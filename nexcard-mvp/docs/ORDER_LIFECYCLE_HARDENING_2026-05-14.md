# Order Lifecycle Hardening — 2026-05-14

## Diagnóstico
El siguiente riesgo estructural en NexCard no era KPI sino integridad operacional del lifecycle:

- `mp-webhook` mutaba `orders.payment_status` y `orders.fulfillment_status` directo
- `process-refund` mutaba `orders.payment_status` directo
- eso abría drift entre:
  - reglas admin
  - historial `order_status_history`
  - ledger `payments`
  - webhooks/refunds service-side

Además había un bug de idempotencia peligroso:
- si llegaba un evento posterior con el mismo `mp_payment_id`, el webhook podía ignorarlo por duplicado
- eso podía dejar una orden pegada sin avanzar a `paid` aunque el pago sí hubiese quedado aprobado

## Primera etapa aplicada

### 1) Service-side order transitions unificadas
Se forzó que los cambios sensibles de órdenes pasen por RPC protegida (`admin_transition_order_state`) en vez de updates directos desde Edge Functions.

Impacto:
- una sola política de transición
- un solo punto de validación
- historial consistente
- menos drift entre admin y automatizaciones

### 2) Hardening del guard trigger
Se eliminó el bypass automático por `service_role` en `guard_orders_sensitive_updates()`.

Nuevo criterio:
- cambios sensibles solo pasan si existe `app.order_transition_bypass = true`
- eso obliga a usar RPCs protegidos que setean explícitamente el bypass

Resultado:
- tener service role ya no basta para saltarse reglas
- se corta la vía rápida más peligrosa

### 3) mp-webhook reconciliado con ledger + transición protegida
`supabase/functions/mp-webhook/index.ts` ahora:
- actualiza ledger `payments` vía `mark_payment_status(...)` cuando corresponde
- persiste `mp_payment_id` sin tocar estados sensibles por fuera
- aplica cambio de orden vía `admin_transition_order_state(...)`
- evita downgrade de órdenes ya pagadas
- deja de tratar como “duplicado inocuo” un evento con mismo `mp_payment_id` si todavía faltaba avanzar estado

### 4) Refunds alineados con ledger + orden
`supabase/functions/process-refund/index.ts` ahora:
- marca `payments` como `refunded` vía RPC si existe ledger activo
- cambia la orden a `refunded` vía `admin_transition_order_state(...)`

Resultado:
- refund deja rastro consistente en payment ledger y order state

## Archivos tocados
- `supabase/functions/mp-webhook/index.ts`
- `supabase/functions/process-refund/index.ts`
- `supabase/migrations/202605142110_order_service_path_hardening.sql`

## Validación esperada
- frontend unit tests y build deben seguir verdes
- la validación específica de edge functions requiere deploy + prueba real/staging con:
  - webhook approved
  - webhook duplicate approved
  - pending -> approved con mismo payment id
  - refund exitoso

## ROI
Este cambio no agrega UI nueva.
Protege margen y operación porque reduce:
- órdenes pagadas que no avanzan
- refunds con trazabilidad incompleta
- drift entre order state y payment ledger
- inconsistencias futuras al crecer volumen

## Próximo paso sugerido
Si quieres seguir en esta misma línea, el mejor siguiente bloque es:
- job de reconciliación automática `orders ↔ payments`
- cola de excepciones operativas para órdenes con drift o aging anómalo
