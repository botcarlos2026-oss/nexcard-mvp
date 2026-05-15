# NexCard — Frontend API Architecture Snapshot

Fecha: 2026-05-15

## Objetivo
Dejar registro del estado final de la capa `src/services/api` después de la fase de hardening estructural y extracción por dominios.

## Estado final
La capa pública sigue exponiendo una sola fachada:
- `src/services/api.js`

Pero la lógica ya no vive concentrada ahí.

`api.js` quedó como:
1. utilidades transversales pequeñas
2. bootstrap de dependencias (`supabase`, `request`, auth helpers)
3. composición de módulos por dominio
4. fachada pública estable `api.*`

Tamaño residual al cierre de fase:
- `src/services/api.js` → **433 líneas**

## Módulos extraídos por dominio
### Operación / core comercial
- `src/services/api/orders.js`
- `src/services/api/orderOperations.js`
- `src/services/api/payments.js`
- `src/services/api/products.js`
- `src/services/api/inventory.js`

### Identidad / activos
- `src/services/api/profiles.js`
- `src/services/api/cards.js`
- `src/services/api/reviewCards.js`

### KPI / observabilidad / admin
- `src/services/api/kpis.js`
- `src/services/api/kpiAdmin.js`
- `src/services/api/adminDashboard.js`

### Growth / CRM / promos
- `src/services/api/crm.js`
- `src/services/api/wheel.js`

## Contrato preservado
Durante toda la refactorización se mantuvo este principio:
- **no cambiar la interfaz pública `api.*`**

Eso permitió:
- mover lógica sin tocar consumidores masivamente
- validar por regresión con menor radio de impacto
- separar dominios sin reescribir pantallas críticas

## Qué sigue viviendo en `api.js`
Al cierre de fase, `api.js` conserva solo responsabilidades razonables de fachada:
- `request()` para fallback HTTP
- auth/session storage helpers
- composición de módulos
- algunos bloques residuales pequeños:
  - `teamMembers`
  - `productsAdmin`
  - forwards KPI públicos

## Criterio de cierre de fase
Se decidió **no seguir fragmentando** `teamMembers` y `productsAdmin` porque:
1. el tamaño residual ya bajó a un rango manejable
2. el ROI marginal de nuevas extracciones cayó fuerte
3. convenía más estabilizar y endurecer tests que seguir cortando por simetría

## Testing agregado en la fase
Se reforzó cobertura específica en módulos nuevos:
- `reviewCards`: fallback RPC → update directo
- `crm`: reutilización de carrito abandonado, inserción nueva, `updated_at`
- `wheel`: selección de promo activa y normalización de coupon code
- `kpiAdmin`: validación de runtime config
- `cards`, `orderOperations`, `orders/utils`: helpers puros y contratos críticos

## Resultado operativo
Al cierre de esta fase:
- build OK
- 9 suites unitarias OK
- 33 tests OK
- múltiples extracciones empujadas a `origin/main`

## Lectura ejecutiva
La arquitectura frontend dejó de depender de un `api.js` monolítico.
Ahora existe una fachada estable con dominios separados detrás, lo que baja:
- riesgo de regresión
- costo de cambio
- acoplamiento entre features administrativas y operativas
