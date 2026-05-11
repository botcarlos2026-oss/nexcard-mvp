# KPIs, alertas y SLA básicos sobre observabilidad (2026-05-11)

## Objetivo
Convertir la trazabilidad post-pago ya implementada en señales ejecutivas accionables para operación diaria.

## Qué se agregó

### 1. KPIs del embudo en dashboard admin
En `AdminDashboard` ahora se muestran contadores directos para:
- `Paid`
- `Ready`
- `Shipped`
- `Delivered`
- `Activated`

Base lógica:
- se calculan desde órdenes enriquecidas por `fetchOrders()`
- `Activated` usa la señal consolidada `activation_completed`

### 2. Alertas operativas visibles
Nuevo bloque: **Alertas operativas**

Muestra órdenes con excepciones detectadas por la capa de observabilidad, por ejemplo:
- pagada sin entrar a producción
- orden avanzada sin card vinculada
- entregada sin activación cerrada
- claim pendiente post-entrega

### 3. SLA en riesgo
Nuevo bloque: **SLA en riesgo**

Regla inicial implementada:
- orden `paid` con **24h o más** desde `paid_at`
- y **sin activación cerrada**

Objetivo:
- mostrar rápido dónde se está acumulando costo operativo o riesgo de soporte

## Cambios técnicos

### `src/services/api.js`
`getAdminDashboard()` ahora:
- reutiliza `fetchOrders()` enriquecido
- calcula funnel operativo
- arma lista de `operationalAlerts`
- arma lista de `slaBreaches`

### `src/components/AdminDashboard.jsx`
Se agregaron:
- cards del funnel
- bloque de alertas operativas
- bloque de SLA en riesgo

## Lectura ejecutiva
Con esto el dashboard deja de mostrar solo actividad y empieza a mostrar:
- embudo real
- excepciones relevantes
- aging operacional

Eso mejora control y priorización sin meter complejidad innecesaria todavía.
