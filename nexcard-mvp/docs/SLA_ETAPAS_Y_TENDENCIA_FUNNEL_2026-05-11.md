# SLA por etapa y tendencia semanal del funnel (2026-05-11)

## Objetivo
Subir el nivel del dashboard desde alertas puntuales a control operacional más fino:
- cuánto tarda cada etapa
- dónde se acumula fricción
- si el embudo mejora o empeora día a día

## Qué se agregó

### 1. SLA promedio por etapa
`getAdminDashboard()` ahora calcula promedios en horas para:
- `Paid → Ready`
- `Ready → Shipped`
- `Shipped → Delivered`
- `Delivered → Activated`

Cada métrica muestra también tamaño de muestra (`sample_size`) para evitar conclusiones falsas con pocos casos.

### 2. Tendencia semanal del embudo
Se agregó `weeklyFunnelTrend` con ventana móvil de 7 días.

Por cada día se muestran conteos de:
- `paid`
- `ready`
- `shipped`
- `delivered`
- `activated`

Eso permite ver rápido si:
- entra volumen pero no avanza a despacho
- se entrega pero no se activa
- hay desacople entre pago y operación

## Cambios técnicos

### `src/services/api.js`
`getAdminDashboard()` ahora también:
- calcula `stageSla`
- calcula `weeklyFunnelTrend`
- devuelve ambas estructuras junto al resto del dashboard

### `src/components/AdminDashboard.jsx`
Se agregaron:
- cards de SLA por etapa
- gráfico compacto de tendencia semanal del funnel

### `src/components/ui/AdminStat.jsx`
Se ampliaron acentos visuales para soportar:
- `blue`
- `violet`
- `fuchsia`

## Lectura ejecutiva
Esto ya no es solo observabilidad.
Es **control de throughput**.

Con esta capa, Carlos puede detectar:
- si el problema está en producción
- si el problema está en despacho
- si el problema está en activación final
- si el cuello es aislado o sostenido en la semana
