# Testing E2E — Route 2 y NFC guardrails

## Added Cypress coverage
The project now has reproducible Cypress coverage for the minimum cards lifecycle guardrails without depending on app-side lifecycle mutations.

### Covered now
- `/admin/cards` renders the lifecycle visibility dataset.
- A seeded `revoked` card is visible in admin with its expected lifecycle state.
- A seeded `archived` card is visible in admin with its expected lifecycle state.
- Admin action buttons remain aligned with lifecycle guardrails (`revoked` cannot be re-revoked, `archived` stays fully non-actionable).
- Both seeded tokens stay blocked by the public NFC bridge (`/c/:publicToken`).

This keeps the suite focused on the regression surface that matters most right now:
- no revoked card should resolve as active
- no archived card should resolve as active
- admin/cards must expose enough state to detect lifecycle drift

## Specs involved
- `cypress/e2e/admin-cards.cy.js`
- `cypress/e2e/nfc-invalid-card-states.cy.js`

## Recommended runner
```bash
npm run test:e2e:cards-lifecycle
```

If you only want the admin-side lifecycle assertions (table + action guardrails), run:
```bash
npm run test:e2e:admin-cards-guardrails
```

## Required env for reproducibility
```bash
CYPRESS_login_email
CYPRESS_login_password
CYPRESS_revoked_nfc_token
CYPRESS_revoked_expected_status
CYPRESS_archived_nfc_token
CYPRESS_archived_expected_status
```

## Optional env
```bash
CYPRESS_revoked_card_code
CYPRESS_archived_card_code
CYPRESS_revoked_expected_deleted
CYPRESS_archived_expected_deleted
CYPRESS_revoked_http_status
CYPRESS_archived_http_status
```

## Example
```bash
CYPRESS_login_email="admin@nexcard.cl" \
CYPRESS_login_password="admin123" \
CYPRESS_revoked_nfc_token="nxc-revoked-token" \
CYPRESS_revoked_expected_status="revoked" \
CYPRESS_archived_nfc_token="nxc-archived-token" \
CYPRESS_archived_expected_status="archived" \
npm run test:e2e:cards-lifecycle
```

## Why this shape
Trying to own the full revoke/archive mutation lifecycle from Cypress would couple the suite to unstable UI work and seeded action flows.

This coverage instead validates the two business-critical outcomes:
1. lifecycle state is visible to admin
2. public resolution stays blocked for invalid cards

That gives lower maintenance cost and higher regression signal.
