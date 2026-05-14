# KPI Runtime Admin + Remote Apply — 2026-05-14

## Objetivo
Cerrar la sexta etapa del módulo KPI dejando:
- edición administrativa de parámetros KPI desde UI
- configuración persistente sembrada en Supabase
- migraciones remotas aplicadas
- fallback seguro intacto

## Cambios implementados

### 1) UI admin para runtime config KPI
En `AdminDashboard` se agregó una sección **KPI runtime config** con edición JSON y guardado por bloque para:
- `sla_targets`
- `payment_method_fees`
- `wow_alert_thresholds`

La UI usa:
- `api.getKpiRuntimeConfig()`
- `api.upsertKpiRuntimeConfig()`

### 2) Seed persistente inicial
Se agregó la migración:
- `supabase/migrations/202605141520_kpi_runtime_config_seed.sql`

Esta deja cargados por defecto:
- SLA targets
- fees por método de pago
- thresholds WoW

### 3) Aplicación remota de migraciones
Se ejecutó `supabase db push --include-all`.

Resultado:
- se corrigió y aplicó `202605030003_weekly_kpi_cron.sql`
- se aplicó `202605141500_kpi_runtime_config.sql`
- se aplicó `202605141520_kpi_runtime_config_seed.sql`

Observación:
- `pg_cron` no está disponible en remoto, por lo que la migración vieja dejó un `NOTICE` y no programa cron nativo en DB. Eso no bloquea KPI runtime config.

### 4) Corrección histórica de migración vieja
Se corrigió la migración `202605030003_weekly_kpi_cron.sql` para evitar conflicto de delimitadores SQL en el bloque `cron.schedule(...)`.

## Validación
- `npm run build` ✅
- `supabase db push --include-all` ✅

## Resultado
Con esta etapa ya quedó operativo el circuito completo:
- fallback en código
- runtime config persistente
- seed inicial en DB
- edición admin desde dashboard
- score ejecutivo y alertas usando parámetros configurables

## Próximo salto recomendado
- UI dedicada con validación por campo en vez de JSON libre
- versionado/auditoría de cambios KPI runtime
- alerta outbound real cuando `executiveScore` entre en `watch` o `critical`
