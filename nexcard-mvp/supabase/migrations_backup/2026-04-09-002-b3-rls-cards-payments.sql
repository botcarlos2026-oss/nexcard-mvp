-- Formal Supabase migration for NexCard
-- Source: supabase/rls_phase_b3.sql
-- Validation: validated manually before promotion; run in staging before prod.

-- NexCard Phase B.3 — Hardening for cards, order_items, organizations, payments, products
-- Reviewed against current public schema shared from Supabase.
-- Apply only after review. Recommended after B.2 validation.

begin;

-- 1) Organizations ----------------------------------------------------------
alter table if exists public.organizations enable row level security;

drop policy if exists "org_modify_owned" on public.organizations;
drop policy if exists "org_select_public" on public.organizations;
drop policy if exists "org_member_read" on public.organizations;
drop policy if exists "org_admin_manage" on public.organizations;

-- Organization visibility should not be globally public unless explicitly needed.
-- Members of the organization can read it; admin can manage all.
create policy "org_member_read"
on public.organizations
for select
to authenticated
using (
  public.is_org_member(id) or public.has_role('admin')
);

create policy "org_admin_manage"
on public.organizations
for all
to authenticated
using (
  public.has_role('admin')
)
with check (
  public.has_role('admin')
);

-- 2) Products ---------------------------------------------------------------
alter table if exists public.products enable row level security;

drop policy if exists "products_admin_write" on public.products;
drop policy if exists "products_public_read" on public.products;
drop policy if exists "products_admin_manage" on public.products;

-- Public can read only active products.
create policy "products_public_read"
on public.products
for select
to anon, authenticated
using (
  coalesce(active, false) = true
);

-- Only admin can create/update/delete catalog entries.
create policy "products_admin_manage"
on public.products
for all
to authenticated
using (
  public.has_role('admin')
)
with check (
  public.has_role('admin')
);

-- 3) Order items ------------------------------------------------------------
alter table if exists public.order_items enable row level security;

drop policy if exists "order_items_access" on public.order_items;
drop policy if exists "order_items_owner_read" on public.order_items;
drop policy if exists "order_items_admin_manage" on public.order_items;

-- Owners can read items only for orders they own.
create policy "order_items_owner_read"
on public.order_items
for select
to authenticated
using (
  exists (
    select 1
    from public.orders o
    where o.id = order_items.order_id
      and o.user_id = auth.uid()
  )
);

-- Admin can manage all order items.
create policy "order_items_admin_manage"
on public.order_items
for all
to authenticated
using (
  public.has_role('admin')
)
with check (
  public.has_role('admin')
);

-- 4) Payments ---------------------------------------------------------------
alter table if exists public.payments enable row level security;

drop policy if exists "payments_access" on public.payments;
drop policy if exists "payments_owner_read" on public.payments;
drop policy if exists "payments_admin_manage" on public.payments;

-- Owners can read payments only for orders they own.
create policy "payments_owner_read"
on public.payments
for select
to authenticated
using (
  exists (
    select 1
    from public.orders o
    where o.id = payments.order_id
      and o.user_id = auth.uid()
  )
);

-- Admin can manage all payments.
create policy "payments_admin_manage"
on public.payments
for all
to authenticated
using (
  public.has_role('admin')
)
with check (
  public.has_role('admin')
);

-- 5) Cards ------------------------------------------------------------------
alter table if exists public.cards enable row level security;

drop policy if exists "cards_access" on public.cards;
drop policy if exists "cards_owner_read" on public.cards;
drop policy if exists "cards_org_member_read" on public.cards;
drop policy if exists "cards_admin_manage" on public.cards;

-- A user can read cards linked to their own profile.
create policy "cards_owner_read"
on public.cards
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = cards.profile_id
      and p.user_id = auth.uid()
  )
);

-- Organization members can read cards from their org.
create policy "cards_org_member_read"
on public.cards
for select
to authenticated
using (
  public.is_org_member(organization_id)
);

-- Admin can manage all cards.
create policy "cards_admin_manage"
on public.cards
for all
to authenticated
using (
  public.has_role('admin')
)
with check (
  public.has_role('admin')
);

commit;
