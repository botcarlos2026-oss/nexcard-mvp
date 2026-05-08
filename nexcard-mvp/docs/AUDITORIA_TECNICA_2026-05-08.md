# Auditoría técnica NexCard — 2026-05-08

## 1) Resumen ejecutivo

NexCard tiene avance real y verificable: el frontend compila correctamente (`npm run build` OK), hay una base operativa sobre Supabase con **37 migraciones**, **10 Edge Functions** y **14 pruebas E2E Cypress**. El producto ya cubre flujos de catálogo, checkout, órdenes, tracking, inventario, NFC, CRM y email marketing.

El problema principal no es “falta de features”, sino **riesgo de control**. El repo muestra una arquitectura con mucha lógica crítica ejecutándose desde el cliente (`src/services/api.js`, `src/components/OrdersDashboard.jsx`, `src/components/EmailDashboard.jsx`) y varias decisiones de seguridad/compliance aún frágiles para operar caja real.

### Juicio ejecutivo
- **Fortaleza**: velocidad de entrega, cobertura funcional amplia, uso consistente de Supabase, evidencias de endurecimiento RLS en varias migraciones.
- **Debilidad estructural**: demasiada confianza en el frontend para reglas de negocio, montos, estados operativos y disparo de funciones sensibles.
- **Riesgo de negocio**: manipulación de órdenes/precios, exposición de datos de clientes vía tracking, y operación manual intensa que escala mal.
- **Estado general**: **MVP avanzado pero todavía frágil para escalar caja con confianza**.

---

## 2) Hallazgos por severidad

### Crítico

#### C1. El checkout confía en precios y montos enviados desde el cliente
**Evidencia**
- `src/components/CheckoutForm.jsx`: construye `orderPayload` con `amount_cents`, `discount_cents`, `coupon_code` e `items` desde el navegador.
- `src/store/cartStore.js`: persiste items y precios en `localStorage` (`persist` con `name: 'nexcard-cart-storage'`).
- `supabase/migrations/202604210002_create_order_with_items_rpc.sql`: la función `create_order_with_items` inserta `amount_cents` y `unit_price_cents` recibidos en `p_order`/`p_items` sin recalcular desde `products`.
- `src/services/api.js`: `supabaseCreateOrder(payload)` envía esos valores a la RPC.

**Impacto**
- Un usuario con DevTools puede alterar subtotal, cantidades, descuentos o precios antes de crear la orden.
- La caja, margen y reporting quedan contaminados desde origen.
- Riesgo directo de vender bajo costo o registrar revenue falso.

**Riesgo negocio/caja**
- Pérdida de margen y errores contables.
- Riesgo de fraudes triviales en campañas o cupones.

**Recomendación**
- Recalcular todo server-side en una Edge Function o RPC que lea `products`, valide stock/cupones y derive el total final.
- El cliente debe enviar solo `product_id`, `quantity` y datos del comprador.

#### C2. Tracking expone datos de órdenes con acceso público/anon insuficientemente protegido
**Evidencia**
- `src/components/TrackingPage.jsx`: consulta `orders` directamente desde frontend con `supabase.from('orders').select('id, customer_name, fulfillment_status, carrier, tracking_code, shipped_at, delivered_at, delivery_address').eq('id', orderId).maybeSingle()`.
- `src/components/TrackingPage.jsx`: luego invoca `get-tracking` con `Authorization: Bearer ${ANON_KEY}`.
- `supabase/functions/get-tracking/index.ts`: usa `SUPABASE_SERVICE_ROLE_KEY` y responde con `customer_name`, `carrier`, `tracking_code`, eventos y estado solo con `order_id` query param; no valida token de entrega ni identidad.
- `supabase/migrations/202604160001_shipping_tracking.sql`: existe `delivery_token`, pero no se usa en `TrackingPage` ni en `get-tracking`.

**Impacto**
- Si alguien obtiene o enumera IDs de órdenes, puede consultar nombre del cliente, dirección y tracking.
- Hay una medida de protección diseñada (`delivery_token`) que quedó sin cerrar en aplicación.

**Riesgo negocio/caja**
- Exposición de PII de clientes.
- Riesgo reputacional y legal por privacidad.

**Recomendación**
- Cambiar tracking público a `/seguimiento/:orderId/:deliveryToken` o token opaco equivalente.
- Hacer que `get-tracking` valide `delivery_token` antes de devolver datos.
- Eliminar lectura directa de `orders` desde el frontend público.

### Alto

#### A1. Autorización administrativa partida entre frontend hardcodeado y RLS
**Evidencia**
- `src/App.jsx`: acceso visual a `/admin*` depende de un `ADMIN_EMAILS` hardcodeado.
- `supabase/migrations/202604150002_admin_memberships.sql`: bootstrap de admins también depende de emails hardcodeados.
- `src/services/api.js`: múltiples acciones administrativas llaman `supabase.from(...).update/insert/delete` desde cliente.

**Impacto**
- La seguridad efectiva depende de que UI, RLS y memberships estén siempre alineados.
- Alto riesgo operativo cuando cambien correos, roles o equipos.
- Aumenta probabilidad de “me deja entrar pero no operar” o peor: accesos inconsistentes.

**Riesgo negocio/caja**
- Bloqueo operativo del backoffice o privilegios mal asignados.

**Recomendación**
- Centralizar autorización en roles/memberships y eliminar whitelist hardcodeada del frontend.
- Crear helper de sesión/rol único.

#### A2. Panel de órdenes concentra demasiada lógica crítica en cliente
**Evidencia**
- `src/components/OrdersDashboard.jsx`: cambios de `payment_status`, `fulfillment_status`, despacho, refund, QR/NFC, exportación, checklist y auto-refresh en un único componente de gran tamaño.
- `src/services/api.js`: lógica de stock, despacho, historial, refunds, linking de cards y alertas repartida en cliente.

**Impacto**
- Alto acoplamiento UI + operación + caja.
- Más difícil probar, auditar y modificar sin romper flujos.
- Mayor costo de mantenimiento.

**Riesgo negocio/caja**
- Un bug de UI puede terminar cambiando estados reales de órdenes o inventario.

**Recomendación**
- Extraer casos de uso críticos a Edge Functions / RPCs dedicadas.
- Separar “presentación admin” de “comandos operativos”.

#### A3. Edge Functions con CORS abierto y controles de invocación heterogéneos
**Evidencia**
- `supabase/functions/create-mp-preference/index.ts`: `Access-Control-Allow-Origin: *`.
- `supabase/functions/send-order-confirmation/index.ts`: `Access-Control-Allow-Origin: *`.
- `supabase/functions/process-refund/index.ts`: `Access-Control-Allow-Origin: *`.
- `supabase/functions/send-abandoned-cart/index.ts`: `Access-Control-Allow-Origin: *` y modo manual/cron en el mismo endpoint.

**Impacto**
- Aunque Supabase exige auth según configuración de despliegue, el código no refleja una política uniforme de validación interna.
- Difícil asegurar qué endpoints están realmente expuestos a anon/authenticated/service-role sin revisar config remota.

**Riesgo negocio/caja**
- Mayor superficie de abuso operacional o spam si una función queda invocable de más.

**Recomendación**
- Definir una matriz explícita por función: pública / autenticada / service-only.
- Validar claims/headers dentro de las funciones sensibles.

#### A4. Cron de carritos abandonados con doble camino operativo y secreto incompleto hacia la Edge Function
**Evidencia**
- `api/cron/abandoned-carts.js`: protege Vercel Cron con `CRON_SECRET`, pero el POST a Supabase Function no envía Authorization.
- `supabase/migrations/202604200002_abandoned_carts_cron.sql`: el cron interno sí intenta usar `Authorization: Bearer service_role_key`.
- `supabase/functions/send-abandoned-cart/index.ts`: mezcla trigger manual y trigger cron en el mismo handler.

**Impacto**
- La operación depende de cómo esté configurada la función en Supabase/Vercel, no solo del código.
- Riesgo de fallos silenciosos en campañas automáticas.

**Riesgo negocio/caja**
- Recuperación de carritos inconsistente; ingresos perdidos por automatización no confiable.

**Recomendación**
- Elegir un solo scheduler oficial.
- Separar endpoint manual admin y endpoint cron/service.
- Asegurar auth explícita en ambos caminos.

### Medio

#### M1. Cobertura de pruebas existe pero está sesgada a E2E; no hay tests unitarios/integración local de lógica crítica
**Evidencia**
- Se detectan **14 specs Cypress** en `cypress/e2e/*.cy.js`.
- No se encontraron archivos `*.test.*` o `*.spec.*` de unit/integration fuera de Cypress.
- `package.json` no define script `test` para unit tests.

**Impacto**
- Lógica de pricing, admin workflows, helpers y adaptadores externos queda sin red de seguridad rápida.
- Cada cambio depende demasiado de pruebas manuales o E2E más lentas.

**Recomendación**
- Agregar Vitest/Jest para pricing, cupones, tracking adapters, mapeos de estados y validadores.

#### M2. Hay señales de deuda y rollback incompleto alrededor de identidad
**Evidencia**
- `package.json` aún incluye `@clerk/react`.
- `src/services/supabaseClient.js`: expone stubs “post-rollback de Clerk” (`getClerkUserId`, `setClerkTokenGetter`, `setClerkUserId`) que devuelven `null`.
- `src/services/api.js`: varios flujos siguen dependiendo de `getClerkUserId()`.

**Impacto**
- Riesgo de bugs sutiles en ownership de perfiles/órdenes.
- Señal de transición técnica no cerrada.

**Recomendación**
- Eliminar deuda de Clerk y reemplazarla completamente por `supabase.auth.getUser()`/session real.

#### M3. Duplicación y fragmentación documental/migratoria
**Evidencia**
- Existen `supabase/migrations/` y `supabase/migrations_backup/` con contenido duplicado.
- También hay SQL paralelos en raíz y docs (`DATABASE_SETUP.sql`, `DB_SCHEMA_SUPABASE.sql`, `docs/*.sql`, `5-entregables/*.sql`).

**Impacto**
- Más difícil saber cuál es la fuente de verdad.
- Riesgo de aplicar scripts equivocados en producción.

**Recomendación**
- Declarar una única fuente de verdad: `supabase/migrations/`.
- Archivar o mover backups fuera del repo operativo.

#### M4. Dependencia operativa alta en tareas manuales del backoffice
**Evidencia**
- `src/components/OrdersDashboard.jsx`: pasos manuales para vincular card, cargar slug, confirmar NFC, checklist y despacho.
- `src/components/EmailDashboard.jsx`: envíos de campañas uno a uno desde cliente con delays y reintentos.

**Impacto**
- Escala pobre en operación diaria.
- Más tiempo operador por orden y más posibilidad de error humano.

**Recomendación**
- Automatizar linking, colas de email, jobs async y estados derivados.

### Bajo

#### B1. Stack frontend basado en CRA ya maduro/envejecido
**Evidencia**
- `package.json`: `react-scripts@5.0.1`.

**Impacto**
- Menor velocidad futura de build/tooling frente a Vite/Next.
- No es bloqueo inmediato, pero sí deuda.

#### B2. Backend local Express sigue vivo como capa paralela/mock
**Evidencia**
- `server/index.js` implementa auth, profiles, admin, uploads y endpoint NFC local con `db.json`.
- `package.json` mantiene scripts `server` y `dev`.

**Impacto**
- Útil para demo/desarrollo, pero aumenta superficie de confusión arquitectónica.

---

## 3) Evidencia concreta con rutas de archivos

### Arquitectura y acoplamiento
- `src/App.jsx`
- `src/services/api.js`
- `src/components/OrdersDashboard.jsx`
- `src/components/EmailDashboard.jsx`
- `src/components/TrackingPage.jsx`
- `server/index.js`

### Seguridad / acceso
- `src/App.jsx`
- `supabase/migrations/202604090001_b2_rls_profiles_orders.sql`
- `supabase/migrations/202604090002_b3_rls_cards_payments.sql`
- `supabase/migrations/202604150002_admin_memberships.sql`
- `supabase/migrations/202604160001_shipping_tracking.sql`

### Caja / checkout / pricing
- `src/components/CheckoutForm.jsx`
- `src/store/cartStore.js`
- `src/services/api.js`
- `supabase/migrations/202604210002_create_order_with_items_rpc.sql`
- `supabase/functions/create-mp-preference/index.ts`
- `supabase/functions/mp-webhook/index.ts`
- `supabase/functions/process-refund/index.ts`

### Operación y automatización
- `supabase/functions/send-order-confirmation/index.ts`
- `supabase/functions/send-abandoned-cart/index.ts`
- `api/cron/abandoned-carts.js`
- `supabase/migrations/202604200002_abandoned_carts_cron.sql`
- `supabase/functions/get-tracking/index.ts`

### Validación técnica realizada
- `npm run build` ejecutado con éxito en el repo.
- Conteo observado: **10 Edge Functions**, **37 migraciones**, **14 specs Cypress**.

---

## 4) Riesgos al negocio / caja

1. **Pérdida directa de margen** por órdenes creadas con montos manipulables desde cliente.
2. **Exposición de datos personales** de clientes en tracking y órdenes públicas por diseño incompleto.
3. **Errores operativos** por panel admin demasiado manual y acoplado.
4. **Automatizaciones de revenue no confiables** (carritos abandonados / campañas) por auth y scheduling fragmentados.
5. **Dificultad para escalar** sin incrementar costo humano por pedido.
6. **Auditoría y control débiles** al mezclar UI, caja y reglas de negocio en el navegador.

---

## 5) Quick wins — próximos 7 días

1. **Blindar pricing**
   - Mover cálculo final de orden a backend/RPC validando `products`, stock y cupones.
   - Bloquear `amount_cents` arbitrario desde cliente.

2. **Cerrar tracking público**
   - Usar `delivery_token` en URL y en `get-tracking`.
   - Quitar lectura directa pública de `orders` desde `TrackingPage.jsx`.

3. **Eliminar whitelist admin del frontend**
   - Basar acceso solo en memberships/roles Supabase.

4. **Separar funciones sensibles por contexto**
   - Cron vs manual en `send-abandoned-cart`.
   - Documentar qué funciones son públicas, auth, service-only.

5. **Agregar smoke tests críticos de caja**
   - Orden con total recalculado server-side.
   - Tracking con token inválido debe fallar.
   - Refund solo para rol admin.

6. **Reducir deuda de identidad**
   - Remover restos de Clerk y usar sesión Supabase real de punta a punta.

7. **Definir fuente única de verdad SQL**
   - Mantener solo `supabase/migrations/` como canon operativo.

---

## 6) Plan técnico 30 días

### Semana 1: Control de caja y privacidad
- Reescribir creación de orden como caso de uso server-side.
- Validar cupones, subtotal, descuentos y stock en backend.
- Implementar tracking con `delivery_token`.
- Revisar exposición de PII en funciones públicas.

### Semana 2: Hardening de autorización
- Unificar acceso admin con memberships + helpers.
- Revisar todas las Edge Functions sensibles con matriz de auth.
- Añadir validación explícita de claims/roles en refunds, campañas, tracking, dispatch.

### Semana 3: Desacoplar operación del frontend
- Extraer comandos críticos del admin a Edge Functions/RPCs:
  - dispatch order
  - link card
  - program NFC
  - process refund
  - send campaign batch
- Dejar el frontend solo como orquestador visual.

### Semana 4: Testing y operabilidad
- Incorporar tests unitarios e integración para pricing, tracking y estados.
- Crear dashboard mínimo de salud operativa: órdenes pendientes, errores de webhooks, campañas fallidas, stock bajo.
- Limpiar migraciones/docs duplicadas y cerrar arquitectura objetivo.

---

## Conclusión

NexCard ya tiene suficiente producto para operar, vender y aprender. Pero hoy **la principal deuda no es funcional; es de control**. Si el objetivo es rentabilidad, trazabilidad y operación confiable, el siguiente salto debe ser **mover el corazón de caja y compliance fuera del frontend y endurecer accesos públicos**. Esa inversión tiene retorno inmediato: menos riesgo de pérdida, menos error manual y más confianza para escalar ventas.
