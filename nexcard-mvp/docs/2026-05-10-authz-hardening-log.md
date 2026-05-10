# Authz Hardening Log — 2026-05-10

## Objetivo
Aplicar quick wins de estabilización y seguridad sin tocar Mercado Pago productivo.

## Cambios locales realizados
- `package.json`
  - scripts nuevos: `test`, `lint`, `check:fast`, `check:smoke`, `check`
- `.eslintrc.json`
  - lint base con `react-app` + `react-app/jest`
- `src/services/api.test.js`
  - test unitario mínimo para `getErrorMessage()`
- `src/config/admin.js`
  - centralización de `ADMIN_EMAILS`, `ADMIN_ROUTES`, `isAdminEmail()`
- `src/App.jsx`
  - elimina duplicación de rutas/admin whitelist
- `src/components/NexCardProfile.jsx`
  - corrige hooks condicionales que rompían build
- `docs/admin-access-runbook.md`
  - runbook operativo de accesos admin
- `CLAUDE.md`
  - actualizado con quality gates, acceso admin centralizado y migración de hardening
- `supabase/migrations/202605100001_authz_hardening_admin_surface.sql`
  - hardening de helpers y policies amplias

## Verificación local
- `npm test` ✅
- `npm run lint` ✅ (sin errores; warnings remanentes del proyecto)
- `npm run build` ✅

## Migración SQL preparada
Archivo:
- `supabase/migrations/202605100001_authz_hardening_admin_surface.sql`

### Qué hace
1. `has_role()` e `is_org_member()` ignoran memberships con `deleted_at`.
2. Reemplaza policies abiertas `authenticated all` por policies admin-only en:
   - `refunds`
   - `crm_contacts`
   - `crm_deals`
   - `crm_activities`
   - `team_members`
   - `review_cards`

## Estado de aplicación remota
- Repositorio Supabase está linkeado a `ghiremuuyprohdqfrxsy`.
- Se detectó desalineación entre migraciones locales y el historial remoto.
- Por seguridad, **no se usó `supabase db push` global** para evitar arrastrar migraciones antiguas no registradas.
- Se intentó aplicar la migración puntual vía CLI remota.
- Resultado actual: **bloqueado por autenticación temporal/circuit breaker del pooler**.

## Implicancia
- El hardening está **listo en código/documentación**.
- La aplicación remota de la migración queda pendiente hasta restablecer acceso DB remoto estable.

## Siguiente paso recomendado
1. Reintentar `supabase db query --linked -f supabase/migrations/202605100001_authz_hardening_admin_surface.sql`
2. Validar policies con consulta a `pg_policies`
3. Registrar la ejecución definitiva en este mismo documento
