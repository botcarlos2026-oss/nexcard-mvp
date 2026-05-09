# NexCard — Plan de activación de perfil post-pago

**Fecha:** 2026-05-08

## Objetivo
Cerrar el hueco entre:
- **venta** (`orders`)
- **activo físico** (`cards`)
- **activo digital** (`profiles`)

Sin asumir que el email del comprador equivale al titular final de la tarjeta.

## Principio rector
**No crear el profile en checkout.**

La compra confirma intención de pago, no identidad final del titular.

## Modelo recomendado
### Etapa 1 — Checkout
Crear solo:
- `orders`
- `order_items`
- preferencia MP
- email de confirmación de compra

### Etapa 2 — Pago confirmado
Cuando `mp-webhook` marque la orden como `paid`:
- crear uno o más registros de activación pendiente
- uno por tarjeta/unidad despachable

### Entidad sugerida
`profile_claims`

Campos sugeridos:
- `id uuid`
- `order_id uuid not null`
- `card_id uuid null`
- `customer_email text not null`
- `claim_token text unique not null`
- `quantity integer not null default 1`
- `status text not null check (status in ('pending','claimed','expired','cancelled'))`
- `claimed_by_user_id uuid null`
- `claimed_profile_id uuid null`
- `expires_at timestamptz null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

## Flujo objetivo
### 1. Compra
Cliente paga una o varias tarjetas.

### 2. Webhook pago aprobado
Sistema:
- actualiza `orders.payment_status = paid`
- crea `profile_claims`
- envía email: **Activa tu NexCard**

### 3. Activación
Usuario abre link:
- si no tiene cuenta → registra auth
- si ya tiene cuenta → login
- completa setup
- sistema crea `profiles.user_id = auth.uid()` si no existe
- sistema marca claim como `claimed`

### 4. Asignación física
Cuando exista `card_id` disponible:
- vincular `cards.order_id`
- vincular `cards.profile_id`
- dejar `activation_status/status` coherente

## Beneficios
- soporta múltiples compras por el mismo email
- soporta packs
- soporta regalos o compras para terceros
- separa comprador vs titular
- reduce trabajo manual y errores de operación

## Fixes base ya aplicados en esta intervención
1. **Supabase Auth real para perfil privado**
   - el helper legacy de Clerk ahora lee la sesión/auth local real
2. **`/edit` redirige a `/setup` si no existe profile**
3. **`updateMyProfile()` ahora puede crear el primer profile**
   - ya no asume que la fila existe
4. **`getProfileSlugForOrder()` ya no consulta columnas inexistentes**
   - ahora intenta resolver por `cards.order_id -> profiles`
   - fallback por `profiles.contact_email`

## Próximo sprint técnico recomendado
### Sprint A — Estabilización auth/profile
- revisar editor privado end-to-end con usuario real
- revisar uploads de avatar/cover con usuario Supabase
- smoke test de setup nuevo

### Sprint B — Activación post-pago
- migración `profile_claims`
- function `claim-profile`
- email `activate-profile`
- pantalla `/activar/:token`

### Sprint C — Integración con tarjetas
- alinear claim con `cards`
- soportar múltiple cantidad por orden
- asignación NFC con vínculo formal

## Riesgo si no se hace
- clientes pagos sin perfil activo
- tarjetas huérfanas
- operación manual no escalable
- errores al reusar mismo email en múltiples órdenes

## Recomendación ejecutiva
La mejor inversión ahora no es seguir puliendo checkout. Es **cerrar activación post-pago** para convertir venta en producto usable.