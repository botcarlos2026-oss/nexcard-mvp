# KPI Runtime Config + Executive Score — 2026-05-14

## Objetivo
Industrializar la capa KPI para que fees, targets y thresholds no dependan solo de hardcodes, y agregar un score ejecutivo compuesto para lectura rápida de salud.

## Cambios implementados

### 1) Configuración persistente preparada en DB
Se agregó la migración:
- `supabase/migrations/202605141500_kpi_runtime_config.sql`

Tabla nueva:
- `public.kpi_runtime_config`

Campos:
- `key`
- `config` (`jsonb`)
- `active`
- timestamps

Uso esperado:
- `sla_targets`
- `payment_method_fees`
- `wow_alert_thresholds`

### 2) Fallback seguro en aplicación
`getAdminDashboard()` ahora intenta leer configuración activa desde `kpi_runtime_config`.

Si la tabla no existe o falla el fetch:
- usa fallback desde `src/config/admin.js`
- el dashboard sigue operativo
- no se rompe la carga admin

### 3) API lista para administración futura
Se agregaron métodos:
- `api.getKpiRuntimeConfig()`
- `api.upsertKpiRuntimeConfig()`

Esto deja la base lista para una futura UI de administración KPI sin rehacer capa de datos.

### 4) Executive score compuesto
Se agregó `executiveScore` al dashboard con:
- score 0-100
- banda (`strong`, `healthy`, `watch`, `critical`)
- drivers resumidos

Inputs actuales del score:
- delta revenue 7d
- delta tasa de pago
- volumen de SLA breaches
- volumen de alertas WoW
- claim rate promedio del top SKU mix

### 5) Transparencia de fuente de configuración
El panel ahora informa si está usando:
- configuración persistente activa, o
- fallback seguro desde código

## Archivos modificados
- `supabase/migrations/202605141500_kpi_runtime_config.sql`
- `src/services/api.js`
- `src/components/AdminDashboard.jsx`

## Validación
- `npm run build` ✅

## Resultado
Con esta etapa el módulo KPI deja de depender completamente de constantes hardcodeadas y pasa a un modelo híbrido:
- persistencia preparada
- fallback seguro
- score ejecutivo resumido para lectura COO

## Siguiente paso recomendado
- aplicar migración remota y sembrar config inicial
- crear UI admin de KPI config
- cron/alerta outbound cuando `executiveScore` caiga de banda saludable
