# NexCard E2E (Cypress)

## Requisitos
- Node 18+
- `npm install` (instala Cypress y @testing-library/cypress)
- Servidores corriendo: `npm run dev` (frontend 3000 + mock API 4000) o usar los runners locales incluidos.
- Seeds ya cargados en Supabase.
- Usuario admin existente; pasa sus credenciales vía vars de entorno para evitar hardcode.

## Config
- `cypress.config.js` usa baseUrl `http://localhost:3000`.
- Credenciales por env:
  - `CYPRESS_login_email`
  - `CYPRESS_login_password`
- Por defecto queda `admin@nexcard.cl / admin123` (solo mock local). Sobrescribe en CI/real.

## Scripts
- Abrir runner: `npm run cypress:open`
- Headless: `npm run test:e2e`
- Runner local completo: `npm run test:e2e:local`
- Solo guardrails NFC inválidos: `npm run test:e2e:nfc-invalid`
- Solo admin cards: `npm run test:e2e:admin-cards`
- Pack mínimo lifecycle cards: `npm run test:e2e:cards-lifecycle`

## Suites incluidas
- `auth.cy.js` → login y registro (registro puede requerir confirmar email en Supabase).
- `smoke.cy.js` → login, perfil público, admin dashboard.
- `profile-edit.cy.js` → edición básica y toggle bancario.
- `wizard.cy.js` → flujo de setup.
- `admin.cy.js` → dashboard + inventario (el test de ítems está **skip** hasta que la UI muestre inventario seed de forma consistente).
- `admin-cards.cy.js` → visibilidad mínima del lifecycle en `/admin/cards` y correlación con guardrails revoke/archive.
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

## Notas
- La suite de lifecycle no intenta ejecutar acciones de revoke/archive desde UI. Su foco es validar los guardrails más caros de romper: visibilidad admin coherente + bloqueo del bridge público.
- Si cambian los seeds, actualiza las variables de entorno en vez de reescribir los tests.
- Selectores: donde existen `data-cy`, se priorizan para estabilidad.
