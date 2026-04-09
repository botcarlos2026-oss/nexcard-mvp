# NexCard — E2E tests for NFC and Route 2 guardrails

## Added Cypress coverage

### `cypress/e2e/nfc-bridge.cy.js`
Validates that a configured NFC token returns a redirect to the expected slug.

Required env vars:
- `CYPRESS_nfc_token`
- `CYPRESS_nfc_expected_slug`

### `cypress/e2e/profile-soft-delete-guard.cy.js`
Validates that a soft-deleted profile slug no longer resolves as a live active public profile.

Required env var:
- `CYPRESS_deleted_profile_slug`

---

## Suggested usage

```bash
cd nexcard-mvp
CYPRESS_nfc_token="your-public-token" \
CYPRESS_nfc_expected_slug="carlos-alvarez" \
CYPRESS_deleted_profile_slug="bot-carlos" \
npx cypress run --spec "cypress/e2e/nfc-bridge.cy.js,cypress/e2e/profile-soft-delete-guard.cy.js"
```

---

## Notes
These tests are intentionally lightweight.
They validate critical guardrails without trying to own the full Supabase lifecycle from Cypress.
