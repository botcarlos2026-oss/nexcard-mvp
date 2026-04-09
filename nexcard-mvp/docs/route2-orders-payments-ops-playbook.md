# NexCard — Route 2.4 ops playbook (Orders & Payments)

## Objetivo
Validar el bloque comercial de Route 2 sin tocar UI actual.

Este playbook cubre:
- snapshot
- soft delete
- cambios sensibles de estado
- verificación de `audit_log`
- guardrails mínimos para evitar drift operativo

---

# 1. Precondiciones
Antes de ejecutar helpers en Supabase:

- `route2_foundation.sql` ya aplicado
- `route2_orders_payments_minimal.sql` ya aplicado
- usar registros de prueba/no críticos
- preferir staging antes de prod

---

# 2. IDs de prueba necesarios
Definir al menos:

- `order_id`
- `payment_id`
- `actor_id` (puede ser `null::uuid` si la ejecución es manual desde SQL editor)

Ejemplo de lookup rápido:

```sql
select id, payment_status, fulfillment_status, deleted_at
from public.orders
where deleted_at is null
order by created_at desc
limit 5;
```

```sql
select id, order_id, status, external_id, deleted_at
from public.payments
where deleted_at is null
order by created_at desc
limit 5;
```

---

# 3. Flujo mínimo recomendado

## 3.1 Snapshot de orden
```sql
select public.snapshot_order(
  '<order_id>'::uuid,
  null::uuid
);
```

## 3.2 Cambio de payment status en orden
```sql
select public.mark_order_payment_status(
  '<order_id>'::uuid,
  'paid',
  null::uuid,
  'manual validation route2 orders/payments'
);
```

## 3.3 Cambio de fulfillment status en orden
```sql
select public.mark_order_fulfillment_status(
  '<order_id>'::uuid,
  'shipping',
  null::uuid,
  'manual validation route2 orders/payments'
);
```

## 3.4 Snapshot de pago
```sql
select public.snapshot_payment(
  '<payment_id>'::uuid,
  null::uuid
);
```

## 3.5 Cambio de status en pago
```sql
select public.mark_payment_status(
  '<payment_id>'::uuid,
  'paid',
  null::uuid,
  'gateway reconciliation test',
  'manual-test-ref-001'
);
```

## 3.5.b Reconciliar order.payment_status desde payments
Úsalo cuando exista drift entre la orden y sus pagos activos.

```sql
select public.reconcile_order_payment_status(
  '<order_id>'::uuid,
  null::uuid,
  'manual reconciliation after payment validation'
);
```

## 3.6 Soft delete de pago
```sql
select public.soft_delete_payment(
  '<payment_id>'::uuid,
  null::uuid
);
```

## 3.7 Soft delete de orden
```sql
select public.soft_delete_order(
  '<order_id>'::uuid,
  null::uuid
);
```

---

# 4. Verificaciones posteriores

## 4.1 Estado final de orden
```sql
select id, payment_status, fulfillment_status, deleted_at, updated_at
from public.orders
where id = '<order_id>'::uuid;
```

## 4.2 Estado final de pago
```sql
select id, order_id, status, external_id, deleted_at, updated_at
from public.payments
where id = '<payment_id>'::uuid;
```

## 4.3 Audit trail de orden
```sql
select entity_type, entity_id, action, created_at, context
from public.audit_log
where entity_type = 'order'
  and entity_id = '<order_id>'::uuid
order by created_at desc;
```

## 4.4 Audit trail de pago
```sql
select entity_type, entity_id, action, created_at, context
from public.audit_log
where entity_type = 'payment'
  and entity_id = '<payment_id>'::uuid
order by created_at desc;
```

---

# 5. Guardrails operativos esperados

## Orders
Los helpers deben rechazar:
- `order_id` inexistente
- soft delete repetido
- cambio de estado sobre orden archivada
- cambio al mismo estado actual
- estados fuera del enum esperado
- transiciones inválidas de `payment_status` (ej. `paid -> pending`)
- transiciones inválidas de `fulfillment_status` (ej. `new -> delivered`)
- reconciliación sin pagos activos

## Payments
Los helpers deben rechazar:
- `payment_id` inexistente
- soft delete repetido
- cambio de estado sobre pago archivado
- cambio redundante sin diferencia real
- estados fuera del enum esperado

---

# 6. Qué evidencia guardar
Para cada validación manual:

- IDs usados
- SQL ejecutado
- resultado de consultas finales
- muestra de `audit_log`
- si hubo error, mensaje exacto

Eso permite comparar staging/prod y reducir costo de soporte futuro.

---

# 7. Alcance intencional de esta fase
Esto NO intenta resolver todavía:
- restore de orders/payments
- sincronización automática order ↔ payment
- backend checkout orchestration
- UI admin específica
- conciliación completa por proveedor

La meta es más austera y rentable:
- trazabilidad mínima
- soft delete consistente
- cambios críticos con rastro

---

# 8. Siguiente iteración mínima sugerida
Si esta validación sale bien, el siguiente paso con mejor ROI es:

1. definir transición válida por estado (no solo enum)
2. decidir si `mark_payment_status('paid')` debe disparar reconciliación automática de `orders.payment_status`
3. crear vistas admin para activos vs archivados
4. formalizar migraciones versionadas en `supabase/migrations/`

---

# 9. Consulta rápida para detectar drift order ↔ payment

```sql
select
  o.id as order_id,
  o.payment_status as order_payment_status,
  array_remove(array_agg(distinct p.status), null) as payment_statuses,
  count(p.*) filter (where p.deleted_at is null) as active_payments
from public.orders o
left join public.payments p
  on p.order_id = o.id
 and p.deleted_at is null
where o.deleted_at is null
group by o.id, o.payment_status
having (
  o.payment_status = 'paid'
  and not bool_or(p.status = 'paid')
) or (
  o.payment_status = 'refunded'
  and not bool_or(p.status = 'refunded')
) or (
  o.payment_status = 'pending'
  and bool_or(p.status in ('paid', 'refunded'))
)
order by o.created_at desc;
```

Si aparecen filas acá, ejecutar primero revisión manual y luego `reconcile_order_payment_status(...)` en staging antes de pensar en prod.
