# Testing E2E — Route 2 y NFC guardrails

## Added Cypress coverage
The project now has reproducible Cypress coverage for the minimum cards lifecycle guardrails without depending on app-side lifecycle mutations.

### Covered now
- `/admin/cards` renders the lifecycle visibility dataset.
- A seeded `revoked` card is visible in admin with its expected lifecycle state.
- A seeded `archived` card is visible in admin with its expected lifecycle state.
- Admin action buttons remain aligned with lifecycle guardrails (`revoked` cannot be re-revoked, `archived` stays fully non-actionable).
- Both seeded tokens stay blocked by the public NFC bridge (`/c/:publicToken`).
- `/admin/profiles` renders the minimum Route 2 visibility dataset for lifecycle/history.
- A seeded `active` profile is visible with expected status, version count and last event.
- A seeded `archived` profile is visible with expected deleted flag, version count and last event.
- Search and `archived` filtering keep the profile lifecycle/history rows reproducible and visible.
- History/archive icons remain visible after filter changes, so the admin screen still exposes the right guardrails.

This keeps the suite focused on the regression surface that matters most right now:
- no revoked card should resolve as active
- no archived card should resolve as active
- admin/cards must expose enough state to detect lifecycle drift
- admin/profiles must expose enough Route 2 state to detect lifecycle/history drift

## Specs involved
- `cypress/e2e/admin-cards.cy.js`
- `cypress/e2e/admin-profiles.cy.js`
- `cypress/e2e/nfc-invalid-card-states.cy.js`

## Recommended runners
```bash
npm run test:e2e:cards-lifecycle
npm run test:e2e:admin-profiles-guardrails
```

If you only want the admin-side cards lifecycle assertions (table + action guardrails), run:
```bash
npm run test:e2e:admin-cards-guardrails
```

## Required env for reproducibility
### Cards
```bash
CYPRESS_login_email
CYPRESS_login_password
CYPRESS_revoked_nfc_token
CYPRESS_revoked_expected_status
CYPRESS_archived_nfc_token
CYPRESS_archived_expected_status
```

### Profiles
```bash
CYPRESS_active_profile_slug
CYPRESS_active_profile_status
CYPRESS_active_profile_versions
CYPRESS_active_profile_last_event
CYPRESS_archived_profile_slug
CYPRESS_archived_profile_status
CYPRESS_archived_profile_versions
CYPRESS_archived_profile_last_event
```

## Optional env
### Cards
```bash
CYPRESS_revoked_card_code
CYPRESS_archived_card_code
CYPRESS_revoked_expected_deleted
CYPRESS_archived_expected_deleted
CYPRESS_revoked_http_status
CYPRESS_archived_http_status
```

### Profiles
```bash
CYPRESS_active_profile_full_name
CYPRESS_archived_profile_full_name
CYPRESS_active_profile_deleted
CYPRESS_archived_profile_deleted
```

## Example
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

## Why this shape
Trying to own the full revoke/archive or restore lifecycle from Cypress would couple the suite to unstable UI work and seeded mutation flows.

This coverage instead validates the business-critical outcomes with lower maintenance cost:
1. lifecycle state is visible to admin
2. public resolution stays blocked for invalid cards
3. Route 2 profile history/archive state stays visible to admin
4. admin filters do not hide or distort the minimum lifecycle/history signal
