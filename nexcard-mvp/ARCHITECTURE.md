# NexCard - Arquitectura

_Última verificación contra código: 2026-08-21._ Este documento describe el estado **real** del sistema, no un plan aspiracional. Para el detalle de tablas ver [`SCHEMA.md`](./SCHEMA.md); para el mapa de toda la documentación ver [`docs/INDEX.md`](./docs/INDEX.md).

## Stack real

- **Frontend:** React 18 + Vite (no CRA/react-scripts — la migración a Vite ya se hizo; `vite.config.js` en la raíz). Tailwind CSS, Zustand para estado de carrito.
- **Backend productivo:** Supabase (Auth, PostgreSQL, Storage, Row Level Security, Edge Functions).
- **Backend serverless propio (Vercel):** `api/` — funciones Vercel para health check, proxy de waitlist, y dos cron jobs productivos (`api/cron/abandoned-carts.js` cada hora, `api/cron/operational-watchdog.js` cada 15 min, registrados en `vercel.json`).
- **Backend local (solo dev):** `server/` — Express, bloqueado explícitamente para no correr en producción (`server/index.js`). Sirve para desarrollo, mocks y algunos flujos E2E.
- **Pagos:** Mercado Pago (Checkout Pro) es el único proveedor activo — `supabase/functions/create-mp-preference`, `mp-webhook`, `process-refund`, `reconcile-order-payments`. **Webpay/Transbank está deshabilitado en UI** (`src/components/CheckoutForm.jsx`, opción "Próximamente"); solo queda un resabio de config de fee en `src/config/admin.js`. No tratar Webpay como canal vivo.
- **Hosting frontend + funciones serverless:** Vercel.
- **Observabilidad:** Sentry (`@sentry/react`, `src/utils/sentry.js`, `ErrorBoundary.jsx`). **PostHog no está integrado** pese a mencionarse antes en este doc — no hay ninguna referencia en el código.
- **Email transaccional:** Resend, vía Edge Functions (`send-order-confirmation`, `send-profile-activation`, `send-shipping-notification`, `send-campaign-email`, `send-abandoned-cart`, `send-low-stock-alert`, `send-executive-alert`, `send-weekly-kpi-report`).

## Principios

1. **Separar comercial de operación**: landing, checkout y panel admin no mezclan lógica.
2. **Modelo multi-segmento**: individual, pyme y empresa (vía `organizations` + `memberships`).
3. **NFC desacoplado**: la tarjeta física se asocia después; el perfil digital vive por sí mismo.
4. **CMS liviano**: contenido editable desde admin sin depender de deploy (`content_blocks`).
5. **Escalabilidad financiera**: cada nueva venta no debe requerir trabajo manual estructural (ledger de pagos, reconciliación automática, backfill).

## Split de backends (lo que NO está documentado en ningún otro lado)

Hay **tres** superficies de servidor distintas y es fácil confundirlas:

| Superficie | Dónde vive | Para qué sirve | Corre en prod? |
|---|---|---|---|
| Supabase Edge Functions | `supabase/functions/*` | Lógica de negocio real: pagos, webhooks, emails, reconciliación, alertas KPI | Sí — es la fuente de verdad |
| Vercel Functions | `api/*.js`, `api/cron/*` | Health check, proxy de waitlist, 2 cron jobs (abandoned carts, watchdog operativo) | Sí |
| Express local | `server/*` | Auth local, mocks, soporte a E2E | No — bloqueado explícitamente para prod |

## Módulos del sistema (según código actual en `src/components/`)

### 1. Sitio comercial / público
- Landing, Coming Soon, catálogo de productos, carrito, checkout
- Perfil público por `/:slug` (`NexCardProfile.jsx`)
- Redirect de review cards `/r/:slug`
- Tracking, baja/unsubscribe, términos, privacidad

### 2. Cuenta cliente
- Login / Auth (`AuthPage.jsx`)
- Setup inicial (`SetupWizard.jsx`)
- Activación de tarjeta (`ActivationPage.jsx`)
- Perfil editable, branding, links, foto, datos comerciales

### 3. Backoffice admin (`src/components/Admin*.jsx`, `src/components/admin/`)
Bastante más grande que "dashboard + perfiles + pedidos + inventario + CMS":
- Dashboard general + capa de alertas (`AdminDashboard.jsx`, `AdminDashboardAlertingSection.jsx`)
- KPIs ejecutivos (`KpiDashboard.jsx`)
- Pedidos, incluida vista QA (`OrdersDashboard.jsx`, `QAOrdersDashboard.jsx`)
- Perfiles (`AdminProfilesDashboard.jsx`)
- Tarjetas / NFC (`AdminCardsDashboard.jsx`)
- Inventario (`InventoryDashboard.jsx`)
- Productos (`ProductsDashboard.jsx`)
- CRM (`CRMDashboard.jsx`)
- NexReview / review cards (`NexReviewDashboard.jsx`, `ReviewCardsDashboard.jsx`)
- Ruleta de descuentos / gamificación (`DiscountWheel.jsx`, `WheelDashboard.jsx`)
- Emails (`EmailDashboard.jsx`)
- Equipo (`TeamDashboard.jsx`)
- Generador de material de impresión (`PrintTestGenerator.jsx`)

**Autorización admin:** RPC `has_role('admin')` contra un modelo real de roles/membresías en Postgres (`src/utils/adminAccess.js`, `supabase/migrations/202604080001_memberships_baseline.sql` y siguientes). **No es una whitelist de emails en frontend** — ese modelo quedó reemplazado; `src/config/admin.js` tiene un comentario explícito prohibiendo reintroducirlo.

### 4. Dominio de pedidos
Producto → Pedido → Pago → Estado de producción → Estado de despacho → Asociación con tarjeta física/NFC. Con reconciliación y backfill automatizados (`scripts/run-order-payment-reconciliation.mjs`, `scripts/run-payment-ledger-backfill.mjs`, ambos con variantes cron).

## Modelo de datos

Ver [`SCHEMA.md`](./SCHEMA.md) para el mapa completo (~29 tablas). Resumen por dominio:

- **Identidad/acceso:** `profiles`, `organizations`, `memberships`
- **Catálogo/pedidos:** `products`, `orders`, `order_items`, `order_cards`, `order_status_history`, `order_operational_events`
- **Pagos:** `payments`, `refunds`
- **Tarjetas/NFC:** `cards`, `card_events`, `card_scans`
- **Inventario:** `inventory_items`, `inventory_movements`
- **CMS:** `content_blocks`, `events`
- **CRM:** `crm_contacts`, `crm_deals`, `crm_activities`
- **Gamificación:** `wheel_config`, `wheel_prizes`, `wheel_spins`
- **Growth/ops:** `abandoned_carts`, `waitlist`, `review_cards`, `team_members`
- **Operación interna/seguridad:** `audit_log`, `dispatch_config`, `email_log`, `email_unsubscribe`, `kpi_alert_evaluations`, `kpi_alert_history`, `kpi_alert_state`, `kpi_runtime_config`, `profile_claims`, `profile_slug_reservations`, `profile_versions`, `rate_limit_hits`, `watchdog_alert_state`

## Estado del roadmap (reevaluado)

Las fases originales ya no describen "por hacer" sino, en su mayoría, **hecho**:

- **Fase 1 — Base operativa:** ✅ completa (auth, profiles, admin, inventory, orders, CMS).
- **Fase 2 — Monetización:** ✅ Mercado Pago + webhooks + fulfillment + emails. Webpay no se implementó (queda como opción deshabilitada en UI).
- **Fase 3 — Escala empresa:** parcial. `organizations` + `memberships` + roles ya existen y gatean el acceso admin; falta empaquetar esto como oferta comercial (packs/equipos/facturación).
- **Fase 4 — Tarjeta física / NFC:** ✅ activación, asociación card/profile y eventos de escaneo están implementados (`cards`, `card_events`, `card_scans`, `ActivationPage.jsx`).

Lo que sigue pendiente hoy vive en `docs/AUDITORIA_PRELANZAMIENTO_2026-08-20.md` y `docs/PLAN_TRABAJO_BRECHAS_2026-08-20.md`, no en este roadmap.

## Variables de entorno

Prefijo `REACT_APP_*` por convención histórica, aunque el build ya corre en Vite — `vite.config.js` whitelistea y reinyecta esas variables vía `define`. No renombrar a `VITE_*` sin actualizar esa whitelist.
