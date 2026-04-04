# NexCard E2E (Cypress)

## Requisitos
- Node 18+
- `npm install` (instala Cypress y @testing-library/cypress)
- Servidores corriendo: `npm run dev` (frontend 3000 + mock API 4000) o apuntar `baseUrl` a deployment.
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

## Suites incluidas
- `auth.cy.js` → login y registro (registro puede requerir confirmar email en Supabase).
- `smoke.cy.js` → login, perfil público, admin dashboard.
- `profile-edit.cy.js` → edición básica y toggle bancario.
- `wizard.cy.js` → flujo de setup.
- `admin.cy.js` → dashboard + inventario.
- `logout.cy.js` → cierre de sesión.

## Notas
- Selectores: se usan textos y placeholders; agrega `data-cy` en componentes clave para más estabilidad.
- Si Supabase exige confirmación de correo, el test de registro puede quedar en rojo; ajusta a mock local o desactiva temporalmente.
