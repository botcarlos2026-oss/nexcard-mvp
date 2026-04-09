-- NexCard Phase B.2 — Roles + RLS hardening for real schema
-- Reviewed against current public schema shared from Supabase.
-- DO NOT run blindly in production; apply first in staging / controlled window.

begin;

create extension if not exists pgcrypto;

-- 1) Role helpers -----------------------------------------------------------
-- memberships already exists in the real schema.
create index if not exists memberships_user_id_idx on public.memberships(user_id);
create index if not exists memberships_role_idx on public.memberships(role);
create index if not exists memberships_org_idx on public.memberships(organization_id);

create or replace function public.has_role(required_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    where m.user_id = auth.uid()
      and m.role = required_role
  );
$$;

create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    where m.user_id = auth.uid()
      and m.organization_id = target_org
  );
$$;

revoke all on function public.has_role(text) from public;
revoke all on function public.is_org_member(uuid) from public;
grant execute on function public.has_role(text) to anon, authenticated;
grant execute on function public.is_org_member(uuid) to anon, authenticated;

-- 2) Profiles ---------------------------------------------------------------
alter table if exists public.profiles enable row level security;

-- Remove broad legacy policies before replacing them.
drop policy if exists "profiles_owner_manage" on public.profiles;
drop policy if exists "profiles_public_read" on public.profiles;
drop policy if exists "profiles_owner_read" on public.profiles;
drop policy if exists "profiles_owner_update" on public.profiles;
drop policy if exists "profiles_owner_insert" on public.profiles;
drop policy if exists "profiles_admin_read" on public.profiles;
drop policy if exists "profiles_admin_update" on public.profiles;

-- Public can read only active profiles.
create policy "profiles_public_read"
on public.profiles
for select
to anon, authenticated
using (
  coalesce(status, 'active') = 'active'
);

-- Owners can read their own profile row.
create policy "profiles_owner_read"
on public.profiles
for select
to authenticated
using (
  user_id = auth.uid()
);

-- Owners can update only their own profile row.
create policy "profiles_owner_update"
on public.profiles
for update
to authenticated
using (
  user_id = auth.uid()
)
with check (
  user_id = auth.uid()
);

-- Owners can insert only for themselves.
create policy "profiles_owner_insert"
on public.profiles
for insert
to authenticated
with check (
  user_id = auth.uid()
);

-- Admin can inspect/update all profiles.
create policy "profiles_admin_read"
on public.profiles
for select
to authenticated
using (
  public.has_role('admin')
);

create policy "profiles_admin_update"
on public.profiles
for update
to authenticated
using (
  public.has_role('admin')
)
with check (
  public.has_role('admin')
);

-- 3) Memberships ------------------------------------------------------------
alter table if exists public.memberships enable row level security;

drop policy if exists "mem_admin_manage" on public.memberships;
drop policy if exists "mem_select_self" on public.memberships;

-- Users can inspect only their own memberships.
create policy "mem_select_self"
on public.memberships
for select
to authenticated
using (
  user_id = auth.uid()
);

-- Only admin can manage memberships.
create policy "mem_admin_manage"
on public.memberships
for all
to authenticated
using (
  public.has_role('admin')
)
with check (
  public.has_role('admin')
);

-- 4) Inventory --------------------------------------------------------------
alter table if exists public.inventory_items enable row level security;
drop policy if exists "inv_admin_manage" on public.inventory_items;
drop policy if exists "inv_read_public" on public.inventory_items;

-- Inventory should not be public.
create policy "inv_admin_manage"
on public.inventory_items
for all
to authenticated
using (
  public.has_role('admin')
)
with check (
  public.has_role('admin')
);

alter table if exists public.inventory_movements enable row level security;
drop policy if exists "inv_movements_manage" on public.inventory_movements;
create policy "inv_movements_manage"
on public.inventory_movements
for all
to authenticated
using (
  public.has_role('admin')
)
with check (
  public.has_role('admin')
);

-- 5) Orders ----------------------------------------------------------------
alter table if exists public.orders enable row level security;
drop policy if exists "orders_modify_owner" on public.orders;
drop policy if exists "orders_select_owner" on public.orders;
drop policy if exists "orders_admin_all" on public.orders;
drop policy if exists "orders_owner_read" on public.orders;
drop policy if exists "orders_owner_insert" on public.orders;
drop policy if exists "orders_owner_update" on public.orders;

-- Admin full access.
create policy "orders_admin_all"
on public.orders
for all
to authenticated
using (
  public.has_role('admin')
)
with check (
  public.has_role('admin')
);

-- Owner can read own orders.
create policy "orders_owner_read"
on public.orders
for select
to authenticated
using (
  user_id = auth.uid()
);

-- Owner can create own orders.
create policy "orders_owner_insert"
on public.orders
for insert
to authenticated
with check (
  user_id = auth.uid()
);

-- Owner can update only own orders.
create policy "orders_owner_update"
on public.orders
for update
to authenticated
using (
  user_id = auth.uid()
)
with check (
  user_id = auth.uid()
);

-- 6) Content / CMS ----------------------------------------------------------
alter table if exists public.content_blocks enable row level security;
drop policy if exists "cb_admin_write" on public.content_blocks;
drop policy if exists "cb_public_read" on public.content_blocks;
drop policy if exists "content_public_read" on public.content_blocks;
drop policy if exists "content_admin_all" on public.content_blocks;

-- Content blocks have no published flag in current schema.
-- Public read is allowed for all blocks; admin only can write.
create policy "cb_public_read"
on public.content_blocks
for select
to anon, authenticated
using (true);

create policy "cb_admin_write"
on public.content_blocks
for all
to authenticated
using (
  public.has_role('admin')
)
with check (
  public.has_role('admin')
);

-- 7) Events -----------------------------------------------------------------
alter table if exists public.events enable row level security;
drop policy if exists "events_public_insert" on public.events;
drop policy if exists "events_public_read" on public.events;
drop policy if exists "events_admin_read" on public.events;

-- Public insert is acceptable for anonymous tap/view tracking.
create policy "events_public_insert"
on public.events
for insert
to anon, authenticated
with check (true);

-- Event stream must not be public. Admin only.
create policy "events_admin_read"
on public.events
for select
to authenticated
using (
  public.has_role('admin')
);

-- 8) Optional next targets not yet hardened here -----------------------------
-- cards, payments, order_items, organizations, products still have policies
-- that should be reviewed in Phase B.3 before production.

commit;
