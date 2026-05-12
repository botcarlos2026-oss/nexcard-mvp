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

### 2026-05-11 — alerta proactiva operativa
Se agregó una capa de priorización automática sobre el dashboard admin para convertir excepciones observadas en una cola de ataque sugerida.

Cambios concretos:
- `src/services/api.js`
  - `getAdminDashboard()` ahora agrupa excepciones en buckets operativos
  - calcula `proactiveQueue` ordenada por severidad e impacto
  - genera `proactiveSummary` con la prioridad principal del momento
- `src/components/AdminDashboard.jsx`
  - ahora muestra banner superior `Prioridad operativa ahora`
  - ahora muestra bloque `Cola proactiva sugerida`

Criterio de priorización implementado:
1. `sla_breaches`
2. `delivered_pending_activation`
3. `advanced_without_card`
4. `paid_without_production`
5. `pending_claim_post_delivery`

Resultado funcional:
- el panel ya no solo muestra observabilidad, SLA y tendencia
- ahora también propone el orden de ataque operativo más rentable

Documentación específica:
- `docs/ALERTA_PROACTIVA_OPERATIVA_2026-05-11.md`

### 2026-05-11 — digest operativo reutilizable
Se agregó una capa de salida ejecutiva para preparar el envío de alertas/resúmenes fuera del dashboard sin duplicar lógica.

Cambios concretos:
- `src/services/api.js`
  - `getAdminDashboard()` ahora genera `operationalDigest`
  - el digest incluye prioridad, severidad, casos, funnel, SLA promedio, acciones sugeridas y recomendación principal
- `src/components/AdminDashboard.jsx`
  - ahora muestra bloque `Resumen ejecutivo listo para enviar`
  - se agregó botón `Copiar` para reutilizar el texto en canales externos

Resultado funcional:
- el panel no solo detecta, mide y prioriza
- también entrega un resumen ejecutivo reutilizable para futura automatización por cron/webhook/mensajería

Documentación específica:
- `docs/DIGEST_OPERATIVO_REUTILIZABLE_2026-05-11.md`

### 2026-05-11 — formatos de delivery listos
Se agregó una capa adicional para preparar el envío automático multicanal sin duplicar contenido.

Cambios concretos:
- `src/services/api.js`
  - `getAdminDashboard()` ahora devuelve `deliveryFormats`
  - incluye:
    - `short_text`
    - `whatsapp_text`
    - `email_subject`
    - `email_body`
- `src/components/AdminDashboard.jsx`
  - ahora muestra bloque `Formatos listos por canal`
  - se agregó copiado individual por formato

Resultado funcional:
- la lógica de resumen ejecutivo ya está desacoplada del transporte
- el siguiente paso para cron/webhook/mensajería será solo conectar delivery

Documentación específica:
- `docs/FORMATOS_DELIVERY_LISTOS_2026-05-11.md`

### 2026-05-11 — transporte automático preparado
Se agregó una capa de preparación para cron/webhook sin habilitar envío real por defecto.

Cambios concretos:
- `src/services/api.js`
  - `getAdminDashboard()` ahora devuelve `transportReadiness`
  - incluye:
    - `mode: dry_run_only`
    - `recommended_trigger`
    - `recommended_frequency`
    - `checklist`
    - `cron_payload`
    - `webhook_payload`
- `src/components/AdminDashboard.jsx`
  - ahora muestra bloque `Transporte automático preparado`
  - se agregó copiado de payloads cron/webhook listos

Resultado funcional:
- la lógica ya está lista para conectarse a transporte real
- pero sigue protegida contra envíos accidentales porque el modo por defecto es `dry_run_only`

Documentación específica:
- `docs/TRANSPORTE_AUTOMATICO_PREPARADO_2026-05-11.md`

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

<!--
PLAN PRE-LANZAMIENTO — revisión ejecutiva

Objetivo:
Cerrar sólo lo que impacta caja, conversión y riesgo operativo del primer cobro real.
No meter features nuevas antes de validar cobro + activación real.

Fase 1 — Go/No-Go técnico-comercial
1. Cambiar `MP_ACCESS_TOKEN` a producción.
2. Eliminar producto TEST-1 para evitar contaminación comercial o compra errónea.
3. Limpiar `console.log` de debug en `api.js`.
4. Ejecutar 1 compra real controlada end-to-end.

Gate obligatorio de salida Fase 1:
- pago aprobado real
- `orders.payment_status = paid`
- `mp_payment_id` persistido
- orden visible en admin sin inconsistencias

Fase 2 — Validación operativa post-pago
5. Confirmar trigger completo del flujo post-pago:
   - claim
   - activación
   - email
6. Revisar observabilidad de la orden en `/admin/orders`.
7. Confirmar que no queden alertas operativas críticas abiertas.

Gate obligatorio de salida Fase 2:
- una orden real completa desde pago hasta activación trazable
- evidencia en admin y/o DB de cada transición crítica

Fase 3 — Hardening mínimo antes de abrir tráfico
8. Endurecer Edge Functions que no deban quedar públicas usando `SUPABASE_SERVICE_ROLE_KEY` + control explícito de rol admin.
9. Documentar checklist operativa de incidentes de pago/activación.

Gate obligatorio de salida Fase 3:
- superficies admin sensibles cerradas
- runbook mínimo listo para soporte operativo

Post-lanzamiento (no bloquear caja inicial)
- partir `src/services/api.js` por dominio
- panel configuración NexReview
- Transbank WebPay
- CRM con pipeline Kanban

Criterio ejecutivo:
Si falla Fase 1 o Fase 2, NO abrir lanzamiento.
Si Fase 1 y Fase 2 pasan, y Fase 3 queda en nivel aceptable de riesgo, sí se puede abrir lanzamiento controlado.
-->

---

## Plan maestro de escalabilidad NexCard

### Objetivo ejecutivo
Construir una base que permita:
- crecer sin romper checkout, pagos o activación
- agregar nuevas features sin aumentar regresión estructural
- delegar operación sin depender de memoria informal
- sostener evolución comercial con disciplina técnica

### Principio rector
El core transaccional debe mantenerse estable y separado de las capas de expansión.

**Core transaccional:**
- orders
- payments
- inventory
- cards
- profiles
- auth/admin

**Capas de expansión:**
- NexReview
- CRM
- automatizaciones
- analytics
- segundo medio de pago
- campañas / growth

---

### Horizonte 0-30 días — estabilización del core

#### Objetivo
Cerrar la base mínima para que el producto pueda evolucionar sin fragilidad excesiva.

#### Prioridad 1 — modularización mínima del frontend
1. Partir `src/services/api.js` por dominio:
   - `src/services/api/orders.js`
   - `src/services/api/payments.js`
   - `src/services/api/profiles.js`
   - `src/services/api/cards.js`
   - `src/services/api/inventory.js`
   - `src/services/api/admin.js`
2. Dejar `src/services/api/index.js` como fachada de compatibilidad temporal.
3. Reducir `src/App.jsx` para que concentre solo:
   - routing
   - guards
   - bootstrap de sesión
4. Mover lógica de carga y mutación de cada dashboard a hooks o servicios específicos.

**Gate de salida:**
- `api.js` deja de ser cuello monolítico
- cada dominio puede modificarse con menor riesgo lateral
- `npm run lint` y `npm run build` siguen verdes

#### Prioridad 2 — contratos de datos y estados formales
1. Definir explícitamente estados válidos para:
   - order lifecycle
   - payment lifecycle
   - card lifecycle
   - activation lifecycle
2. Documentar transiciones válidas, inválidas y side effects.
3. Eliminar inferencias blandas donde un estado crítico deba venir de evidencia formal.
4. Revisar duplicación de reglas entre frontend, SQL y Edge Functions.

**Gate de salida:**
- existe fuente de verdad por flujo
- se reduce drift entre app y schema
- cambios futuros no requieren “adivinar” estados

#### Prioridad 3 — testing mínimo reproducible
1. Cerrar pack smoke obligatorio para:
   - checkout
   - pago
   - retorno post-pago
   - admin/orders
2. Formalizar variables E2E mínimas y dataset de prueba.
3. Dejar un camino claro de validación pre-merge y pre-deploy.

**Gate de salida:**
- existe validación repetible del flujo de caja
- una mejora futura no depende de prueba manual improvisada

---

### Horizonte 30-90 días — escalabilidad operativa y delegación

#### Objetivo
Reducir dependencia del fundador y preparar operación con más volumen y más personas.

#### Prioridad 4 — permisos y gobierno de acceso
1. Reemplazar whitelist hardcodeada por modelo formal de roles/memberships.
2. Separar permisos por capacidad:
   - super admin
   - operaciones
   - soporte
   - ventas
3. Endurecer Edge Functions sensibles con validación explícita de rol.
4. Auditar accesos administrativos y eventos críticos.

**Gate de salida:**
- acceso admin escalable
- menor riesgo al delegar tareas operativas
- menos lógica crítica hardcodeada en frontend

#### Prioridad 5 — observabilidad y runbooks
1. Formalizar timeline operativo por orden con eventos consistentes.
2. Agregar alertas para excepciones de:
   - pago sin reconciliación
   - orden sin activación cuando corresponde
   - despacho sin card vinculada
   - errores de email/webhook
3. Crear runbooks mínimos para incidentes de:
   - pago
   - stock
   - activación
   - fulfillment
4. Definir checklist de cierre diario operativo.

**Gate de salida:**
- la operación se puede diagnosticar sin depender de memoria informal
- incidentes repetidos tienen respuesta estándar

#### Prioridad 6 — inventario y fulfillment robusto
1. Consolidar SKU real como fuente de verdad.
2. Endurecer reserva, descuento y conciliación de stock.
3. Trazar completamente:
   - order → order_card → card → activation
4. Revisar reglas de despacho, entrega y cierre operativo.

**Gate de salida:**
- baja riesgo de pérdida de margen por errores físicos
- fulfillment soporta mayor volumen sin caos manual

---

### Horizonte 90+ días — expansión segura del producto

#### Objetivo
Agregar crecimiento sin contaminar el core.

#### Prioridad 7 — arquitectura de extensibilidad
1. Tratar NexReview, CRM y growth como módulos acoplados débilmente al core.
2. Definir interfaces claras entre:
   - core comercial
   - automatizaciones
   - analytics
   - canales nuevos
3. Evitar que features de marketing entren directo a rutas críticas de cobro.

**Gate de salida:**
- nuevas líneas de producto no fuerzan cirugía en checkout/orders/payments
- el costo de agregar features cae en vez de subir

#### Prioridad 8 — segundo medio de pago y expansión multicanal
1. Evaluar Transbank solo después de estabilizar Mercado Pago real.
2. Diseñar capa de pagos con contrato común para múltiples providers.
3. Preparar estrategia de reconciliación homogénea entre proveedores.

**Gate de salida:**
- agregar otro medio de pago no duplica deuda técnica
- la caja no queda fragmentada sin control

#### Prioridad 9 — data y growth con disciplina
1. Formalizar eventos y tracking de negocio.
2. Separar métricas operativas de métricas comerciales.
3. Medir:
   - conversión landing → checkout
   - checkout → pago aprobado
   - pago → activación
   - activación → recompra / referencia
4. Recién después acelerar campañas o automatizaciones de adquisición.

**Gate de salida:**
- crecimiento guiado por datos útiles
- marketing deja de operar a ciegas

---

### Riesgos estructurales a vigilar
- `src/services/api.js` como cuello de mantenimiento
- `src/App.jsx` como punto único de fragilidad frontend
- drift entre frontend, migraciones y Edge Functions
- permisos admin demasiado simples para escalar
- QA dependiente de contexto manual
- features nuevas mezcladas con core transaccional

---

### Reglas de decisión para futuras mejoras

#### Sí hacer pronto si:
- protege flujo de caja
- reduce regresión
- baja tiempo operativo manual
- mejora trazabilidad o permisos

#### No priorizar aún si:
- es cosmético
- agrega complejidad sin proteger caja
- mete coupling al core
- depende de un flujo base todavía no estabilizado

---

### KPIs de salud para escalar
- tiempo de resolución de incidentes de pago
- porcentaje de órdenes con trazabilidad completa
- porcentaje de deploys sin regresión en smoke
- tiempo promedio de cambio por módulo
- cantidad de flujos críticos que dependen de lógica hardcodeada
- porcentaje de operación delegable sin intervención del fundador

---

### Recomendación ejecutiva final
NexCard no necesita más features para justificar el siguiente salto.
Necesita una base más modular, auditable y delegable.

Orden correcto:
1. estabilizar core
2. modularizar frontend y contratos
3. formalizar permisos y testing
4. endurecer operación e inventario
5. recién después acelerar expansión de producto y canales

### Decisión estratégica
Si el objetivo es escalar con rentabilidad, cada mejora futura debe pasar por este filtro:

**¿protege caja, reduce riesgo operativo o baja costo de cambio?**

Si la respuesta es no, no debe entrar antes que el hardening del core.

---

## Roadmap operativo — próximas 4 semanas

### Semana 1 — cerrar caja y base de validación

#### Objetivo
Eliminar los bloqueadores directos de lanzamiento controlado y dejar validación mínima repetible.

#### Tareas
1. Cambiar `MP_ACCESS_TOKEN` a producción.
2. Eliminar producto `TEST-1` del flujo comercial.
3. Remover `console.log` de debug pendiente en `api.js`.
4. Ejecutar una compra real controlada end-to-end.
5. Confirmar en evidencia real:
   - `orders.payment_status = paid`
   - persistencia de `mp_payment_id`
   - orden visible en `/admin/orders`
6. Cerrar un smoke test mínimo documentado para:
   - landing
   - carrito
   - checkout
   - retorno post-pago
   - admin/orders

#### Entregable semanal
- primer cobro real validado
- checklist smoke base documentada
- go/no-go técnico-comercial resuelto

#### Riesgo que baja
- vender sin reconciliación real
- romper caja por confiar sólo en sandbox

---

### Semana 2 — modularización mínima de frontend

#### Objetivo
Reducir el costo de cambio del frontend antes de seguir agregando módulos.

#### Tareas
1. Partir `src/services/api.js` por dominios prioritarios:
   - orders
   - payments
   - profiles
   - inventory
2. Crear `src/services/api/index.js` como fachada temporal.
3. Mover llamadas por dominio gradualmente sin romper imports existentes.
4. Reducir `src/App.jsx` para dejar solo:
   - routing
   - session bootstrap
   - guards
5. Mover lógica de dashboards a hooks o servicios dedicados.

#### Entregable semanal
- primer corte real del monolito `api.js`
- `App.jsx` más delgado
- build/lint verdes tras refactor

#### Riesgo que baja
- regresiones laterales por tocar un archivo demasiado central
- dificultad para sumar mejoras futuras

---

### Semana 3 — permisos, contratos y observabilidad

#### Objetivo
Cerrar los riesgos de escala operativa y de drift entre capas.

#### Tareas
1. Diseñar reemplazo de whitelist hardcodeada por roles/memberships.
2. Definir estados formales para:
   - orders
   - payments
   - cards
   - activación
3. Documentar transiciones válidas e inválidas.
4. Revisar Edge Functions sensibles y marcar cuáles requieren rol admin explícito.
5. Consolidar observabilidad de órdenes con eventos y alertas operativas clave.
6. Crear runbook mínimo para incidentes de:
   - pago
   - activación
   - email/webhook

#### Entregable semanal
- blueprint de permisos listo para implementación
- contratos de estado documentados
- runbook operativo inicial

#### Riesgo que baja
- dependencia excesiva de memoria informal
- drift entre frontend, DB y functions
- acceso admin poco escalable

---

### Semana 4 — inventario robusto y preparación de expansión

#### Objetivo
Blindar fulfillment y dejar preparada la base para crecer sin contaminar el core.

#### Tareas
1. Consolidar SKU real como fuente de verdad.
2. Revisar reserva/descuento/conciliación de stock.
3. Trazar completamente:
   - order → order_card → card → activation
4. Definir frontera técnica entre:
   - core transaccional
   - NexReview
   - CRM
   - growth / automatizaciones
5. Priorizar backlog futuro con filtro de ROI estructural.
6. Preparar lista de trabajo post-semana 4 con:
   - Transbank
   - analytics formal
   - expansión de módulos

#### Entregable semanal
- flujo físico más confiable
- base clara para expansión modular
- backlog futuro priorizado por rentabilidad y riesgo

#### Riesgo que baja
- pérdida de margen por errores operativos físicos
- expansión desordenada sobre base frágil

---

## Criterio de priorización semanal

### Hacer primero
- lo que protege caja
- lo que reduce riesgo de regresión
- lo que formaliza operación
- lo que baja dependencia de conocimiento implícito

### Postergar
- features cosméticas
- automatizaciones lindas pero no críticas
- crecimiento comercial sobre flujos no estabilizados
- módulos nuevos que toquen el core sin necesidad

---

## Resultado esperado al cierre de 4 semanas
- cobro real validado y trazable
- frontend menos frágil
- base de permisos más escalable
- operación más delegable
- inventario/fulfillment más confiables
- backlog futuro mejor ordenado

### Lectura ejecutiva
Si estas 4 semanas se ejecutan bien, NexCard deja de ser sólo un MVP fuerte y pasa a ser una base seria para escalar con menos deuda explosiva.

---

## Checklist operativo de ejecución

### Semana 1 — caja y validación real
- [ ] Cambiar `MP_ACCESS_TOKEN` a producción
- [ ] Eliminar `TEST-1` del catálogo productivo en Supabase
- [ ] Verificar si el pendiente de `console.log` en `api.js` sigue vigente o cerrarlo como desalineado
- [ ] Ejecutar 1 compra real controlada end-to-end
- [ ] Confirmar `orders.payment_status = paid`
- [ ] Confirmar persistencia de `mp_payment_id`
- [ ] Confirmar visualización correcta en `/admin/orders`
- [ ] Documentar smoke mínimo post-cobro

### Semana 2 — modularización frontend
- [x] Crear primer corte modular para `products` y `orders` fuera de `api.js`
- [x] Partir `payments` fuera de `api.js`
- [x] Partir `profiles` fuera de `api.js`
- [x] Partir `inventory` fuera de `api.js`
- [ ] Dejar `src/services/api/index.js` como fachada temporal si ya conviene
- [x] Adelgazar `src/App.jsx` con primer corte seguro (render + sync de sesión)
- [x] Validar `npm run lint`
- [x] Validar `npm run build`

### Semana 3 — permisos y observabilidad
- [ ] Diseñar reemplazo de whitelist por roles/memberships
- [ ] Definir estados formales de order/payment/card/activation
- [ ] Documentar transiciones válidas e inválidas
- [ ] Marcar Edge Functions que requieren rol admin explícito
- [ ] Consolidar alertas operativas mínimas
- [ ] Crear runbook de incidentes de pago/activación/email

### Semana 4 — inventario y expansión segura
- [ ] Consolidar SKU real como fuente de verdad
- [ ] Revisar reserva/descuento/conciliación de stock
- [ ] Trazar `order → order_card → card → activation`
- [ ] Definir frontera técnica entre core y módulos de expansión
- [ ] Priorizar backlog post-semana 4 por ROI estructural

### Regla de avance
No abrir nuevas líneas de trabajo si la anterior toca caja o core y sigue sin evidencia técnica de cierre.

### Avance real ejecutado
- se extrajo `products` a `src/services/api/products.js`
- se extrajo `orders` a `src/services/api/orders.js`
- se extrajo `payments` a `src/services/api/payments.js`
- se extrajo `profiles` a `src/services/api/profiles.js`
- se extrajo `inventory` a `src/services/api/inventory.js`
- se extrajo `AppRouteRenderer` para encapsular la decisión de render/rutas
- se extrajo `useAuthSessionSync` para aislar la sincronización de sesión/auth con Supabase
- se extrajo `useCheckoutFlow` para centralizar estado y handlers del checkout
- el retorno post-pago de Mercado Pago quedó movido dentro de `useCheckoutFlow`
- se extrajo `adminBootstrap.js` con:
  - `ensureAdminAccess`
  - `loadAdminRouteData`
  - `applyAdminRouteData`
  - `resetAdminRouteState`
- se extrajo `appRoutes.js` con helper para bypass público del bootstrap
- se extrajo `useAppBootstrap` para sacar el effect principal de `App.jsx` sin mover todavía navegación ni handlers de negocio
- la rama admin del bootstrap quedó más desacoplada sin mover todavía la semántica del flujo
- se agregó reset-before-apply para bajar riesgo de stale state entre rutas admin
- se endureció el bootstrap principal con request guard por secuencia + cancelación local para evitar respuestas tardías
- `loadAdminRouteData` pasó a mapa más exhaustivo de rutas admin soportadas
- `/admin/crm` dejó de caer implícitamente a órdenes
- se endureció `supabase/functions/mp-webhook/index.ts` para proteger órdenes ya pagadas frente a eventos tardíos/ambiguos de Mercado Pago
- el webhook ahora no degrada `payment_status` una vez que la orden ya quedó `paid`
- el webhook ahora evita pisar `fulfillment_status` salvo el avance controlado `new -> in_production` cuando entra un pago válido
- el webhook ahora persiste un ledger mínimo en `public.payments` para cada cobro de Mercado Pago usando `provider='mercado_pago'`, `external_id`, `status`, `amount_cents`, `currency` y `payload`
- ese ledger se actualiza de forma idempotente por `external_id` dentro del propio webhook, sin volver dependiente el camino crítico de la reconciliación Route2
- se creó `src/utils/adminAccess.js` como helper único para resolver acceso admin desde `has_role('admin')`
- el gate de `/admin/*` ahora consulta memberships/roles reales vía Supabase y deja whitelist por email solo como fallback transitorio si falla el RPC
- el redirect post-login en `App.jsx` dejó de decidir admin solo por email hardcodeado y ahora usa el mismo helper centralizado
- se endureció `supabase/functions/process-refund/index.ts` para exigir JWT válido + rol admin antes de ejecutar mutaciones con service role
- `process-refund` ahora valida consistencia `refundId -> orderId`, evita reprocesar refunds ya procesados y limita el monto al refund/orden
- se endureció `supabase/functions/send-campaign-email/index.ts` para aceptar solo `admin` autenticado o `service_role`, rechazando `anon`
- `EmailDashboard.jsx` dejó de usar fallback de `SUPABASE_ANON_KEY` para campañas manuales y exige sesión admin real
- `src/services/api.js` quedó funcionando como fachada compatible
- `dispatchOrder` se dejó en `api.js` por ahora, porque mezcla inventario + órdenes + alertas + email
- navegación, auth handlers y `handleSave` quedaron intencionalmente en `App.jsx` para no subir riesgo de regresión
- validación ejecutada:
  - `npm run lint` ✅
  - `npm run build` ✅

### Siguiente corte recomendado
- priorizar hardening funcional pre-lanzamiento sobre más refactor cosmético
- siguiente paso: revisar `send-abandoned-cart`, `send-low-stock-alert`, `send-profile-activation` y `send-order-confirmation` para unificar matriz explícita de acceso
- luego revisar reconciliación formal `payments -> orders.payment_status` y eventual unique constraint para `payments.external_id`
- recién después evaluar si la carga de landing conviene separarla del bootstrap principal

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
