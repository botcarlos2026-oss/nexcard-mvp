# NexCard — Security Phase B.2

## Objective
Move authorization to Supabase as the single source of truth using:
- authenticated sessions only
- role table (`memberships`)
- row-level security (RLS)
- public/admin/owner separation by policy, not by frontend assumptions

## What this phase covers
1. `memberships` table with roles:
   - `admin`
   - `company_owner`
   - `member`
2. `has_role()` helper function
3. RLS baseline for:
   - `profiles`
   - `inventory_items`
   - `orders`
   - `content_blocks`
   - `events`

SQL file:
- `supabase/rls_phase_b2.sql`

## Important constraints
This repository does **not** contain the real Supabase schema/migrations, so the SQL is a baseline and must be reviewed against the actual table definitions before applying.

Expected assumptions:
- `profiles.id = auth.users.id`
- `orders.user_id` exists
- `content_blocks.is_published` exists
- `inventory_items`, `events` tables exist

If your real schema differs, adapt column names before execution.

## Recommended application order
1. Back up the database
2. Review schema compatibility table by table
3. Run the SQL in Supabase SQL editor on staging
4. Validate these scenarios:
   - anonymous can view public profile only
   - authenticated user can read/update own profile only
   - non-admin cannot access inventory/orders/admin CMS
   - admin can access dashboard data
5. Only then apply to production

## Validation checklist
### Profiles
- [ ] anon can select active public profiles
- [ ] authenticated user can select own profile
- [ ] authenticated user cannot update another profile
- [ ] admin can inspect/update profiles

### Orders
- [ ] user can read own orders only
- [ ] non-admin cannot read all orders
- [ ] admin can read all orders

### Inventory
- [ ] only admin can read/write inventory

### Content
- [ ] public can read only published content
- [ ] only admin can edit content blocks

### Events
- [ ] public insert works if analytics requires it
- [ ] only admin can inspect event stream

## Frontend follow-up required
The current app already blocks insecure fallback, but the next code cleanup should:
- remove temporary email whitelist for admin
- resolve admin state only from `memberships`
- handle RLS errors explicitly in UI
- remove or isolate the insecure local Express mock from production path

## Business read
This is the minimum viable authorization model for a product that manages identity-linked digital profiles. Without this layer, every growth action sits on top of reputational debt.
