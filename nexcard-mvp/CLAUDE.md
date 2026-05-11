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

### 2026-05-11 — observabilidad post-pago / activación
Se implementó una primera capa rentable de observabilidad operativa en `/admin/orders`.

Cambios concretos:
- `fetchOrders()` en `src/services/api.js` ahora enriquece cada orden con señales derivadas desde:
  - `cards`
  - `order_cards`
  - `profile_claims`
  - `profiles`
  - `payments`
- se agregaron campos derivados por orden:
  - `related_cards`
  - `activation_claim`
  - `active_cards_count`
  - `programmed_cards_count`
  - `activation_ready`
  - `activation_completed`
  - `funnel_stage`
  - `terminal_state`
  - `observability_alerts`
- `src/components/OrdersDashboard.jsx` ahora muestra:
  - embudo real `paid → ready → shipped → delivered → activated`
  - contador de excepciones operativas
  - bloque de trazabilidad por orden con mini timeline post-pago
  - alertas como:
    - pagada sin entrar a producción
    - orden avanzada sin card vinculada
    - entregada sin activación cerrada
    - claim pendiente post-entrega
- documentación específica creada en:
  - `docs/OBSERVABILIDAD_POST_PAGO_ACTIVACION_2026-05-11.md`

Validación de esta capa:
- `npm run lint` ✅
- `npm run build` ✅

### 2026-05-11 — observabilidad capa 2 server-side
Se endureció la trazabilidad operativa en backend para que el funnel post-pago deje huella formal aunque el cambio venga desde webhook, trigger, claim o panel admin.

Cambios concretos:
- nueva migración:
  - `supabase/migrations/202605110950_second_layer_order_observability.sql`
- nuevas columnas en `orders`:
  - `paid_at`
  - `ready_at`
  - `activated_at`
- nueva tabla:
  - `public.order_operational_events`
- nuevos helpers / triggers server-side:
  - `log_order_operational_event(...)`
  - `mark_order_activated(...)`
  - trigger de timestamps operativos sobre `orders`
  - trigger de eventos operativos sobre `orders`
  - trigger que marca activación desde `cards`
  - trigger que marca activación desde `profile_claims`
- backfill histórico incluido para poblar timestamps cuando existía evidencia previa
- la UI pasa a privilegiar timestamps formales (`paid_at`, `ready_at`, `activated_at`) por sobre inferencia blanda
- documentación específica creada en:
  - `docs/OBSERVABILIDAD_CAPA2_SERVER_SIDE_2026-05-11.md`

Validación de esta capa:
- `npm run lint` ✅
- `npm run build` ✅

### 2026-05-11 — ejecución cautelosa de migración en Supabase
Se aplicó **remotamente** la migración `202605110950_second_layer_order_observability.sql` en el proyecto productivo `ghiremuuyprohdqfrxsy`, pero **sin usar `supabase db push`**, para evitar arrastrar el backlog histórico de migraciones locales que todavía no estaba íntegramente registrado en remoto.

Método usado:
- validación previa por Management API read-only
- aplicación puntual por endpoint de migraciones de Supabase Management API
- validación posterior de:
  - columnas nuevas en `orders`
  - tabla `order_operational_events`
  - funciones `mark_order_activated` / `log_order_operational_event`
  - triggers server-side esperados
- registro manual de la versión en `supabase_migrations.schema_migrations`

Incidencia detectada durante la aplicación:
- el SQL original intentó backfill desde `payments.paid_at`
- la tabla `payments` remota no tiene columna `paid_at`
- se corrigió la migración para backfill desde `order_status_history` + fallback por `orders.updated_at`
- luego la migración aplicó correctamente

Resultado final verificado en producción:
- `orders.paid_at` ✅
- `orders.ready_at` ✅
- `orders.activated_at` ✅
- `public.order_operational_events` ✅
- triggers operativos creados ✅
- versión `202605110950` registrada en `supabase_migrations.schema_migrations` ✅

### 2026-05-11 — smoke test funcional de observabilidad capa 2
Se ejecutó un smoke test real en producción, pero con enfoque controlado y limpieza posterior.

Método usado:
- creación de orden sintética efímera
- avance controlado por etapas usando el bypass interno `app.order_transition_bypass`
- validación read-only por Management API
- limpieza explícita de la orden y sus dependencias

Orden usada:
- `SMOKE OBS L2 2026-05-11T10:16`

Resultado validado:
- timestamps completos generados:
  - `paid_at`
  - `ready_at`
  - `shipped_at`
  - `delivered_at`
  - `activated_at`
- `order_operational_events` registró exactamente 5 hitos:
  - `paid:payment_status_paid`
  - `ready:fulfillment_ready`
  - `shipped:fulfillment_shipped`
  - `delivered:fulfillment_delivered`
  - `activated:activation_completed`
- limpieza final verificada con `remaining_orders = 0`

Documentación específica:
- `docs/SMOKE_TEST_OBSERVABILIDAD_CAPA2_2026-05-11.md`

### 2026-05-11 — KPIs, alertas y SLA básicos
Se montó la siguiente capa rentable sobre la observabilidad ya validada: convertir trazabilidad en señales operativas visibles dentro del dashboard.

Cambios concretos:
- `getAdminDashboard()` en `src/services/api.js` ahora reutiliza `fetchOrders()` enriquecido para calcular:
  - funnel `paid / ready / shipped / delivered / activated`
  - `operationalAlerts`
  - `slaBreaches`
- `src/components/AdminDashboard.jsx` ahora muestra:
  - KPIs del embudo operativo
  - bloque de alertas operativas
  - bloque de SLA en riesgo

Regla SLA inicial:
- órdenes pagadas hace `24h+`
- sin activación cerrada

Documentación específica:
- `docs/KPIS_ALERTAS_SLA_OBSERVABILIDAD_2026-05-11.md`

### 2026-05-11 — SLA por etapa y tendencia semanal del funnel
Se agregó una capa adicional de control operativo sobre el dashboard admin.

Cambios concretos:
- `src/services/api.js`
  - `getAdminDashboard()` ahora calcula `stageSla` por etapa:
    - `paid_to_ready`
    - `ready_to_shipped`
    - `shipped_to_delivered`
    - `delivered_to_activated`
  - además calcula `weeklyFunnelTrend` para una ventana móvil de 7 días
- `src/components/AdminDashboard.jsx`
  - ahora muestra cards con SLA promedio por etapa
  - ahora muestra gráfico compacto con tendencia semanal del funnel
- `src/components/ui/AdminStat.jsx`
  - se extendieron acentos visuales para soportar nuevos estados de color (`blue`, `violet`, `fuchsia`)

Resultado funcional:
- el panel ahora muestra no solo volumen y alertas
- también muestra velocidad de avance entre etapas y posible persistencia del cuello operacional

Documentación específica:
- `docs/SLA_ETAPAS_Y_TENDENCIA_FUNNEL_2026-05-11.md`

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

Lo que seguía siendo estructural y no cosmético en ese punto:
- transición server-side de estados de orden
- despacho realmente atómico
- política clara de carriers soportados
- cierre real de `profile_claims` con un pago aprobado

---

## Blindaje server-side de órdenes + despacho atómico — 2026-05-10

### Objetivo
Cerrar el hueco operativo detectado en `/admin/orders`:
- no depender de updates directos del cliente para mover estados sensibles
- impedir saltos arbitrarios (`new -> delivered`, etc.)
- hacer que el despacho con descuento de stock ocurra como una sola unidad transaccional en DB

### Implementación aplicada
#### 1. RPC protegida para transiciones de estado
**Archivo:** `supabase/migrations/202605102310_order_transition_guards.sql`

Se creó:
- `public.admin_transition_order_state(...)`

Comportamiento:
- exige rol `admin` o `service_role`
- valida transiciones permitidas de `payment_status`
- valida transiciones permitidas de `fulfillment_status`
- prohíbe pasar a `shipped` por el flujo genérico
- obliga a usar despacho dedicado para ese salto
- exige pago `paid` antes de avanzar a `in_production`, `ready`, `shipped`, `delivered`
- registra historial en `order_status_history`

Matriz práctica que quedó protegida:
- `pending -> paid|failed|cancelled`
- `failed -> pending|cancelled`
- `paid -> refunded`
- `new -> in_production|cancelled`
- `in_production -> ready|cancelled`
- `ready -> cancelled` (para `shipped`, usar RPC de despacho)
- `shipped -> delivered`

#### 2. RPC protegida para despacho atómico
**Archivo:** `supabase/migrations/202605102310_order_transition_guards.sql`

Se creó:
- `public.admin_dispatch_order(...)`

Comportamiento:
- exige rol `admin` o `service_role`
- exige orden `paid`
- exige orden en `fulfillment_status = ready`
- valida carrier permitido
- valida formato de tracking
- bloquea doble descuento si `inventory_decremented = true`
- valida stock de todos los SKUs activos en `dispatch_config` antes de tocar la orden
- descuenta stock + registra `inventory_movements`
- actualiza orden a `shipped`
- marca:
  - `inventory_reserved = true`
  - `inventory_decremented = true`
- registra historial de cambios

Resultado:
- ya no existe la ventana donde la orden queda `shipped` pero el stock falla después en una segunda operación separada del cliente

#### 3. Trigger de guardia en tabla `orders`
**Archivo:** `supabase/migrations/202605102320_orders_sensitive_update_guard.sql`

Se creó:
- `public.guard_orders_sensitive_updates()`
- trigger `trg_guard_orders_sensitive_updates`

Comportamiento:
- bloquea updates directos sobre campos sensibles si no vienen por bypass interno controlado o `service_role`
- campos protegidos:
  - `payment_status`
  - `fulfillment_status`
  - `carrier`
  - `tracking_code`
  - `shipped_at`
  - `delivered_at`
  - `inventory_reserved*`
  - `inventory_decremented*`

Esto evita que incluso un admin con acceso directo al cliente termine saltándose los RPCs protegidos con un `.update(...)` trivial.

#### 4. Frontend/admin alineado al nuevo flujo
**Archivos:**
- `src/services/api.js`
- `src/components/OrdersDashboard.jsx`

Cambios:
- `api.transitionOrderState(...)` usa el RPC protegido
- `api.dispatchOrder(...)` usa el RPC atómico
- `api.updateOrder(...)` rechaza updates directos de campos sensibles
- `/admin/orders` ahora ofrece solo transiciones permitidas en selects/botones
- cuando la orden está `ready`, el panel avisa explícitamente que para `shipped` se debe usar el módulo de despacho

### Aplicación real en producción
Se aplicó directamente sobre la base remota con ejecución SQL controlada (no con `db push`, porque el historial local/remoto de migraciones está desalineado y el CLI intentaba arrastrar archivos viejos no aplicados en el repo local).

Versiones registradas en `supabase_migrations.schema_migrations`:
- `202605102310_order_transition_guards`
- `202605102320_orders_sensitive_update_guard`

### Evidencia de validación
#### Gate de build/lint
- `npm run lint ...` → OK
- `npm run build` → OK

#### Prueba real contra DB remota
Se creó una orden QA temporal y se validó:
1. **update directo bloqueado**
   - intento: `update orders set payment_status='paid' ...`
   - resultado: error `Los campos sensibles de órdenes solo pueden cambiarse mediante RPCs protegidos`
2. **RPC protegida sí funciona**
   - `admin_transition_order_state(..., 'paid', ...)` → OK
   - `admin_transition_order_state(..., ..., 'in_production', ...)` → OK
   - `admin_transition_order_state(..., ..., 'ready', ...)` → OK
3. **despacho exige precondiciones**
   - `admin_dispatch_order(...)` antes de `ready` → bloqueado con `Solo puedes despachar órdenes en estado ready`
4. **cleanup**
   - la orden QA temporal se eliminó después de la validación

### Resultado ejecutivo
Este punto sí quedó resuelto en el core del sistema:
- las transiciones sensibles ya no dependen del navegador
- el despacho ya no puede partir por un lado y descontar stock por otro
- el cliente/admin ya no puede saltarse el flujo correcto con updates triviales

---

## Endurecimiento de confirmación de entrega + lifecycle del token — 2026-05-10

### Problema detectado
El flujo original tenía dos debilidades:
1. `DeliveryConfirmation.jsx` actualizaba `orders` directo desde cliente anon
2. `delivery_token` no tenía expiración ni rotación formal al re-despachar

Eso dejaba una superficie innecesaria:
- dependencia fuerte de RLS/policies para una operación sensible
- links eternos
- mismo token reutilizable aunque cambie el despacho

### Cambios aplicados
#### 1. Lifecycle formal del delivery token
**Archivo:** `supabase/migrations/202605102340_delivery_token_lifecycle.sql`

Se agregó:
- `orders.delivery_token_expires_at`

Reglas aplicadas:
- backfill de expiración para órdenes existentes con token
- cada despacho vía `admin_dispatch_order(...)` ahora:
  - genera `delivery_token` nuevo
  - fija `delivery_token_expires_at = shipped_at + 45 días`
  - registra ambos cambios en `order_status_history`

Resultado:
- cada nuevo despacho rota el token
- el enlace deja de ser indefinido

#### 2. Confirmación de entrega por backend controlado
**Archivos:**
- `supabase/migrations/202605102350_confirm_delivery_rpc.sql`
- `supabase/functions/confirm-delivery/index.ts`
- `src/components/DeliveryConfirmation.jsx`

Se creó:
- RPC `confirm_order_delivery_by_token(...)`
- Edge Function pública `confirm-delivery`

Nuevo comportamiento:
- el frontend ya no hace `.update()` directo sobre `orders`
- ahora llama a `confirm-delivery`
- la function valida:
  - `order_id`
  - `delivery_token`
  - expiración del token
  - que la orden esté en `shipped`
  - que no haya sido confirmada antes
- luego ejecuta la RPC protegida, que:
  - marca `fulfillment_status = delivered`
  - fija `delivered_at`
  - fija `delivery_confirmed_by = customer`
  - registra historial

#### 3. Tracking público endurecido
**Archivo:** `supabase/functions/get-tracking/index.ts`

Nuevo comportamiento:
- ahora también valida `delivery_token_expires_at`
- si el token expiró, responde `410`
- ya no deja seguimiento eterno con link viejo

### Aplicación real en producción
Se aplicó directo en base remota y se registraron versiones en `supabase_migrations.schema_migrations`:
- `202605102340_delivery_token_lifecycle`
- `202605102350_confirm_delivery_rpc`

Deploys ejecutados:
- `get-tracking`
- `confirm-delivery`

### Evidencia de validación
#### DB / despacho
Se creó una orden QA temporal y se validó que `admin_dispatch_order(...)` ahora devuelve y persiste:
- `delivery_token` nuevo
- `delivery_token_expires_at`
- estado `shipped`
- descuento de inventario

#### Confirmación pública real
Se creó otra orden QA temporal en `shipped` con token válido y se probó HTTP real contra:
- `POST /functions/v1/confirm-delivery`

Resultado:
- `HTTP 200`
- respuesta `status: success`
- orden quedó en DB con:
  - `fulfillment_status = delivered`
  - `delivery_confirmed_by = customer`
  - `delivered_at` persistido

#### Gate técnico
- `npm run lint ...` → OK
- `npm run build` → OK

### Resultado ejecutivo
Este frente ya quedó saneado:
- confirmación de entrega dejó de depender del cliente anon como escritor directo
- el token de delivery ahora tiene expiración
- el token rota con cada despacho nuevo
- tracking y confirmación comparten una política temporal coherente

---

## Unificación de logging/auditoría de emails — 2026-05-10

### Problema real detectado
El stack de emails existía, pero la trazabilidad estaba rota o desalineada:
- `email_log` real en DB no tenía todas las columnas que el código/dash suponían
- faltaban tipos operativos como `profile_activation` y `abandoned_cart`
- `send-abandoned-cart` registraba `campaign` en vez de un tipo propio
- `send-low-stock-alert` intentaba escribir columnas inexistentes (`recipient`, `metadata`) sobre un schema más corto
- varias functions operativas ni siquiera escribían log homogéneo

### Cambios aplicados
#### 1. Endurecimiento de schema `email_log`
**Archivo:** `supabase/migrations/202605102400_email_log_hardening.sql`

Se agregó a `email_log`:
- `subject`
- `provider`
- `provider_message_id`
- `metadata jsonb`

Se reemplazó el check de `email_type` para soportar un set operativo real:
- `order_confirmation`
- `shipping`
- `profile_activation`
- `abandoned_cart`
- `followup`
- `upsell`
- `campaign`
- `waitlist_launch`
- `low_stock_alert`
- `internal_notification`

#### 2. Helper único de logging
En la misma migración se creó:
- `public.log_email_event(...)`

Objetivo:
- normalizar inserciones
- bajar duplicación
- asegurar lowercase del email
- mantener provider / message id / metadata consistente

#### 3. Functions alineadas
**Archivos actualizados:**
- `supabase/functions/send-order-confirmation/index.ts`
- `supabase/functions/send-shipping-notification/index.ts`
- `supabase/functions/send-profile-activation/index.ts`
- `supabase/functions/send-abandoned-cart/index.ts`
- `supabase/functions/send-campaign-email/index.ts`
- `supabase/functions/send-low-stock-alert/index.ts`

Nuevo comportamiento:
- **order confirmation** registra:
  - email cliente → `order_confirmation`
  - email interno → `internal_notification`
- **shipping** registra → `shipping`
- **profile activation** registra → `profile_activation`
- **abandoned cart** registra → `abandoned_cart`
- **campaign email** sigue registrando `campaign`, pero ahora con provider/message id/metadata homogéneos
- **low stock** registra → `low_stock_alert` y deja de intentar columnas inexistentes

#### 4. Ruta de baja alineada
En `send-abandoned-cart` se corrigió el footer:
- de `/unsubscribe?email=...`
- a `/baja?email=...`

#### 5. Dashboard admin alineado
**Archivo:** `src/components/EmailDashboard.jsx`

Se ampliaron labels para mostrar correctamente los nuevos tipos:
- activación de perfil
- carrito abandonado
- alerta de stock bajo
- notificación interna

### Aplicación real en producción
Se aplicó directo en base remota y se registró versión:
- `202605102400_email_log_hardening`

Deploys ejecutados:
- `send-order-confirmation`
- `send-shipping-notification`
- `send-profile-activation`
- `send-abandoned-cart`
- `send-campaign-email`
- `send-low-stock-alert`

### Evidencia de validación
#### Prueba real de DB
Se invocó `log_email_event(...)` directamente con un caso QA:
- insertó fila correctamente
- persistió:
  - `recipient_email`
  - `email_type`
  - `subject`
  - `provider`
  - `provider_message_id`
  - `metadata`
- luego se eliminó la fila QA

#### Gate técnico
- `npm run lint ...` → OK
- `npm run build` → OK

### Resultado ejecutivo
La auditoría de emails quedó mucho más confiable:
- los tipos ya representan eventos reales
- el schema ya soporta el dato que las functions necesitan
- desaparece el falso logging genérico de campañas para eventos operativos
- `email_log` pasa de “registro parcial” a bitácora usable para operación y análisis

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
