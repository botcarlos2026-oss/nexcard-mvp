# NexCard — Security Phase B.3

## Objective
Harden the remaining high-risk tables that still exposed `{public}` policies:
- `cards`
- `order_items`
- `organizations`
- `payments`
- `products`

SQL file:
- `supabase/rls_phase_b3.sql`

## Schema facts used
### cards
- `organization_id`
- `profile_id`
- `order_id`
- `card_code`
- `activation_status`

### order_items
- linked by `order_id`
- no direct `user_id`

### organizations
- only `id`, `name`, `slug`, timestamps
- no explicit owner column
- org membership must be derived from `memberships.organization_id`

### payments
- linked by `order_id`
- contains provider/external/payment payload data
- should never be public

### products
- public catalog can be readable
- `active` flag exists and should gate public visibility

## Policy model
### organizations
- read: organization members + admin
- write: admin only

### products
- read: public only when `active = true`
- write: admin only

### order_items
- read: owner of parent order + admin
- write: admin only

### payments
- read: owner of parent order + admin
- write: admin only

### cards
- read: owner of linked profile, or org members, or admin
- write: admin only

## Business rationale
### payments
This is the most sensitive remaining block. Public `ALL` on payments is unacceptable in production.

### cards
Cards are the bridge between physical NFC issuance and identity. Overexposing card metadata increases cloning, abuse and operational risk.

### organizations
If org rows are too open, tenancy separation weakens.

### order_items
They may look operational, but they reveal order composition and pricing structure.

### products
Public read is fine for catalog visibility. Public write is not.

## Caveats
- This B.3 script assumes `public.has_role()` and `public.is_org_member()` already exist from B.2.
- It intentionally leaves writes admin-only for `payments`, `order_items`, and `cards` until a dedicated backend/service-role flow is defined.
- If checkout currently inserts directly into `order_items` or `payments` from client-side code, that flow may need backend mediation after this change.

## Validation checklist
### cards
- [ ] non-authenticated users cannot read cards
- [ ] card owner can read linked cards
- [ ] org member can read org cards if intended
- [ ] only admin can modify cards

### payments
- [ ] no public access
- [ ] user can read payments only for own orders
- [ ] only admin can modify payments

### order_items
- [ ] user can read only items for own orders
- [ ] only admin can modify order items

### organizations
- [ ] non-members cannot read organization rows
- [ ] members can read own org
- [ ] only admin can modify orgs

### products
- [ ] public can read only active products
- [ ] inactive products are hidden publicly
- [ ] only admin can modify products
