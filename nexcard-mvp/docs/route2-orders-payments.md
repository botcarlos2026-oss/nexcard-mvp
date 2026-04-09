# NexCard — Ruta 2.4: Orders & Payments

## Objetivo
Extender el patrón de resiliencia y trazabilidad a la operación comercial:
- `orders`
- `payments`

---

# 1. Por qué esta fase importa

Después de perfiles y tarjetas, el siguiente bloque crítico es el comercial.
Si una orden o un pago cambia de estado sin rastro, el costo operativo sube rápido:
- conciliación más difícil
- soporte más lento
- riesgo financiero más alto

---

# 2. Qué NO haría todavía

## No intentaría modelar todo el motor de pagos
Todavía no.

## No intentaría un restore genérico complejo de órdenes/pagos
Primero:
- audit claro
- soft delete consistente
- helpers mínimos de estado

---

# 3. Principio de diseño

## `orders`
Representan operación comercial y fulfillment.

## `payments`
Representan dinero y conciliación.

Por lo tanto:
- ambos necesitan `audit_log`
- ambos deben soportar `deleted_at`
- ambos deben tener helpers mínimos para cambios sensibles

---

# 4. Acciones mínimas a cubrir

## Orders
- snapshot antes de cambios relevantes
- soft delete / archive
- cambio de `payment_status`
- cambio de `fulfillment_status`

## Payments
- snapshot antes de cambios relevantes
- soft delete / archive
- cambio de `status`
- trazabilidad del `external_id` y payload relevante

---

# 5. Recomendación pragmática

## No crear todavía `order_versions` ni `payment_versions`
Mi recomendación inicial:
- usar `audit_log` como primera fuente de historia
- si luego el negocio exige restore sofisticado, recién pensar en tablas de versión dedicadas

## Por qué
En órdenes/pagos, el costo de versionar todo desde el día 1 puede ser mayor que el beneficio inmediato.

---

# 6. Helpers mínimos recomendados

## Orders
- `snapshot_order(order_id, actor_id)`
- `soft_delete_order(order_id, actor_id)`

## Payments
- `snapshot_payment(payment_id, actor_id)`
- `soft_delete_payment(payment_id, actor_id)`

## Siguiente iteración
- `mark_order_paid(...)`
- `mark_order_fulfilled(...)`
- `mark_payment_status(...)`
- `reconcile_order_payment_status(...)`

---

# 7. Qué debe registrar `audit_log`

## Orders
- `order_snapshot`
- `order_soft_delete`
- luego `order_payment_status_change`
- luego `order_fulfillment_status_change`
- luego `order_payment_status_reconciled`

## Payments
- `payment_snapshot`
- `payment_soft_delete`
- luego `payment_status_change`

---

# 8. Lecturas que deben respetar soft delete

## Orders
- owner/admin views no deberían mezclar por defecto órdenes archivadas con activas sin distinguirlo

## Payments
- igual criterio

## Recomendación
Más adelante, separar:
- activas
- archivadas
- todo (admin)

---

# 9. Recomendación ejecutiva

El primer paso correcto de Ruta 2.4 no es construir restore.
Es construir:
- snapshot
- soft delete
- audit consistente

Eso ya da mucho control sin inflar complejidad.

---

# 10. Conclusión
Perfiles y cards ya demostraron el patrón.
Orders/payments son la extensión natural para que NexCard gane resiliencia también en la parte comercial.

---

# 11. Refinamiento táctico recomendado

Si esta fase se quiere acercar a validación real sin inflar backend/UI, el mejor ROI no está en restore complejo.

Está en dos cosas:

1. **transiciones explícitas**
   - evitar `paid -> pending`
   - evitar `new -> delivered`
   - evitar cambios sobre registros archivados

2. **reconciliación manual auditable**
   - cuando `orders.payment_status` difiere del estado observable en `payments`
   - resolverlo con un helper dedicado y `audit_log`

Eso baja costo de soporte y deja el bloque más listo para un gateway real sin tocar todavía la app/UI.
