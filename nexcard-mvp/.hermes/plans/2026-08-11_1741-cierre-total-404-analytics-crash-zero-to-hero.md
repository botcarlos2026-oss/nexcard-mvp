# NexCard cierre total 404/analytics/crash/Zero-to-Hero Implementation Plan

> **For Hermes:** avanzar lo máximo sin pedir datos nuevos; usar subagentes para inspección paralela cuando ayude, pero ejecutar y verificar evidencia real en esta sesión.

**Goal:** cerrar o dejar con bloqueo físico explícito y documentado los puntos pendientes: 404 HTTP real, analytics real, crash monitoring, Zero-to-Hero físico y cierre documental/Git.

**Architecture:** Para 404 real, agregar una capa server/edge antes del rewrite SPA que consulta Supabase por slugs públicos activos y devuelve HTTP 404 solo para slugs top-level inexistentes, preservando deep links conocidos. Para analytics/crash, robustecer el engine actual de Supabase `events` con eventos de QA y crash client-side no dependientes de un DSN externo. Para Zero-to-Hero físico, crear matriz ejecutable y validar todo lo no-físico desde Hermes.

**Tech Stack:** Vite React, Vercel Routing Middleware, Supabase PostgREST/RLS, Vitest, Cypress, Lighthouse, Obsidian filesystem notes.

---

## Contexto actual verificado

- Repo: `/Users/tars/business-workspace/nexcard-mvp-github/nexcard-mvp`.
- Branch: `release/canonical-main-sync-20260810...origin/main`.
- `vercel.json` contiene rewrite SPA genérico `/(?!api/).* -> /index.html`, causante del HTTP 200 para slugs inexistentes.
- `profiles` es públicamente legible vía RLS cuando `status = 'active'`; frontend además filtra `deleted_at is null`.
- `events` permite `select` e `insert` públicos vía RLS (`events_public_read`, `events_public_insert`).
- Env local tiene Supabase URL/anon y service role presentes; no hay `SENTRY_DSN` ni `REACT_APP_SENTRY_DSN`.
- Zero-to-Hero físico requiere hardware real; Hermes solo puede validar preparación, URLs, matriz y eventos de software.

## Criterios 100%

### 1. 404 HTTP real
- Slug inexistente top-level responde HTTP 404 en la capa server/edge.
- Rutas conocidas SPA siguen respondiendo 200: `/`, `/preview`, `/coming-soon`, `/privacidad`, `/terminos`, `/login`, `/admin...`, `/activar/...`, `/seguimiento/...`, `/confirmar/...`, `/r/...`, assets.
- Slug público activo real/controlado responde 200.
- Verificación: test unit/ad-hoc de middleware + build + smoke. Producción solo será 100% después de deploy y `curl` real a `https://nexcard.cl/slug-inexistente-qa-404` = 404.

### 2. Analytics real
- `trackClick()` no revienta si Supabase no está configurado.
- Evento real controlado se inserta en `public.events` y se puede leer con ID/timestamp.
- Verificación: script ad-hoc inserta evento `qa_analytics_probe` con metadata `source=hermes` y lo lee por ID sin imprimir secretos.

### 3. Crash monitoring
- Implementar crash monitoring propio mínimo usando `public.events` para `window.error` y `unhandledrejection`.
- Debe sanitizar mensajes/stacks y no capturar PII ni tokens.
- Debe quedar no-op si Supabase no está configurado.
- Verificación: test unit/ad-hoc invoca reporter con cliente stub y confirma payload; evento real `qa_crash_probe` se inserta/lee en Supabase.
- Nota: Sentry externo queda como mejora opcional bloqueada por falta de DSN, no blocker si el app-owned crash monitoring queda verificado.

### 4. Zero-to-Hero físico
- Crear matriz física iPhone/Android/NFC/QR/datos móviles con campos de evidencia.
- Validar desde Hermes lo no-físico: URLs públicas, perfil controlado, eventos QA, documentación.
- Estado 100% físico solo puede cerrarse cuando alguien ejecute en dispositivos reales y registre evidencia. Sin dispositivos, estado correcto es “preparado al 100%; ejecución física pendiente”.

### 5. Documentación y Git
- Actualizar plan en repo, reporte en `/Users/tars/Documents/NexCard`, y nota Obsidian.
- Separar cambios de esta pasada de cambios preexistentes (`package.json`, `package-lock.json`, docs previos).
- No mezclar commits sin revisar diff; si se commitea, incluir solo archivos de alcance.

## Tareas ejecutables

### Task 1: Implementar middleware 404 real

**Files:**
- Create/modify: `middleware.js`
- Modify: `vercel.json` si el matcher/rewrite requiere ajustes mínimos.
- Test: `scripts/hermes-verify-404-middleware.mjs` temporal o test ad-hoc en `/tmp`.

**Steps:**
1. Crear helpers puros para clasificar rutas conocidas vs candidate slugs.
2. Middleware consulta Supabase REST `profiles?select=id&slug=eq.<slug>&status=eq.active&deleted_at=is.null&limit=1` con anon key.
3. Si Supabase no está configurado o falla, fail-open a SPA para no romper producción.
4. Si slug inexistente, devolver `404 text/html` con mensaje seguro.
5. Validar rutas conocidas y slug inexistente con Request/Response local.

### Task 2: Robustecer analytics y crash monitoring

**Files:**
- Modify: `src/utils/analyticsEngine.js`
- Modify: `src/index.jsx` o `src/App.jsx` para instalar listeners una sola vez.
- Create: `src/utils/analyticsEngine.test.js`

**Steps:**
1. Exportar `trackEvent(eventType, payload)` genérico con Supabase opcional.
2. Mantener `trackClick(slug, buttonType)` compatible.
3. Agregar `reportCrash(error, context)` con sanitización.
4. Agregar `installCrashMonitoring()` con guard idempotente para `error` y `unhandledrejection`.
5. Crear tests unitarios con cliente stub.
6. Insertar/leer eventos reales QA en Supabase local usando env ignorada.

### Task 3: Validaciones canónicas y ad-hoc

**Commands:**
- `npm run test:unit`
- `npm run lint`
- `npm run build`
- `npm audit --audit-level=low`
- `npm run test:e2e:env-check`
- `npm run test:e2e:smoke`
- Ad-hoc temp verifier para middleware + Supabase event probes.

### Task 4: Documentar estado 100% / bloqueos físicos

**Files:**
- Update: `/Users/tars/Documents/NexCard/PLAN_CIERRE_TOTAL_404_ANALYTICS_CRASH_ZERO_TO_HERO_2026-08-11.md`
- Update/Create: `/Users/tars/Documents/Obsidian Vault/Proyectos/NexCard/05 - QA/2026-08-11 - Cierre Total 404 Analytics Crash Zero-to-Hero.md`
- Update: este plan si cambia el estado.

### Task 5: Cierre Git

**Steps:**
1. `git status --short` y `git diff --stat`.
2. Listar archivos propios vs preexistentes.
3. Si se commitea, usar commit atómico con solo alcance autorizado.
4. No tocar/mezclar `package.json`, `package-lock.json`, docs previos sin revisar.

## Riesgos

- Middleware de Vercel puede tener diferencias entre `vercel dev` y producción; por eso fail-open ante falta/error Supabase y se valida con test de función pura.
- 404 real en producción no se puede declarar cerrado hasta deploy y curl real post-deploy.
- Crash monitoring externo tipo Sentry requiere DSN; sin DSN se cierra con monitoring propio en `events`, y Sentry queda como mejora opcional.
- Zero-to-Hero físico requiere dispositivos reales; Hermes no puede falsificar esa evidencia.
