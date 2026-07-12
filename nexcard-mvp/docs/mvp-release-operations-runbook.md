# NexCard — Runbook operativo MVP / Pre-Launch

Fecha: 2026-07-03
Fuente de verdad: repo GitHub `botcarlos2026-oss/nexcard-mvp`, app en `nexcard-mvp/`.

## Objetivo

Operar las primeras ventas reales de NexCard con control diario, evitando tres riesgos principales:

1. cobrar sin que la orden quede reconciliada;
2. tener una orden pagada sin fulfillment claro;
3. tener un cliente pagado sin activación de perfil/tarjeta.

Este runbook es para lanzamiento controlado, máximo 5-10 clientes iniciales.

---

## 1. Checklist diario mínimo

Ejecutar al inicio y cierre del día mientras estemos en pre-launch.

### Pagos y órdenes

- Abrir `/admin/orders`.
- Revisar órdenes de las últimas 24 horas.
- Confirmar que toda orden pagada tenga:
  - `payment_status = paid`;
  - payment ledger asociado en `payments`;
  - `mp_payment_id` si corresponde;
  - email de confirmación enviado o registrado.
- Revisar órdenes con `payment_status = pending` por más de 2 horas.
- Revisar órdenes con alerta de drift order/payment.

### Fulfillment

- Toda orden `paid` debe avanzar desde `new` hacia `in_production`.
- Toda orden `in_production` debe tener revisión de stock.
- Toda orden `ready`/`ready_to_ship` debe tener card o item físico asignable.
- Toda orden `shipped` debe tener dato de despacho/tracking si aplica.
- Toda orden `delivered` debe revisarse para activación pendiente.

### Activación

- Revisar `profile_claims` pendientes.
- Confirmar que las órdenes pagadas hayan disparado email de activación.
- Revisar cards sin `profile_id` si ya existe cliente pagado.
- Revisar profiles incompletos de clientes pagados.

### Emails

- Confirmar Resend/Edge Functions sin errores recientes:
  - `send-order-confirmation`;
  - `send-profile-activation`;
  - `send-shipping-notification` si se usa.

---

## 2. Flujo por cada venta real

### Paso 1 — Orden creada

Validar:

- orden aparece en `/admin/orders`;
- datos cliente completos:
  - nombre;
  - email;
  - teléfono;
  - dirección;
- `amount_cents` coincide con producto vendido;
- `payment_method = mercado-pago`;
- `payment_status` inicialmente `pending` o `paid` según webhook.

Si no aparece la orden:

- revisar checkout frontend;
- revisar RPC `create_order_with_items`;
- revisar logs de Supabase/Edge Functions;
- no producir manualmente sin registro de orden.

### Paso 2 — Pago Mercado Pago

Validar:

- pago aparece en Mercado Pago;
- `external_reference` = `order.id`;
- webhook `mp-webhook` recibió evento;
- order quedó `payment_status = paid` cuando MP status sea `approved`;
- payment ledger quedó en tabla `payments`.

Si Mercado Pago cobró pero la orden no quedó pagada:

1. no duplicar orden;
2. guardar payment id;
3. revisar logs de `mp-webhook`;
4. ejecutar reconciliación si la Edge Function está desplegada:
   - `npm run ops:reconcile-orders:dry`
   - luego modo real solo con confirmación;
5. marcar revisión manual en admin.

### Paso 3 — Producción

Cuando `payment_status = paid`:

- confirmar stock disponible;
- avanzar a `in_production`;
- verificar reserva/descuento de inventario;
- dejar nota si falta stock.

No pasar a producción si:

- pago sigue `pending`;
- monto no coincide;
- payment ledger contradice la orden;
- producto es test o SKU inválido.

### Paso 4 — Card / perfil

Para cada orden pagada:

- verificar si existe `profile_claims` pendiente;
- verificar si se envió email de activación;
- si hay card física disponible, vincular card/order/profile según flujo admin;
- si el cliente aún no completó perfil, dejar pendiente y hacer seguimiento.

### Paso 5 — Despacho y cierre

Antes de marcar `shipped`:

- card física preparada;
- dirección validada;
- guía/tracking registrado si aplica;
- email o WhatsApp de seguimiento enviado.

Antes de marcar `delivered`:

- confirmar entrega real;
- revisar si activación sigue pendiente;
- disparar recordatorio si el cliente no activó.

---

## 3. Matriz de estados

| Caso | Lectura | Acción |
|---|---|---|
| `payment_status=pending` y MP pendiente | normal | esperar o contactar cliente si supera 2h |
| MP approved pero order pending | drift crítico | revisar `mp-webhook`, reconciliar, no duplicar orden |
| order paid sin payment ledger | riesgo contable | ejecutar reconciliación/backfill dry-run y revisar manual |
| order paid + fulfillment new > 24h | atraso operacional | pasar a producción o registrar bloqueo |
| fulfillment ready/shipped sin card | inconsistencia | vincular card o bajar estado con nota |
| delivered sin activación > 24h | cliente sin valor final | enviar recordatorio/WhatsApp y revisar claim |
| paid → failed por evento tardío | no degradar | el webhook ya intenta evitar downgrade; revisar ledger |
| refund solicitado | riesgo caja/soporte | usar flujo `process-refund` si está validado; registrar motivo |

---

## 4. Comandos operativos locales

Desde:

```bash
cd /Users/openclow-worker/Documents/business-workspace/nexcard-mvp-github/nexcard-mvp
```

Verificar build:

```bash
npm run build
```

Smoke público sin credenciales admin:

```bash
npm run test:e2e:smoke
```

Preflight E2E completo con credenciales:

```bash
npm run test:e2e:env-check
```

Reconciliación dry-run:

```bash
npm run ops:reconcile-orders:dry
```

Backfill payments dry-run:

```bash
npm run ops:backfill-payments:dry
```

Nunca ejecutar scripts no-dry-run en producción sin tener claro:

- qué Edge Function está desplegada;
- qué service role/secret usa;
- qué lote va a tocar;
- cómo revertir o auditar.

---

## 5. Incidentes frecuentes

### Incidente A — Cliente pagó, admin no ve orden pagada

Acción:

1. buscar orden por email;
2. buscar payment id en Mercado Pago;
3. confirmar `external_reference`;
4. revisar logs `mp-webhook`;
5. ejecutar reconciliación dry-run;
6. si se confirma pago, actualizar vía flujo admin/RPC, no editando directo a ciegas.

### Incidente B — Cliente no recibe email

Acción:

1. revisar spam;
2. revisar Resend;
3. revisar Edge Function `send-order-confirmation`;
4. reenviar manualmente si el pago está confirmado;
5. registrar incidencia.

### Incidente C — Cliente pagado no puede activar perfil

Acción:

1. revisar `profile_claims` por `order_id`;
2. verificar `claim_token` y status;
3. revisar `/activar/:token`;
4. si no existe claim, generarlo con flujo seguro o fallback manual;
5. no crear perfiles duplicados por apuro.

### Incidente D — Stock insuficiente

Acción:

1. no avanzar a despacho;
2. marcar bloqueo interno;
3. contactar cliente si impacta SLA;
4. corregir inventario con movimiento trazable, no editando stock sin movimiento.

---

## 6. Go / No-Go diario

### Go para seguir vendiendo

- Cobros reales se reconcilian.
- Admin ve órdenes correctamente.
- Emails llegan.
- No hay drift crítico sin resolver.
- Billing Vercel activo.

### No-Go temporal

- Webhook productivo falla.
- MP cobra pero no se actualiza orden.
- Vercel/billing en riesgo.
- No se puede identificar qué clientes pagaron.
- Hay órdenes pagadas sin posibilidad de fulfillment/activación.
