# KPI Module Corrections — 2026-05-14

## Objetivo
Corregir sesgos P1 del módulo KPI/admin para que el panel ejecutivo use verdad operacional y no subconjuntos o cohortes mal rotuladas.

## Cambios implementados

### 1) Ventas reales últimos 7 días
**Problema anterior:** el gráfico usaba `recentOrders`, que solo cargaba 5 órdenes recientes, por lo que la serie semanal podía quedar subreportada o directamente falsa.

**Corrección aplicada:**
- Se creó `salesTrend7d` en `src/services/api.js`.
- La serie ahora se calcula sobre **todas las órdenes operativas pagadas** dentro de la ventana diaria de 7 días.
- El gráfico `SalesChart` en `src/components/AdminDashboard.jsx` ahora consume esa serie agregada, no la lista corta de órdenes recientes.

### 2) Tendencia semanal del embudo real
**Problema anterior:** el gráfico semanal agrupaba por `created_at` y luego mostraba el estado actual de esas órdenes. Eso era una cohorte disfrazada de throughput diario.

**Corrección aplicada:**
- `weeklyFunnelTrend` ahora se calcula por timestamp real de cada etapa:
  - `paid_at`
  - `ready_at`
  - `shipped_at`
  - `delivered_at`
  - `activated_at` / `activation_last_at`
- Se ajustó el copy del dashboard para declarar explícitamente que el gráfico muestra **throughput real** por hitos diarios.

### 3) Definición de backlog operativo
**Problema anterior:** `pendingOrders` contaba casi todo lo no entregado/cancelado, mezclando estados no cobrados con carga operativa real.

**Corrección aplicada:**
- Se definió `isOperationallyOpen(order)` como:
  - `payment_status === 'paid'`
  - no `failed/cancelled/refunded`
  - `activation_completed === false`
- El KPI de pedidos abiertos ahora representa cola operacional pagada aún no cerrada.

### 4) KPI de órdenes en dashboard de órdenes
**Problema anterior:**
- `Pedidos pendientes` mezclaba estados.
- `Pedidos atrasados` no medía atraso real, solo estados iniciales.

**Corrección aplicada:**
- `Pedidos pendientes` pasa a `Pedidos abiertos`.
- `Pedidos atrasados` pasa a `SLA en riesgo`.
- La nueva lógica de `SLA en riesgo` cuenta órdenes pagadas con más de 24h desde pago y sin activación cerrada.

## Archivos modificados
- `src/services/api.js`
- `src/components/AdminDashboard.jsx`
- `src/components/OrdersDashboard.jsx`

## Validación
- `npm run build` ✅

## Resultado esperado
- El gráfico de ventas semanales deja de subreportar por usar solo 5 órdenes.
- El embudo semanal deja de mezclar cohortes con throughput operativo.
- El backlog ejecutivo pasa a representar carga real pagada pendiente de cierre.
- El módulo de órdenes muestra riesgo SLA real en vez de una aproximación por estado.

## Pendientes recomendados (siguiente iteración)
- Agregar percentiles SLA (`p50`, `p90`) y breach rate por etapa.
- Incorporar comparativos WoW / vs período previo.
- Exponer conversiones etapa a etapa (`Paid→Ready`, `Ready→Shipped`, etc.) como KPI ejecutivo explícito.
