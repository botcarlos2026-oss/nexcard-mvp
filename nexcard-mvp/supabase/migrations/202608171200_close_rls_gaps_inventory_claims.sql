-- NexCard — Close 2 RLS gaps found during Gate G security review (2026-08-17).
--
-- 1) product_inventory_requirements had RLS disabled entirely, while the anon
-- role already held GRANT ALL at the table-privilege level — any visitor
-- with just the public anon key could read/insert/update/delete rows via
-- the REST API directly, corrupting the inventory deduction mapping used by
-- reserve_inventory_for_order().
--
-- 2) profile_claims had RLS enabled with zero policies, which silently
-- blocked src/services/api/orders.js#getOrders() (used only by admin
-- dashboards) from ever seeing claim data for any order — admins have been
-- blind to claim/activation status on every order in the UI.

begin;

alter table public.product_inventory_requirements enable row level security;

create policy "product_inventory_requirements_admin_all"
  on public.product_inventory_requirements
  to authenticated
  using (public.has_role('admin'::text))
  with check (public.has_role('admin'::text));

create policy "profile_claims_admin_all"
  on public.profile_claims
  to authenticated
  using (public.has_role('admin'::text))
  with check (public.has_role('admin'::text));

commit;
