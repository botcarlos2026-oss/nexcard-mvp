# NexCard — Modelo de datos (Supabase/PostgreSQL)

_Última verificación contra migraciones: 2026-08-21 (95 migraciones en `supabase/migrations/`, hasta `202608202000_...`)._

## Fuente de verdad

**Este documento NO intenta replicar el DDL exacto de cada tabla** — con 95 migraciones y crecimiento activo, cualquier lista de columnas copiada aquí queda obsoleta en semanas (le pasó a la versión anterior de este archivo, que solo documentaba 2 de ~29 tablas). Para columnas/constraints exactos:

1. `supabase/migrations/` — orden cronológico real, es la única fuente que no miente.
2. `docs/supabase-schema-baseline-2026-08-15.md` — snapshot de baseline + explica por qué existe `202604080002_initial_schema_baseline.sql` (replay limpio de 16 tablas que no tenían `CREATE TABLE` propio en el historial).
3. `docs/supabase-memberships-baseline-schema-2026-08-14.md` — schema específico de `memberships`.

Lo que este documento sí da: **un mapa de qué tabla existe, para qué sirve y cómo se relaciona con las demás**, para poder ubicarse rápido sin tener que leer 95 archivos SQL.

## Identidad y acceso

| Tabla | Para qué sirve |
|---|---|
| `profiles` | Perfil digital editable (branding, links, datos bancarios, contador de vistas). Es la tabla más grande y con más columnas del sistema — no listar sus campos aquí, ver migraciones. |
| `organizations` | Cuentas tipo pyme/empresa que agrupan varios perfiles/miembros. |
| `memberships` | Relación usuario↔organización con rol. Es la base de la autorización admin actual vía RPC `has_role('admin')` (ver `src/utils/adminAccess.js`). Reemplazó el modelo anterior de whitelist de emails en frontend. |
| `profile_claims` | Reclamo/asociación de un perfil a un usuario (flujo `claim-profile`). |
| `profile_slug_reservations` | Reserva temporal de slugs para evitar colisiones durante checkout. |
| `profile_versions` | Historial de versiones de un perfil (soporta restore). |

Auth de usuarios en sí la maneja Supabase Auth de forma nativa (no es una tabla en `public`).

## Catálogo y pedidos

| Tabla | Para qué sirve |
|---|---|
| `products` | Catálogo de productos vendibles. |
| `orders` | Pedido. |
| `order_items` | Líneas de un pedido. |
| `order_cards` | Vínculo entre un pedido y las tarjetas físicas asociadas (llegó tarde al historial, ver nota de replay debt). |
| `order_status_history` | Historial de cambios de estado de un pedido. |
| `order_operational_events` | Eventos operativos sobre un pedido (dispatch, producción, etc.), capa aparte del historial de estado. |
| `dispatch_config` | Configuración de despacho (SKU/slug de dispatch — ver `202608151900_fix_dispatch_sku_and_slug_reservation_ambiguity.sql`). |

## Pagos

| Tabla | Para qué sirve |
|---|---|
| `payments` | Ledger de pagos. Mercado Pago es el único proveedor activo hoy (ver `ARCHITECTURE.md`). |
| `refunds` | Reembolsos. |

Reconciliación y backfill de este ledger corren vía `scripts/run-order-payment-reconciliation.mjs` y `scripts/run-payment-ledger-backfill.mjs` (cron + manual), no manualmente.

## Tarjetas / NFC

| Tabla | Para qué sirve |
|---|---|
| `cards` | Tarjeta física, su estado de activación y asociación a un perfil. |
| `card_events` | Eventos de ciclo de vida de una tarjeta (activación, reasignación, etc.). |
| `card_scans` | Eventos de escaneo/tap NFC. |

## Inventario

| Tabla | Para qué sirve |
|---|---|
| `inventory_items` | Stock por SKU. |
| `inventory_movements` | Movimientos de entrada/salida de stock. |

## CMS

| Tabla | Para qué sirve |
|---|---|
| `content_blocks` | Contenido editable de la landing sin deploy. |
| `events` | Eventos de tracking/analítica genéricos (no confundir con `card_events` ni `order_operational_events`). |

## CRM

| Tabla | Para qué sirve |
|---|---|
| `crm_contacts` | Contactos. |
| `crm_deals` | Oportunidades/negociaciones. |
| `crm_activities` | Actividades sobre contactos/deals. |

## Gamificación (ruleta de descuentos)

| Tabla | Para qué sirve |
|---|---|
| `wheel_config` | Configuración de la ruleta. |
| `wheel_prizes` | Premios disponibles. |
| `wheel_spins` | Registro de giros/resultados. |

## Growth / operación comercial

| Tabla | Para qué sirve |
|---|---|
| `waitlist` | Lista de espera (landing "Coming Soon"). |
| `abandoned_carts` | Carritos abandonados, insumo del cron `api/cron/abandoned-carts.js`. |
| `review_cards` | Tarjetas NexReview (redirección `/r/:slug`). |
| `team_members` | Equipo interno con acceso al backoffice. |

## Operación interna / seguridad / observabilidad

| Tabla | Para qué sirve |
|---|---|
| `audit_log` | Auditoría de acciones sensibles. |
| `email_log` | Registro de envíos de email. |
| `email_unsubscribe` | Bajas de email. |
| `rate_limit_hits` | Rate limiting de Edge Functions (`202608172100_rate_limit_edge_functions.sql`). |
| `kpi_runtime_config` | Configuración en runtime del sistema de KPIs/alertas ejecutivas. |
| `kpi_alert_state`, `kpi_alert_history`, `kpi_alert_evaluations` | Estado, historial y evaluaciones del motor de alertas KPI (`supabase/functions/evaluate-executive-alert`, `send-executive-alert`, `send-weekly-kpi-report`). |
| `watchdog_alert_state` | Estado del watchdog operativo (`api/cron/operational-watchdog.js`, `202608180001_operational_watchdog_state.sql`). |

## Notas de integridad histórica (por qué el orden de migraciones importa)

Varias tablas fueron referenciadas por RLS/lógica **antes** de tener su propio `CREATE TABLE` reproducible, lo que rompía un replay limpio desde cero. Esto ya se corrigió con `202604080002_initial_schema_baseline.sql` (ver `docs/supabase-schema-baseline-2026-08-15.md`), pero es útil saberlo si algo falla al reconstruir la base desde cero:

- `card_scans` / `card_events`: sus políticas RLS (`202604090003`/`202604090004`) corren antes que su `CREATE TABLE` (`202604090005`).
- `waitlist`: referenciada por `202605030002_kpi_views.sql` sin `CREATE TABLE` previo en el historial original.
- `order_status_history`: referenciada por dos migraciones (`202605102310`, `202605110950`) antes de tener `CREATE TABLE` propio.
- `order_cards`: referenciada desde `202605110950`, pero su `CREATE TABLE` real llegó recién en `202607150001_hybrid_order_cards.sql`.

## Row Level Security

RLS está activo en todas las tablas de negocio. El endurecimiento es iterativo y reciente — las últimas migraciones (`202608171200_close_rls_gaps_inventory_claims.sql`, `202608191800_close_rls_gaps_customer_data_admin_only.sql`, `202608192000_close_rls_gaps_cards_inventory_dispatch_waitlist.sql`, `202608201700_close_payment_bypass_and_inventory_gaps.sql`, `202608201900_...`, `202608202000_...`) cierran brechas encontradas en auditorías de seguridad. Antes de asumir que una tabla está bien protegida, revisar si tiene una migración de cierre de brecha posterior a su creación.
