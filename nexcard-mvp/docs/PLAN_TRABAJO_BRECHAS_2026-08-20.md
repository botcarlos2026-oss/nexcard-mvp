# Plan de trabajo — brechas post-auditoría NexCard (2026-08-20)

**Para quien ejecute este documento:** no asumas que tenés el contexto de la conversación donde se generó esto. Lo que sigue es autocontenido, pero **leé primero, en este orden, antes de tocar nada:**

1. `docs/AUDITORIA_PRELANZAMIENTO_2026-08-20.md` — auditoría exhaustiva del proyecto, con hallazgos AP-01 a AP-31, la mayoría ya aplicados y en producción (ver su sección "Estado de ejecución").
2. `~/Desktop/cyber-neo-report-nexcard-mvp-2026-08-19.md` — audit de seguridad previo (28 hallazgos, todos remediados salvo rotación de credenciales pendiente).
3. Este documento — cubre específicamente lo que **esos dos documentos NO llegaron a revisar**. No repitas lo que ya está ahí.

**Repo:** `/Users/tars/business-workspace/nexcard-mvp-github/nexcard-mvp`. Stack: React 18 + Vite, Supabase (Postgres + Auth + Edge Functions), Vercel (deploy, detrás de Cloudflare), Mercado Pago, Resend.

**Estado al momento de escribir esto:** el core transaccional (pagos, RLS, checkout, catálogo) ya fue auditado y corregido a fondo, mergeado (`main` en `b0568da`) y confirmado en producción. Este plan es la "segunda capa" — todo lo que queda fuera de código puro: configuración externa, observabilidad en vivo, calidad visual/performance, legal, y housekeeping.

---

## Leyenda de cada tarea

- 🤖 **Ejecutable de punta a punta por el agente** — investigar y, si aplica, corregir código. Trabajar en una rama nueva (`fix/<tema>-<fecha>`, nunca directo sobre `main`), abrir PR al terminar, no mergear.
- 🔍 **Solo investigar y reportar** — no requiere ni justifica cambios de código por sí solo; el valor es el diagnóstico. Si el diagnóstico revela un bug de código real, tratarlo como un hallazgo nuevo (documentarlo con el mismo rigor que la auditoría original: evidencia exacta, archivo:línea) en vez de arreglarlo sobre la marcha sin avisar.
- 🙋 **Requiere decisión o acción humana** — el agente NO debe intentar ejecutar esto ni decidir por su cuenta. El trabajo del agente acá es dejar la decisión planteada con claridad (opciones, trade-offs) para que la persona la tome.

**Regla general:** ante la duda de si algo es reversible o afecta producción/credenciales reales, tratarlo como 🙋 y preguntar antes de actuar — mismo criterio que se usó en toda la auditoría previa.

---

## P0 — Antes de dar el lanzamiento por cerrado

### T-01 · Prueba de pago real de punta a punta 🙋
**Por qué importa:** en ningún momento de la auditoría previa se completó un pago real (con tarjeta real, no sandbox) contra Mercado Pago. Todo lo demás — creación de preferencia, webhook, idempotencia — se verificó por código y por datos históricos, nunca con una transacción nueva de punta a punta ahora mismo.
**Qué hacer:** el agente no puede ejecutar esto (necesita una tarjeta real y completar un checkout interactivo). Dejar planteado para la persona: comprar 1 unidad del producto real más barato en `nexcard.cl`, confirmar que `orders.payment_status` pasa a `paid`, que `mp_payment_id` queda persistido, que se dispara el email de confirmación y el flujo de activación/claim. Si el agente tiene forma de verificar el resultado en la base de datos después de que la persona confirme que pagó (vía `supabase db query --linked`, solo lectura), hacerlo y dejar la evidencia.

### T-02 · Confirmar sincronía de variables de entorno Vercel ↔ Supabase 🤖
**Por qué importa:** hay un gotcha ya documentado en este proyecto — `SUPABASE_SERVICE_ROLE_KEY` (y otras) viven en dos stores separados que Supabase NO sincroniza automáticamente: Vercel → Settings → Environment Variables, y Supabase → Edge Functions → Secrets. Ya causó un incidente real de horas. Nunca se comparó explícitamente el contenido de ambos stores en esta sesión, solo se leyó `.env.local`.
**Cómo hacerlo:**
- `vercel env ls` (o la skill `vercel:env`) para listar qué variables existen en Vercel y en qué entornos (production/preview/development).
- `supabase secrets list --project-ref ghiremuuyprohdqfrxsy` para listar qué secrets existen del lado de Supabase Edge Functions (los nombres, no los valores — Supabase no los expone).
- Comparar que las variables que ambos lados necesitan compartir (`SUPABASE_SERVICE_ROLE_KEY`, `MP_ACCESS_TOKEN` si aplica, etc.) existan en ambos. No se puede comparar el *valor* directamente (por diseño, ninguno de los dos CLIs lo expone), pero si falta la variable de un lado eso ya es un hallazgo.
**Criterio de éxito:** reportar qué variables existen en cada store, cuáles son compartidas conceptualmente, y si falta alguna de un lado.

### T-03 · Triage de las 7 specs E2E que quedaron fallando 🤖
**Por qué importa:** quedaron con diagnóstico pero sin fix. Correr `npm run test:e2e:local` (o `./scripts/run-e2e-local.sh`) para confirmar que siguen en el mismo estado antes de tocar nada.
**Specs y lo que ya se sabe** (ver sección "AP-03" en el documento de auditoría para el detalle completo):
- `admin-orders.cy.js` — espera columna `'Fulfillment'`, que existe en `OrdersDashboard.jsx:322` pero el componente no usa `<table>/<th>` tradicional (probablemente Kanban/tarjetas). Falta confirmar en el DOM real si ese texto se pinta en la vista por defecto.
- `admin-inventory.cy.js` — se descartó que sea fixture vacío (11 filas reales en `inventory_items`). Hipótesis: la cuenta de `CYPRESS_login_email`/`CYPRESS_login_password` (variables de entorno del harness E2E) podría no tener fila `admin` en `memberships`, y RLS estaría devolviendo 0 filas a esa sesión. Verificar con `supabase db query --linked "select * from memberships where user_id = (select id from auth.users where email = '<CYPRESS_login_email real>')"`.
- `admin-profiles.cy.js` / `admin-profiles-e2e.cy.js` — esperan filas seed `carlos-alvarez` / `qa-archived-profile` que no existen en el dataset actual. Es trabajo de seeding (crear esos perfiles reales o vía fixtures), no de código de producto. Ver `docs/testing-e2e-route2-and-nfc.md` para las variables `CYPRESS_*` que estos specs necesitan.
- `wizard.cy.js` — test obsoleto, espera texto `/uso personal/i` de antes del reposicionamiento a "Perfil Profesional"/"Perfil Negocio" (mayo 2026). Reescribir contra el copy real actual del wizard.
- `public-checkout-validation.cy.js` — el test "requires invoice fields when business invoice is enabled" espera el texto `/usuario disponible/i`, que suena a aserción de disponibilidad de slug, no de campos de factura. Investigar `cypress/e2e/public-checkout-validation.cy.js:26` contra el flujo real — probablemente una aserción mal copiada o un paso intermedio que no se está completando.
- `logout.cy.js` — el comando compartido `cy.logoutUI()` (`cypress/support/commands.js:21`) busca el botón de logout por **texto** (`/cerrar sesión|logout/i`), pero el botón real del admin shell es **solo ícono**, sin texto visible (mismo patrón que `UserEditor.jsx`). Fix recomendado: agregar `aria-label="Cerrar sesión"` al botón de logout donde sea que viva en el admin shell (no se identificó el archivo exacto en la sesión anterior — buscarlo, probablemente cerca de `AdminShell.jsx` o donde se renderiza la navegación superior admin), y actualizar `logoutUI()` para buscar por ese atributo. **Cuidado:** `logoutUI()` es un comando compartido — antes de cambiar su estrategia de selección, confirmar que no rompe otro spec que dependa de su comportamiento actual.
**Criterio de éxito:** cada spec queda o (a) arreglado y verificado en verde, o (b) con un hallazgo nuevo documentado con la misma calidad que el resto de la auditoría si resulta ser un bug de producto real, no de test.

### T-04 · Decisión Bsale (boleta/factura SII) 🙋
**Por qué importa:** `supabase/functions/emit-bsale-document/index.ts` es un NO-OP a propósito. Si el negocio va a vender con boleta electrónica desde el lanzamiento, esto bloquea. Ver sección "Bsale SII" en `CLAUDE.md` para los pasos exactos de activación si se decide que sí.
**Qué hacer:** el agente no decide esto. Solo confirmar si ya se tomó una decisión (preguntar) y, si la respuesta es "sí, activar", ejecutar los pasos ya documentados en `CLAUDE.md`.

### T-05 · Rotación de credenciales CN-002 🙋
**Por qué importa:** único hallazgo crítico de seguridad que sigue abierto del audit Cyber Neo original. Estaba explícitamente pospuesto para el viernes 2026-08-21.
**Qué hacer:** el agente no ejecuta esto (necesita logins interactivos a GitHub, Supabase, Vercel, Google Cloud Console). Si esta tarea se retoma después del viernes, preguntar primero si ya se hizo — no asumir. Lista exacta de qué rotar: GitHub PAT, Supabase PAT, service-role key, contraseña de BD, `CRON_SECRET`, token de Telegram, y el `client_secret` de Google OAuth (proyecto `nexcard-sentinel`). Recordar actualizar el service-role key en **ambos** stores (ver T-02). Al rotar, borrar también las copias de `.env.local`/`.env.secrets` que quedaron en `/private/tmp/nexcard-prelaunch-master-20260816210904/` y `/private/tmp/nexcard-cypress-16-HyqPCB/`.

---

## P1 — Observabilidad y confiabilidad operativa

### T-06 · Auditoría de configuración de Supabase Auth 🔍
**Por qué importa:** nunca se revisó — solo se auditó el uso de Auth desde el código (RLS, `has_role`), no la configuración del servicio en sí.
**Qué revisar** (dashboard de Supabase → Authentication → sección correspondiente, o vía Management API si hay token disponible):
- Templates de email (confirmación, reset de password, magic link) — ¿tienen el branding/copy correcto de NexCard, o están en default de Supabase?
- Redirect URLs permitidas — ¿incluyen `https://www.nexcard.cl` y excluyen dominios viejos/de prueba?
- Rate limits de los endpoints de auth (signup, login, reset) — ¿están en default o ajustados?
- Providers habilitados — ¿solo email/password, o hay algo más habilitado sin uso (riesgo de superficie)?
**Criterio de éxito:** reportar el estado de cada punto; si algo parece mal configurado, documentarlo como hallazgo con evidencia (screenshot o export de config), no cambiarlo sin confirmar.

### T-07 · Verificar Sentry — errores acumulados sin resolver 🔍
**Por qué importa:** Sentry se integró recientemente (`@sentry/react`, commit `9b8752c`) pero nunca se revisó el dashboard real — solo se confirmó que el código de instrumentación existe.
**Qué hacer:** entrar al dashboard de Sentry del proyecto, filtrar por "unresolved", revisar si hay errores recurrentes de producción acumulados desde que se activó. Priorizar los que tengan más ocurrencias o afecten flujos de pago/checkout.
**Criterio de éxito:** lista de issues abiertos con severidad/frecuencia, y cuáles ameritan un fix de código (tratarlos como hallazgos nuevos si es así).

### T-08 · Verificar GA4 — eventos llegando de verdad 🔍
**Por qué importa:** `src/utils/ga4.js` (o donde viva) tiene `trackPageView`/`trackEvent` en el código, pero nunca se confirmó en el dashboard real de GA4 que los eventos efectivamente llegan.
**Qué hacer:** revisar el reporte de tiempo real de GA4 mientras se navega el sitio en vivo (o revisar el volumen de eventos de los últimos días). Confirmar que al menos `page_view` y los eventos custom del funnel (landing → checkout → pago) están registrando.
**Criterio de éxito:** confirmación de que el tracking está vivo, o el hallazgo de que no lo está (y desde cuándo).

### T-09 · Verificar UptimeRobot — monitor configurado y activo 🔍
**Por qué importa:** una nota operativa anterior (`01 - Decisiones/2026-08-19 - Observabilidad backend...` en Obsidian) dejó pendiente "crear el Heartbeat monitor en UptimeRobot y setear `HEARTBEAT_URL` en Vercel" — nunca se confirmó si se hizo.
**Qué hacer:** revisar si existe el monitor en UptimeRobot, si está activo, y si `HEARTBEAT_URL` está seteada en Vercel (ver T-02 para cómo listar env vars). Si no existe, es una brecha real: sin esto, si el cron `operational-watchdog` deja de correr, nadie se entera (ver `api/cron/operational-watchdog.js` para el mecanismo de dead-man's-switch ya implementado, que depende de esta variable).
**Criterio de éxito:** confirmación de que el monitor existe y está recibiendo pings, o el hallazgo de que falta configurarlo.

### T-10 · Verificar alertas de Telegram siguen funcionando 🔍
**Por qué importa:** `api/_lib/alertTelegram.js` y `supabase/functions/_shared/alertTelegram.ts` envían alertas de error a un bot de Telegram. Nunca se confirmó en esta sesión que el bot/chat sigan activos y recibiendo mensajes.
**Qué hacer:** si hay forma de disparar una alerta de prueba sin efectos secundarios reales (revisar si `api/health.js` u otro endpoint tiene un modo de test), usarla. Si no, coordinar con la persona para provocar una alerta controlada (ej. tumbar temporalmente una variable de entorno en un entorno de preview, nunca en producción) y confirmar que llega el mensaje.
**Criterio de éxito:** confirmación de que las alertas llegan, con timestamp de la última alerta real recibida si se puede consultar el historial del chat.

### T-11 · CI: agregar lint + smoke E2E 🤖
**Por qué importa:** ya identificado como AP-08 en la auditoría, nunca aplicado. `.github/workflows/ci.yml` hoy solo corre `npm ci`, build, unit tests, `npm audit`, y un scan de secretos en `dist/` — no corre `npm run lint` ni ninguna suite Cypress.
**Cómo hacerlo:** agregar un step `npm run lint` (rápido, ~9s) y como mínimo `npm run test:e2e:smoke` al workflow. Cypress ya se confirmó que corre bien en modo headless en este tipo de entorno (Electron headless, sin configuración adicional) durante la auditoría anterior. Cuidado: correr Cypress en CI necesita el frontend y backend local levantados primero (ver cómo lo hace `scripts/run-e2e-local.sh` para replicar el mismo setup en el step de CI).
**Criterio de éxito:** PR con el workflow actualizado, y una corrida de CI real (en el propio PR) mostrando el nuevo step en verde.

### T-12 · AP-28 revisitado — normalizar CORS en 2 edge functions 🤖
**Por qué importa:** en la sesión anterior se decidió NO tocar `backfill-payment-ledger/index.ts` y `reconcile-order-payments/index.ts` (usan `{'Access-Control-Allow-Origin': 'null'}` hardcodeado en vez del helper compartido `_shared/cors.ts`) porque no había forma de probarlas en vivo. Si ahora hay más tiempo/contexto, vale la pena cerrarlo bien.
**Cómo hacerlo:** confirmar primero que ambas funciones son 100% server-to-server (gateadas por `x-ops-secret`, sin caller de navegador) — si es así, migrar al helper `getCorsHeaders(req)` de `_shared/cors.ts` es cosmético y de bajo riesgo. Probar con una invocación real (`curl` con service role / `x-ops-secret`) antes y después del cambio para confirmar que la respuesta sigue funcionando igual.
**Criterio de éxito:** ambas funciones usando el helper compartido, con evidencia de una invocación real exitosa post-cambio.

---

## P2 — Calidad, performance, legal, housekeeping

### T-13 · Auditoría de accesibilidad (a11y) independiente 🔍
**Por qué importa:** se hizo mucho trabajo de a11y recientemente (commits `fix(checkout): a11y...`, `fix(landing): ...`, etc. — ver git log del 2026-08-19) pero nadie lo auditó de forma independiente después.
**Cómo hacerlo:** correr un scanner automatizado (axe-core es el estándar — se puede integrar vía `cypress-axe` sobre las specs E2E existentes, o correr `npx @axe-core/cli <url>` directo contra las páginas públicas clave: `/`, `/preview`, catálogo, checkout, perfil público). Priorizar violaciones de nivel "critical"/"serious".
**Criterio de éxito:** reporte de violaciones por página, priorizado.

### T-14 · Performance / Core Web Vitals / Lighthouse 🔍
**Por qué importa:** nunca se corrió. El build muestra bundles individuales pero no hay señal de performance real (LCP, CLS, INP) en ningún momento de la auditoría.
**Cómo hacerlo:** correr Lighthouse (CLI `npx lighthouse <url> --view` o PageSpeed Insights API) contra `nexcard.cl`, `/preview`, y una página de perfil pública. Si está disponible en este entorno, el subagente especializado `vercel:performance-optimizer` está diseñado exactamente para este tipo de auditoría (Core Web Vitals, rendering, caching, bundle size) — considerar delegarle esta tarea completa en vez de hacerlo a mano.
**Criterio de éxito:** scores de Lighthouse por página + top 3 oportunidades de mejora si el score no es alto.

### T-15 · SEO y Open Graph dinámico 🔍
**Por qué importa:** el historial de git tiene todo un saga de commits sobre "OG middleware" (`middleware.js`, varias ramas `debug/og-*`) — se implementaron Open Graph tags dinámicas por perfil, pero nunca se confirmó en esta sesión que sigan funcionando hoy.
**Cómo hacerlo:** `curl` con un user-agent de bot (ej. `curl -A "facebookexternalhit/1.1" https://www.nexcard.cl/<slug-de-perfil-real>"`) y confirmar que el HTML devuelto trae `og:title`/`og:description`/`og:image` específicos del perfil, no genéricos. Revisar también `sitemap.xml`/`robots.txt` si existen.
**Criterio de éxito:** confirmación de que las OG tags dinámicas funcionan en producción hoy, con la evidencia del curl.

### T-16 · Responsive/mobile real 🔍
**Por qué importa:** Cypress simula viewports pero nunca se hizo una revisión visual real en un browser (ni siquiera headless con capturas) durante la auditoría — todo el juicio sobre mobile vino del código/tests, no de mirar la pantalla.
**Cómo hacerlo:** usar un browser tool (headless o real) para navegar el flujo completo (`/preview` → catálogo → checkout, y un perfil público) en viewports mobile reales (375×667 iPhone SE, 390×844 iPhone 14) y tomar capturas. Comparar contra desktop.
**Criterio de éxito:** capturas de las pantallas clave en mobile, con cualquier problema visual documentado.

### T-17 · Revisar Vercel Analytics / Speed Insights 🔍
**Por qué importa:** están habilitados en el dashboard de Vercel (visibles en el menú lateral) pero nunca se revisó su contenido en esta sesión.
**Qué hacer:** revisar si tienen datos poblados (señal de que están bien instrumentados) y si hay alguna alerta o degradación visible.
**Criterio de éxito:** confirmación de que están recolectando datos, con cualquier hallazgo relevante.

### T-18 · Revisar contenido legal (Términos, Privacidad) 🔍
**Por qué importa:** las rutas `/terms` y `/privacy` (o como se llamen — ver `src/components/TermsAndConditions.jsx` y `PrivacyPolicy.jsx`) existen y pasan sus tests E2E, pero nunca se leyó el contenido real para confirmar que es correcto/actualizado/coherente con lo que el producto realmente hace hoy.
**Qué hacer:** leer el contenido completo de ambas páginas. Confirmar que mencionan correctamente: qué datos se recolectan (incluye analytics/GA4, Sentry), Mercado Pago como procesador de pago, y el mecanismo real de baja/unsubscribe (`/baja`).
**Criterio de éxito:** confirmación de que el contenido es preciso, o lista de discrepancias.

### T-19 · Flujo de impresión física de tarjetas 🔍
**Por qué importa:** existe `PrintTestGenerator.jsx` y la tabla `fargo_calibrations` (offsets de impresión por modelo de tarjeta) — nunca se tocó ni entendió este flujo en la auditoría, y es parte del proceso operativo real de producir las tarjetas físicas que se venden.
**Qué hacer:** entender el flujo completo (¿quién lo usa, cuándo, qué produce?) y confirmar que no depende de nada que se haya roto con los cambios de esta sesión.
**Criterio de éxito:** documentación breve de cómo funciona este flujo hoy, y confirmación de que sigue operativo.

### T-20 · Tap NFC físico real 🙋
**Por qué importa:** `resolve_card_by_token` y el bridge público `/c/:publicToken` se revisaron por código (incluida su seguridad, ver CN-025 en el Cyber Neo report), pero nunca se probó con una tarjeta NFC física real tocando un teléfono real.
**Qué hacer:** el agente no puede ejecutar esto (necesita hardware físico). Dejar planteado para que la persona lo pruebe con una tarjeta real, confirmando que resuelve al perfil correcto y que tarjetas revocadas/archivadas siguen bloqueadas (esto último si tiene tests E2E que ya lo cubren — `nfc-invalid-card-states.cy.js` — pero vale la pena la confirmación física una vez).

### T-21 · Housekeeping 🤖
Varios items chicos, todos de bajo riesgo:
- Borrar `supabase/migrations_backup/` — ya confirmado en la auditoría que es un intento abandonado de otra convención de nombres, estrictamente desactualizado respecto a `migrations/` (ver AP-13b en el documento de auditoría).
- Decidir si `PRODUCT.md` (raíz del repo) debe commitearse — parece un documento real y útil, generado por la skill `impeccable`, actualmente sin trackear.
- Decidir qué hacer con `.impeccable/` (10 críticas de UX del 2026-08-19) y `5-entregables/` (incluye un bundle de evidencia de preproducción del 2026-08-16) — ¿son artefactos de herramientas que deberían estar en `.gitignore`, o vale la pena preservarlos commiteados como historial?
- Abrir y leer `5-entregables/nexcard_informe_errores.docx` — nunca se pudo leer en la sesión anterior (herramientas sin soporte de `.docx` en ese momento). Si tiene hallazgos no incorporados a la auditoría, agregarlos.
- `npm outdated` — 16 paquetes directos con versiones más nuevas disponibles (no vulnerabilidades, solo desfase — ver el reporte de Cyber Neo para la lista). Evaluar si vale la pena actualizar alguno antes del lanzamiento o dejarlo para después.

### T-22 · Backup / point-in-time recovery de la base de datos 🔍
**Por qué importa:** nunca se confirmó si el proyecto de Supabase tiene PITR habilitado ni cuál es la política de backups — importante para un sistema que ya procesa pagos reales.
**Qué hacer:** revisar en el dashboard de Supabase (Settings → Database → Backups) el plan actual y si PITR está habilitado. Confirmar que el plan de Supabase contratado lo soporta.
**Criterio de éxito:** confirmación de la política de backup actual, y si es insuficiente para un producto con pagos reales, dejarlo planteado como decisión 🙋.

### T-23 · SPF/DKIM/DMARC del dominio de envío 🔍
**Por qué importa:** los emails transaccionales (confirmación de orden, activación, etc.) van por Resend desde `hola@nexcard.cl`. Si los registros DNS de autenticación de email no están bien configurados, los emails pueden caer en spam — un problema silencioso que nadie notaría hasta que un cliente se queje de no haber recibido su confirmación.
**Cómo hacerlo:** `dig TXT nexcard.cl`, `dig TXT _dmarc.nexcard.cl`, y revisar en el dashboard de Resend si el dominio está verificado.
**Criterio de éxito:** confirmación de que SPF/DKIM/DMARC están configurados correctamente, o el hallazgo de que faltan.

### T-24 · Force-push de la historia purgada 🙋
**Por qué importa:** ya documentado extensamente en el Cyber Neo report y en la auditoría (CN-003/CN-021/AP-07) — decisión pendiente, sin tocar.
**Qué hacer:** el agente no lo ejecuta. Solo recordar que sigue pendiente si se retoma este tema.

### T-25 · Cumplimiento de protección de datos (Chile) 🔍
**Por qué importa:** NexCard recolecta datos personales (nombre, email, teléfono, y potencialmente datos bancarios en el perfil — ver columnas `bank_*` en `profiles`). Nunca se evaluó el cumplimiento con la Ley 19.628 (Chile) ni si hace falta algo adicional a la política de privacidad ya existente.
**Qué hacer:** esto probablemente necesita criterio legal, no solo técnico — el agente puede investigar y resumir qué datos sensibles se recolectan y dónde viven (para facilitarle el análisis a un abogado), pero no debe intentar determinar cumplimiento legal por su cuenta. Tratar como 🙋 en la práctica aunque la investigación inicial sea 🔍.

---

## Cómo reportar de vuelta

Para cada tarea completada, dejar evidencia concreta (no solo "hecho") — comandos corridos, output real, capturas si aplica, archivo:línea si es un hallazgo de código. Mismo estándar de rigor que `docs/AUDITORIA_PRELANZAMIENTO_2026-08-20.md`: preferir verificar antes de afirmar, distinguir claramente lo confirmado de lo hipotético.

Si se generan cambios de código, seguir el mismo flujo ya establecido en este proyecto: rama nueva por tema, commit descriptivo, PR contra `main`, sin mergear — eso lo revisa la persona (o Claude en una sesión de revisión) después.

Actualizar `docs/AUDITORIA_PRELANZAMIENTO_2026-08-20.md` y la nota de Obsidian (`Proyectos/NexCard/03 - QA y Releases/2026-08-20 - Auditoría prelanzamiento exhaustiva.md`) con lo que se vaya cerrando de este plan, seguir la misma convención de secciones "Actualización N" ya usada ahí.
