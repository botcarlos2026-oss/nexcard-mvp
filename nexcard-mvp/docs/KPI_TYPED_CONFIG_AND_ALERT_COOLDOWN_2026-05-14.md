# KPI Typed Config + Alert Cooldown — 2026-05-14

## Objetivo
Quitar fragilidad operativa en la capa KPI:
- reemplazar edición JSON libre por inputs tipados
- agregar política configurable de alertas ejecutivas
- persistir estado de cooldown/deduplicación

## Cambios implementados

### 1) Config KPI tipada en AdminDashboard
La sección `KPI runtime config` dejó de depender de textarea JSON.

Ahora usa inputs numéricos tipados para:
- `sla_targets`
- `payment_method_fees`
- `wow_alert_thresholds`
- `executive_alert_policy`

Resultado:
- menos error manual
- menor probabilidad de romper score/alertas por formato inválido
- edición más rápida para operación real

### 2) Política ejecutiva de alertas
Se agregó en `src/config/admin.js` y runtime config:
- `KPI_EXECUTIVE_ALERT_POLICY`

Campos:
- `enabled`
- `cooldown_minutes`
- `dedupe_by_band`
- `min_band_watch`
- `min_band_critical`

Esto permite controlar cuándo una alerta ejecutiva es elegible antes de conectar salida real.

### 3) Estado persistente de alertas
Nueva migración:
- `supabase/migrations/202605141610_kpi_alert_state.sql`

Tabla:
- `public.kpi_alert_state`

Guarda:
- `alert_key`
- `last_band`
- `last_score`
- `cooldown_minutes`
- `last_sent_at`
- `last_payload`

### 4) Seed de policy
Nueva migración:
- `supabase/migrations/202605141615_kpi_executive_alert_policy_seed.sql`

Deja cargada la policy inicial de alertas ejecutivas.

### 5) Lógica de dedupe/cooldown en dashboard
`getAdminDashboard()` ahora calcula:
- `should_send`
- `in_cooldown`
- `blocked_reason`
- `last_band`
- `last_sent_at`

Todo expuesto dentro de:
- `transportReadiness.executive_alert_state`

### 6) Dry-run state update
Se agregó `api.upsertKpiAlertState()` y un botón en dashboard:
- **Marcar enviado (dry-run)**

Sirve para simular despacho y probar cooldown/deduplicación sin salida real.

## Validación
- `npm run build` ✅
- `supabase db push` ✅

## Resultado
Esta etapa deja la capa KPI bastante más madura:
- configuración tipada
- policy de alertas
- memoria persistente de alertas
- control de ruido antes de automatizar envío real

## Próximo paso recomendado
- conectar webhook/email real usando `should_send`
- agregar cooldown por severidad/banda
- persistir hash de payload para dedupe más fino
- panel de historial específico de alertas emitidas
