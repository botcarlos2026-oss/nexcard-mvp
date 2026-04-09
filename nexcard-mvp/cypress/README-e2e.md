# NexCard E2E (Cypress)

## Requisitos
- Node 18+
- `npm install` (instala Cypress y @testing-library/cypress)
- Seeds ya cargados en Supabase.
- Usuario admin existente; pasa sus credenciales vía vars de entorno para evitar hardcode.
- Recomendado: copiar `.env.e2e.example` a `.env.e2e.local` para aislar credenciales/seeds E2E del `.env.local` diario.

## Flujo recomendado
1. `cp .env.e2e.example .env.e2e.local`
2. Completar credenciales reales + slugs/tokens seed
3. `npm run test:e2e:env-check`
4. Ejecutar la suite necesaria (`npm run test:e2e:smoke`, `npm run test:e2e:nfc`, etc.)

El runner local levanta frontend/backend automáticamente. Solo usa `npm run dev` manual si quieres depurar interactivamente fuera de Cypress.

## Precedencia de entorno
- `scripts/run-e2e-local.sh` intenta cargar primero `.env.e2e.local`
- si no existe, cae a `.env.local`

Esto baja el riesgo de mezclar credenciales de trabajo diario con seeds de testing.

## Config
- `cypress.config.js` usa baseUrl `http://localhost:3000`.
- Credenciales por env:
  - `CYPRESS_login_email`
  - `CYPRESS_login_password`
- Por defecto queda `admin@nexcard.cl / admin123` (solo mock local). Sobrescribe en CI/real.

## Scripts
- Abrir runner: `npm run cypress:open`
- Headless puro Cypress: `npm run test:e2e`
- Preflight env mínimo: `npm run test:e2e:env-check`
- Smoke rápido reproducible: `npm run test:e2e:smoke`
- Runner local completo: `npm run test:e2e:local`
- Solo guardrails NFC inválidos: `npm run test:e2e:nfc-invalid`
- Solo admin cards: `npm run test:e2e:admin-cards`
- Alias explícito guardrails admin/cards: `npm run test:e2e:admin-cards-guardrails`
- Pack mínimo lifecycle cards: `npm run test:e2e:cards-lifecycle`
- Solo admin profiles: `npm run test:e2e:admin-profiles`
- Alias explícito guardrails admin/profiles: `npm run test:e2e:admin-profiles-guardrails`
- Coherencia punta a punta public/admin para profiles: `npm run test:e2e:profiles-e2e`
- Pack recomendado para cerrar profiles: `npm run test:e2e:profiles-full`

## Suites incluidas
- `auth.cy.js` → login y registro (registro puede requerir confirmar email en Supabase).
- `smoke.cy.js` → login, perfil público, admin dashboard.
- `profile-edit.cy.js` → edición básica y toggle bancario.
- `wizard.cy.js` → flujo de setup.
- `admin.cy.js` → dashboard + inventario (el test de ítems está **skip** hasta que la UI muestre inventario seed de forma consistente).
- `admin-cards.cy.js` → visibilidad mínima del lifecycle en `/admin/cards`, guardrails de acciones revoke/archive y correlación con el bloqueo del bridge público.
- `admin-profiles.cy.js` → guardrails reproducibles en `/admin/profiles` para dataset visible de lifecycle/history, búsqueda y filtro `archived`.
- `admin-profiles-e2e.cy.js` → coherencia mínima punta a punta entre resolución pública por `/:slug` y trazabilidad admin en `/admin/profiles`.
- `nfc-invalid-card-states.cy.js` → bridge HTTP para tarjetas `revoked` y `archived`.
- `logout.cy.js` → cierre de sesión.

## Variables de entorno para lifecycle cards
Estas suites quedan reproducibles si apuntas a dos tarjetas seed/controladas: una `revoked` y una `archived`.

### Requeridas
- `CYPRESS_revoked_nfc_token`
- `CYPRESS_archived_nfc_token`
- `CYPRESS_revoked_expected_status`
- `CYPRESS_archived_expected_status`

### Opcionales
- `CYPRESS_revoked_card_code`
- `CYPRESS_archived_card_code`
- `CYPRESS_revoked_expected_deleted` (default: `No`)
- `CYPRESS_archived_expected_deleted` (default: `Sí`)
- `CYPRESS_revoked_http_status` (default: `410`)
- `CYPRESS_archived_http_status` (default: `410`)

### Ejemplo
```bash
CYPRESS_login_email="admin@nexcard.cl" \
CYPRESS_login_password="admin123" \
CYPRESS_revoked_nfc_token="nxc-revoked-token" \
CYPRESS_revoked_expected_status="revoked" \
CYPRESS_revoked_card_code="NXC-REV-001" \
CYPRESS_archived_nfc_token="nxc-archived-token" \
CYPRESS_archived_expected_status="archived" \
CYPRESS_archived_card_code="NXC-ARC-001" \
npm run test:e2e:cards-lifecycle
```

## Variables de entorno para admin profiles
Estas suites quedan reproducibles si apuntas a dos perfiles seed/controlados: uno `active` y otro `archived`, ambos con historial visible.

### Requeridas
- `CYPRESS_active_profile_slug`
- `CYPRESS_active_profile_status`
- `CYPRESS_active_profile_versions`
- `CYPRESS_active_profile_last_event`
- `CYPRESS_archived_profile_slug`
- `CYPRESS_archived_profile_status`
- `CYPRESS_archived_profile_versions`
- `CYPRESS_archived_profile_last_event`

### Opcionales
- `CYPRESS_active_profile_full_name`
- `CYPRESS_archived_profile_full_name`
- `CYPRESS_active_profile_deleted` (default: `No`)
- `CYPRESS_archived_profile_deleted` (default: `Sí`)

### Ejemplo
```bash
CYPRESS_login_email="admin@nexcard.cl" \
CYPRESS_login_password="admin123" \
CYPRESS_active_profile_slug="carlos-alvarez" \
CYPRESS_active_profile_status="active" \
CYPRESS_active_profile_versions="2" \
CYPRESS_active_profile_last_event="snapshot" \
CYPRESS_archived_profile_slug="bot-carlos" \
CYPRESS_archived_profile_status="archived" \
CYPRESS_archived_profile_versions="3" \
CYPRESS_archived_profile_last_event="soft_delete" \
npm run test:e2e:admin-profiles-guardrails
```

## Notas
- La suite de profiles no intenta restaurar ni mutar perfiles desde UI. Su foco es validar los guardrails más caros de romper: visibilidad admin coherente del lifecycle/history, coherencia public/admin y filtros mínimos reproducibles.
- Checklist operativo y criterio de salida recomendados para `/admin/profiles`: `docs/admin-profiles-validation-checklist.md`
- La suite de lifecycle cards no intenta ejecutar acciones de revoke/archive desde UI. Su foco es validar los guardrails más caros de romper: visibilidad admin coherente + bloqueo del bridge público.
- Si cambian los seeds, actualiza las variables de entorno en vez de reescribir los tests.
- El runner ahora imprime el tail de `.e2e-frontend.log` y `.e2e-backend.log` cuando falla antes/durante Cypress. Revisa eso primero antes de asumir bug de UI.
- Artefactos volátiles (`.e2e-*.log`, `cypress/screenshots/`, `cypress/videos/`) quedaron ignorados para no ensuciar commits.
- Selectores: donde existen `data-cy`, se priorizan para estabilidad.
