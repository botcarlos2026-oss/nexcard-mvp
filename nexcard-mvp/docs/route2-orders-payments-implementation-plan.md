# NexCard — Route 2.4 implementation plan (Orders & Payments)

## Objetivo
Aplicar el patrón mínimo validado en perfiles/cards a la capa comercial.

---

# Entregables mínimos

## Orders
- `snapshot_order()`
- `soft_delete_order()`
- `mark_order_payment_status()`
- `mark_order_fulfillment_status()`

## Payments
- `snapshot_payment()`
- `soft_delete_payment()`
- `mark_payment_status()`

## Audit
- registro consistente en `audit_log`

## Ops
- playbook manual de validación

---

# Qué se gana con esto
- historia operativa básica
- borrado lógico consistente
- menos riesgo de cambios silenciosos
- mejor base para futura conciliación/soporte

---

# Qué se deja para después
- restore de órdenes/pagos
- version tables dedicadas
- sincronización automática order ↔ payment
- UI/admin específico
- reglas estrictas de transición entre estados

---

# Validación recomendada
## Orders
- snapshot de una orden de prueba
- cambio de `payment_status`
- cambio de `fulfillment_status`
- soft delete de una orden de prueba
- verificar `audit_log`

## Payments
- snapshot de un pago de prueba
- cambio de `status`
- soft delete de un pago de prueba
- verificar `audit_log`
- seguir `docs/route2-orders-payments-ops-playbook.md`

---

# Recomendación ejecutiva
No inflar esta fase.
Primero asegurar trazabilidad y soft delete; luego, si el negocio lo exige, agregar helpers de cambio de estado y UI.
