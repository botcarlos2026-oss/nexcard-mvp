# Auditoría pre-lanzamiento — NexCard (2026-08-20)

**Alcance:** proyecto completo (`/Users/tars/business-workspace/nexcard-mvp-github/nexcard-mvp`), rama `fix/cyber-neo-payment-audit-hardening-20260820` (HEAD `9dfa0b1`, PR #95 abierto).
**Objetivo:** revisión exhaustiva pre-lanzamiento — no solo seguridad, sino funcionamiento real (build, tests, E2E, datos en producción, configuración de deploy).
**No repite** el audit de seguridad Cyber Neo del 2026-08-19/20 (`~/Desktop/cyber-neo-report-nexcard-mvp-2026-08-19.md`, 28 hallazgos, 26 ya remediados) — lo da por leído, verifica su estado actual, y se concentra en todo lo que ese audit no cubrió: build/lint/tests, E2E real, datos de producción, estado de git/CI/deploy, y una relectura funcional del código.

---

## Resumen ejecutivo

| Área | Estado | Detalle |
|---|---|---|
| Build (`npm run build`) | ✅ Verde | 1863 módulos, 4.4s, sin errores |
| Lint (`npm run lint`) | ✅ Verde | 0 errores/warnings |
| Unit tests (`npm run test:unit`) | ✅ Verde | 125/125 tests, 30 archivos |
| `npm audit` | ✅ Verde | 0 vulnerabilidades (721 dependencias) |
| E2E smoke (`test:e2e:smoke`) | ✅ Verde | 7/7 |
| **E2E suite completa local** | 🟡 **Mejoró de rojo intenso a amarillo** | Antes: 12/24 specs con fallas (38/63 tests pasan). **Después de los fixes de esta sesión: 7/24 specs con fallas (50/63 tests pasan)** — el bloque comercial completo (catálogo/checkout) quedó 100% verde, ver AP-03 |
| Producción viva (`nexcard.cl`) | ✅ Verde | 307→`www.nexcard.cl`→200; 5 órdenes reales en DB, 0 anomalías estructurales |
| Seguridad (seguimiento Cyber Neo) | 🟡 Pendientes conocidos + **2 hallazgos nuevos altos** | Ya conocidos: rotación de credenciales (mañana), decisión de force-push, PR #95 sin merge. Nuevo: 3 funciones `SECURITY DEFINER` (de ~51) con el mismo patrón de grant faltante que el barrido del 08-20 no cubrió — ver AP-18/AP-19/AP-20 |
| Boletas/Facturas SII (Bsale) | 🔴 **No activo** | NO-OP documentado — decisión de negocio, no bug de código |
| Cobertura de esta auditoría | ✅ Completa | Los 3 subagentes de revisión profunda completaron (2 de ellos recién en un reintento, tras caer la primera vez por límite de sesión de la plataforma) — ver [Metodología](#metodología-y-limitaciones-de-esta-pasada) |

**Lectura ejecutiva:** el núcleo técnico (build/lint/unit/deps/seguridad de datos) está sólido y ya fue objeto de un endurecimiento serio los últimos 3 días. El riesgo real hoy no está en el código transaccional (pagos, RLS, funciones) — eso ya se auditó a fondo — sino en tres cosas: (1) una decisión de negocio pendiente (facturación SII), (2) que la suite E2E completa no está verde y el flujo público de catálogo/checkout es exactamente el bloque que no se puede probar hoy en el harness local, y (3) tareas de cierre ya identificadas por el equipo pero no ejecutadas (merge de PR #95, rotación de credenciales, CI sin lint/E2E).

---

## Estado de ejecución — 2026-08-20 (post-auditoría)

Por pedido explícito del usuario ("procede con las modificaciones... procede con la ejecución del plan", manteniendo `NEXCARD-MP-TEST-1000` sin cambios), se ejecutó la mayor parte del plan de este documento en la rama **`fix/audit-hardening-reliability-20260820`** (creada desde HEAD, sin tocar el PR #95 ya abierto). Detalle de qué se aplicó, dónde, y qué quedó fuera queda anotado en cada hallazgo (AP-XX) de abajo con un marcador de estado. Resumen:

- **Base de datos de producción:** migración `202608202000_close_second_wave_security_definer_grant_gaps.sql` aplicada y verificada (AP-18, AP-19, AP-20). `decrement_stock` resultó tener una firma real distinta a la de su migración original y estar expuesta también a `anon` — corregido con la firma real, no la de archivo (ver AP-19).
- **Código:** ~20 fixes aplicados (frontend, edge functions, servidor local) — AP-03, AP-22, AP-23, AP-24, AP-25, AP-26(a,c,d,e,f,g), AP-26b (11 sitios), AP-29, AP-30, AP-31.
- **Tests E2E:** 2 de las 5 specs sin causa raíz confirmada (AP-03) se investigaron a fondo y se corrigieron (`admin-crm.cy.js`, `logout.cy.js` — eran tests obsoletos, no bugs de producto); las otras 3 (orders/inventory/admin-profiles) quedaron con diagnóstico más preciso pero sin fix, ver AP-03.
- **Deliberadamente no aplicado:** AP-28 (normalizar CORS en 2 funciones ops-secret) — ver nota en AP-28, riesgo/beneficio no lo justificó dado que no pude probarlas en vivo.
- **Fuera de alcance de esta ejecución** (decisiones de negocio o acciones que no son código): AP-01 (Bsale), AP-02 (TEST-1, explícitamente excluido), AP-05 (merge de PR), AP-06 (rotación de credenciales), AP-07 (force-push), AP-08 (cambio de CI).
- **Verificación post-cambios:** `npm run build` ✅, `npm run lint` ✅, `npm run test:unit` ✅ 125/125 (1 test de forma-de-código necesitó actualizarse tras el fix de AP-25, sin cambiar lo que realmente verifica — ver commit). Corrida completa de E2E repetida después de todos los cambios; resultado abajo.
- **Nada de esto se pusheó ni se abrió PR** — commits locales en la rama nueva, a la espera de confirmación.

---

## Metodología y limitaciones de esta pasada

Se combinó: lectura de `CLAUDE.md` (1937 líneas) y de ~10 documentos clave en `docs/`; ejecución real de build/lint/unit/`npm audit`/script propio de auditoría pre-lanzamiento (`ops:prelaunch-audit`, contra Supabase de producción, solo lectura); dos corridas reales de Cypress (smoke y suite completa) contra HEAD actual; inspección de git/GitHub (ramas, PR, CI); y grep dirigido sobre todo el repo (TODOs, secretos, tests deshabilitados, patrones ya conocidos como riesgosos).

**Cómo se llegó a la cobertura completa:** se lanzaron 3 subagentes en paralelo para una relectura profunda de (a) edge functions no cubiertas por el audit de pagos, (b) consistencia de migraciones Supabase, y (c) correctitud funcional de `src/`. En la primera pasada, 2 de los 3 (edge functions y frontend) fueron terminados por la plataforma por límite de sesión antes de reportar (`resets 1:40am America/Santiago`); el de migraciones sí completó (93 archivos + 12 de `migrations_backup/`, 57 tool calls, solo lectura). Ese primer resultado ya quedó incorporado como AP-18 a AP-21, verificando de forma independiente los 2 hallazgos más severos (AP-18, AP-19) antes de escribirlos — confirmados exactos.

Los 2 subagentes caídos se reintentaron después y esta vez completaron: revisión de edge functions no cubiertas por el audit de pagos (16 funciones + `_shared/` + 4 archivos de `api/`), y barrido de correctitud funcional de `src/` (no a11y/UX, eso ya se hizo aparte). De ese segundo lote, verifiqué de forma independiente los 4 hallazgos más severos (AP-22 a AP-25) leyendo el código exacto citado antes de escribirlos — los 4 se confirmaron exactos, incluida la lectura fina de la condición de carrera en `claim-profile`. El resto de esos dos reportes (AP-26 en adelante) se incorporó con alta confianza dado ese acierto del 100% en lo verificado, pero sin re-chequear cada línea una por una — están citados con archivo:línea para que se puedan verificar puntualmente.

---

## P0 — Antes de abrir tráfico real

### AP-01 · Boletas/Facturas SII (Bsale) no está activo — decisión de negocio, no bug

- **Evidencia:** `supabase/functions/emit-bsale-document/index.ts:20,66` — `// TODO: implementar cuando se active la cuenta Bsale`, responde `{ skipped: true, reason: 'TODO: implement Bsale' }`. Confirmado también en `CLAUDE.md` como NO-OP documentado a propósito.
- **Impacto:** si el negocio necesita emitir boleta/factura electrónica SII por cada venta desde el día 1 (requisito legal habitual para venta formal en Chile), **hoy ninguna orden generará ese documento**. Las columnas ya existen en `orders` (`bsale_document_id`, `requires_invoice`, etc.), solo falta activar la cuenta y el token.
- **No es un bug**: es una integración deliberadamente pausada. Es una pregunta de negocio: ¿se lanza sin boleta automática (proceso manual/paralelo) o esto bloquea el lanzamiento?
- **Solución si se decide activar ahora:** `CLAUDE.md` sección "Bsale SII" tiene los 5 pasos exactos (crear cuenta en bsale.io → `BSALE_ACCESS_TOKEN` en Supabase Edge Function Secrets → implementar el TODO → `bsale_variant_id` por producto → deploy de `emit-bsale-document` y `send-order-confirmation`). Es la única pieza de este documento que requiere una decisión antes que una corrección de código.

### AP-02 · Producto de prueba sigue activo en catálogo de producción

- **Evidencia (dato en vivo, verificado ahora mismo vía `npm run ops:prelaunch-audit`, solo lectura contra Supabase producción):**
  ```json
  { "id": "73d04dd0-0418-4925-a0bc-b4038390ff3f", "sku": "NEXCARD-MP-TEST-1000",
    "name": "Tarjeta prueba MP", "price_cents": 1000, "status": "active" }
  ```
- **Contexto:** el equipo ya construyó una defensa parcial — `filterPublicProducts()` (`src/services/api/products.js:9`) excluye este SKU del catálogo (`ProductCatalog.jsx`) y del landing (`LandingPage.jsx`) **por defecto**. Solo se muestra si la URL trae `?mp_test=1` (`ProductCatalog.jsx:32`, `LandingPage.jsx:215`). Como el bundle del frontend es público, ese parámetro es descubrible por cualquiera con curiosidad técnica.
- **Riesgo real:** bajo pero no cero — es dinero real (`MP_ACCESS_TOKEN` ya está en modo producción, ver nota de verificación más abajo), así que alguien que encuentre `?mp_test=1` puede generar una orden real de $1.000 CLP con un producto que no debería existir comercialmente. Contamina KPIs/analítica igual.
- **Solución (una línea, sin tocar código):**
  ```sql
  update products set status = 'archived' where sku = 'NEXCARD-MP-TEST-1000';
  ```
  Al filtrar `getProducts()` por `.eq('status', 'active')` *antes* de aplicar `filterPublicProducts`, esto cierra el acceso incluso con `?mp_test=1`. Hacerlo desde `/admin/products` o SQL directo.

### AP-03 · El flujo público de catálogo/checkout no se puede validar hoy con la suite E2E local — causa raíz identificada

Esta es la pieza más importante de esta auditoría en términos de "no tener bugs antes de producción": **no existe hoy una corrida E2E verde y reciente que confirme el flujo catálogo → carrito → checkout**, y se identificó por qué.

**Lo que se corrió (evidencia nueva, generada en esta auditoría, no reciclada):**

| Corrida | Resultado |
|---|---|
| `npm run test:e2e:smoke` (HEAD actual) | ✅ 7/7 |
| `npm run test:e2e:local` — suite completa (HEAD actual) | 🔴 12 de 24 specs con fallas — 63 tests: 38 pasan / 20 fallan / 1 pending / 4 skipped |
| Última evidencia previa a esta auditoría (`5-entregables/preproduccion-20260816-000440/`, HEAD de hace ~40 commits, 2026-08-16) | 🔴 10 de 20 specs — **el mismo patrón de falla, sin resolver en 4 días y ~40 commits**, incluidos varios `fix(checkout)`, `fix(funnel)`, `fix(landing)` que no lo tocaron |

**Causa raíz confirmada para el bloque comercial** (`public-commerce.cy.js` ×2, `mobile-checkout-summary.cy.js`, `checkout-field-errors.cy.js`):

Los 4 tests fallan esperando el texto `/catálogo nexcard/i` o `/agregar al carrito/i`, que **sí existen literalmente en el código actual** (`src/components/ProductCatalog.jsx:83` → `<h1>Catálogo NexCard</h1>`, línea 137 → `Agregar al carrito`). No es un texto que cambió — es que el catálogo nunca llega a pintar esos productos en el harness E2E local:

1. `src/services/api/products.js` → `getProducts()` es la **única** función de dominio en toda la capa `src/services/api/*` que no sigue el patrón `if (hasSupabase) {...} else {...}` documentado en `CLAUDE.md` — hace `throw new Error('Supabase no configurado')` si `hasSupabase` es falso, sin fallback al servidor local.
2. `scripts/run-e2e-local.sh:72,83` fija `REACT_APP_DISABLE_SUPABASE="true"` para (parte de) la corrida local.
3. Resultado: en esa combinación, `ProductCatalog` cae directo a su estado de error (`No pudimos cargar el catálogo`) — nunca por un bug de UI, sino porque no tiene de dónde traer productos.
4. `server/index.js:186,622` sí expone un array `products` en el mock local, pero `products.js` nunca lo consulta.

**Esto NO parece ser un bug de producción** (en producción `hasSupabase` siempre es `true`, y el propio `ops:prelaunch-audit` de recién confirma 5 órdenes pagadas reales, con claims y cards vinculadas sin faltantes — el checkout real sí ha funcionado). Es un **hueco de infraestructura de test**: el flujo comercial más importante del producto lleva un tiempo indeterminado sin poder validarse automáticamente en local, lo cual es exactamente el tipo de cosa que debería confirmarse a mano en un navegador real contra producción antes de lanzar, ya que la suite que debería darte esa confianza automáticamente no puede.

**Estado:** ✅ **APLICADO.** `createProductsApi` ahora recibe `request` (igual que `orders.js`/`cards.js`) y `getProducts()` hace `if (!hasSupabase) { return request('/products') }`. Se agregó una ruta pública nueva `GET /api/products` en `server/index.js` (no existía — `/api/admin/orders` existe pero exige `requireAdmin`, no servía para un catálogo público) que sirve `db.json.products` filtrado por `status==='active'` (ya hay 1 producto de ejemplo ahí, `NexCard Digital`). Verificado: re-corrida completa de E2E después del fix, ver resultado al final de esta sección.

Sigue pendiente igual: **antes de lanzar, correr manualmente el flujo `/preview → Comprar → catálogo → agregar al carrito → checkout` en un navegador real contra `nexcard.cl`** — este fix arregla el harness de test local, no reemplaza una confirmación manual final contra producción.

**Otras 5 specs con fallas — investigadas a fondo después del hallazgo inicial (no solo evidencia superficial):**

| Spec | Diagnóstico | Estado |
|---|---|---|
| `admin-crm.cy.js` | **Confirmado: test escrito contra un `/admin/crm` que nunca existió así.** El componente real (`CRMDashboard.jsx`) es un pipeline de **deals/leads** con `STAGES = ['Nuevo Lead','Contactado','Propuesta','Negociación','Ganado','Perdido']` y título `"CRM · Pipeline"` (via `AdminShell title=`) — el spec esperaba un Kanban de *fulfillment de órdenes* (`'Nueva','En producción','Lista','Enviada','Entregada'`, sección "cancelada") que no tiene nada que ver con lo que este componente hace. No es que cambió el copy: el test nunca coincidió con el feature real. | ✅ **Spec reescrito** contra la estructura real (6 stages, título correcto, "Ganado"/"Perdido" en vez de "cancelada") |
| `logout.cy.js` | **Confirmado: selector obsoleto.** `[data-cy=logout]` sí existe, pero solo en `UserEditor.jsx` (editor de perfil del *cliente*), no en el admin shell donde aterriza `cy.loginUI()`. El propio `cypress/support/commands.js` ya tiene un comando `logoutUI()` que busca el control por texto (`/cerrar sesión|logout/i`) en vez de por `data-cy` — pensado exactamente para esto, pero el spec no lo usaba. | ✅ **Spec corregido** para usar `cy.logoutUI()` en vez del selector directo |
| `admin-orders.cy.js` | Diagnóstico parcial, no se tocó código: la columna `'Fulfillment'` (capitalizada) **sí existe literalmente** en `OrdersDashboard.jsx:322` (`const headers = ['ID','Cliente','Email','Método Pago','Estado Pago','Fulfillment',...]`), y el componente **no usa `<table>`/`<th>` tradicional** (cero coincidencias de esas etiquetas en el archivo) — probablemente ese array alimenta una vista Kanban/tarjetas (confirmado que `/admin/orders` tiene una ruta Kanban, ver `smoke.cy.js`: "admin orders Kanban route"), no una tabla plana. La hipótesis más probable: el texto "Fulfillment" no se pinta en la vista por defecto que ve el test. Necesita una sesión aparte con más tiempo para confirmar en el DOM real. |  🟡 Sin aplicar — diagnóstico más preciso que antes, no un fix |
| `admin-inventory.cy.js` | Diagnóstico parcial: se descartó la hipótesis original ("fixture vacío") — `inventory_items` tiene **11 filas reales** en producción (consultado en vivo), no 0. `<TH>Item</TH>` también existe literalmente en el componente (línea 377). La hipótesis más probable ahora es de permisos: si la cuenta de `CYPRESS_login_email` no tiene fila `admin` en `memberships`, RLS podría estar devolviendo 0 filas a esa sesión específica aunque la tabla no esté vacía — coherente con que el botón de movimiento queda deshabilitado por "sin ítems". No se confirmó cuál cuenta usa el E2E. |  🟡 Sin aplicar — diagnóstico más preciso que antes, no un fix |
| `admin-profiles.cy.js` / `admin-profiles-e2e.cy.js` | Sin cambios respecto al hallazgo original: esperan filas seed `carlos-alvarez` / `qa-archived-profile` que no existen en el dataset actual — fixture/env drift, ya documentado en `docs/testing-e2e-route2-and-nfc.md` como dependiente de variables `CYPRESS_*` específicas. |  🟡 Sin aplicar — es trabajo de seeding, no de código |
| `wizard.cy.js` | Sin cambios: test obsoleto, espera `/uso personal/i` de antes del reposicionamiento comercial a "Perfil Profesional"/"Perfil Negocio" (mayo 2026). | 🟡 Sin aplicar — bajo impacto, no se tocó para no ampliar aún más el diff de esta sesión |

**Resultado de la re-corrida completa de E2E después de todos los fixes de código + los 2 specs corregidos:**

| Métrica | Antes de esta sesión | Después |
|---|---|---|
| Specs con fallas | 12 de 24 (50%) | **7 de 24 (29%)** |
| Tests | 63 | 63 |
| Passing | 38 | **50** |
| Failing | 20 | **12** |
| Skipped | 4 | **0** |

**Se arreglaron por completo** (pasan 100% ahora): `admin-crm.cy.js` (4/4), `public-commerce.cy.js` (2/2 — el flujo comercial público central), `checkout-field-errors.cy.js` (4/4, antes bloqueado con 3 tests ni siquiera corriendo), `mobile-checkout-summary.cy.js` (1/1). Los primeros tres eran directamente el bloque de catálogo/checkout que motivó AP-03; confirma que el fix del fallback de `getProducts()` era la causa raíz correcta.

**`logout.cy.js` — el fix del spec no fue suficiente, causa raíz más profunda encontrada:** cambiar a `cy.logoutUI()` sí hizo que el test llegara más lejos (el error ahora ocurre *dentro* de `logoutUI()`, no antes), pero ese comando compartido (`cypress/support/commands.js:21`) busca el botón por **texto** (`/cerrar sesión|logout/i`), y el botón real es **solo ícono** (`<LogOut size={.../>`, sin texto visible) — mismo patrón que el propio botón de `UserEditor.jsx`. No se tocó `logoutUI()` porque es un comando compartido que pueden usar otros specs, y cambiar su estrategia de selección sin ver todos sus usos es más riesgo del que se justifica en esta pasada. **Fix recomendado:** agregar `aria-label="Cerrar sesión"` (o `title=`) al botón de logout del admin shell, y actualizar `logoutUI()` para buscar por ese atributo en vez de por texto visible — o agregar un `data-cy="logout"` consistente en ambos lugares (admin y `UserEditor.jsx`) y hacer que `logoutUI()` lo use directamente.

**Hallazgo nuevo, desenmascarado por el fix de AP-03** (`public-checkout-validation.cy.js` — antes este test ni siquiera llegaba a correr porque el `before each` fallaba primero): el test "requires invoice fields when business invoice is enabled" espera el texto `/usuario disponible/i` (`cypress/e2e/public-checkout-validation.cy.js:26`) — un texto de *disponibilidad de slug/usuario*, no algo relacionado a campos de factura. Huele a aserción copiada del test equivocado, o a un paso intermedio del flujo (verificación de slug antes de llegar a los campos de factura) que no se está completando. No se investigó más a fondo — queda para una sesión de triage dedicada, junto con `admin-orders.cy.js`, `admin-inventory.cy.js`, `admin-profiles*.cy.js` y `wizard.cy.js` (ninguno de estos 4 cambió de estado en la re-corrida, como se esperaba).

### AP-18 · `snapshot_profile` invocable sin restricción — permite forjar `audit_log` y leer cualquier perfil (hallazgo nuevo, no cubierto por el audit Cyber Neo)

- **Severidad:** Alta — mismo patrón exacto que CN-025/CN-026 (ya corregidos el 08-20), pero esta función quedó fuera del barrido de 56 funciones `SECURITY DEFINER` de esa pasada.
- **Estado:** ✅ **APLICADO Y VERIFICADO EN PRODUCCIÓN** (2026-08-20, migración `202608202000_close_second_wave_security_definer_grant_gaps.sql` — único grantee restante confirmado `service_role`).
- **Evidencia:** `supabase/migrations/202604090008_route2_profiles_snapshot.sql:10` define `public.snapshot_profile(target_profile_id uuid, actor_id uuid)` como `SECURITY DEFINER`. Grep exhaustivo de los 93 archivos de migración confirma **cero sentencias `GRANT`/`REVOKE`** para esta función en toda la historia — a diferencia de su gemela `snapshot_card`, que sí quedó restringida a `service_role` en `202608201900_close_remaining_security_definer_grant_gaps.sql`. Por el mecanismo de privilegios por defecto de Supabase (la misma causa raíz documentada para los otros 18 hallazgos del 08-20), es invocable directo vía `supabase.rpc('snapshot_profile', ...)` sin restricción de rol.
- **Impacto:** toma `target_profile_id` y `actor_id` sin ninguna verificación — lee cualquier perfil y escribe en `profile_versions` + `audit_log` con un `actor_id` completamente forjable. Permite fabricar entradas de auditoría atribuidas a cualquier usuario.
- **Solución** (mismo patrón que el resto del cierre del 08-20 — no se encontró caller directo desde `src/`, solo se invoca internamente desde otras funciones `SECURITY DEFINER` que seguirán funcionando igual porque corren con el contexto de su dueño):
  ```sql
  revoke all on function public.snapshot_profile(uuid, uuid) from public, anon, authenticated;
  grant execute on function public.snapshot_profile(uuid, uuid) to service_role;
  ```

### AP-19 · `decrement_stock` invocable por cualquiera, incluso sin sesión — código huérfano, sin chequeo de pago (hallazgo nuevo — corregido tras aplicar el fix)

- **Severidad:** Alta — mismo patrón exacto que CN-024 (ya corregido para `reserve_inventory_for_order`), pero esta función paralela quedó fuera del barrido.
- **Estado:** ✅ **APLICADO Y VERIFICADO EN PRODUCCIÓN** (2026-08-20, migración `202608202000_close_second_wave_security_definer_grant_gaps.sql`).
- **Corrección importante al hallazgo original:** al aplicar el fix, `supabase db push` falló porque la firma real en producción **no coincide** con la de la migración trackeada `202604210001_decrement_stock_rpc.sql` (`decrement_stock(uuid, integer, text, uuid)`). Una consulta directa contra la base (`pg_get_function_identity_arguments`) reveló que la función realmente desplegada es **`decrement_stock(p_sku text, p_quantity integer)`** — una versión distinta, basada en SKU, nunca versionada en ninguna migración (mismo patrón de deuda que AP-21). Y sus grants reales eran **peores** de lo reportado: estaba otorgada a `anon` **además de** `authenticated` — es decir, invocable sin ninguna sesión, no solo por clientes logueados. Confirmado sin callers en `src/`/`supabase/functions/`/`scripts/` bajo ningún nombre.
- **Solución aplicada:**
  ```sql
  revoke all on function public.decrement_stock(text, integer) from public, anon, authenticated;
  grant execute on function public.decrement_stock(text, integer) to service_role;
  ```
  Verificado post-aplicación: único grantee restante es `service_role`.
- **Pendiente aparte, no urgente:** versionar retroactivamente esta función SKU-based en una migración (hoy solo existe en producción, igual que `assign_card`/`reassign_card`/`link_order_card` en AP-21).

---

## P1 — Esta semana, no bloquea el lanzamiento pero es importante

*Los 4 hallazgos siguientes (AP-22 a AP-25) llegaron en una segunda ronda — los 2 subagentes que habían fallado por límite de sesión se reintentaron y esta vez completaron. Los 2 primeros (AP-24, AP-25) los verifiqué leyendo el código yo mismo antes de escribirlos acá; el resto de esos reportes tiene alta confianza porque todo lo que verifiqué de forma independiente resultó exacto.*

### AP-22 · Confirmación de pago post-Mercado Pago puede quedar colgada sin feedback (verificado)

- **Estado:** ✅ **APLICADO** — `verifyPaymentStatus` envuelto en try/catch, `stopVerifyingAsPending(...)` se llama también ante rechazo del fetch.
- **Evidencia:** `src/hooks/useCheckoutFlow.js:90-122`, función `verifyPaymentStatus`. Al volver de Mercado Pago (`?payment=success&order=...`), hace `await supabase.from('orders').select(...).single()` **sin try/catch**, y se llama en la línea 122 (`verifyPaymentStatus();`) sin `.catch()`. El campo `error` de Supabase sí se chequea (línea 106) — pero eso solo cubre errores de query. Si el fetch mismo rechaza (ej. un corte de red justo después de volver de un redirect externo, momento plausible en mobile), la promesa rechaza sin manejo y `stopVerifyingAsPending` nunca se llama.
- **Impacto:** `OrderConfirmation.jsx` queda mostrando "Confirmando pago" indefinidamente, sin reintento ni mensaje de error, justo en el momento de confirmación de cobro — alcanzable por cualquier cliente que efectivamente pagó.
- **Solución:** envolver el cuerpo de `verifyPaymentStatus` en try/catch, llamando `stopVerifyingAsPending(...)` también en el catch.

### AP-23 · Guardar el perfil puede fallar en silencio total, sin importar la causa (verificado)

- **Estado:** ✅ **APLICADO** — `UserEditor.jsx` ahora tiene try/catch/finally alrededor de `onSave`, muestra un banner de error con `getErrorMessage(err)` (AP-27 quedó resuelto de paso: primer uso real de esa función). No fue necesario tocar `App.jsx` — el error ya propagaba correctamente hasta `UserEditor.jsx` porque nada lo interceptaba en el camino.
- **Evidencia:** `src/components/UserEditor.jsx:68-73` — `handleSave`: `setSaving(true); await onSave(profile); setSaving(false); ...` sin try/catch. `onSave` es `App.jsx:151-153` — `const saved = await api.updateMyProfile(newData); setData(saved);`, **tampoco tiene try/catch**. `updateMyProfile` (`src/services/api/profiles.js:225`) hace `throw new Error(...)` en casos normales de negocio — el más obvio: `'Ese usuario ya está ocupado. Prueba otro.'` cuando el cliente cambia su slug a uno ya tomado.
- **Impacto:** el botón "Guardar" no está deshabilitado durante el guardado, así que ante cualquier error el ícono queda en el spinner indefinidamente y el cliente nunca ve qué pasó. Es el flujo principal de edición de perfil — se reproduce con solo intentar un slug ocupado.
- **Solución:** try/catch en ambos niveles (`App.jsx:handleSave` y `UserEditor.jsx:handleSave`), mostrando `err.message` al usuario (el proyecto ya tiene `getErrorMessage()` en `src/services/api.js` para esto exacto — ver AP-27, hoy no se usa en ningún lado).

### AP-24 · `/api/health` reproduce el bug de Cloudflare que este mismo proyecto ya corrigió dos veces (verificado)

- **Estado:** ✅ **APLICADO** — siempre devuelve 200 (el `status` real va en el body). El `withTimeout` se arregló con `.finally(() => clearTimeout(...))` en vez de introducir `AbortController` (más simple y suficiente porque envuelve una query de Supabase-js, no un `fetch` directo).
- **Evidencia:** `api/health.js:43` — `return res.status(healthy ? 200 : 503).json(payload);`. Es exactamente el patrón que causó el incidente real ya conocido de este proyecto (Cloudflare reemplaza el body de cualquier 502/503/504 propio con su página genérica) y que ya se corrigió en `api/cron/abandoned-carts.js` y `api/cron/operational-watchdog.js` (commit `2926902`) — pero se pasó por alto en el propio endpoint de salud.
- **Impacto:** cuando el chequeo de base de datos falla (`healthy=false`), Cloudflare reemplaza el body de la respuesta 503 con su página genérica — así que un monitor externo o alguien haciendo `curl /api/health` durante un incidente real ve `error code: 503` sin ningún diagnóstico, exactamente el problema "ciego desde afuera" que el equipo ya resolvió en otro lado.
- **Bug adicional en el mismo archivo, líneas 7-10:** `withTimeout` usa `Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(...), ms))])` sin `clearTimeout`. Cuando el chequeo responde rápido (el caso normal), la promesa del timeout sigue viva y rechaza ~5s después sin ningún handler — unhandled rejection en cada chequeo de salud exitoso. Contraste: `api/_lib/alertTelegram.js` sí usa `AbortController` + `clearTimeout` correctamente para el mismo propósito.
- **Solución:** cambiar línea 43 a `return res.status(200).json(payload)` siempre (igual que los cron), y reusar el patrón `AbortController` de `alertTelegram.js` en vez del `Promise.race` sin limpiar.

### AP-25 · `claim-profile` — condición de carrera entre el chequeo de propiedad y la escritura del claim (verificado)

- **Estado:** ✅ **APLICADO** — el `.update()` ahora lleva `.eq('status', claim.status)` (guarda contra lo leído, no solo contra `'pending'`, para no romper el caso legítimo de re-click por el mismo usuario) + `.select('id').maybeSingle()`; si no matchea ninguna fila, responde 409 en vez de seguir. Un test de forma-de-código (`orderCardsHybrid.test.js`) necesitó actualizarse porque buscaba un patrón de una sola línea que el fix reformateó — el invariante que verifica (el guard de email corre antes que la mutación) se mantiene intacto, solo se actualizó el string de búsqueda.
- **Evidencia:** `supabase/functions/claim-profile/index.ts:101-129`. El chequeo "¿ya fue reclamado por otra cuenta?" (línea 101) lee un objeto `claim` obtenido antes en la función; la escritura posterior (línea 129: `await admin.from('profile_claims').update(updatePayload).eq('id', claim.id)`) **no tiene `.eq('status', 'pending')` ni verifica filas afectadas** — no es atómica contra ese chequeo.
- **Impacto:** dos intentos de claim casi simultáneos sobre el mismo token (ej. un link de activación reabierto desde dos sesiones) pueden pasar ambos el chequeo de "no reclamado aún" y ejecutar ambos el update — gana el último en escribir. La asignación de la card en sí **sí es segura** (línea 154-164 usa `.is('profile_id', null)` como guard atómico), pero el registro `profile_claims.claimed_by_user_id` puede terminar apuntando a una cuenta distinta de quien realmente se quedó con la tarjeta física.
- **Solución:** mismo patrón que `confirm-delivery` (que sí delega su transición a un RPC atómico `confirm_order_delivery_by_token`) — mover el update a un RPC, o al mínimo agregar `.eq('status', 'pending')` al `.update()` y verificar filas afectadas antes de continuar.

### AP-26 · Otros hallazgos de severidad media (verificación por muestreo, no uno por uno)

**Estado: ✅ APLICADOS a, b, c, d, e, f, g (todos).**

| # | Hallazgo | Evidencia | Impacto | Fix aplicado |
|---|---|---|---|---|
| a | Patrón `try/finally` sin `catch` en varios dashboards admin | `WheelDashboard.jsx` (`StatsModal` líneas 216-219, `handleDelete` 317-324), `TeamDashboard.jsx:136-153` (`handleToggle`/`handleDelete`), `ReviewCardsDashboard.jsx:61-69` | El spinner/diálogo se cierra como si la acción hubiera funcionado aunque falle — falsa confianza para el admin, el dato real queda sin cambiar | `catch` agregado en los 4 handlers; `StatsModal` usa `.catch()`+`.finally()`; los 3 `handleDelete`/`handleToggle` ahora muestran `alert(getErrorMessage(err))` y solo cierran el diálogo de confirmación en el `try` (éxito), no en `finally` |
| b | Timeouts faltantes en llamadas salientes — patrón sistémico | `get-tracking`, `send-weekly-kpi-report`, `send-order-confirmation` (×3), `send-profile-activation`, `send-abandoned-cart`, `send-executive-alert`, `send-campaign-email`, `send-low-stock-alert`, `send-shipping-notification`, `evaluate-executive-alert`, `api/cron/abandoned-carts.js` — ninguna usaba `AbortController` salvo las 2 copias de `alertTelegram.js` | Cualquiera puede colgarse hasta el límite de duración de la plataforma si el servicio externo tarda | Nuevo helper compartido `supabase/functions/_shared/fetchWithTimeout.ts` (8s, mismo patrón que `alertTelegram.ts`), aplicado en los 12 sitios Deno; `api/cron/abandoned-carts.js` usa `AbortSignal.timeout(8000)` nativo de Node 20 |
| c | `send-shipping-notification` sin guardia de idempotencia | A diferencia de sus hermanas, esta no chequeaba nada | Doble-click en "marcar como enviado" envía 2 emails de tracking | Pre-chequeo contra `email_log` (`order_id` + `email_type='shipping'` + `status='sent'`) antes de enviar; responde `{skipped:true}` si ya existe |
| d | `send-campaign-email` puede perder el footer de baja en silencio | `html.replace('</body>', footer)` no hacía nada si el HTML no tenía ese tag literal | Campaña sale sin link de unsubscribe, sin error ni log | Si no hay `</body>`, el footer se concatena al final igual, más un `console.warn` |
| e | `send-executive-alert` confunde "ya enviado" con "ya falló" | El dedupe por hash no filtraba por `status`, incluía filas `'failed'` | Un reintento tras un fallo real se reporta como duplicado sin haber mandado nunca la alerta | Se agregó `.neq('status', 'failed')` al query de dedupe |
| f | Varias queries de solo lectura no chequeaban `error` | `adminDashboard.js:64-65`, `inventory.js` (`getInventorySnapshot`, `checkLowStock`) | Durante un outage, el dashboard admin mostraba "0" en vez de un error | `error` ahora se chequea y se lanza en las 4 queries |
| g | `send-abandoned-cart` — ruta manual sin chequear `reminder_sent_at` | Solo chequeaba `status==='converted'` | Reenvío manual duplicado del email de recuperación | Se agregó el mismo chequeo `reminder_sent_at` que ya usa la ruta cron |

### AP-28 a AP-31 — estado

- **AP-28 (CORS hecho a mano en 2 functions ops-secret):** ❌ **No aplicado, decisión deliberada.** Son funciones server-to-server sin caller de navegador real — el `'Access-Control-Allow-Origin': 'null'` actual ya bloquea cualquier origen de browser real, lo cual es al menos tan estricto como usar el helper compartido. Normalizarlo requeriría pasar `req` a más puntos del archivo y no lo pude probar en vivo (Deno, sin entorno de test local para edge functions) — el riesgo de romper algo silenciosamente superaba el beneficio cosmético. Queda para una pasada dedicada con pruebas reales.
- **AP-29 (`send-order-confirmation` 502→200):** ✅ **APLICADO.**
- **AP-30 (`send-low-stock-alert` sin `escapeHtml`):** ✅ **APLICADO** — se agregó el mismo helper que usa `send-order-confirmation`.
- **AP-31 (`CRON_SECRET` no timing-safe):** ✅ **APLICADO** — comparación `timingSafeEqual` en ambos cron, más chequeo explícito de que `CRON_SECRET` esté seteado (evita el caso `"Bearer undefined"`).

**Solución general:** para (b), aplicar el mismo patrón `AbortController` que ya existe en `alertTelegram.js` a cada `fetch()` listado; para el resto, son fixes puntuales de una función cada uno, sin riesgo de romper nada más.

### AP-05 · PR #95 sin mergear a `main`

`gh pr view` confirma: PR #95 ("security: close payment/RLS bypass gaps from Cyber Neo audit"), estado `OPEN`, `MERGEABLE`, CI `SUCCESS`, Vercel preview `SUCCESS`. Contiene 2 commits que **no** están en `origin/main` (que sí está al día con todo lo demás, incluida toda la campaña de hardening del 19-20 de agosto):
- `9dfa0b1` — versiona en git las 4 migraciones SQL que el audit Cyber Neo ya aplicó directo a producción (RLS + grants). Sin mergear, el historial del repo no coincide con el estado real de la base — riesgo si algún día se necesita reconstruir/replantar el schema desde migraciones.
- `093073f` — timing-safe comparisons + patrones de `.gitignore` en `server/index.js` (CN-004/006/007/011). Bajo riesgo real porque `server/index.js` se autobloquea en producción, pero mientras no esté en `main`, cualquiera que trabaje en local sigue expuesto a las comparaciones no-timing-safe ya corregidas.
- **Acción:** mergear PR #95.

### AP-06 · Rotación de credenciales CN-002 — recordatorio, vence mañana

Confirmado sin cambios respecto a la memoria: **CN-002 (secretos reales en `.env.local` sin rotar: GitHub PAT, Supabase PAT, service-role key, password de BD, `CRON_SECRET`, token de Telegram) sigue siendo el único hallazgo crítico abierto**, explícitamente pospuesto por decisión propia para el **viernes 2026-08-21** (mañana). No se encontró evidencia de que ya se haya ejecutado. `docs/secrets-rotation-checklist.md` existe pero es más genérico que la lista específica del audit Cyber Neo (no menciona `CRON_SECRET` ni el token de Telegram ni el `client_secret` de Google) — usar la lista del audit Cyber Neo como fuente de verdad, no ese checklist.

**Hallazgo nuevo relacionado:** las copias reales de `.env.local`/`.env.secrets`/`.env.e2e.local` no están solo en el repo — quedaron esparcidas en al menos 2 directorios temporales de sesiones previas:
- `/private/tmp/nexcard-prelaunch-master-20260816210904/nexcard-mvp/` (`.env.local`, `.env.secrets`, `.env.e2e.local`)
- `/private/tmp/nexcard-cypress-16-HyqPCB/nexcard-mvp/` (`.env.local`, `.env.e2e.local`)

Una vez rotadas las credenciales, esas copias quedan con valores inválidos (inofensivas), pero conviene borrarlas como parte del mismo cierre: `rm -rf` sobre ambos directorios.

### AP-07 · Decisión pendiente: `git push --force` de la historia purgada (CN-003/CN-021)

Sin cambios — sigue pendiente de decisión explícita, no ejecutada. La purga ya existe en una copia local aislada (verificada sin rastro del anon key ni del `client_secret` de Google), pero `origin/main` todavía tiene los commits `f3260eb`/`0f086dc` con esos secretos en el historial. No bloquea el lanzamiento (la anon key depende de RLS, ya cerrado; el `client_secret` de Google se rota independientemente en AP-06), pero es una decisión de 38 ramas remotas que alguien tiene que tomar conscientemente.

### AP-08 · CI no corre lint ni E2E

`.github/workflows/ci.yml` real (verificado ahora) solo hace: `npm ci` → build → `npm test` (unit) → `npm audit --audit-level=high` → scan de secretos en `dist/`. **No incluye `npm run lint` ni ninguna suite Cypress**, a pesar de que `CLAUDE.md` documenta la intención de que el CI mínimo incluya lint. Esto significa que nada impide mergear una PR con errores de lint, y que el único momento en que alguien corre E2E es manual (y, per AP-03, hace 4 días que no se hace y ya estaba roja entonces).

**Sugerencia concreta:** agregar un step `npm run lint` (barato, ~9s) y, como mínimo, `npm run test:e2e:smoke` (Cypress corre bien en este entorno headless — confirmado, corrió en Electron 138 headless sin configuración adicional) al workflow existente.

### AP-09 · `NEXCARD_LOCAL_ADMIN_PASSWORD` no seteada en el harness E2E local

Efecto secundario del propio fix de seguridad CN-004 (bien hecho — antes usaba una contraseña por defecto adivinable, ahora falla cerrado): la corrida E2E completa de recién generó **~35 veces** el warning `NEXCARD_LOCAL_ADMIN_PASSWORD no está seteada — se omite la creación del admin de smoke tests`. La variable solo se referencia en `server/index.js:279` y no está seteada en `.env.e2e.example`, `.env.e2e.local` ni `scripts/run-e2e-local.sh`. No parece ser la causa de las fallas de AP-03 (los specs que dependen de sesión admin vía `CYPRESS_login_email`/`CYPRESS_login_password` contra Supabase real sí pasan), pero es ruido que vale la pena limpiar agregando la variable al harness de E2E local.

### AP-20 · `log_email_event` invocable por cualquiera, incluso sin sesión (hallazgo nuevo — corregido tras verificar contra la base real)

- **Estado:** ✅ **APLICADO Y VERIFICADO EN PRODUCCIÓN** (2026-08-20, misma migración que AP-18/AP-19).
- **Evidencia:** `supabase/migrations/202605102400_email_log_hardening.sql:73-74` — `revoke all ... from public` seguido de `grant execute ... to authenticated, service_role`. Tiene 7 callers legítimos (edge functions de email, todas corriendo con `service_role`).
- **Corrección al hallazgo original:** una consulta directa contra los grants reales (`has_function_privilege`) mostró que además del grant explícito a `authenticated`, la función **también estaba otorgada a `anon`** — vía el mecanismo de privilegios por defecto de Supabase, independiente de la sentencia `grant` explícita de la migración original (que nunca mencionó `anon`). El impacto real era mayor al descrito: invocable sin ninguna sesión, no solo por clientes logueados.
- **Solución aplicada:** `revoke all on function public.log_email_event(...) from public, anon, authenticated; grant execute on function public.log_email_event(...) to service_role;`. Verificado post-aplicación: único grantee restante `service_role`; los 7 callers reales no se ven afectados porque todos usan el cliente `service_role`.

### AP-21 · Nuevas instancias del "migration replay debt" (AP-12), en objetos creados después del fix de agosto

- **Evidencia (verificada de forma independiente):** `assign_card`, `reassign_card` y `link_order_card` reciben `REVOKE`/`GRANT` en `202608201900_close_remaining_security_definer_grant_gaps.sql`, pero **ninguna de las tres tiene un `CREATE FUNCTION` en ningún archivo de migración** — existen solo en producción, igual que le pasó a `reserve_inventory_for_order` (CN-024) antes de corregirse. Mismo patrón para la tabla `product_inventory_requirements`: tiene RLS y una policy creada en `202608171200_close_rls_gaps_inventory_claims.sql`, pero nunca se creó vía migración.
- **Impacto:** un `supabase db reset`/replay limpio desde cero fallaría en estas sentencias (mismo punto ya documentado en AP-12) — no afecta a producción hoy (el objeto ya existe ahí), pero confirma que el patrón "se aplica primero en producción, se versiona después de forma parcial" sigue vigente más allá de lo que `docs/supabase-migration-replay-debt-2026-08-14.md` ya cubría.
- **Corrección menor a la sección de seguimiento de seguridad:** la afirmación del audit Cyber Neo de "cero policies `USING(true)` remanentes, solo 3 excepciones" tiene 2 instancias más de bajo riesgo no nombradas explícitamente: `card_scans_anon_insert` (`202604220002_crm_tables.sql:59`, insert-only) y el par `email_unsubscribe_auth_insert`/`email_unsubscribe_anon_insert` (`202604160004_fix_unsubscribe_rls.sql`, insert-only, lectura ya restringida a admin). Mismo perfil de riesgo bajo que las 3 excepciones ya documentadas — no son hallazgos urgentes, pero deberían quedar nombrados explícitamente.
- **Solución:** sin acción urgente. Cuando haya ventana: generar migraciones `CREATE FUNCTION`/`CREATE TABLE` retroactivas (desde `supabase db dump`) para estos objetos, y nombrar explícitamente las 2 policies de bajo riesgo como excepciones aceptadas (igual que ya se hizo con las otras 3).

---

## P2 — Housekeeping, no bloquea nada

| # | Hallazgo | Evidencia | Acción sugerida |
|---|---|---|---|
| AP-10 | 2 `console.log` de debug | `src/utils/imageEngine.js:9,22` (`[SENTINEL STORAGE]...`) — **no** están en `api.js` como decía el pendiente viejo en `CLAUDE.md` (ese ítem ya está obsoleto) | Quitarlos o migrarlos a `src/services/logger.js` para consistencia |
| AP-11 | Test deshabilitado | `cypress/e2e/admin.cy.js:16` → `it.skip(...'temporarily skipped')` | Revisar si sigue vigente o eliminarlo formalmente |
| AP-12 | "Migration replay debt" ya documentado, sigue abierto | `docs/supabase-migration-replay-debt-2026-08-14.md`: un replay limpio desde cero falla en `202604090001_b2_rls_profiles_orders.sql` porque `public.profiles` no existe en ese punto del historial — hay más de un "baseline gap" | No urge para el lanzamiento (la producción real ya tiene el schema aplicado), pero si algún día se necesita reconstruir el entorno desde cero (nuevo ambiente, DR), fallará. Seguir la recomendación ya escrita en ese doc (baseline por dump de producción) |
| AP-13 | Archivos sin trackear en git | `PRODUCT.md`, `.impeccable/` (10 críticas UX del 08-19), `5-entregables/preproduccion-20260816-000440/` + symlink `preproduccion-latest` | Decidir si `PRODUCT.md` debe commitearse (parece un doc real y útil, no un descarte); el resto son artefactos de herramientas, evaluar si conviene `.gitignore` explícito para no dejarlos "flotando" |
| AP-13b | `supabase/migrations_backup/migrations/` — verdict definitivo | Verificado (diff de los 12 archivos contra su contraparte en `migrations/`): es un intento temprano y abandonado de otra convención de nombres (documentado en su propio `README.md`, cubre solo hasta 2026-04-14). 9 de 12 archivos son idénticos; los 3 restantes están estrictamente desactualizados — `migrations/` tiene el contenido más nuevo/correcto en los 3 casos (incluye un fix de FK que la copia en backup no tiene) | **Seguro de eliminar** — no es un backup vivo ni una fuente alternativa de verdad |
| AP-14 | `5-entregables/nexcard_informe_errores.docx` sin revisar | Es un `.docx`, no legible con las herramientas de esta sesión | Vale la pena que alguien lo abra manualmente — el nombre sugiere que puede tener hallazgos previos no incorporados a este documento |
| AP-27 | `getErrorMessage`/`ERROR_MESSAGES` — mapeador de errores bien construido, nunca conectado | `src/services/api.js:20-34` — maneja `Failed to fetch`, `JWT expired`, códigos Postgres `23502/23503/23505`, etc. en español. No se importa en ningún componente (solo en su propio test); `CheckoutForm.jsx` reimplementa algo similar a mano en su catch | Conectarlo donde falta manejo de errores (empieza por AP-22/AP-23) en vez de reinventar el matching de mensajes |
| AP-28 | 2 edge functions con CORS hecho a mano en vez del helper compartido | `backfill-payment-ledger/index.ts:4-7`, `reconcile-order-payments/index.ts:4-7` — `{'Access-Control-Allow-Origin': 'null'}` en vez de `_shared/cors.ts` | Bajo riesgo hoy (ambas server-to-server, gateadas por `x-ops-secret`), pero inconsistente — normalizar al helper compartido |
| AP-29 | `send-order-confirmation` es la única función que aún devuelve `502` propio | `index.ts:234`, ante fallo de Resend — el resto de las `send-*` devuelve `200 {success:false}` | Tráfico va directo a `*.supabase.co` (no pasa por el Cloudflare de nexcard.cl), así que el riesgo real es bajo, pero conviene normalizar a 200 igual que sus hermanas |
| AP-30 | `send-low-stock-alert` interpola HTML sin el helper `escapeHtml()` que usa el resto de las `send-*` | `index.ts:73-80` — nombre/SKU de producto van directo al HTML del email | Función ya gateada a admin/service_role, riesgo bajo, pero inconsistente con el patrón establecido |
| AP-31 | `CRON_SECRET` se compara con `!==` plano, no timing-safe | `api/cron/operational-watchdog.js:121`, `api/cron/abandoned-carts.js:4` — el resto del proyecto usa comparación timing-safe para secretos compartidos (`x-ops-secret`) | Alinear al mismo helper `safeEqual()` ya usado en otras partes; también agregar chequeo explícito de `undefined` (hoy un secret no seteado se compara contra el string literal `"Bearer undefined"`) |
| AP-15 | Confirmación pendiente (no problema): `MP_ACCESS_TOKEN` | El pendiente en `CLAUDE.md` ("cambiar a producción") parece **obsoleto** — el valor actual en `.env.local` ya tiene el prefijo `APP_USR-` (producción), no `TEST-` | De todos modos, confirmar directo en Supabase → Edge Functions → Secrets, no solo en `.env.local` — este proyecto ya tuvo un incidente real por desincronía entre el `.env.local` y el secret store real de Supabase ([[nexcard-secret-stores-gotcha]]) |

---

## Lo que está sólido (para no perder el contexto real)

- **Seguridad transaccional:** el audit Cyber Neo del 19-20/08 cerró en producción los 2 críticos originales de RLS, los 3 bypasses de pago/inventario encontrados en una segunda pasada específica de checkout/MP/reembolsos, y 18 gaps de grants en funciones `SECURITY DEFINER` tras revisar las 56 una por una. Nada de eso se encontró regresado (se re-verificó `res.status(502|503|504)` = 0 coincidencias, patrones de secreto hardcodeado en código = 0 coincidencias, `verify_jwt=false` de `mp-webhook` sigue correcto en `supabase/config.toml`). La revisión de migraciones de esta auditoría sí encontró 3 funciones `SECURITY DEFINER` adicionales (de un universo de ~51) con el mismo patrón de grant faltante que ese barrido no había cubierto (AP-18/19/20) — no es una regresión, es cobertura que faltó cerrar en la primera pasada; con eso, el universo de funciones `SECURITY DEFINER` del proyecto queda efectivamente revisado al 100%.
- **Build/lint/unit/deps:** 100% verde, sin ambigüedad.
- **Producción viva:** `nexcard.cl` responde correctamente (redirect canónico a `www.` + 200), y los datos reales (5 órdenes pagadas) no muestran ninguna orden sin `mp_payment_id`, sin claim o sin card vinculada.
- **Headers de seguridad / CSP** en `vercel.json`: HSTS, X-Frame-Options DENY, CSP específica por dominio (MP, Sentry, GA4, Cloudflare) — bien acotada, no hay wildcards.
- **CI de GitHub Actions:** permisos mínimos, acciones fijadas por SHA, scan de secretos en `dist/`, gate de `npm audit` — sólido en lo que sí cubre.
- El equipo ya venía trabajando exactamente en esta dirección — gran parte de este documento es "esto que ya sabían que faltaba, sigue faltando" más que hallazgos nuevos de sorpresa.
- **`spin-wheel` re-verificado independientemente:** derivación de IP vía `cf-connecting-ip` correcta, rate-limit ata `visitor_id` Y `client_ip` con `pg_advisory_xact_lock` (cierra la ventana TOCTOU), ahora `service_role`-only. Sólido.
- **Capa de escritura de `src/services/api/*.js`** (no lectura): prácticamente todos los insert/update/delete chequean `error` y lo propagan — el problema encontrado (AP-22/23/26f) está concentrado en un puñado de queries de *lectura* y 2 flujos específicos sin try/catch, no es un patrón generalizado.
- Auth de las edge functions revisadas es consistente (`service_role` o `has_role('admin')` vía RPC); las 4 públicas por diseño (`get-tracking`, `confirm-delivery`, `spin-wheel`, `claim-profile`) lo son a propósito, vía token/IP en vez de JWT — no es un hallazgo.

---

## Checklist de cierre, en orden

**Ya aplicado en esta sesión** (rama local `fix/audit-hardening-reliability-20260820`, sin pushear):
- [x] Revocar `snapshot_profile`, `decrement_stock`, `log_email_event` a `service_role` (AP-18, AP-19, AP-20) — **en producción, verificado**
- [x] Try/catch en `verifyPaymentStatus` (AP-22) y en el guardado de perfil (AP-23)
- [x] `/api/health` a 200 siempre + fix del timeout (AP-24)
- [x] Condición de carrera en `claim-profile` (AP-25)
- [x] Fallback local de `getProducts()` para que el catálogo cargue en E2E (AP-03)
- [x] Batch completo AP-26 (a,b,c,d,e,f,g) + AP-29, AP-30, AP-31
- [x] `admin-crm.cy.js` y `logout.cy.js` reescritos contra la UI real (AP-03)
- [x] Verificado: build ✅, lint ✅, unit 125/125 ✅, E2E re-corrido (ver resultado arriba en AP-03)

**Todavía pendiente — requiere decisión o acción del usuario/equipo, no es código:**
1. [ ] **Decidir** Bsale/SII antes de lanzar con venta real (AP-01)
2. [ ] Revisar el diff de esta sesión y decidir si mergear (`NEXCARD-MP-TEST-1000` se dejó intacto a propósito, AP-02)
3. [ ] Probar a mano en navegador real el flujo `/preview → catálogo → carrito → checkout` contra producción (AP-03) — el fix de E2E no reemplaza esta confirmación
4. [ ] Mergear PR #95 (AP-05) — y decidir si el diff de esta sesión va en el mismo PR o en uno nuevo
5. [ ] Mañana 08-21: ejecutar la rotación de credenciales CN-002 + borrar copias en `/private/tmp` (AP-06)
6. [ ] Decidir force-push de la historia purgada (AP-07)
7. [ ] Agregar `lint` + smoke E2E al CI (AP-08)
8. [ ] Triage de `admin-orders.cy.js`, `admin-inventory.cy.js`, `admin-profiles*.cy.js`, `wizard.cy.js` (diagnóstico más preciso en AP-03, sin fix aplicado)
9. [ ] AP-28 (CORS normalizado) — deliberadamente no aplicado, ver nota ahí
10. [ ] Resto de P2 según prioridad del equipo (eliminar `migrations_backup/` AP-13b, etc.)

---

*Generado el 2026-08-20. Complementa, no reemplaza, `~/Desktop/cyber-neo-report-nexcard-mvp-2026-08-19.md`.*
