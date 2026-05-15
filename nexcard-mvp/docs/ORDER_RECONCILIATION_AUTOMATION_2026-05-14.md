# Order Reconciliation Automation — 2026-05-14

## Objetivo
Pasar de observabilidad pasiva a acción automática controlada:
- auto-reconciliar drift seguro entre `orders` y `payments`
- escalar solo casos raros o riesgosos

## Componentes agregados

### 1) Edge Function
- `supabase/functions/reconcile-order-payments/index.ts`

Función:
- lee `order_payment_reconciliation_queue`
- procesa lote pequeño (`limit`, default 20)
- corre serial para evitar bursts innecesarios
- usa `reconcile_order_payment_status(...)`
- devuelve resumen ejecutivo:
  - `auto_reconciled`
  - `manual_review_required`
  - `missing_active_payment_ledger`
  - `failed`

### 2) Script runner operativo
- `scripts/run-order-payment-reconciliation.mjs`

Comandos:
- `npm run ops:reconcile-orders`
- `npm run ops:reconcile-orders:dry`
- `npm run ops:reconcile-orders:cron`

### 3) Config Supabase
- `supabase/config.toml`
- `verify_jwt = false` para `reconcile-order-payments`

Esto permite invocación controlada tipo cron/script con service-role encapsulado dentro de la Edge Function.

## Criterio de seguridad
La automatización NO fuerza todo.

Auto-reconcilia solo cuando el RPC lo considera seguro.

Quedan para revisión manual los casos como:
- `paid` que se degradaría a `pending/failed`
- `refunded` que se intentaría reabrir
- órdenes sin payment ledger activo
- cualquier error RPC

## Resultado esperado
En régimen, el sistema debería:
- limpiar solo drift mecánico
- dejar pocos casos humanos
- bajar ruido en operación y reportes KPI

## Próximo uso recomendado
Programar cron aislado cada 30 min con alertado por falla.

Payload sugerido:
- `npm run ops:reconcile-orders:cron`

## Validación local posible
- unit tests frontend
- build frontend
- dry-run del script si la function está desplegada

## Limitación
Sin deploy de la Edge Function nueva, el script no podrá ejecutarse todavía contra Supabase.
