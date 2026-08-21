# NexCard MVP

Repo principal de NexCard. Última revisión de esta puerta de entrada: **2026-08-21**.

## Qué es hoy

NexCard vende tarjetas físicas NFC vinculadas a un perfil digital editable (`/:slug`). Es una SPA React + Vite con Supabase como backend productivo real (Auth, Postgres, RLS, Edge Functions), Mercado Pago como único proveedor de pago activo, y capas de admin/CRM/inventario/KPIs bastante más desarrolladas que un MVP simple.

## Mapa de documentación

Este repo tiene mucha documentación acumulada. Si es tu primera vez acá, **no leas todo** — empieza por esto:

1. **`docs/INDEX.md`** → mapa completo de qué documento existe, para qué sirve y si sigue vigente. Empieza aquí si buscas algo específico.
2. **`ARCHITECTURE.md`** → stack real, split entre Supabase Edge Functions / Vercel Functions (`api/`) / Express local (`server/`), módulos del sistema.
3. **`SCHEMA.md`** → mapa de las ~29 tablas por dominio (no el DDL exacto — eso vive en `supabase/migrations/`).
4. **`PRODUCT.md`** → segmentos, propuesta de valor, principios de producto.
5. **`DESIGN.md`** → sistema de diseño (paleta, tipografía, componentes).
6. **`CLAUDE.md`** → guía extensa (78KB) para agentes/Claude Code trabajando en este repo — el doc más detallado que existe.

Si algo choca entre documentos: **código > CLAUDE.md > los 5 docs de arriba > `docs/INDEX.md` > todo lo demás**.

## Stack

- React 18 + **Vite** (no CRA/react-scripts — ya migrado)
- Tailwind CSS, Zustand (carrito)
- Supabase (`@supabase/supabase-js`) — backend productivo
- Vercel Functions (`api/`) — health check, proxy de waitlist, 2 cron jobs
- Express local (`server/`) — solo dev/mocks/E2E, bloqueado para producción
- Cypress para E2E
- Sentry para error tracking
- Mercado Pago (único proveedor de pago activo; Webpay está deshabilitado en UI)

## Estructura del repo

- `src/` → frontend principal (`components/`, `services/api/`, `store/`, `hooks/`, `config/`, `utils/`)
- `server/` → Express local, solo para dev/soporte/mocks
- `api/` → funciones Vercel (health, waitlist proxy, crons)
- `supabase/migrations/` → migraciones SQL versionadas (95 al 2026-08-21, fuente de verdad del schema)
- `supabase/functions/` → Edge Functions (pagos, webhooks, emails, KPIs, reconciliación)
- `cypress/` → pruebas E2E
- `docs/` → estado, planes, specs y checklists — ver `docs/INDEX.md` antes de perderte ahí
- `5-entregables/` → material histórico / anexos
- `scripts/` → tooling operativo (reconciliación de pagos, evaluador de KPIs, auditoría pre-lanzamiento)

## Cómo correrlo local

```bash
npm install
npm run dev
```

### Scripts frecuentes

```bash
npm run build
npm run server
npm run check              # build + env-check + smoke E2E
npm run test:e2e:smoke
npm run kpi:evaluate        # evaluador de alertas ejecutivas KPI
npm run ops:reconcile-orders:dry
npm run ops:prelaunch-audit
```

Ver `package.json` para la lista completa — hay bastante tooling operativo (`kpi:*`, `ops:*`, `test:e2e:admin-*`) que no cabe acá.

## URLs locales esperadas

- Frontend: `http://localhost:3000`
- API local: `http://localhost:4000/api`
- Bridge NFC local: `http://localhost:4000/c/:token`

## Variables de entorno

Prefijo `REACT_APP_*` por convención histórica (el build corre en Vite, que whitelistea y reinyecta esas variables vía `define` en `vite.config.js` — no renombrar a `VITE_*` sin actualizar esa whitelist).

Variables relevantes visibles por código:
- `REACT_APP_SUPABASE_URL`
- `REACT_APP_SUPABASE_ANON_KEY`
- `REACT_APP_API_URL`
- `PUBLIC_APP_URL`

Para E2E, revisar `.env.e2e.example` y `cypress/README-e2e.md`.

## Seguridad y acceso admin

Admin se autoriza server-side vía RPC `has_role('admin')` contra un modelo real de `memberships`/roles en Postgres (`src/utils/adminAccess.js`) — **no** una whitelist de emails en frontend (ese modelo fue removido explícitamente; `src/config/admin.js` prohíbe reintroducirlo).

RLS está activo en todas las tablas de negocio y se sigue endureciendo activamente — las migraciones más recientes (`20260819xx`, `20260820xx`) cierran brechas encontradas en auditorías. Antes de asumir que algo está protegido, revisar si tiene una migración de cierre posterior a su creación.

## Qué no asumir

- Este repo tiene documentación histórica abundante y parte de ella describe estados ya superados (ver `docs/INDEX.md` para saber cuál es cuál).
- El estado real de producción (Vercel, secrets, deploy Supabase, Mercado Pago, Resend) no se puede confirmar solo leyendo el repo.
- Hay SQL y backups dispersos fuera de `supabase/migrations/` (en `docs/`) que no deben tratarse como fuente de schema.
