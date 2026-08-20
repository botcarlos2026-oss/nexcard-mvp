-- NexCard — Close 6 more RLS gaps found during Cyber Neo security audit (2026-08-19).
--
-- cards, dispatch_config, order_status_history, inventory_items, inventory_movements,
-- and waitlist each had a leftover `TO authenticated USING (true)` policy (some also
-- `WITH CHECK (true)` for write access) sitting alongside newer, correctly-scoped
-- policies (has_role('admin') or ownership checks). Postgres RLS combines permissive
-- policies with OR, so the blanket-open policy silently defeated the properly-scoped
-- one on every one of these tables — any Supabase-authenticated principal (any customer
-- who has claimed a card) could read cross-tenant card codes/tokens, modify live
-- inventory stock, edit dispatch/courier config, and forge order status history events
-- for orders that are not theirs.
--
-- Verified against current app code: every caller of these tables (OrdersDashboard,
-- InventoryDashboard, EmailDashboard, dispatchOrder/admin_dispatch_order flow) is
-- already gated behind the admin UI shell — no legitimate non-admin flow depends on
-- direct table access here. Public-facing flows use security-definer RPCs instead
-- (e.g. reserve_inventory_for_order, admin_dispatch_order) which are unaffected by
-- this change. `cards_owner_read`/`cards_org_member_read` and `inv_admin_manage`/
-- `inv_movements_manage` already exist and take over once the open policy is dropped;
-- `dispatch_config`, `order_status_history`, and `waitlist` get a new has_role('admin')
-- policy since no scoped alternative existed for them yet. The anon-facing
-- `waitlist_insert_anon` policy is left untouched.

begin;

-- cards: cards_admin_manage / cards_org_member_read / cards_owner_read already cover
-- legitimate access; just remove the blanket-open read policy.
drop policy if exists "cards_authenticated_read" on public.cards;

-- dispatch_config: no scoped alternative existed — replace with admin-only.
drop policy if exists "dispatch_config_authenticated_all" on public.dispatch_config;
create policy "dispatch_config_admin_all"
  on public.dispatch_config for all
  to authenticated
  using (public.has_role('admin'))
  with check (public.has_role('admin'));

-- order_status_history: no scoped alternative existed — replace with admin-only.
drop policy if exists "history_authenticated_read" on public.order_status_history;
create policy "history_admin_read"
  on public.order_status_history for select
  to authenticated
  using (public.has_role('admin'));

drop policy if exists "history_authenticated_insert" on public.order_status_history;
create policy "history_admin_insert"
  on public.order_status_history for insert
  to authenticated
  with check (public.has_role('admin'));

-- inventory_items: inv_admin_manage already covers admin CRUD; just remove the open ones.
drop policy if exists "inventory_items_authenticated_read" on public.inventory_items;
drop policy if exists "inventory_items_authenticated_update" on public.inventory_items;

-- inventory_movements: inv_movements_manage already covers admin CRUD; just remove the open ones.
drop policy if exists "inventory_movements_authenticated_read" on public.inventory_movements;
drop policy if exists "inventory_movements_authenticated_insert" on public.inventory_movements;

-- waitlist: keep public anon insert intact; restrict read to admins.
drop policy if exists "waitlist_read_authenticated" on public.waitlist;
create policy "waitlist_admin_read"
  on public.waitlist for select
  to authenticated
  using (public.has_role('admin'));

commit;
