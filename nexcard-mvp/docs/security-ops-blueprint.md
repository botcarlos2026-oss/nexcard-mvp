# NexCard — Security & Operations Blueprint

## Purpose
Turn the target architecture into an implementation-oriented operational plan.

---

# 1. Security posture target

## Minimum acceptable production posture
- Supabase Auth as single auth source
- RLS on all critical tables
- no public `ALL` policies on sensitive tables
- admin derived from memberships, never frontend hardcode
- service-role keys only in backend/ops contexts
- public traffic limited to explicit public resources

## Sensitive asset classes
### Class A — identity & money
- profiles
- cards
- orders
- payments
- memberships

### Class B — operations
- inventory_items
- inventory_movements
- organizations
- order_items

### Class C — public product layer
- content_blocks
- products
- public profile routes

---

# 2. Write paths that should become privileged backend flows

## Immediate candidates
### payments
- provider webhooks
- payment reconciliation
- status updates

### cards
- issuance
- assignment
- activation
- revocation
- replacement

### inventory
- stock movements
- adjustments
- purchase intake
- issuance consumption

### organizations / memberships
- invitations
- role changes
- revocations

These should not remain direct client writes in a mature production model.

---

# 3. Migration blueprint

## Step 1 — Stabilize current secured baseline
Status:
- B.1 completed
- B.2 completed
- B.3 completed

## Step 2 — Introduce structural fields
Recommended additions:
- `deleted_at`
- `status`
- `version`
- `updated_by`
- `public_token` on `cards`

## Step 3 — Introduce history tables
- `audit_log`
- `profile_versions`
- later: `card_lifecycle_events`

## Step 4 — Introduce backend privileged flows
- payment webhook handler
- card issue/assign/revoke service
- inventory movement service

## Step 5 — Introduce restore / rollback discipline
- regular backup verification
- migration rollback notes
- staging dress rehearsal before prod migrations

---

# 4. Backup strategy

## 4.1 Policy
Follow 3-2-1:
- database snapshot / logical dump
- secondary copy in another storage system
- offsite copy

## 4.2 Cadence
- daily logical backup
- point-in-time recovery if available
- monthly restore drill

## 4.3 Restore drills
Validate:
- restore full DB
- restore specific critical table
- recover one profile from snapshot/version history
- verify RLS/policies survive restore/migration path

---

# 5. Migration discipline

## Rules
- no manual schema drift without migration record
- one logical change per migration
- include forward and rollback notes
- production migration only after staging validation

## Recommended migration categories
- `authz_*`
- `profiles_*`
- `cards_*`
- `payments_*`
- `ops_*`

Example:
- `2026_04_08_authz_hardening_b2.sql`
- `2026_04_08_authz_hardening_b3.sql`
- `2026_04_15_cards_public_token.sql`

---

# 6. Audit blueprint

## What to log
### Access-sensitive actions
- role changes
- membership grants/revokes
- card assignment/revocation
- payment status changes
- inventory adjustments
- profile publish/unpublish

### Restore-sensitive actions
- deletions
- restores
- migrations
- manual admin edits

## Minimum fields
- actor
- action
- entity
- before
- after
- timestamp
- source

---

# 7. NFC operations blueprint

## Lifecycle
1. product ordered
2. card issued
3. card printed
4. card assigned to profile/user/org
5. card activated
6. scan events monitored
7. card revoked/replaced if compromised

## States
- `printed`
- `assigned`
- `active`
- `suspended`
- `revoked`
- `lost`
- `replaced`

## Security controls
- unique `public_token`
- unique `card_code`
- server-side resolution
- scan logging
- anomaly detection rules
- revocation path

---

# 8. Operational alerts recommended

## High severity
- payment webhook failure
- migration failure
- restore test failure
- card anomaly spikes
- unauthorized admin write attempts

## Medium severity
- repeated failed logins
- inventory below threshold
- unusual profile event volume

---

# 9. Immediate next implementation recommendations

## Priority 1
- create migration plan for `deleted_at` on critical tables
- design `cards.public_token`
- create backend flow map for payments and card lifecycle

## Priority 2
- add `audit_log`
- add `profile_versions`
- review `v_current_memberships`

## Priority 3
- define restore drill checklist
- define incident runbooks
- formalize staging/prod promotion process

---

# 10. Deliverables recommended after this blueprint

## Technical docs
- ERD / schema map
- permissions matrix
- migration register
- backup / restore runbook
- card lifecycle runbook

## Engineering work items
- C2: profile model normalization
- C3: NFC tokenized routing
- C4: privileged backend write flows
- C5: audit/versioning/restore discipline

---

# 11. Bottom line
NexCard now has a more secure database posture, but durable production quality depends on operational maturity:
- controlled write paths
- auditable history
- durable routing for NFC
- tested backups
- disciplined migrations

Security without operations is fragile.
Operations without architecture is expensive.
This blueprint is the bridge between both.
