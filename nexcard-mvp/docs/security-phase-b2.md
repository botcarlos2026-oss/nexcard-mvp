# NexCard — Security Phase B.2

## Objective
Move authorization to Supabase as the single source of truth using:
- authenticated sessions only
- roles from `memberships`
- row-level security (RLS)
- public/admin/owner separation enforced by database policy

## Real schema reviewed
The SQL was adjusted against the current public schema shared from Supabase.

Relevant tables confirmed:
- `profiles`
- `memberships`
- `orders`
- `inventory_items`
- `inventory_movements`
- `content_blocks`
- `events`
- plus additional tables for later hardening: `cards`, `organizations`, `payments`, `products`, `order_items`

Important schema facts:
- `profiles` uses `user_id` (not `id`) to associate auth user
- `orders` uses `user_id` and `organization_id`
- `memberships` already exists and includes `user_id`, `organization_id`, `role`
- `content_blocks` does **not** have `is_published`
- current policies include several `{public}` ALL grants that are too permissive for production

SQL file:
- `supabase/rls_phase_b2.sql`

## What the current B.2 script does
1. Adds helper functions:
   - `has_role(role)`
   - `is_org_member(organization_id)`
2. Replaces legacy broad policies on:
   - `profiles`
   - `memberships`
   - `inventory_items`
   - `inventory_movements`
   - `orders`
   - `content_blocks`
   - `events`
3. Removes public read from:
   - `inventory_items`
   - `events`
4. Keeps public read only where it makes product sense:
   - active public profiles
   - content blocks
5. Keeps public insert for events to preserve anonymous analytics/tap tracking

## Main risk found in current policies
Based on the policy list you shared, the biggest red flags are:
- `inventory_items` currently has public read
- `events` currently has public read
- several tables expose `ALL` policies to `{public}` and need a second pass

That means data visibility is likely broader than intended today.

## Recommended application order
1. Back up database / confirm rollback path
2. Apply `supabase/rls_phase_b2.sql` in staging or a controlled maintenance window
3. Validate:
   - anonymous can view active profiles
   - authenticated owner can edit only own profile
   - non-admin cannot read inventory
   - non-admin cannot inspect events
   - admin can read dashboard-related datasets
4. Only after validation, promote to production

## Validation checklist
### Profiles
- [ ] anon can select active public profiles
- [ ] authenticated user can select own profile via `user_id = auth.uid()`
- [ ] authenticated user cannot update another profile
- [ ] admin can inspect/update profiles

### Memberships
- [ ] user can read own memberships only
- [ ] non-admin cannot grant roles
- [ ] admin can manage memberships

### Orders
- [ ] user can read own orders only
- [ ] user can create own order only
- [ ] user cannot read all orders
- [ ] admin can read/update all orders

### Inventory
- [ ] only admin can read/write inventory items
- [ ] only admin can read/write inventory movements

### Content
- [ ] public can read content blocks
- [ ] only admin can edit content blocks

### Events
- [ ] public insert works for analytics
- [ ] public cannot read event stream
- [ ] admin can inspect events

## What remains for Phase B.3
Still pending hardening/review:
- `cards`
- `payments`
- `order_items`
- `organizations`
- `products`
- `v_current_memberships`

Those tables should be reviewed before production launch because their current policy names suggest some may still be too broad.

## Frontend follow-up required
The app already blocks insecure fallback, but next cleanup should:
- remove temporary admin email whitelist
- resolve admin state only from `memberships`
- handle RLS/permission errors explicitly in UI
- remove or isolate insecure local Express mock from production path

## Business read
This phase is not glamour work, but it is margin protection. In a digital identity product, weak authorization becomes reputational debt faster than feature debt.
