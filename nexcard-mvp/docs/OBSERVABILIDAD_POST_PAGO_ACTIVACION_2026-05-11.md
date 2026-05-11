# Observabilidad post-pago / activación — 2026-05-11

## Objetivo
Cerrar el vacío operativo entre pago, preparación, despacho, entrega y activación para que el admin vea el embudo real y detecte órdenes grises antes de que generen soporte manual.

## Qué se implementó

### 1. Enriquecimiento de órdenes en `src/services/api.js`
`fetchOrders()` ahora agrega una capa de observabilidad derivada por orden usando:
- `orders`
- `payments`
- `cards`
- `order_cards`
- `profile_claims`
- `profiles`

Campos derivados principales:
- `related_cards`
- `activation_claim`
- `active_cards_count`
- `assigned_cards_count`
- `programmed_cards_count`
- `activation_ready`
- `activation_completed`
- `card_lifecycle_ready`
- `delivery_ready`
- `funnel_stage`
- `terminal_state`
- `observability_alerts`
- `activation_last_at`

### 2. Embudo operativo visible en `OrdersDashboard`
Se agregó un bloque superior con embudo real:
- `paid`
- `ready`
- `shipped`
- `delivered`
- `activated`

La base del embudo es `payment_status = paid`.
Cada etapa muestra:
- volumen
- % sobre base pagada
- excepciones detectadas

### 3. Trazabilidad por orden
En el detalle de la orden se agregó un bloque de trazabilidad post-pago con:
- estado terminal / etapa actual
- mini timeline `paid → ready → shipped → delivered → activated`
- señal de claim
- alertas operativas
- trazabilidad de cards relacionadas

## Reglas de excepción implementadas
Hoy se levantan alertas cuando ocurre alguno de estos casos:
- orden pagada pero todavía en `fulfillment_status = new`
- orden en `ready/shipped/delivered` sin card vinculada
- orden `delivered` sin activación cerrada
- activación detectada antes de entrega confirmada
- claim pendiente después de entrega

## Criterio usado para activación
Se considera activación cerrada si ocurre al menos una de estas condiciones:
- existe card relacionada con `status = active`
- existe card relacionada con `activation_status = activated`
- existe `profile_claim` en estado `claimed`

## Limitaciones actuales
Esta capa todavía es **derivada en aplicación**, no completamente consolidada server-side.

Eso implica que aún conviene endurecer una segunda capa con:
1. timestamps formales `paid_at`, `ready_at`, `shipped_at`, `delivered_at`, `activated_at`
2. historial formal de activación / claim / programación NFC
3. vista materializada o RPC operativa para que el panel no dependa tanto de lógica frontend

## Validación ejecutada
- `npm run lint` ✅
- `npm run build` ✅

## ROI esperado
Este cambio baja costo operativo en tres frentes:
- menos órdenes invisibles o ambiguas
- menos soporte manual para revisar dónde quedó cada compra
- mejor lectura del cuello de botella real entre cobro, fulfillment y activación
