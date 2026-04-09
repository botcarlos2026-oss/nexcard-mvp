# NexCard — Route 2.4 implementation plan (Orders & Payments)

## Objetivo
Aplicar el patrón mínimo validado en perfiles/cards a la capa comercial.

---

# Entregables mínimos

## Orders
- `snapshot_order()`
- `soft_delete_order()`

## Payments
- `snapshot_payment()`
- `soft_delete_payment()`

## Audit
- registro consistente en `audit_log`

---

# Qué se gana con esto
- historia operativa básica
- borrado lógico consistente
- menos riesgo de cambios silenciosos
- mejor base para futura conciliación/soporte

---

# Qué se deja para después
- change-status helpers (`paid`, `fulfilled`, etc.)
- restore de órdenes/pagos
- version tables dedicadas
- UI/admin específico

---

# Validación recomendada
## Orders
- snapshot de una orden de prueba
- soft delete de una orden de prueba
- verificar `audit_log`

## Payments
- snapshot de un pago de prueba
- soft delete de un pago de prueba
- verificar `audit_log`

---

# Recomendación ejecutiva
No inflar esta fase.
Primero asegurar trazabilidad y soft delete; luego, si el negocio lo exige, agregar helpers de cambio de estado y UI.
