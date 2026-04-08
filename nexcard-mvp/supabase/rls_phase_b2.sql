-- NexCard Phase B.2 — Roles + RLS baseline
-- Apply in Supabase SQL editor only after review.
-- Objective: make Supabase the single source of truth for authz.

begin;

create extension if not exists pgcrypto;

-- 1) Roles / memberships ----------------------------------------------------
create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'company_owner', 'member')),
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create index if not exists memberships_user_id_idx on public.memberships(user_id);
create index if not exists memberships_role_idx on public.memberships(role);

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

revoke all on function public.has_role(text) from public;
grant execute on function public.has_role(text) to anon, authenticated;

-- 2) Profiles ---------------------------------------------------------------
-- Assumes a public.profiles table keyed by auth user id.
alter table if exists public.profiles enable row level security;

-- Public read: only active/public-safe profiles via slug.
drop policy if exists "profiles_public_read" on public.profiles;
create policy "profiles_public_read"
on public.profiles
for select
to anon, authenticated
using (
  coalesce(status, 'active') = 'active'
);

-- Owner can read own private profile row.
drop policy if exists "profiles_owner_read" on public.profiles;
create policy "profiles_owner_read"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
);

-- Owner can update only own row.
drop policy if exists "profiles_owner_update" on public.profiles;
create policy "profiles_owner_update"
on public.profiles
for update
to authenticated
using (
  id = auth.uid()
)
with check (
  id = auth.uid()
);

-- Owner can insert own row.
drop policy if exists "profiles_owner_insert" on public.profiles;
create policy "profiles_owner_insert"
on public.profiles
for insert
to authenticated
with check (
  id = auth.uid()
);

-- Admin can read/update all profiles.
drop policy if exists "profiles_admin_read" on public.profiles;
create policy "profiles_admin_read"
on public.profiles
for select
to authenticated
using (
  public.has_role('admin')
);

drop policy if exists "profiles_admin_update" on public.profiles;
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

-- 3) Inventory --------------------------------------------------------------
alter table if exists public.inventory_items enable row level security;

drop policy if exists "inventory_admin_only" on public.inventory_items;
create policy "inventory_admin_only"
on public.inventory_items
for all
to authenticated
using (
  public.has_role('admin')
)
with check (
  public.has_role('admin')
);

-- 4) Orders ----------------------------------------------------------------
alter table if exists public.orders enable row level security;

-- Admin full access.
drop policy if exists "orders_admin_all" on public.orders;
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

-- Company owner/member can read their own orders if table has user_id.
drop policy if exists "orders_owner_read" on public.orders;
create policy "orders_owner_read"
on public.orders
for select
to authenticated
using (
  user_id = auth.uid()
);

-- Optional self-insert for checkout flows.
drop policy if exists "orders_owner_insert" on public.orders;
create policy "orders_owner_insert"
on public.orders
for insert
to authenticated
with check (
  user_id = auth.uid()
);

-- 5) Landing / CMS ----------------------------------------------------------
alter table if exists public.content_blocks enable row level security;

-- Public read only published content.
drop policy if exists "content_public_read" on public.content_blocks;
create policy "content_public_read"
on public.content_blocks
for select
to anon, authenticated
using (
  coalesce(is_published, true) = true
);

-- Admin controls CMS.
drop policy if exists "content_admin_all" on public.content_blocks;
create policy "content_admin_all"
on public.content_blocks
for all
to authenticated
using (
  public.has_role('admin')
)
with check (
  public.has_role('admin')
);

-- 6) Events / analytics -----------------------------------------------------
alter table if exists public.events enable row level security;

-- Insert allowed from public traffic if needed.
drop policy if exists "events_public_insert" on public.events;
create policy "events_public_insert"
on public.events
for insert
to anon, authenticated
with check (true);

-- Admin read only.
drop policy if exists "events_admin_read" on public.events;
create policy "events_admin_read"
on public.events
for select
to authenticated
using (
  public.has_role('admin')
);

commit;
