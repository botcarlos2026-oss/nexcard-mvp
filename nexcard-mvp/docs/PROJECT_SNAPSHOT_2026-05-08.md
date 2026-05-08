# NexCard — Project Snapshot Verificado

**Fecha:** 2026-05-08  
**Branch:** `main`  
**Último commit visible:** `d74487b` — `docs(nexcard): agregar bitácora actualizada etapa 9`

---

## 1. Resumen ejecutivo
NexCard está en una fase **pre-lanzamiento avanzada**.

No es un prototipo. Ya existe una base operativa real para:
- venta de productos
- checkout con Mercado Pago
- administración interna
- inventario
- perfiles públicos
- lifecycle de tarjetas
- notificaciones por email

### Lectura ejecutiva
**Sí hay activo tecnológico real.**  
**No conviene tratarlo como “ya listo para escalar” sin hardening.**

El riesgo dominante ya no es falta de features, sino:
- seguridad operativa
- consistencia entre frontend, Supabase y Edge Functions
- mantenibilidad del frontend
- disciplina de pruebas reproducibles

---

## 2. Estado verificable hoy

### Verificado por código/estructura
- Build de frontend compila correctamente con `npm run build`.
- Repo en branch `main`.
- Existe app React productiva con múltiples módulos admin.
- Existe integración real con Supabase.
- Existen Edge Functions para pagos, emails, tracking, refunds y alertas.
- Existe suite Cypress, pero **el entorno E2E no está listo para correr sin variables faltantes**.

### Verificado por comando
- `npm run build` → **OK**
- `npm run test:e2e:env-check` → **FAIL** por variables faltantes:
  - `CYPRESS_login_email`
  - `CYPRESS_login_password`

Conclusión: **el proyecto compila, pero la validación E2E no está operativamente cerrada en este workspace.**

---

## 3. Stack actual

### Frontend
- React 18
- Tailwind CSS
- Zustand
- Router manual en `src/App.jsx`

### Backend / datos
- Supabase
  - Auth
  - Postgres
  - RLS
  - RPCs
  - Edge Functions
- Express local como soporte de desarrollo / fallback

### Infra / servicios externos
- Vercel
- Mercado Pago
- Resend
- Cypress

---

## 4. Módulos detectados en el código

### Web pública / comercial
- `/` → Coming Soon
- `/preview` → landing comercial
- catálogo / carrito / checkout
- términos y privacidad
- waitlist

### Checkout / venta
- catálogo de productos
- carrito persistente
- formulario de checkout
- creación de orden vía RPC `create_order_with_items`
- retorno desde Mercado Pago
- confirmación de compra

### Admin interno
Módulos detectados:
- dashboard general
- orders
- inventory
- cards
- profiles
- CRM
- emails
- products
- review cards
- NexReview
- team
- wheel
- print test

### Operación / fulfillment
- inventario y movimientos
- tracking
- confirmación de entrega
- lifecycle de cards
- linking order ↔ card
- perfiles públicos editables

---

## 5. Archivos núcleo del sistema

### Frontend crítico
- `src/App.jsx`
- `src/services/api.js`
- `src/services/supabaseClient.js`

### Backend / funciones
- `server/index.js`
- `supabase/functions/create-mp-preference/index.ts`
- `supabase/functions/mp-webhook/index.ts`
- `supabase/functions/send-order-confirmation/index.ts`
- `supabase/functions/process-refund/index.ts`
- `supabase/functions/get-tracking/index.ts`
- `supabase/functions/send-shipping-notification/index.ts`
- `supabase/functions/send-low-stock-alert/index.ts`
- `supabase/functions/send-abandoned-cart/index.ts`
- `supabase/functions/send-campaign-email/index.ts`

### SQL / esquema / migraciones
- `supabase/migrations/*`
- `DB_SCHEMA_SUPABASE.sql`
- `docs/*.sql`

---

## 6. Hallazgos técnicos relevantes

### A. `App.jsx` está sobrecargado
Tamaño aproximado: **355 líneas**.

Concentra:
- bootstrap de sesión
- guards admin
- routing
- carga de dashboards
- flujo checkout
- navegación principal

**Juicio:** aguanta corto plazo, pero es un punto de fragilidad si sigues sumando módulos.

### B. `api.js` es cuello de mantenimiento
Tamaño aproximado: **1117 líneas**.

Concentra lógica de:
- órdenes
- perfiles
- inventario
- cards
- landing
- emails
- CRM
- productos
- refunds

**Juicio:** alta velocidad de iteración, pero alto acoplamiento y riesgo de regresión.

### C. Dependencia fuerte de Supabase
La app ya depende de Supabase en la parte crítica del negocio.

Eso significa que el verdadero estado del sistema no vive solo en el repo; también vive en:
- proyecto Supabase
- secrets
- Edge Functions desplegadas
- configuración externa

### D. Admin auth todavía simple
En `src/App.jsx` el acceso admin sigue validándose con **whitelist de emails**.

**Juicio:** suficiente para etapa controlada, malo para escalamiento y delegación operativa.

### E. Hay evidencia de drift esquema/frontend
Commit reciente:
- `fix: deshabilitar scan tracking temporalmente — esquema card_scans desalineado`

**Juicio:** esto confirma que el riesgo de inconsistencia entre app y base es real, no teórico.

---

## 7. QA / testing real

### Lo que sí existe
- suite Cypress amplia
- documentación E2E
- scripts para smoke, profiles, cards, NFC y admin

### Lo que no quedó operativo hoy
El preflight E2E falla por configuración incompleta en este workspace.

Faltan variables mínimas:
- `CYPRESS_login_email`
- `CYPRESS_login_password`

Además existe evidencia de fallos previos en screenshots de Cypress dentro del repo.

### Lectura correcta
**Hay intención seria de QA, pero no se puede afirmar hoy que la suite está verde.**

---

## 8. Riesgos actuales

### Riesgo 1 — Seguridad / acceso
- whitelist admin embebida
- dependencia de secrets externos
- necesidad de revisar RLS y funciones públicas

### Riesgo 2 — Mantenibilidad
- `api.js` grande
- `App.jsx` centralizado
- costo de cambio creciente

### Riesgo 3 — Drift operativo
- frontend, SQL y edge functions pueden desalinearse
- especialmente sensible en cards, tracking y pagos

### Riesgo 4 — QA incompleto
- build OK no equivale a operación segura
- E2E no está listo para ejecución reproducible en este entorno

---

## 9. Prioridades recomendadas

### Prioridad 1 — Blindar caja
1. validar producción de Mercado Pago
2. auditar webhook y estados de pago
3. confirmar trazabilidad order/payment/refund

### Prioridad 2 — Blindar operación
1. cerrar env E2E
2. correr smoke reproducible
3. corregir cualquier drift de `card_scans`
4. documentar seeds y credenciales de prueba

### Prioridad 3 — Blindar acceso admin
1. reemplazar whitelist rígida por modelo más formal
2. revisar memberships / roles / RLS
3. definir proceso de alta de admins

### Prioridad 4 — Reducir deuda técnica
1. separar `api.js` por dominio
2. extraer guards/routing de `App.jsx`
3. consolidar documentación viva

---

## 10. Recomendación de negocio
El siguiente trabajo rentable **no** es agregar más features estéticas.

El siguiente trabajo rentable es:
- asegurar cobro real
- reducir riesgo operativo
- cerrar QA mínimo
- dejar documentado el sistema para continuidad

En simple: **menos maquillaje, más control de caja y menos probabilidad de error.**

---

## 11. Evidencia usada para este snapshot
- `package.json`
- `README.md`
- `docs/STATUS.md`
- `BITACORA_ETAPA_9.md`
- `src/App.jsx`
- `src/services/api.js`
- `supabase/functions/*`
- `cypress/README-e2e.md`
- build local exitoso
- preflight E2E fallido por variables faltantes
