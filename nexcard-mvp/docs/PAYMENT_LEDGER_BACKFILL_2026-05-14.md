# Payment Ledger Backfill — 2026-05-14

## Problema detectado
La reconciliación automática order↔payment estaba sana técnicamente, pero subutilizada por una deuda histórica:

- múltiples órdenes tenían `order.payment_status`
- pero no tenían filas activas en `payments`

Resultado:
- `missing_active_payment_ledger`
- 0 auto-reconciliaciones reales
- observabilidad correcta, pero poca capacidad de corrección automática

## Heurística aplicada
Se eligió un backfill **conservador**, no cosmético.

### Sí backfill
Órdenes con `active_payments = 0` y además:
- `payment_status in ('paid', 'refunded', 'failed')`
- **o** `mp_payment_id` presente

### No backfill por ahora
- `pending` sin `mp_payment_id`

Razón:
- no conviene inventar pagos en órdenes donde probablemente nunca hubo confirmación real

## Componentes agregados

### 1) Edge Function
- `supabase/functions/backfill-payment-ledger/index.ts`

Hace:
- lee la cola de reconciliación sin ledger
- filtra candidatas elegibles
- en dry-run reporta elegibles
- en modo real inserta fila mínima en `payments`
- deja `audit_log` con acción `payment_ledger_backfill`

### 2) Runner operativo
- `scripts/run-payment-ledger-backfill.mjs`

Comandos:
- `npm run ops:backfill-payments`
- `npm run ops:backfill-payments:dry`

### 3) Config Supabase
- `supabase/config.toml`
- `verify_jwt = false` para `backfill-payment-ledger`

## Inserción mínima esperada
La fila backfilled contiene:
- `order_id`
- `provider` derivado de `payment_method`
- `status` desde `orders.payment_status`
- `amount_cents`
- `currency`
- `external_id` si existe `mp_payment_id`
- `payload.source = historical_payment_ledger_backfill`

## Criterio financiero
Este diseño protege margen mejor que un backfill agresivo porque:
- repara historia útil para reconciliación
- evita crear “pagos fantasmas” en pendientes viejos
- mejora reportabilidad sin contaminar caja

## Siguiente verificación recomendada
1. correr dry-run
2. correr modo real
3. rerun de `ops:reconcile-orders:dry`
4. confirmar reducción de `missing_active_payment_ledger`
