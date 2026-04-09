# NexCard — Route 1 review: `card_events` and `v_current_memberships`

## 1. `card_events`

### Current finding
- `rowsecurity = false`
- no policies
- broad grants for `anon` and `authenticated`

### Risk
`card_events` is not harmless telemetry.
It can contain lifecycle and operational traces such as:
- issuance
- activation
- revoke
- replacement
- anomaly markers

Leaving this open would expose internal operations and weaken asset governance.

### Recommendation
- enable RLS
- make read admin-only
- make write/manage admin-only
- later, if backend/service-role flows write here, they can continue outside client exposure

---

## 2. `v_current_memberships`

### Current definition
The view exposes:
- membership identifiers
- user_id
- organization_id
- role
- created_at
- email

And filters by:
- `m.user_id = auth.uid()`

### Initial reading
This does **not** look like an immediate cross-tenant leak because it is scoped to the current authenticated user.

### Why it still deserves review
- it exposes `auth.users.email`
- it depends on the correctness of auth scoping
- view grants should be checked later to ensure only intended roles can use it

### Recommendation
Short term:
- leave as is if current product uses it safely

Medium term:
- verify grants on the view
- decide whether `email` is truly needed in that view
- if not needed, remove it from the view definition to reduce exposure surface

---

## 3. Recommended Route 1 order from here
1. close `card_events`
2. review grants on `v_current_memberships`
3. review secrets rotation / env hygiene

This preserves momentum while closing the most obvious remaining operational exposure.
