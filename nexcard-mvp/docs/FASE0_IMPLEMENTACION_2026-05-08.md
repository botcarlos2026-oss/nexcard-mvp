# NexCard — Fase 0 implementada (2026-05-08)

## Objetivo
Cerrar los riesgos más caros antes de lanzamiento controlado:
- integridad del cobro
- protección del tracking público
- trazabilidad mínima de despliegue

---

## Qué quedó implementado en código

### 1. Checkout endurecido server-side
Se eliminó la confianza operativa en precios/montos enviados por el navegador.

#### Cambios
- Nueva migración: `supabase/migrations/202605081700_phase0_checkout_hardening.sql`
- `create_order_with_items(...)` ahora:
  - recalcula subtotal desde `products.price_cents`
  - ignora `unit_price_cents` enviados por cliente
  - valida productos activos/no borrados
  - valida cantidades > 0
  - recalcula descuento por cupón desde `wheel_prizes` + `wheel_spins`
  - persiste `order_items.unit_price_cents` con precio canónico de base
  - guarda `orders.amount_cents` desde cálculo server-side

#### Impacto
- baja fuerte del riesgo de manipulación de caja/margen vía DevTools
- la preferencia de pago ya no depende del payload adulterable del frontend

---

### 2. Preferencia de Mercado Pago endurecida
La Edge Function ya no construye la preferencia con `items`, `customerEmail` ni `totalCents` enviados por cliente.

#### Archivo
- `supabase/functions/create-mp-preference/index.ts`

#### Nuevo comportamiento
- recibe solo `orderId`
- consulta `orders` y `order_items` en Supabase con service role
- reconstruye nombres/ítems válidos desde base
- recalcula total desde ítems persistidos
- rechaza desalineación `orders.amount_cents` vs suma de `order_items`

#### Impacto
- el monto cobrado por Mercado Pago ahora nace desde datos persistidos y no desde frontend

---

### 3. Tracking público protegido con `delivery_token`
El tracking dejó de depender solo de `order_id`.

#### Cambios
- `supabase/functions/get-tracking/index.ts`
- `src/components/TrackingPage.jsx`
- `src/App.jsx`
- `supabase/functions/send-shipping-notification/index.ts`
- `src/utils/emailTemplates.js`
- `src/components/OrdersDashboard.jsx`

#### Nuevo comportamiento
- la ruta pública correcta es:
  - `/seguimiento/:orderId/:deliveryToken`
- `get-tracking` exige:
  - `order_id`
  - `delivery_token`
- el frontend público de tracking ya no consulta `orders` directo
- el email y los links nuevos usan token completo
- el enlace antiguo sin token deja de ser válido para tracking público

#### Impacto
- baja fuerte del riesgo de exposición de PII por enumeración de `order_id`
- el tracking público queda alineado con el diseño original del schema

---

### 4. Email/links de seguimiento alineados
#### Cambios
- `src/utils/emailTemplates.js`
- `supabase/functions/send-shipping-notification/index.ts`
- `src/components/OrdersDashboard.jsx`

#### Resultado
- todos los links nuevos de seguimiento quedan tokenizados
- el admin abre el tracking con token cuando está disponible

---

## Cambios de frontend asociados

### `src/services/api.js`
- `createOrder` ya no depende del precio enviado por cliente para persistencia real
- se envía `coupon_code` para validación server-side
- el email usa `order_items` persistidos como fuente más confiable

### `src/components/CheckoutForm.jsx`
- la invocación a `create-mp-preference` ahora manda solo `orderId`

---

## Validación ejecutada
### Build
- `npm run build` → **OK**

---

## Pendientes externos de Fase 0
Estos no se pueden cerrar solo editando el repo.

### A. Aplicar migración en Supabase
Aplicar:
- `supabase/migrations/202605081700_phase0_checkout_hardening.sql`

### B. Desplegar funciones actualizadas
Re-deploy de:
- `create-mp-preference`
- `get-tracking`
- `send-shipping-notification`

### C. Activar Mercado Pago producción
Pendiente externo:
- `MP_ACCESS_TOKEN` productivo
- primer pago real de validación
- revisión webhook productivo

### D. Billing de Vercel
Pendiente externo:
- agregar medio de pago / resolver trial

### E. QA mínimo reproducible
Sigue pendiente cerrar variables E2E mínimas:
- `CYPRESS_login_email`
- `CYPRESS_login_password`

---

## Smoke test recomendado post-deploy

### Cobro
1. crear orden real desde checkout
2. verificar que `orders.amount_cents` coincide con suma canónica de `order_items`
3. abrir MP y confirmar monto correcto
4. completar pago de prueba real/controlado
5. verificar webhook + admin

### Tracking
1. despachar una orden con `tracking_code`
2. abrir link tokenizado del email
3. confirmar que carga seguimiento
4. probar `/seguimiento/:orderId` sin token
5. confirmar que ya no expone datos

### Admin
1. abrir orden despachada
2. verificar botón “Ver seguimiento” con token
3. enviar email de despacho
4. confirmar link funcional

---

## Riesgo residual después de esta Fase 0
Se reducen dos riesgos grandes, pero todavía quedan:
- whitelist admin hardcodeada
- acoplamiento alto en `App.jsx` y `api.js`
- drift potencial entre frontend / SQL / Edge Functions
- QA incompleto por entorno E2E sin cerrar

---

## Recomendación inmediata
Después de desplegar esto, el siguiente paso correcto es:
1. validar pago real
2. validar tracking real
3. cerrar smoke reproducible
4. recién ahí abrir lanzamiento controlado
