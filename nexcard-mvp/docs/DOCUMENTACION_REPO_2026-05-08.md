# Documentación del repo NexCard — 2026-05-08

## Alcance y criterio
Este documento ordena la documentación **según evidencia visible en el repo** al 2026-05-08.

Criterio usado:
- **Vigente**: coincide de forma razonable con el código/estructura actual.
- **Parcial**: útil, pero mezcla realidad actual con planes, supuestos o estado no verificado desde el repo.
- **Obsoleto / duplicado**: fue superado, se repite o puede confundir como fuente principal.

> Nota: varias afirmaciones sobre producción, secrets, Vercel, Mercado Pago o despliegues Supabase no pueden verificarse 100% solo con este repo. Cuando aplica, quedan marcadas como **no verificadas aquí**.

---

## 1) Mapa documental actual

### A. Documentos raíz del proyecto

| Archivo | Estado | Uso recomendado |
|---|---|---|
| `README.md` | Vigente | Puerta de entrada del repo. Fue reescrito en esta revisión para reflejar el estado actual visible. |
| `ARCHITECTURE.md` | Parcial | Útil como visión/arquitectura objetivo; no debe leerse como estado operativo exacto. |
| `SCHEMA.md` | No revisado en detalle | Mantener como apoyo solo si se alinea con `supabase/migrations/`. Requiere contraste posterior. |
| `DB_SCHEMA_SUPABASE.sql` | Parcial | Foto amplia de esquema; no debería competir con migraciones versionadas como fuente principal. |
| `DATABASE_SETUP.sql` | Parcial | Posible bootstrap/manual setup. Requiere aclarar si aún se usa. |
| `ADD_COLUMNS.sql`, `ADD_COLUMNS_COVER.sql` | Parcial / suelto | SQL utilitario fuera del flujo formal; fuente secundaria. |
| `CLAUDE.md` | Interno | No es documentación funcional del producto. |

### B. Bitácoras

| Archivo | Estado | Observación |
|---|---|---|
| `BITACORA_ETAPA_2.md` a `BITACORA_ETAPA_8.md` | Históricas | Sirven como registro de evolución, no como fuente operativa primaria. |
| `BITACORA_ETAPA_9.md` | Vigente parcial | Es la bitácora más cercana al estado actual y conversa bien con el código. Aun así mezcla conclusiones operativas no verificadas aquí. |

### C. Docs vivas en `docs/`

#### Más vigentes / útiles hoy
- `docs/PROJECT_SNAPSHOT_2026-05-08.md`  
  Muy útil como snapshot ejecutivo, pero no debe ser fuente única porque mezcla verificación de repo con inferencias de entorno.
- `docs/STATUS.md`  
  Útil como checklist ejecutiva, pero ya quedó fechada en abril 2026 y contiene afirmaciones que deberían reconfirmarse.
- `docs/testing-e2e-automation.md`
- `docs/testing-e2e-env-conventions.md`
- `docs/testing-e2e-route2-and-nfc.md`
- `docs/admin-profiles-validation-checklist.md`
- `docs/supabase-migrations-process.md`
- `docs/supabase-migration-inventory.md`
- `docs/secrets-rotation-checklist.md`

#### Diseño, planes o specs todavía útiles pero no “fuente de verdad”
- `docs/route2-*.md`
- `docs/nfc-c3-*.md`
- `docs/security-*.md`
- `docs/phase-*.md`
- `docs/product-inventory-expansion-plan.md`
- `docs/option3-admin-profile-history.md`
- `docs/architecture-option-c.md`
- `docs/route1-memberships-and-events-review.md`

#### SQL y utilitarios documentales dentro de `docs/`
Estos archivos son útiles como apoyo, pero hoy están dispersos y compiten con `supabase/migrations/`:
- `docs/cards-guardrails-next.sql`
- `docs/cards-hardening-assign-activate.sql`
- `docs/cards-hardening-revoke.sql`
- `docs/cards-lifecycle-rpcs.sql`
- `docs/inventory-rpc-and-sku-next-step.sql`
- `docs/order-cards-link.sql`
- `docs/reassign-card.sql`

### D. Testing / QA

| Archivo | Estado | Observación |
|---|---|---|
| `cypress/README-e2e.md` | Vigente | Describe bastante bien cómo correr la suite actual. |
| `5-entregables/04_test_cases_e2e.md` | Parcial / duplicado | Puede solaparse con Cypress docs actuales. |
| `.env.e2e.example` | Vigente | Fuente útil para setup de testing. |

### E. Entregables y anexos

| Ruta | Estado | Observación |
|---|---|---|
| `5-entregables/` | Histórica / parcial | Material de soporte y entregables previos; no debería competir con `README` ni `docs/STATUS.md`. |
| `ENCUESTA_VALIDACION.md` | Histórica | Útil como insumo de producto, no como doc técnica principal. |

---

## 2) Estado real observable del proyecto

## Stack verificable en el repo
- Frontend SPA en **React 18** con **react-scripts** (CRA), no Next.js.
- **Tailwind CSS**.
- **Zustand** para carrito.
- Router manual en `src/App.jsx`.
- **Supabase** como backend principal desde frontend (`@supabase/supabase-js`).
- **Express local** en `server/index.js` como soporte/mock/fallback de desarrollo.
- **Cypress** para E2E.
- `vercel.json` presente.
- Edge Functions Supabase presentes en `supabase/functions/`.

## Módulos visibles en código
Público/comercial:
- `/` → `ComingSoon`
- `/preview` → landing comercial
- catálogo, carrito, checkout, confirmación
- términos, privacidad, tracking, baja
- perfil público `/:slug`
- redirección review `/r/:slug`

Admin:
- dashboard
- inventory
- cards
- profiles
- orders
- CRM
- NexReview
- emails
- review cards
- products
- team
- wheel
- print test

## Verificaciones hechas
- `npm run build` compila correctamente.
- `supabase/functions/` **sí existe** en este repo.
- `README.md` anterior ya no representa el estado real.

## Incertidumbres que no conviene maquillar
- No se verificó desde este repo el estado real de despliegue en Vercel/Supabase.
- No se verificó aquí si Mercado Pago/Resend están operativos en producción.
- No se validó que toda la suite Cypress esté verde; solo que existe estructura y documentación para correrla.
- Hay documentos que afirman estado de producción; deben leerse como contexto, no como prueba definitiva.

---

## 3) Duplicidades, obsolescencia y puntos de confusión

### 3.1 README raíz estaba desalineado y fue corregido en esta revisión
El `README.md` anterior decía, en esencia, que el proyecto estaba orientado a:
- React + Tailwind + Express local
- perfil público
- editor de perfil
- inventario
- “siguiente salto” hacia Supabase

Eso ya no reflejaba el repo actual, porque hoy el código ya incluye:
- integración real con Supabase
- Edge Functions en el repo
- admin mucho más amplio
- checkout, orders, refunds, emails, CRM, team, wheel, review cards

**Conclusión:** el README anterior estaba obsoleto como documento principal; en este encargo quedó reescrito.

### 3.2 `docs/PROJECT_SNAPSHOT_2026-05-08.md` y `BITACORA_ETAPA_9.md` se pisan bastante
Ambos describen:
- estado ejecutivo
- stack actual
- riesgos
- prioridades

No son idénticos, pero sí suficientemente cercanos como para generar doble fuente.

**Recomendación:**
- dejar `PROJECT_SNAPSHOT_2026-05-08.md` como snapshot ejecutivo puntual por fecha;
- dejar `BITACORA_ETAPA_9.md` como bitácora histórica/narrativa;
- no usar ambos como “fuente principal del repo”.

### 3.3 `docs/STATUS.md` sigue siendo útil, pero quedó vieja como tablero vivo
Problemas:
- fecha de abril 2026
- mezcla hechos, pendientes y métricas que pueden cambiar fuera del repo
- varias marcas `[x]` dependen de operación externa, no solo del código visible

**Conclusión:** útil como checklist de release, pero parcial y potencialmente desactualizable rápido.

### 3.4 Arquitectura objetivo vs arquitectura real
`ARCHITECTURE.md` mezcla:
- stack recomendado
- principios
- roadmap técnico
- entorno local

El problema no es que esté mal; el problema es que puede leerse como “estado actual exacto” cuando en realidad también es documento de dirección.

**Conclusión:** mantenerlo como documento de arquitectura objetivo/referencia, no como foto operativa exacta.

### 3.5 SQL disperso fuera de migraciones
Hay SQL en varias zonas:
- raíz del repo
- `docs/*.sql`
- `supabase/*.sql`
- `supabase/migrations/*.sql`
- `supabase/migrations_backup/**`

Esto dificulta responder una pregunta básica: **¿cuál es la fuente de verdad para reconstruir base?**

**Lectura recomendada hoy:**
- fuente principal: `supabase/migrations/`
- fuente secundaria/histórica: `supabase/*.sql`, `docs/*.sql`, SQL raíz
- backups: `supabase/migrations_backup/`

### 3.6 `supabase/migrations_backup/` duplica material sensible para onboarding
Existen duplicados evidentes entre:
- `supabase/migrations/*`
- `supabase/migrations_backup/*`
- `supabase/migrations_backup/migrations/*`

No hay que borrar nada en este encargo, pero sí marcarlo como **duplicidad estructural**.

### 3.7 Artefactos y ruido de workspace
Hay elementos que no deberían confundirse con documentación ni estado del producto:
- `build/`
- `node_modules/`
- `.e2e-backend.log`
- `.e2e-frontend.log`
- `.env`, `.env.local`

No son problema por sí mismos, pero sí ensucian la lectura del repo si README/docs no guían bien.

---

## 4) Vacíos documentales relevantes

### Vacío 1 — Falta una “fuente de verdad” corta para entrar al repo
Hasta ahora faltaba un README que dijera claramente:
- qué es real hoy
- qué stack corre hoy
- qué módulos existen
- cómo levantar local
- qué depende de Supabase/env
- qué documentos consultar primero

### Vacío 2 — Falta separar “estado verificado” de “estado asumido/desplegado”
Hay docs que hablan de producción con tono concluyente, pero varias de esas afirmaciones no se pueden auditar desde el repo solo.

### Vacío 3 — Falta política visible sobre documentación viva vs histórica
Hoy conviven:
- bitácoras
- snapshots
- checklists
- planes
- specs
- SQLs de apoyo

Sin una convención clara, todo parece igual de vigente.

### Vacío 4 — Falta clarificar la jerarquía SQL/migraciones
No está suficientemente explícito qué se usa para:
- reconstruir esquema
- aplicar cambios nuevos
- consultar historial
- revisar experimentos/ideas

---

## 5) Propuesta de orden documental

## Orden recomendado de lectura
1. `README.md` → puerta de entrada operativa del repo.
2. `docs/PROJECT_SNAPSHOT_2026-05-08.md` → foto ejecutiva puntual.
3. `docs/STATUS.md` → checklist de release/operación, con advertencia de que requiere actualización periódica.
4. `cypress/README-e2e.md` + `docs/testing-e2e-*.md` → QA.
5. `supabase/migrations/README.md` + `docs/supabase-migrations-process.md` → base de datos/migraciones.
6. `ARCHITECTURE.md` → visión y decisiones de arquitectura.
7. `BITACORA_ETAPA_*.md` → historial.

## Clasificación sugerida para mantener a futuro

### Fuente primaria
- `README.md`
- `docs/STATUS.md`
- `docs/PROJECT_SNAPSHOT_YYYY-MM-DD.md`
- `cypress/README-e2e.md`
- `supabase/migrations/README.md`

### Fuente secundaria / referencia
- `ARCHITECTURE.md`
- `docs/security-*.md`
- `docs/route2-*.md`
- `docs/nfc-c3-*.md`
- `docs/*validation*`

### Histórica
- `BITACORA_ETAPA_*.md`
- `5-entregables/`
- `ENCUESTA_VALIDACION.md`

### SQL fuente de verdad
- `supabase/migrations/*.sql`

### SQL auxiliar / propuesta / legacy
- `supabase/*.sql`
- `docs/*.sql`
- SQLs en raíz
- `supabase/migrations_backup/**`

---

## 6) Reglas mínimas recomendadas para no seguir acumulando ruido

1. **Cada doc debe declarar su tipo**: `estado`, `plan`, `bitácora`, `spec`, `checklist`, `histórico`.
2. **README no debe contener wishful thinking**; solo estado real y riesgos visibles.
3. **`docs/STATUS.md` debe tener fecha de última revisión** cada vez que se toque.
4. **Las migraciones versionadas deben ser la fuente de verdad SQL**.
5. **Los SQL auxiliares deben explicar si son borrador, parche manual o referencia histórica**.
6. **No abrir un nuevo snapshot si el anterior sigue siendo el vigente sin cambios reales**.
7. **Las bitácoras no deberían reemplazar documentación operativa.**

---

## 7) Resumen ejecutivo corto

### Qué sigue vigente
- El repo ya no es un MVP con mock local solamente.
- La base actual es una SPA React conectada principalmente a Supabase, con Express local como apoyo.
- Existe un set amplio de módulos admin y flujo de checkout/operación.
- La documentación de testing y migraciones sigue siendo de lo más útil.

### Qué estaba mal o confuso
- El README raíz estaba atrasado.
- Hay demasiada superposición entre snapshot, status, bitácoras y planes.
- El material SQL está disperso y con duplicados claros.
- Varias afirmaciones operativas fuertes dependen de entorno externo no verificable solo por repo.

### Qué propongo como orden
- `README` = entrada corta y realista.
- `PROJECT_SNAPSHOT` = foto ejecutiva fechada.
- `STATUS` = checklist viva.
- `migrations/` = fuente SQL principal.
- bitácoras y entregables = histórico, no fuente primaria.
