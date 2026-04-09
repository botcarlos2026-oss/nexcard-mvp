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
- `reconcile_order_payment_status()`

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
- sincronización automática order ↔ payment en cada callback del gateway
- UI/admin específico
- workflows complejos multi-step por proveedor

---

# Refinamiento aplicado en esta iteración

## Guardrails de transición
La fase mínima ya no depende solo de enums “sueltos”.

Se endurece con validaciones explícitas para evitar drift operativo:

- `orders.payment_status`
  - bloquea redundancias
  - bloquea regresiones inválidas desde `paid` hacia `pending/authorized`
  - bloquea transiciones desde `refunded`
- `orders.fulfillment_status`
  - fuerza secuencia `new -> printing -> shipping -> delivered`
  - permite `canceled` solo desde etapas no terminales
  - bloquea cambios desde `delivered` o `canceled`
- `payments.status`
  - mismas protecciones base para estados financieros

## Reconciliación mínima rentable
Se agrega `reconcile_order_payment_status()` como helper manual/operativo.

Objetivo:
- recalcular `orders.payment_status` desde los `payments` activos de la orden
- registrar `audit_log`
- dejar una vía explícita para correcciones post-gateway/manuales sin meter todavía automatización compleja

Precedencia aplicada:
1. `refunded`
2. `paid`
3. `authorized`
4. `pending`
5. `failed`

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
