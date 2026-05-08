# NexCard MVP

Repo principal de NexCard al **2026-05-08**.

## Qué es hoy
NexCard ya no está solo en etapa mock/local. Este repo contiene una SPA en React con una capa operativa real sobre **Supabase**, más un **backend Express local** que sirve para desarrollo, fallback y algunos flujos E2E.

## Estado real visible en el repo
### Stack
- React 18 (`react-scripts`)
- Tailwind CSS
- Zustand
- Supabase (`@supabase/supabase-js`)
- Express local para soporte/mock
- Cypress para E2E
- Edge Functions en `supabase/functions/`

### Módulos visibles
#### Público/comercial
- `/` → Coming Soon
- `/preview` → landing comercial
- catálogo, carrito, checkout y confirmación
- perfil público por `/:slug`
- términos, privacidad, tracking, baja
- redirect de review cards `/r/:slug`

#### Admin
- dashboard
- orders
- inventory
- cards
- profiles
- CRM
- NexReview
- emails
- review cards
- products
- team
- wheel
- print test

## Estructura útil del repo
- `src/` → frontend principal
- `server/` → API Express local y mocks
- `supabase/migrations/` → migraciones SQL versionadas
- `supabase/functions/` → Edge Functions
- `cypress/` → pruebas E2E
- `docs/` → estado, planes, specs y checklists
- `5-entregables/` → material histórico / anexos

## Cómo correrlo local
```bash
npm install
npm run dev
```

### Scripts frecuentes
```bash
npm run build
npm run server
npm run test:e2e:env-check
npm run test:e2e:smoke
npm run test:e2e:local
```

## URLs locales esperadas
- Frontend: `http://localhost:3000`
- API local: `http://localhost:4000/api`
- Bridge NFC local: `http://localhost:4000/c/:token`

## Variables / dependencias importantes
Sin entorno Supabase, varias funciones admin/checkout quedan limitadas o no operan completas.

Variables relevantes visibles por código:
- `REACT_APP_SUPABASE_URL`
- `REACT_APP_SUPABASE_ANON_KEY`
- `REACT_APP_API_URL`
- `PUBLIC_APP_URL`

Para E2E, revisar además:
- `.env.e2e.example`
- `cypress/README-e2e.md`

## Estado técnico verificado en esta revisión
- `npm run build` compila OK.
- El router sigue siendo manual en `src/App.jsx`.
- La mayor parte de la lógica de negocio cliente está concentrada en `src/services/api.js`.
- El acceso admin depende de sesión Supabase + whitelist de emails en frontend.

## Riesgos / límites actuales
- `src/App.jsx` y `src/services/api.js` concentran demasiada responsabilidad.
- Hay documentación superpuesta y parte de ella estaba atrasada.
- El estado real de producción (Vercel, secrets, deploy Supabase, Mercado Pago, Resend) **no se puede confirmar solo con este repo**.
- Existen SQL y backups dispersos fuera de `supabase/migrations/`, lo que puede confundir la fuente de verdad.

## Documentos clave
- `docs/DOCUMENTACION_REPO_2026-05-08.md` → mapa documental y propuesta de orden
- `docs/PROJECT_SNAPSHOT_2026-05-08.md` → snapshot ejecutivo
- `docs/STATUS.md` → checklist de estado/pre-release
- `cypress/README-e2e.md` → ejecución de pruebas E2E
- `supabase/migrations/README.md` → criterio de migraciones
- `BITACORA_ETAPA_9.md` → bitácora más cercana al estado actual

## Qué no asumir
No conviene leer este repo como “listo para escalar sin revisión”. La base es seria, pero todavía depende de:
- hardening de acceso y RLS
- disciplina de migraciones
- validación E2E reproducible
- alineación entre frontend, SQL y Edge Functions

## Nota
Si algo choca entre documentos, prioriza en este orden:
1. código en `src/`, `server/`, `supabase/`
2. `docs/DOCUMENTACION_REPO_2026-05-08.md`
3. `docs/PROJECT_SNAPSHOT_2026-05-08.md`
4. `docs/STATUS.md`
5. bitácoras históricas
