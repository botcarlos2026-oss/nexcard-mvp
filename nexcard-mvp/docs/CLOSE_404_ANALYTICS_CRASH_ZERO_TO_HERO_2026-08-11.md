# NexCard — cierre 404 real, analytics/crash y Zero-to-Hero

Fecha: 2026-08-11
Branch limpio: `release/close-404-analytics-crash-20260811`
Worktree limpio: `/tmp/nexcard-close-404-analytics-crash-20260811/nexcard-mvp`
Base: `origin/main` (`3dca6cd` al crear worktree)

## Veredicto ejecutivo

| Punto | Estado | Evidencia |
|---|---|---|
| 404 real para slugs inexistentes | Implementado prod-ready; pendiente deploy para validar HTTP real en `nexcard.cl` | `middleware.js`, lookup Supabase activo/inexistente validado, respuesta local `buildNotFoundResponse().status === 404` |
| Analytics con evento real | Cerrado | Evento `view` insertado/leído en Supabase: `175a7924-0d99-44cb-b692-9f7c3aa01e13` |
| Crash monitoring | Cerrado como monitoring propio app-owned; Sentry externo opcional sin DSN | Evento `client_crash` insertado/leído en Supabase: `bc760593-16c6-4f81-8adc-8b0b543e6a6a` |
| Zero-to-Hero físico | Bloqueo físico/operacional pendiente | Matriz iPhone/Android/NFC/QR/datos móviles documentada; Hermes no puede ejecutar hardware real |
| Bundle/code-splitting | Cerrado | `npm run build`: main chunk `104.49 kB` min / `31.01 kB` gzip; chunks `vendor-react`, `vendor-supabase` |
| npm audit | Cerrado | `npm audit --audit-level=low`: `0 vulnerabilities` |
| SEO icon/canonical | Cerrado | `index.html` contiene canonical explícito y `apple-touch-icon` |

## Cambios implementados

### 1. 404 real prod-ready

Archivo nuevo:
- `middleware.js`

Comportamiento:
- Mantiene el rewrite SPA de `vercel.json`; no se toca a ciegas.
- Solo trata como slug público rutas top-level `/:slug` que cumplen patrón seguro.
- Excluye rutas conocidas y deep links:
  - `/`, `/preview`, `/coming-soon`, `/privacidad`, `/terminos`, `/login`, `/baja`
  - `/admin/*`, `/api/*`, `/assets/*`, `/activar/*`, `/seguimiento/*`, `/confirmar/*`, `/r/*`
  - assets con extensión (`favicon`, `robots`, `sitemap`, etc.)
- Consulta Supabase REST `profiles` con anon key y filtro:
  - `slug = candidato`
  - `status = active`
  - `deleted_at is null`
  - `limit 1`
- Si Supabase confirma cero filas, responde HTTP 404 con HTML seguro y `noindex`.
- Si falta env o Supabase falla, hace fail-open para no romper perfiles reales.

Validación ejecutada:
- `unknownSlugExists: false` para `slug-inexistente-qa-404`
- `qaSmokeProfileExists: true` para `qa-smoke-profile`
- mock middleware:
  - missing => `false`
  - active => `true`
  - fail-open sin env => `null`
- `node -c middleware.js`: OK

Pendiente de 100% producción:
- Push/deploy Vercel con token válido.
- Post-deploy:
  - `curl -sSIL https://www.nexcard.cl/slug-inexistente-qa-404 | tr -d '\r' | sed -n '1,20p'` debe devolver `404`.
  - `curl -sSIL https://www.nexcard.cl/preview | tr -d '\r' | sed -n '1,20p'` debe seguir `200`.
  - Validar deep links `/activar/*` y `/seguimiento/*` no se rompen.

### 2. Analytics verificable

Archivo modificado:
- `src/utils/analyticsEngine.js`

Cambios:
- `trackEvent(eventType, { profileSlug, metadata }, client)` genérico.
- `trackClick(slug, buttonType)` conserva compatibilidad y registra interacción CTA.
- Guard seguro si Supabase no está disponible.
- Retorna `{ ok, data/error/skipped }` para poder probar.

Evento real validado en Supabase:
- `runId`: `hermes-1786484919865`
- `event_type`: `view`
- `event ID`: `175a7924-0d99-44cb-b692-9f7c3aa01e13`
- Insert anon: OK
- Readback service role: OK

### 3. Crash monitoring

Archivos:
- `src/utils/analyticsEngine.js`
- `src/index.jsx`
- `supabase/migrations/202608111745_events_client_crash_type.sql`

Cambios:
- `reportCrash(error, context)` registra `event_type = client_crash` en `public.events`.
- `installCrashMonitoring()` instala listeners:
  - `window.error`
  - `window.unhandledrejection`
- Sanitiza texto sensible antes de enviar (`token`, `authorization`, `secret`, `password`, etc.).
- `src/index.jsx` instala el monitoring al arrancar.
- Migración amplía `chk_event_type_valid` para aceptar `client_crash`.

Migración aplicada:
- `supabase db push --linked --yes`: OK
- `supabase db push --linked --dry-run`: `Remote database is up to date`

Evento crash real validado:
- `runId`: `hermes-1786484919865`
- `event_type`: `client_crash`
- `event ID`: `bc760593-16c6-4f81-8adc-8b0b543e6a6a`

Nota:
- Esto cierra crash monitoring app-owned.
- Sentry/externo queda opcional y requiere DSN/proyecto real; no se inventó proveedor externo.

### 4. Bundle/code-splitting y SEO

Archivos:
- `src/components/AppRouteRenderer.jsx`
- `vite.config.js`
- `index.html`
- `public/apple-touch-icon.png`

Cambios:
- Lazy loading de rutas públicas/perfil/legal vía `React.lazy` + `withSuspense`.
- `manualChunks` para `vendor-react`, `vendor-supabase`, `vendor-icons`.
- Canonical explícito `https://nexcard.cl/`.
- `apple-touch-icon` 180x180.

Build validado:
- `npm run build`: OK
- Main chunk: `104.49 kB` min / `31.01 kB` gzip
- `vendor-react`: OK
- `vendor-supabase`: OK

## Validaciones ejecutadas

En worktree limpio:
- `npm run test:unit`: 22 files / 93 tests passed
- `npm run lint`: OK
- `npx eslint src/index.jsx src/utils/analyticsEngine.js src/utils/analyticsEngine.test.js --ext js,jsx`: OK
- `node -c middleware.js`: OK
- `npm audit --audit-level=low`: 0 vulnerabilities
- `npm run build`: OK
- `npm run test:e2e:env-check`: OK
- `npm run test:e2e:smoke`: 7 passing / 0 failing
- `supabase db push --linked --dry-run`: remote up to date

Ad-hoc verifier:
- Script temporal creado y eliminado correctamente:
  - `/private/var/folders/f9/wvghkwfn7vn7d17rtb1nygj40000gp/T/hermes-verify-t8icaeqz.sh`
- Resultado: `verifier_exit_code=0`
- Validó rutas, middleware, analytics/crash, build artifact y cleanup.

Intento bloqueado:
- `npx vercel build --yes` no pudo ejecutarse por token inválido:
  - `Error: The token provided via VERCEL_TOKEN environment variable is not valid.`
- No se imprimieron secretos.

## Zero-to-Hero físico

Hermes puede validar preflight, rutas, build, smoke, backend, Supabase y artefactos. No puede ejecutar cámara/NFC/datos móviles reales sin hardware.

Matriz mínima para cierre físico:

| Fase | Dispositivo/red | Qué validar | Pass | Evidencia |
|---|---|---|---|---|
| QR iPhone | iPhone + Wi‑Fi/datos móviles | Cámara abre QR y aterriza al destino correcto | URL final correcta, sin loops/interstitials | Video/foto, URL final, timestamp, modelo/OS |
| QR Android | Android + Wi‑Fi/datos móviles | Cámara abre QR y aterriza al destino correcto | URL final correcta | Video/foto, URL final, timestamp, modelo/OS |
| NFC iPhone | iPhone + datos móviles | Tap de tarjeta NFC real | Abre perfil/landing correcto, sin error de lectura | Video del tap, slug/card ID, modelo/OS |
| NFC Android | Android + datos móviles | Tap de tarjeta NFC real | Abre perfil/landing correcto | Video del tap, slug/card ID, modelo/OS |
| Compra/retorno | iPhone + Android | Checkout/retorno Mercado Pago | Estado visible correcto, sin doble submit | payment_id/order_id, screenshot/video |
| Webhook/ledger | Backend/Hermes | Reconciliación orden/pago | IDs coherentes, sin duplicados | logs/query IDs |
| Claim/activación | Móvil real | Claim con email comprador | Ownership correcto, perfil activo | email de prueba, profile slug, capturas |

Veredicto comercial/operacional:
- Técnicamente OK con bloqueo comercial/operacional pendiente para la parte física.
- Gate G/real payment no se ejecutó porque requiere autorización explícita.

## Archivos principales del alcance limpio

- `middleware.js`
- `src/utils/analyticsEngine.js`
- `src/utils/analyticsEngine.test.js`
- `src/index.jsx`
- `supabase/migrations/202608111745_events_client_crash_type.sql`
- `src/components/AppRouteRenderer.jsx`
- `vite.config.js`
- `index.html`
- `public/apple-touch-icon.png`
- `package.json`
- `package-lock.json`
- `.hermes/plans/2026-08-11_1741-cierre-total-404-analytics-crash-zero-to-hero.md`

## Próximos pasos para 100% producción

1. Commit + push branch limpia.
2. Crear PR.
3. Corregir `VERCEL_TOKEN` o usar deploy automático de GitHub/Vercel.
4. Post-deploy, validar HTTP real en `nexcard.cl`.
5. Ejecutar Zero-to-Hero físico con iPhone + Android + datos móviles + tarjeta NFC/QR real y guardar evidencia.
