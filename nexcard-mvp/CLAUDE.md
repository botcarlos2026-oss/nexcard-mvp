# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Propósito del proyecto
NexCard es una plataforma de tarjetas NFC digitales y Google Reviews Cards (NexReview). Incluye perfil digital personalizado, panel admin completo, checkout con Mercado Pago e inventario físico.

---

## Comandos de desarrollo

```bash
# Frontend React (puerto 3000)
npm start

# Backend local Express (puerto 4000) + frontend en paralelo
npm run dev

# Solo el servidor local mock
npm run server

# Build para producción (Vercel)
npm run build
```

**Tests E2E (Cypress):**
```bash
# Abrir Cypress interactivo
npm run cypress:open

# Suite completa en CI
npm run test:e2e

# Tests individuales
npm run test:e2e:smoke
npm run test:e2e:admin-cards
npm run test:e2e:admin-profiles
npm run test:e2e:nfc

# Combinaciones de suites
npm run test:e2e:cards-lifecycle
npm run test:e2e:profiles-full
```

No hay unit tests ni linting configurado. Los únicos tests son Cypress e2e en `cypress/e2e/`.

---

## Stack
- **Frontend:** React 18 SPA, Tailwind CSS, Lucide icons, Zustand (carrito)
- **DB + Auth + Edge Functions:** Supabase (proyecto `ghiremuuyprohdqfrxsy`)
- **Deploy:** Vercel (nexcard.cl) — `vercel.json` define rewrites SPA + headers de seguridad
- **Email:** Resend (`hola@nexcard.cl`) via Edge Function
- **Pagos:** Mercado Pago Checkout Pro via Edge Function

---

## Arquitectura general

### Router manual en `src/App.jsx`
No hay React Router. El routing es manual con `window.location.pathname` + `window.history.pushState`. `App.jsx` contiene toda la lógica de estado global, bootstrapping, autenticación y renderizado condicional de páginas.

### Dos modos de datos: Supabase o servidor local mock
`src/services/supabaseClient.js` exporta `supabase` (puede ser `null`) y `hasSupabase` (booleano). Todos los métodos en `src/services/api.js` hacen `if (hasSupabase)` para decidir si van a Supabase o al servidor Express local (`server/index.js`). En producción siempre va a Supabase.

### Capa de servicio: `src/services/api.js`
Archivo central. Dos helpers privados importantes:
- `fetchAdminCards()` — cards enriquecidas con profile_name, profile_slug, last_event, events[]
- `fetchOrders()` — órdenes con `order_items(*)` y `payments(*)` incluidos

Todos los métodos del admin panel usan estos helpers para retornar datos completos tras cada mutación.

### Estado global del carrito: `src/store/cartStore.js` (Zustand)

### Edge Functions (no están en el repo local)
Deployadas directamente en Supabase. Para inspeccionarlas: Supabase Dashboard → Edge Functions.
- `create-mp-preference` — crea preferencia MP y retorna `init_point`
- `mp-webhook` — recibe notificaciones de MP, actualiza `payment_status` de la orden
- `send-order-confirmation` — email al cliente + notificación interna

---

## RLS y sistema de permisos — crítico

**Todas** las operaciones admin en Supabase dependen de `public.has_role('admin')`, que busca en la tabla `memberships`. El whitelist de emails en `App.jsx` solo protege la UI — no otorga permisos de DB.

Para que el admin pueda hacer updates en Supabase (órdenes, cards, inventario), el usuario debe tener una fila en `memberships` con `role='admin'`. La migración `202604150002_admin_memberships.sql` inserta esa fila automáticamente para los emails admin.

Si los updates del admin panel fallan silenciosamente, verificar primero en Supabase → Table Editor → `memberships`.

### Políticas relevantes por tabla
- `orders` → `orders_admin_all` (has_role admin) + `orders_owner_read/insert`
- `cards` → `cards_admin_manage` (has_role admin)
- `order_items` → `order_items_admin_manage` + `order_items_owner_insert`
- `payments` → `payments_admin_manage`
- `inventory_items/movements` → `inv_admin_manage`

---

## Schema de cards — constraints activos

```sql
-- status
CHECK (status IN ('printed', 'assigned', 'active', 'suspended', 'revoked', 'lost', 'replaced', 'archived'))

-- activation_status
CHECK (activation_status IN ('unassigned', 'assigned', 'activated', 'disabled', 'revoked', 'lost'))
```

Las acciones de lifecycle en `api.js` usan RPC cuando existe la función `security definer` en DB:
- `revokeCard` → `rpc('revoke_card')` (escribe en audit_log + card_events)
- `archiveCard` → `rpc('soft_delete_card')` (setea deleted_at + status=archived)
- `activateCard`, `assignCard`, `reassignCard` → direct update

---

## Valores de fulfillment_status

El frontend usa: `new → in_production → ready → shipped → delivered` (+ `cancelled`).
La función DB `mark_order_fulfillment_status` usa valores distintos (`printing`, `shipping`) pero **no es llamada por el frontend** — los updates son directos a la tabla sin CHECK constraint en `fulfillment_status`.

---

## Tablas principales

| Tabla | Notas clave |
|-------|-------------|
| `products` | `price_cents` en CLP directo (79990 = $79.990, no centavos) |
| `orders` | `payment_status`, `fulfillment_status`, `deleted_at` (soft delete) |
| `order_items` | `product_id`, `quantity`, `unit_price_cents` |
| `order_status_history` | log de cambios de campo en órdenes |
| `cards` | lifecycle NFC: status + activation_status (ver constraints arriba) |
| `card_events` | log de eventos por tarjeta |
| `profiles` | perfiles públicos; `deleted_at` para soft delete |
| `memberships` | roles de usuario — requerido para RLS admin |
| `audit_log` | log de operaciones security definer |
| `inventory_items` / `inventory_movements` | stock físico |
| `waitlist` | emails lista de espera |

---

## Variables de entorno

**Vercel (frontend):**
- `REACT_APP_SUPABASE_URL`
- `REACT_APP_SUPABASE_ANON_KEY`

**Supabase Secrets (Edge Functions):**
- `RESEND_API_KEY`
- `MP_ACCESS_TOKEN` — usar `TEST-...` en desarrollo, producción al lanzar

---

## Admin acceso
Whitelist en `App.jsx` (solo protege UI):
- `bot.carlos.2026@gmail.com`
- `carlos.alvarez.contreras@gmail.com`

Agregar un nuevo admin requiere: (1) añadir el email a la whitelist en App.jsx, y (2) ejecutar la migración `202604150002` o insertar manualmente en `memberships`.

---

## Flujo de pago MP
```
Checkout → supabaseCreateOrder (status: pending) →
Edge Function create-mp-preference → redirect MP →
pago exitoso → webhook mp-webhook → orden payment_status: paid →
return nexcard.cl?payment=success&order=ID
```

---

## Migraciones

Directorio: `supabase/migrations/`. Convención de nombres: `YYYYMMDDNNNN_descripcion.sql`.
Las migraciones son SQL puro — aplicar manualmente en Supabase Dashboard → SQL Editor.
Todas las migraciones llevan `begin; ... commit;` y son idempotentes donde es posible.

---

## Pendientes para lanzamiento
- [ ] Cambiar `MP_ACCESS_TOKEN` a credenciales de producción
- [ ] Eliminar producto TEST-1 ($19.990)
- [ ] Remover `console.log` de debug en `api.js`
- [ ] Panel configuración Google Reviews Card (NexReview)
- [ ] Transbank WebPay (segunda integración de pago)
- [ ] CRM con pipeline Kanban

---

## Bsale SII — Pendiente de activar

La estructura está lista (NO-OP hasta configurar el token). Pasos para activar:

1. Crear cuenta en [bsale.io](https://bsale.io)
2. Obtener Access Token: Configuración → API → Access Token
3. Agregar `BSALE_ACCESS_TOKEN` en Supabase → Project Settings → Edge Functions → Secrets
4. Implementar el `TODO` en `supabase/functions/emit-bsale-document/index.ts`
5. Agregar `bsale_variant_id` (INTEGER) a cada producto en tabla `products`

**Tipos de documento:**
- `documentTypeId: 39` = Boleta electrónica (cliente genérico RUT 66.666.666-6)
- `documentTypeId: 33` = Factura electrónica (requiere RUT + razón social del cliente)

**Campos en `orders` ya disponibles:**
- `bsale_document_id` — ID del documento emitido
- `bsale_document_url` — URL del PDF
- `bsale_emitted_at` — timestamp de emisión
- `requires_invoice` — true si el cliente pidió factura empresa
- `invoice_rut` — RUT de la empresa
- `invoice_razon_social` — razón social

**Deploy al activar:**
```bash
supabase functions deploy emit-bsale-document --project-ref ghiremuuyprohdqfrxsy
supabase functions deploy send-order-confirmation --project-ref ghiremuuyprohdqfrxsy
```
## Skills disponibles
- UI/Animaciones: ~/.claude/skills/emil-design-eng/SKILL.md
  Filosofía de design engineering de Emil Kowalski.
  Leer antes de cualquier tarea de UI, animaciones o micro-interacciones.

## Skills globales
- Design Engineering: ~/.claude/skills/emil-design-eng/SKILL.md
  Leer antes de cualquier tarea de UI, animaciones o componentes.
