# KPI Executive Layer — 2026-05-14

## Objetivo
Agregar una segunda capa gerencial al módulo KPI para que el dashboard no solo muestre foto operativa, sino también performance comparativa y calidad de ejecución por etapa.

## Cambios implementados

### 1) Percentiles SLA por etapa
Se extendió `stageSla` para incluir:
- `avg_hours`
- `p50_hours`
- `p90_hours`
- `max_hours`
- `sample_size`
- `breach_count`
- `breach_rate`
- `target_hours`

Targets usados en esta iteración:
- Paid → Ready: 24h
- Ready → Shipped: 24h
- Shipped → Delivered: 72h
- Delivered → Activated: 24h

### 2) Conversiones ejecutivas entre etapas
Se agregó `conversionStats` con tasas de conversión reales del embudo operativo:
- `paid_to_ready`
- `ready_to_shipped`
- `shipped_to_delivered`
- `delivered_to_activated`

Estas métricas permiten detectar el cuello exacto del flujo sin depender solo del volumen absoluto.

### 3) Comparativos contra período anterior
Se agregó `kpiComparisons` para comparar ventana actual de 7 días vs ventana previa de 7 días en:
- revenue cobrado
- paid orders
- tasa de pago

Campos expuestos:
- `current`
- `previous`
- `delta_pct` o `delta_pts`

## UI actualizada
En `AdminDashboard` ahora se muestran:
- comparativo 7d vs período previo
- conversiones por etapa del embudo
- hints SLA con `p50`, `p90` y `% breach`

## Archivos modificados
- `src/services/api.js`
- `src/components/AdminDashboard.jsx`

## Validación
- `npm run build` ✅

## Resultado
El dashboard ya no es solo operativo. Ahora también permite lectura ejecutiva de:
- tendencia vs período anterior
- eficiencia del funnel por etapa
- dispersión SLA y no solo promedio

## Próximo salto recomendado
- filtros por carrier / método de pago / producto
- deltas MTD y no solo rolling 7d
- target parametrizable desde config/admin
