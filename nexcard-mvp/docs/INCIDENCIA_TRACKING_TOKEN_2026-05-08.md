# NexCard — Incidencia y fix de tracking tokenizado

**Fecha:** 2026-05-08

## Síntoma
El endpoint `get-tracking` devolvía `404 Orden no encontrada` incluso usando un `order_id` + `delivery_token` válidos.

## Causa raíz
La function consultaba una columna inexistente en el esquema remoto:
- `orders.delivery_address`

El esquema real en producción usa:
- `orders.customer_address`

Eso hacía fallar la query interna y el código lo terminaba maquillando como `Orden no encontrada`.

## Corrección aplicada
### Functions
- `supabase/functions/get-tracking/index.ts`
- `supabase/functions/send-shipping-notification/index.ts`

### Front/admin
- `src/components/OrdersDashboard.jsx`

## Ajuste funcional
- se reemplazó `delivery_address` por `customer_address` en lecturas a DB
- se mantiene `delivery_address` en la respuesta JSON de tracking como campo de compatibilidad para frontend
- el admin ahora usa `customer_address` como fuente principal, con fallback a `delivery_address` si existe en algún dato viejo en memoria

## Validación posterior
Prueba real contra la function remota:
- `order_id`: `cc84b204-1fe7-49f7-a252-475d4b7f7796`
- `delivery_token`: válido
- respuesta: **200 OK**
- resultado: `tracking_available: false` + mensaje correcto de que aún no hay tracking asignado

## Conclusión
El hardening de tracking quedó operativo:
- sin token: falla correctamente
- con token válido: responde correctamente
