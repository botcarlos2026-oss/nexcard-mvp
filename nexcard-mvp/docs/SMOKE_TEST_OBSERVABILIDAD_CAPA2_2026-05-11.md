# Smoke test funcional — observabilidad capa 2 (2026-05-11)

## Objetivo
Validar en producción, con el menor riesgo posible, que la segunda capa de observabilidad server-side realmente registra el embudo completo:
- `paid`
- `ready`
- `shipped`
- `delivered`
- `activated`

## Enfoque usado
Para no intervenir órdenes reales de clientes:
- se creó una **orden sintética efímera**
- se forzó el avance controlado del flujo usando el bypass interno `app.order_transition_bypass`
- se validó el resultado vía lectura read-only por Supabase Management API
- luego se eliminó la orden sintética y sus artefactos dependientes

## Orden de prueba
Nombre usado:
- `SMOKE OBS L2 2026-05-11T10:16`

## Resultado validado
La orden de prueba terminó con:
- `payment_status = paid`
- `fulfillment_status = delivered`
- `paid_at` ✅
- `ready_at` ✅
- `shipped_at` ✅
- `delivered_at` ✅
- `activated_at` ✅

Además, `order_operational_events` registró exactamente 5 eventos esperados:
- `paid:payment_status_paid`
- `ready:fulfillment_ready`
- `shipped:fulfillment_shipped`
- `delivered:fulfillment_delivered`
- `activated:activation_completed`

## Evidencia funcional observada
Respuesta validada durante el test:
- `event_count = 5`
- `event_flow = paid:payment_status_paid | ready:fulfillment_ready | shipped:fulfillment_shipped | delivered:fulfillment_delivered | activated:activation_completed`

## Limpieza ejecutada
Se eliminaron los artefactos asociados al smoke test:
- `order_operational_events`
- `order_status_history`
- `order_cards`
- `profile_claims`
- `inventory_movements`
- `refunds`
- `payments`
- `order_items`
- `orders`

Verificación final:
- `remaining_orders = 0`

## Lectura ejecutiva
La capa 2 quedó validada de punta a punta.
No solo existe el schema/triggers: también **funciona** el registro real del funnel completo en producción.
