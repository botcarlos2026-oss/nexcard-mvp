# NexCard — Auditoría flujo compra → perfil de usuario

**Fecha:** 2026-05-08

## Resumen ejecutivo
Hoy **la compra NO crea automáticamente un perfil de usuario**.

El flujo actual sí crea:
- `orders`
- `order_items`
- email de confirmación
- preferencia de Mercado Pago

Pero **no crea**:
- `profiles`
- vínculo formal `order -> profile`
- vínculo automático `order -> card -> profile`

Además, el flujo privado de perfil tiene roturas estructurales:
1. `/edit` depende de `getClerkUserId()`, pero hoy esa función devuelve siempre `null`.
2. `updateMyProfile()` solo hace `update`; no existe camino de `insert` para un perfil nuevo.
3. `getProfileSlugForOrder()` consulta columnas que **no existen** en `profiles` (`order_id`, `email`).

## Flujo real detectado
### 1) Checkout
La RPC `public.create_order_with_items` solo inserta orden e ítems.

**Fuente:** `supabase/migrations/202605081700_phase0_checkout_hardening.sql:79-124`

No hay creación de perfil en esa RPC.

### 2) Confirmación de orden
El sistema envía email de confirmación de compra, pero el contenido habla de despacho y soporte; no activa perfil ni usuario.

**Fuente:** `supabase/functions/send-order-confirmation/index.ts`

### 3) Pago confirmado
El webhook `mp-webhook` solo actualiza estado de pago/fulfillment en `orders`.

**Fuente:** `supabase/functions/mp-webhook/index.ts`

No crea `profiles`, no crea `cards`, no vincula nada.

### 4) Perfil privado / editor
La ruta `/edit` intenta cargar perfil con `api.getMyProfile()`.

**Fuente:** `src/App.jsx:203-210`

Pero `api.getMyProfile()` depende de `getClerkUserId()`.

**Fuente:** `src/services/api.js:288-295`

Y hoy `getClerkUserId()` está stubbeado a `null`.

**Fuente:** `src/services/supabaseClient.js:11-15`

Resultado operativo: el flujo privado actual queda quebrado para usuarios nuevos y probablemente también para usuarios normales sin parche adicional.

### 5) Setup wizard
`/setup` no crea perfil; solo arma datos y luego llama `handleSave()`.

`handleSave()` termina en `api.updateMyProfile()`.

**Fuentes:**
- `src/App.jsx:238-240`
- `src/App.jsx:324-327`
- `src/services/api.js:298-305`

Eso implica que el setup **asume que el perfil ya existe**. Si no existe, no hay alta.

## Brechas técnicas críticas
### A. No existe alta automática de profile post-compra
Busqué inserts/upserts de `profiles` en frontend, backend y functions y no aparece un camino real de creación post-checkout.

Impacto:
- un cliente puede pagar y seguir sin perfil
- la tarjeta puede quedar operativamente “huérfana”
- depende de trabajo manual en admin

### B. La identidad del perfil está mal conectada al auth actual
`profiles.user_id` es la llave correcta del modelo, pero el frontend sigue dependiendo de helper legacy de Clerk.

Impacto:
- login/registro Supabase no asegura acceso al editor
- `/edit` puede fallar con `No hay sesión activa`
- el setup no puede completar un primer perfil si no existe fila previa

### C. La helper order → profile está rota
`getProfileSlugForOrder()` consulta:
- `profiles.order_id`
- `profiles.email`

Esas columnas no existen en el esquema real. Prueba directa contra DB devolvió:
- `column profiles.order_id does not exist`
- `column profiles.email does not exist`

**Fuente código:** `src/services/api.js:623-640`

El esquema real tiene `contact_email`, no `email`, y no muestra `order_id` en `profiles`.

**Fuente:** `DB_SCHEMA_SUPABASE.sql:39-60` + inspección directa de columnas remotas.

Impacto:
- el admin no puede resolver bien qué slug/perfil corresponde a una orden
- la programación NFC basada en orden queda débil o rota

### D. La compra múltiple por un mismo email está mal modelada si el vínculo es por email
Tu regla de negocio es correcta: **un mismo email puede comprar varias veces**.

Entonces **no conviene** usar `customer_email` como clave única de perfil/orden.

Si intentamos resolver perfiles por email solamente:
- una persona puede comprar 2+ tarjetas
- una empresa puede comprar para terceros usando un mismo correo pagador
- se mezcla comprador con titular final de la tarjeta

## Lectura de negocio
Hoy el checkout funciona como caja, pero **no como activación de producto**.

En términos de operación:
- `order` = venta
- `profile` = activo digital del cliente
- `card` = activo físico/NFC

Esos 3 objetos hoy no están cerrados en un flujo único y confiable.

## Recomendación de arquitectura
## Opción recomendada: separar “comprador” de “titular de perfil”
### Modelo sugerido
1. **La compra crea orden solamente**
   - correcto para caja
2. **Cuando el pago queda confirmado**, crear un registro de activación pendiente por cada tarjeta comprada
   - ejemplo: `profile_claims` / `card_claims` / `activation_tokens`
3. **El cliente recibe email de activación**
   - crea su cuenta o inicia sesión
   - completa setup
4. **Recién ahí se crea el `profile`**
   - vinculado a `user_id`
5. **La tarjeta física/NFC se asigna a ese profile**
   - vía `cards.profile_id`
   - y opcionalmente `cards.order_id`

### Por qué esta opción es la correcta
- no fuerza crear perfiles vacíos al momento de pagar
- soporta múltiples compras por el mismo email
- separa comprador vs usuario final de la tarjeta
- escala mejor para packs, regalos y compras empresa

## Recomendaciones concretas de implementación
### Prioridad 1 — reparar identidad del editor
- reemplazar `getClerkUserId()` por `supabase.auth.getUser()` / sesión real
- hacer que `getMyProfile()` busque por `user_id` real de Supabase
- hacer que `updateMyProfile()` sea `upsert` o `select-then-insert/update`

### Prioridad 2 — definir el momento oficial de creación de profile
Decisión recomendada:
- **NO** crear profile en checkout
- crear profile en **activación/setup posterior al pago**

### Prioridad 3 — crear vínculo formal de activación
Agregar una entidad formal tipo:
- `profile_claims`
  - `id`
  - `order_id`
  - `card_id` (nullable hasta asignación física)
  - `customer_email`
  - `activation_token`
  - `status` (`pending`, `claimed`, `expired`)
  - `claimed_by_user_id`

### Prioridad 4 — arreglar helper order → profile
`getProfileSlugForOrder()` no debe depender de columnas inexistentes.

Opciones sanas:
- resolver por `cards.order_id -> cards.profile_id -> profiles.slug`
- o resolver por tabla de activación formal

### Prioridad 5 — alinear admin con el esquema real
Donde hoy aparece `delivery_address`, `email`, `order_id` en `profiles`, revisar y consolidar contra columnas reales.

## Conclusión
**Hoy NexCard sí vende, pero todavía no activa perfiles de forma confiable tras la compra.**

La brecha principal no es de UX menor; es de modelo operativo:
- la caja ya funciona
- la activación del producto todavía depende de pasos manuales y código legado roto

## Recomendación ejecutiva final
Siguiente sprint técnico:
1. reparar flujo auth/editor con Supabase real
2. definir activación post-pago
3. implementar vínculo formal `order/card/profile`
4. recién después automatizar email de “activa tu NexCard” y programación NFC sobre base estable
