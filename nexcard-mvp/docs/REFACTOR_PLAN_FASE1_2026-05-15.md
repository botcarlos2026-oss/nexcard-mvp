# NexCard — Fase 1 de hardening estructural

Fecha: 2026-05-15

## Objetivo
Bajar riesgo de regresión y costo de cambio sin alterar contratos visibles ni flujos críticos ya operativos.

## Cambios aplicados hoy
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
4. `OrderDetailPanel` y cards internas

### API
Después de `orderOperations`, el siguiente bloque rentable es:
1. `adminDashboard / executiveKpis`
2. `kpiAdmin`

## Riesgos controlados
- Se mantuvieron side effects y flujos server-side intactos
- No se modificaron payloads públicos ni nombres de métodos
- No se tocó el read model de `getOrders`

## Validación esperada
- `npm run test:unit -- --runInBand --watch=false`
- `npm run build`
