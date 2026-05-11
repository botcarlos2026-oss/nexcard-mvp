# Alerta proactiva operativa (2026-05-11)

## Objetivo
Pasar de observabilidad pasiva a priorización accionable.

La idea no es solo mostrar métricas, sino decir:
- qué duele más ahora
- cuántos casos tiene
- qué acción conviene tomar primero

## Qué se agregó

### 1. `proactiveSummary`
`getAdminDashboard()` ahora sintetiza una prioridad operativa principal.

Entrega:
- `headline`
- `severity`
- `count`
- `action`
- `secondary_count`

Si no hay excepciones relevantes, responde:
- `Operación estable`

### 2. `proactiveQueue`
Se agregó una cola priorizada de ataque sobre excepciones reales.

Tipos contemplados:
- `sla_breaches`
- `delivered_pending_activation`
- `advanced_without_card`
- `paid_without_production`
- `pending_claim_post_delivery`

Ordenamiento:
- primero por severidad
- luego por volumen

### 3. Visualización en dashboard
`AdminDashboard` ahora muestra:
- banner superior **Prioridad operativa ahora**
- bloque **Cola proactiva sugerida**

Eso convierte el panel en un instrumento de decisión, no solo de monitoreo.

## Regla de negocio detrás
Esto sigue una lógica de margen/flujo:
- primero se atacan órdenes con SLA roto
- luego entregas sin activación
- luego incoherencias físicas (`order-card`)
- luego pagos atrapados antes de producción
- después claims pendientes post-entrega

## Cambios técnicos

### `src/services/api.js`
Se agregaron:
- `alertBuckets`
- `proactiveCandidates`
- `proactiveQueue`
- `proactiveSummary`

### `src/components/AdminDashboard.jsx`
Se agregaron:
- banner de prioridad operativa
- lista priorizada de cola operativa

## Lectura ejecutiva
Esto reduce tiempo de interpretación.

Antes:
- el operador veía métricas y debía inferir prioridad

Ahora:
- el sistema propone dónde atacar primero
- con mejor alineación a SLA, soporte y riesgo operativo
