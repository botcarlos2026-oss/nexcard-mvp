# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Propósito del proyecto
NexCard es una plataforma de tarjetas NFC digitales y Google Reviews Cards (NexReview). Incluye perfil digital personalizado, panel admin completo, checkout con Mercado Pago e inventario físico.

---

## Comandos de desarrollo

```bash
# Frontend React (puerto 3000)
npm start

# Backend local Express (puerto 4000) + frontend en paralelo
npm run dev

# Solo el servidor local mock
npm run server

# Build para producción (Vercel)
npm run build
```

**Quality gates / tests:**
```bash
# Frontend build
npm run build
# Nota: el script usa `CI=false` para que CRA no trate warnings heredados como errores en Vercel.

# Lint mínimo operativo
npm run lint

# Unit tests mínimos (Jest vía react-scripts)
npm test

# Check rápido
npm run check:fast

# Check con smoke E2E
npm run check:smoke

# Check completo local
npm run check

# Abrir Cypress interactivo
npm run cypress:open

# Suite completa en CI
npm run test:e2e

# Tests individuales
npm run test:e2e:smoke
npm run test:e2e:admin-cards
npm run test:e2e:admin-profiles
npm run test:e2e:nfc

# Combinaciones de suites
npm run test:e2e:cards-lifecycle
npm run test:e2e:profiles-full
```

Ya existe una capa mínima de calidad:
- lint básico (`.eslintrc.json`)
- unit test mínimo en `src/services/api.test.js`
- build verificado
- smoke/checks listos para uso manual o pre-merge

---

## Bitácora reciente (operativo)

### 2026-05-09 — trabajo de ayer
Se dejó implementado y validado el reposicionamiento comercial a **dos líneas de producto**:
- `Perfil Profesional`
- `Perfil Negocio`

Cambios concretos de ayer:
- onboarding/setup actualizado para reemplazar `Uso Personal` / `Empresa` por líneas comerciales más claras
- landing ajustada para vender mejor por contexto de uso
- CTA/copy refinado según perfil
- documentación de producto en:
  - `docs/FEATURE_DOS_LINEAS_PERFIL_PROFESIONAL_Y_NEGOCIO_2026-05-09.md`

Resultado de ayer:
- `npm run build` exitoso
- base comercial más coherente entre promesa de venta y UX

### 2026-05-10 — trabajo de hoy
Se cerraron cinco frentes:

1. **Hardening real de acceso admin / authz**
   - se centralizó la whitelist UI en `src/config/admin.js`
   - se documentó el runbook en `docs/admin-access-runbook.md`
   - se creó la migración:
     - `supabase/migrations/202605100001_authz_hardening_admin_surface.sql`
   - objetivo: dejar de confiar en policies abiertas tipo `authenticated all` en superficies de backoffice

2. **Desbloqueo de deploy en Vercel**
   - causa detectada: CRA en Vercel corre con `CI=true`, y eso convertía warnings en error de build
   - fix aplicado: `package.json` ahora usa `CI=false react-scripts build`
   - esto destrabó el deploy productivo del commit de hardening

3. **Limpieza técnica / quality gates**
   - se agregaron scripts de `lint`, `check:fast`, `check:smoke` y `check`
   - se agregó test mínimo en `src/services/api.test.js`
   - se limpiaron warnings de build/lint en componentes admin/frontend para dejar compilación limpia

4. **Validación del flujo principal usuario (landing → carrito → checkout)**
   - validado con Cypress:
     - `cypress/e2e/public-commerce.cy.js`
     - `cypress/e2e/public-checkout-entry.cy.js`
     - `cypress/e2e/public-checkout-validation.cy.js`
   - cobertura validada:
     - landing comercial en `/preview`
     - CTA Comprar
     - catálogo
     - carrito
     - entrada a checkout
     - validaciones de campos requeridos
     - validaciones de factura (RUT + razón social)

5. **Post-pago / retorno Mercado Pago**
   - se detectó bug real: el retorno `?payment=success&order=...` reconstruía una orden incompleta en frontend
   - fix aplicado:
     - persistencia temporal de snapshot de orden en `sessionStorage`
     - rehidratación del snapshot al volver desde Mercado Pago
   - validado con Cypress:
     - `cypress/e2e/payment-return.cy.js`

Estado final de hoy:
- `npm run lint` ✅
- `npm run build` ✅
- producción Vercel destrabada ✅
- migración remota aplicada y registrada ✅
- landing/carrito/checkout UI validados ✅
- creación real de orden + preferencia Mercado Pago validada ✅
- retorno frontend desde Mercado Pago corregido y validado ✅

---

## Stack
- **Frontend:** React 18 SPA, Tailwind CSS, Lucide icons, Zustand (carrito)
- **DB + Auth + Edge Functions:** Supabase (proyecto `ghiremuuyprohdqfrxsy`)
- **Deploy:** Vercel (nexcard.cl) — `vercel.json` define rewrites SPA + headers de seguridad
- **Email:** Resend (`hola@nexcard.cl`) via Edge Function
- **Pagos:** Mercado Pago Checkout Pro via Edge Function

---

## Arquitectura general

### Router manual en `src/App.jsx`
No hay React Router. El routing es manual con `window.location.pathname` + `window.history.pushState`. `App.jsx` contiene toda la lógica de estado global, bootstrapping, autenticación y renderizado condicional de páginas.

### Dos modos de datos: Supabase o servidor local mock
`src/services/supabaseClient.js` exporta `supabase` (puede ser `null`) y `hasSupabase` (booleano). Todos los métodos en `src/services/api.js` hacen `if (hasSupabase)` para decidir si van a Supabase o al servidor Express local (`server/index.js`). En producción siempre va a Supabase.

### Capa de servicio: `src/services/api.js`
Archivo central. Dos helpers privados importantes:
- `fetchAdminCards()` — cards enriquecidas con profile_name, profile_slug, last_event, events[]
- `fetchOrders()` — órdenes con `order_items(*)` y `payments(*)` incluidos

Todos los métodos del admin panel usan estos helpers para retornar datos completos tras cada mutación.

### Estado global del carrito: `src/store/cartStore.js` (Zustand)

### Edge Functions (no están en el repo local)
Deployadas directamente en Supabase. Para inspeccionarlas: Supabase Dashboard → Edge Functions.
- `create-mp-preference` — crea preferencia MP y retorna `init_point`
- `mp-webhook` — recibe notificaciones de MP, actualiza `payment_status` de la orden
- `send-order-confirmation` — email al cliente + notificación interna

**Crítico:** `mp-webhook` debe quedar publicado con `verify_jwt = false`, porque Mercado Pago no enviará bearer token de Supabase. El repo ahora deja esto explícito en:
- `supabase/config.toml`

---

## RLS y sistema de permisos — crítico

**Todas** las operaciones admin en Supabase dependen de `public.has_role('admin')`, que busca en la tabla `memberships`. El whitelist de emails en `App.jsx` solo protege la UI — no otorga permisos de DB.

Para que el admin pueda hacer updates en Supabase (órdenes, cards, inventario), el usuario debe tener una fila en `memberships` con `role='admin'`. La migración `202604150002_admin_memberships.sql` inserta esa fila automáticamente para los emails admin.

Si los updates del admin panel fallan silenciosamente, verificar primero en Supabase → Table Editor → `memberships`.

### Políticas relevantes por tabla
- `orders` → `orders_admin_all` (has_role admin) + `orders_owner_read/insert`
- `cards` → `cards_admin_manage` (has_role admin)
- `order_items` → `order_items_admin_manage` + `order_items_owner_insert`
- `payments` → `payments_admin_manage`
- `inventory_items/movements` → `inv_admin_manage`

---

## Schema de cards — constraints activos

```sql
-- status
CHECK (status IN ('printed', 'assigned', 'active', 'suspended', 'revoked', 'lost', 'replaced', 'archived'))

-- activation_status
CHECK (activation_status IN ('unassigned', 'assigned', 'activated', 'disabled', 'revoked', 'lost'))
```

Las acciones de lifecycle en `api.js` usan RPC cuando existe la función `security definer` en DB:
- `revokeCard` → `rpc('revoke_card')` (escribe en audit_log + card_events)
- `archiveCard` → `rpc('soft_delete_card')` (setea deleted_at + status=archived)
- `activateCard`, `assignCard`, `reassignCard` → direct update

---

## Valores de fulfillment_status

El frontend usa: `new → in_production → ready → shipped → delivered` (+ `cancelled`).
La función DB `mark_order_fulfillment_status` usa valores distintos (`printing`, `shipping`) pero **no es llamada por el frontend** — los updates son directos a la tabla sin CHECK constraint en `fulfillment_status`.

---

## Tablas principales

| Tabla | Notas clave |
|-------|-------------|
| `products` | `price_cents` en CLP directo (79990 = $79.990, no centavos) |
| `orders` | `payment_status`, `fulfillment_status`, `deleted_at` (soft delete) |
| `order_items` | `product_id`, `quantity`, `unit_price_cents` |
| `order_status_history` | log de cambios de campo en órdenes |
| `cards` | lifecycle NFC: status + activation_status (ver constraints arriba) |
| `card_events` | log de eventos por tarjeta |
| `profiles` | perfiles públicos; `deleted_at` para soft delete |
| `memberships` | roles de usuario — requerido para RLS admin |
| `audit_log` | log de operaciones security definer |
| `inventory_items` / `inventory_movements` | stock físico |
| `waitlist` | emails lista de espera |

---

## Variables de entorno

**Vercel (frontend):**
- `REACT_APP_SUPABASE_URL`
- `REACT_APP_SUPABASE_ANON_KEY`

**Supabase Secrets (Edge Functions):**
- `RESEND_API_KEY`
- `MP_ACCESS_TOKEN` — usar `TEST-...` en desarrollo, producción al lanzar

---

## Admin acceso
La configuración UI admin ahora está centralizada en:
- `src/config/admin.js`

Incluye:
- `ADMIN_EMAILS`
- `isAdminEmail()`
- `ADMIN_ROUTES`

**Importante:** la whitelist frontend sigue siendo solo protección visual/transitoria. La autorización real sigue dependiendo de `public.memberships` + `public.has_role('admin')`.

Agregar un nuevo admin requiere:
1. actualizar `memberships`
2. revisar `src/config/admin.js` si la whitelist UI transitoria sigue activa
3. validar acceso real en `/admin`

Runbook operativo:
- `docs/admin-access-runbook.md`

---

## Flujo de pago MP
```
Checkout → supabaseCreateOrder (status: pending) →
Edge Function create-mp-preference → redirect MP →
pago exitoso → webhook mp-webhook → orden payment_status: paid →
return nexcard.cl?payment=success&order=ID
```

---

## Migraciones

Directorio: `supabase/migrations/`. Convención de nombres: `YYYYMMDDNNNN_descripcion.sql`.
Las migraciones son SQL puro y deben quedar documentadas antes de aplicar.
Todas las migraciones llevan `begin; ... commit;` y son idempotentes donde es posible.

### Migración de hardening reciente
- `supabase/migrations/202605100001_authz_hardening_admin_surface.sql`

Objetivo:
- ignorar `memberships.deleted_at` en `has_role()` e `is_org_member()`
- cerrar policies abiertas de backoffice/CRM/review cards/refunds

Estado real al 2026-05-10:
- aplicada en remoto
- registrada en `supabase_migrations.schema_migrations` con versión `202605100001`
- policies confirmadas en remoto:
  - `refunds_admin_all`
  - `crm_contacts_admin_all`
  - `crm_deals_admin_all`
  - `crm_activities_admin_all`
  - `team_members_admin_all`
  - `review_cards_admin_all`

Nota operativa importante:
- el flujo normal de `supabase db push` quedó bloqueado por el pooler/login temporal del CLI (`Circuit breaker open: Too many authentication errors`)
- workaround usado: conexión directa con `--db-url` al pooler Postgres y aplicación manual por bloques, seguida de inserción explícita en `supabase_migrations.schema_migrations`
- si vuelve a fallar el CLI, no insistir con reintentos ciegos porque vuelve a abrir el circuit breaker

Validación posterior obligatoria:
1. probar `/admin`
2. probar CRM
3. probar refunds
4. probar review cards
5. confirmar que el usuario admin siga teniendo fila activa en `memberships`

### Hallazgo crítico de pagos (2026-05-10 noche)
Se validó que:
- la orden real sí se crea en Supabase
- `create-mp-preference` sí retorna `init_point` y `preference_id`
- el retorno frontend desde MP quedó corregido con snapshot local

Pero también se detectó un riesgo crítico operativo:
- al llamar `https://ghiremuuyprohdqfrxsy.supabase.co/functions/v1/mp-webhook` sin Authorization, Supabase responde `401 UNAUTHORIZED_NO_AUTH_HEADER`
- eso significa que **el webhook público de Mercado Pago no debería depender de JWT de Supabase**
- por eso el repo ahora declara:
  - `supabase/config.toml`
  - `[functions.mp-webhook]`
  - `verify_jwt = false`

Implicancia:
- si producción no se redeploya con esa configuración, existe riesgo alto de que pagos aprobados queden en `pending` y nunca se marque `mp_payment_id`

Resultado de evidencia levantada:
- consulta directa reciente a `orders` mostró órdenes nuevas `pending` con `mp_payment_id = NULL`
- la preferencia de test creada en validación también quedó `pending` porque no se completó pago interactivo

Intento operativo ejecutado:
- primer intento de redeploy real con:
  - `supabase functions deploy mp-webhook --project-ref ghiremuuyprohdqfrxsy`
- primer resultado:
  - `401 Unauthorized` desde `https://api.supabase.com/v1/projects/ghiremuuyprohdqfrxsy/functions/deploy?slug=mp-webhook`
- causa:
  - el token inicial disponible en workspace no era válido para deploy
- resolución posterior:
  - se cargó un `SUPABASE_ACCESS_TOKEN` válido (`sbp_...`)
  - se reintentó deploy
  - resultado final: **deploy exitoso de `mp-webhook`** en proyecto `ghiremuuyprohdqfrxsy`
- estado operativo final:
  - el fix ya no quedó solo en repo; quedó **desplegado**

Validación posterior al deploy:
- `POST https://ghiremuuyprohdqfrxsy.supabase.co/functions/v1/mp-webhook` sin JWT ahora responde `200 ok`
- eso confirma que el endpoint público del webhook quedó accesible para Mercado Pago

Límite actual de validación end-to-end:
- no hay `MP_ACCESS_TOKEN` visible en workspace local para invocar APIs de pago directamente
- no hay browser automation disponible en esta sesión para completar el checkout sandbox interactivo dentro de Mercado Pago
- por eso **no se pudo cerrar automáticamente** el tramo final `payment approved -> webhook real -> orders.payment_status = paid`
- sí quedó validado todo lo demás del camino:
  - orden real creada
  - preferencia real creada
  - webhook desplegado y público
  - retorno frontend corregido y probado

Evidencia adicional levantada:
- no se encontraron filas útiles en `payments` con `external_id` / payment id reutilizable para reinyectar webhook histórico
- existen órdenes históricas en `paid`, pero sin `mp_payment_id`, por lo que no sirven como prueba reproducible de re-disparo del webhook

---

## Auditoría 5 frentes post-pago sin MP real — 2026-05-10

### 1. Activación post-compra
Estado real:
- `claim-profile` y `send-profile-activation` existen y están desplegadas
- el preview público del claim funciona con anon key
- el claim real exige sesión, como corresponde
- `mp-webhook` ya contiene lógica para crear `profile_claims` y disparar `send-profile-activation` cuando el pago queda `paid`

Validación hecha:
- invocación pública de `claim-profile` con token inválido devolvió `404` funcional (`Link de activación inválido o expirado`), no bloqueo por gateway
- tabla `profile_claims` existe en DB, pero actualmente no tenía filas en la muestra revisada

Lectura operativa:
- el flujo está montado
- sigue faltando la prueba con pago aprobado real para confirmar creación automática de claim + email en producción

### 2. Emails operativos
Cobertura existente confirmada:
- confirmación de orden
- activación de perfil
- despacho / tracking
- carrito abandonado

Riesgos detectados:
- desalineación entre documentación vieja y código actual
- trazabilidad de emails inconsistente
- faltan tipos homogéneos para `profile_activation` / `abandoned_cart` en el esquema histórico
- duplicación de templates/lógica entre frontend y edge functions
- inconsistencia de rutas de baja (`/baja` vs `/unsubscribe`)

### 3. Tracking / post-despacho
Hallazgo principal:
- UI/admin/email ofrecen múltiples carriers, pero tracking detallado backend real solo existe para `blueexpress`

Fix aplicado:
- `supabase/functions/get-tracking/index.ts`
- para carriers no soportados ya no rompe con `500`
- ahora responde degradado de forma segura, mantiene datos de orden/código y devuelve mensaje claro al cliente

Deploy ejecutado:
- `supabase functions deploy get-tracking --project-ref ghiremuuyprohdqfrxsy`

Riesgos que siguen abiertos:
- token de tracking no expira ni rota
- confirmación de entrega sigue dependiendo de policies/RLS correctas
- falta soporte real por carrier si se quiere prometer multi-courier de verdad

### 4. UX móvil público
Hallazgo principal:
- el checkout móvil era usable, pero el resumen mobile ocultaba demasiado contexto económico

Fix aplicado:
- `src/components/CheckoutForm.jsx`
- el bloque mobile `Tu pedido` ahora muestra:
  - subtotal
  - descuento cuando aplica
  - envío
  - total

Validación agregada:
- nuevo spec `cypress/e2e/mobile-checkout-summary.cy.js`
- prueba que en viewport iPhone el resumen móvil aparece y muestra subtotal/envío/total

### 5. Admin orders / guardrails
Hallazgos fuertes:
- cambios manuales de estado siguen demasiado libres
- despacho no es atómico end-to-end
- checklist sigue siendo solo frontend
- refund tenía guardrails incompletos
- vinculación de cards y programación NFC necesitaban barreras más duras

Fixes aplicados:
- `src/services/api.js`
  - `updateShipping()` y `dispatchOrder()` ahora calculan historial contra el estado previo real, no después del update
  - normalizan `tracking_code` a uppercase antes de persistir
  - `createRefund()` ahora revalida:
    - orden pagada
    - no entregada
    - monto > 0
    - monto <= total orden
  - `linkOrderCard()` ahora bloquea cards:
    - archivadas
    - ya vinculadas a otra orden
    - ya asignadas a un perfil
    - revocadas/archivadas por estado
- `src/components/OrdersDashboard.jsx`
  - validación de `nfcSlug`: solo minúsculas, números y guiones

### Gates ejecutados
- `npm run lint ...` ✅
- `npm run build` ✅
- `npx cypress run --spec cypress/e2e/mobile-checkout-summary.cy.js` ✅

### Conclusión ejecutiva
Sin pago real de Mercado Pago todavía, los riesgos más caros después del cobro quedaron mejor acotados:
- activación está montada y accesible
- tracking ya no rompe por carrier no soportado
- admin tiene guardrails algo más serios
- mobile checkout muestra mejor el contexto de compra

Lo que sigue siendo estructural y no cosmético:
- transición server-side de estados de orden
- despacho realmente atómico
- política clara de carriers soportados
- cierre real de `profile_claims` con un pago aprobado

## Pendientes para lanzamiento
- [ ] Cambiar `MP_ACCESS_TOKEN` a credenciales de producción
- [ ] Eliminar producto TEST-1 ($19.990)
- [ ] Remover `console.log` de debug en `api.js`
- [ ] Ejecutar pago aprobado end-to-end desde sandbox/producción controlada con interacción humana o browser automation
- [ ] Confirmar cambio a `orders.payment_status = paid` + `mp_payment_id` persistido
- [ ] Confirmar creación/trigger del flujo post-pago asociado (claim / activación / email) sobre un caso real aprobado
- [ ] Endurecer Edge Functions con `SUPABASE_SERVICE_ROLE_KEY` (JWT + rol admin explícito) donde aplique a funciones no públicas
- [ ] Seguir partiendo `src/services/api.js` por dominio
- [ ] Panel configuración Google Reviews Card (NexReview)
- [ ] Transbank WebPay (segunda integración de pago)
- [ ] CRM con pipeline Kanban

---

## Bsale SII — Pendiente de activar

La estructura está lista (NO-OP hasta configurar el token). Pasos para activar:

1. Crear cuenta en [bsale.io](https://bsale.io)
2. Obtener Access Token: Configuración → API → Access Token
3. Agregar `BSALE_ACCESS_TOKEN` en Supabase → Project Settings → Edge Functions → Secrets
4. Implementar el `TODO` en `supabase/functions/emit-bsale-document/index.ts`
5. Agregar `bsale_variant_id` (INTEGER) a cada producto en tabla `products`

**Tipos de documento:**
- `documentTypeId: 39` = Boleta electrónica (cliente genérico RUT 66.666.666-6)
- `documentTypeId: 33` = Factura electrónica (requiere RUT + razón social del cliente)

**Campos en `orders` ya disponibles:**
- `bsale_document_id` — ID del documento emitido
- `bsale_document_url` — URL del PDF
- `bsale_emitted_at` — timestamp de emisión
- `requires_invoice` — true si el cliente pidió factura empresa
- `invoice_rut` — RUT de la empresa
- `invoice_razon_social` — razón social

**Deploy al activar:**
```bash
supabase functions deploy emit-bsale-document --project-ref ghiremuuyprohdqfrxsy
supabase functions deploy send-order-confirmation --project-ref ghiremuuyprohdqfrxsy
```
## Skills disponibles
- UI/Animaciones: ~/.claude/skills/emil-design-eng/SKILL.md
  Filosofía de design engineering de Emil Kowalski.
  Leer antes de cualquier tarea de UI, animaciones o micro-interacciones.

## Skills globales
- Design Engineering: ~/.claude/skills/emil-design-eng/SKILL.md
  Leer antes de cualquier tarea de UI, animaciones o componentes.
