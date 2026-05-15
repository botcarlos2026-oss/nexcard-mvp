# Order Reconciliation & Operational Anomalies — 2026-05-14

## Objetivo
Agregar una capa más escalable al motor operacional de NexCard:
- detectar drift entre `orders` y `payments`
- detectar aging operacional más caro
- dejar una base SQL para reconciliación controlada

## Qué se agregó

### 1) Vista SQL de reconciliación
Se creó:
- `public.order_payment_reconciliation_queue`

Entrega por orden:
- `order_payment_status`
- `payment_statuses`
- `active_payments`
- `suggested_order_payment_status`
- `has_drift`
- `drift_reason`

Uso:
- detectar rápido órdenes donde `orders.payment_status` ya no coincide con el ledger real

### 2) RPC de reconciliación controlada
Se creó:
- `public.reconcile_order_payment_status(target_order_id, actor_id, reason)`

Comportamiento:
- reconcilia solo cuando es seguro
- evita downgrade automático de órdenes ya `paid`
- evita reabrir órdenes `refunded`
- si la orden pagada está en `new`, puede empujarla a `in_production`
- si la situación es riesgosa, devuelve `manual_review_required`

### 3) Observabilidad operacional más útil en frontend
`src/services/api/orders.js` ahora deriva también:
- drift entre `order.payment_status` y `payments`
- aging pagada sin llegar a `ready`
- aging despacho sin entrega confirmada
- aging entrega sin activación final
- score/nivel de anomalía

### 4) Admin dashboard con señal más ejecutiva
`AdminDashboard` ahora destaca explícitamente:
- `drift pago`
- severidad de alerta (`critical`, `high`, etc.)

## Archivos
- `supabase/migrations/202605142130_order_payment_reconciliation.sql`
- `src/services/api/orders.js`
- `src/services/api.js`
- `src/components/AdminDashboard.jsx`

## Validación ejecutada
- `npm run test:unit -- --runInBand --watch=false`
- `npm run build`

## Limitación actual
No se pudo correr `deno check` local porque `deno` no está instalado en esta máquina.

## ROI
Esto mejora dos cosas críticas:
1. detectar antes el drift que contamina fulfillment/refunds/KPI
2. priorizar casos operativos por severidad en vez de revisar órdenes “a ojo”

## Siguiente paso recomendado
El próximo bloque más rentable sería:
- cron/worker que lea `order_payment_reconciliation_queue`
- auto-reconcilie solo casos seguros
- y mande alerta solo para `manual_review_required` o drift persistente
