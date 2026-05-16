# NexCard — Fase 1 de hardening estructural

Fecha: 2026-05-15

## Objetivo
Bajar riesgo de regresión y costo de cambio sin alterar contratos visibles ni flujos críticos ya operativos.

## Cambios aplicados hoy
### 0. Segunda ola sobre OrdersDashboard
- `src/components/orders/OrdersDashboardHeader.jsx`
- `src/components/orders/OrdersFiltersBar.jsx`
- `src/components/orders/OrdersTable.jsx`
- `src/components/OrdersDashboard.jsx` ahora delega superficie visual, pero mantiene estado/side effects centralizados

### 0.1 Tercera ola sobre OrdersDashboard
- `src/components/orders/OrderTraceabilityCard.jsx`
- `src/components/orders/OrderQaAuditCard.jsx`
- `src/components/orders/OrderNfcCard.jsx`
- `src/components/orders/OrderRefundCard.jsx`
- `OrdersDashboard.jsx` delega cards críticas del panel derecho, manteniendo orchestration/state en el contenedor

### 0.2 Primera ola de Fase 2 sobre OrdersDashboard
- `src/components/orders/utils.js` absorbe lógica pura de:
  - normalización de órdenes
  - conteos QA/test
  - filtros derivados
  - stats del dashboard
  - funnel snapshot
- `src/components/orders/utils.test.js` amplía cobertura de helpers del dashboard
- `src/components/OrdersDashboard.jsx` baja de **1350 → 1226 líneas** manteniendo handlers/side effects en el contenedor

### 0.3 Segunda ola de Fase 2 sobre OrdersDashboard
- `src/components/orders/utils.js` absorbe helpers puros de:
  - parseo de query params QA/auditoría
  - reconstrucción de URL de filtros QA
- `src/components/orders/utils.test.js` agrega cobertura sobre parse/build de estado URL
- `OrdersDashboard.jsx` reduce ruido cognitivo del bloque de sincronización URL/filters aunque el tamaño bruto no cae materialmente por wrapping

### 0.4 Tercera ola de Fase 2 sobre OrdersDashboard
- `src/components/orders/useOrdersDashboardActions.js` absorbe handlers operativos de:
  - update/transition
  - link card
  - programación NFC
  - despacho
  - QA override / review
  - refund
  - acciones rápidas de pago/fulfillment
- `OrdersDashboard.jsx` baja de **1226 → 1099 líneas**
- el contenedor conserva estado y composición visual, pero ya no carga el paquete principal de side effects operativos

### 0.5 Cuarta ola de Fase 2 sobre OrdersDashboard
- `src/components/orders/useOrdersDashboardDetailState.js` absorbe:
  - selección de orden activa
  - audit override derivado
  - timeline QA derivado
  - inicialización del panel derecho
  - carga de slug NFC y refund asociado
- `src/components/orders/useOrdersDashboardRuntime.js` absorbe:
  - refresh manual
  - auto-refresh 30s
  - carga de historial
  - sync de selección con URL
- `OrdersDashboard.jsx` baja de **1099 → 1007 líneas**
- el contenedor queda mucho más cerca de coordinator puro

### 1. Extracción dominio cards
- `src/services/api/cards.js`
- `src/services/api/cards.test.js`
- `src/services/api.js` queda como facade

### 2. Extracción dominio order operations / fulfillment
- `src/services/api/orderOperations.js`
- `src/services/api/orderOperations.test.js`
- Se movieron desde `api.js`:
  - `updateOrder`
  - `overrideOrderTestClassification`
  - `reviewOrderTestClassification`
  - `updateShipping`
  - `dispatchOrder`
  - `linkOrderCard`
  - `updateCardNFC`

### 3. Extracción helpers puros de OrdersDashboard
- `src/components/orders/utils.js`
- `src/components/orders/utils.test.js`
- `OrdersDashboard.jsx` conserva comportamiento pero reduce lógica embebida

## Principios usados
1. No cambiar la interfaz pública `api.*`
2. Mover primero lógica pura o dominios autocontenidos
3. Validar con tests unitarios + build
4. Evitar reescribir estado complejo de `OrdersDashboard` en esta fase

## Siguiente corte recomendado
### OrdersDashboard
Extraer por UI primero, no por estado:
1. `OrdersDashboardHeader`
2. `OrdersFiltersBar`
3. `OrdersTable`
4. `OrderDetailPanel` y cards internas ✅

### AdminDashboard
- `src/components/admin/AdminDashboardOverviewSection.jsx`
- `src/components/admin/AdminDashboardAlertingSection.jsx`
- `src/components/admin/AdminDashboardProfilesSection.jsx`
- `src/components/AdminDashboard.jsx` ya delega:
  - overview/KPIs/cola QA/wow alerts
  - alerting ejecutivo / runtime config / transporte automático
  - profiles table / recent orders / diagnóstico final
- siguiente corte rentable ya no es UI principal: conviene volver a `api.js` o endurecer QA/roles

### API
Bloques extraídos desde `api.js` al cierre de fase:
1. `cards`
2. `orderOperations`
3. `kpiAdmin` (`src/services/api/kpiAdmin.js`)
4. `adminDashboard` (`src/services/api/adminDashboard.js`)
5. `reviewCards` (`src/services/api/reviewCards.js`)
6. `crm` (`src/services/api/crm.js`)
7. `wheel` (`src/services/api/wheel.js`)

Cierre de fase:
1. `api.js` queda estable como facade final de **433 líneas**
2. `teamMembers` y `productsAdmin` quedan adentro por ROI marginal bajo
3. el siguiente trabajo correcto ya no es fragmentar por simetría, sino mantener y endurecer cobertura donde haga falta

## Riesgos controlados
- `reviewCards` ahora tiene cobertura sobre fallback RPC→update directo.
- `crm` ahora cubre reutilización de carrito abandonado, inserción nueva y timestamp en update.
- `wheel` ahora tiene cobertura sobre selección de promo activa y validación de coupon code.
- Se mantuvieron side effects y flujos server-side intactos
- No se modificaron payloads públicos ni nombres de métodos
- No se tocó el read model de `getOrders`

## Validación final ejecutada
- `npm run test:unit -- --runInBand --watch=false`
- `npm run build`
- estado final observado: **9 suites / 33 tests OK / build OK**
