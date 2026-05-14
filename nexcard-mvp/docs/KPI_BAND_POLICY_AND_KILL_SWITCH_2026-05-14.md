# KPI Band Policy + Kill Switch — 2026-05-14

## Objetivo
Seguir industrializando alertas ejecutivas con control fino por banda:
- cooldown diferenciado
- recipients diferenciados
- kill switch operativo

## Cambios implementados

### 1) Nueva runtime config por banda
Nuevo bloque:
- `executive_alert_band_policy`

Campos:
- `kill_switch`
- `watch_cooldown_minutes`
- `critical_cooldown_minutes`
- `watch_recipients_csv`
- `critical_recipients_csv`

Seed remoto aplicado:
- `supabase/migrations/202605141700_kpi_executive_alert_band_policy_seed.sql`

### 2) Cooldown distinto por banda
La lógica ahora usa:
- `critical_cooldown_minutes` cuando la banda es `critical`
- `watch_cooldown_minutes` cuando la banda es `watch`

Esto baja latencia en incidentes críticos sin volver ruidoso el modo watch.

### 3) Routing por severidad
La audiencia ya no depende solo del routing genérico.

Ahora:
- `critical` puede llegar a una lista más amplia
- `watch` puede quedarse en una lista más acotada

### 4) Kill switch
Si `kill_switch=1`:
- la alerta deja de ser elegible
- `blocked_reason` pasa a `kill_switch_active`

Sirve como freno de emergencia sin tocar código ni deploy.

### 5) Dashboard
Se agregó visibilidad de:
- kill switch
- policy por banda editable
- recipients por banda

## Validación
- `npm run build` ✅
- `supabase db push` ✅

## Resultado
La capa de alertas quedó con mucho mejor gobierno:
- distinto tratamiento para watch y critical
- freno de emergencia
- menos riesgo de ruido ejecutivo

## Lo que todavía falta para autonomía completa
Aún falta portar la **evaluación del executive score fuera del dashboard** a una función backend/edge propia.
Hoy el sistema ya puede despachar automáticamente cuando se evalúa el dashboard, pero no tiene todavía un evaluador autónomo completamente desacoplado de la UI.

Ese es el siguiente bloque serio.
