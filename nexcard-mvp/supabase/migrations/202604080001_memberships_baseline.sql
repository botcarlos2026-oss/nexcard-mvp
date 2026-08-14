-- Baseline for public.memberships.
-- This table existed in production before formal migrations were backfilled.
-- Required so a clean `supabase start` can replay migrations past 202604090001.
--
-- Production schema captured in:
-- docs/supabase-memberships-baseline-schema-2026-08-14.md
--
-- Design notes:
-- - Idempotent/no-op on production where the table already exists.
-- - Does not seed admin rows; 202604150002_admin_memberships.sql owns that.
-- - Enables RLS, but leaves policies to 202604090001_b2_rls_profiles_orders.sql.
-- - The organization FK is guarded because historical migrations also assume
--   public.organizations already exists; the FK is added only when the table exists.

begin;

create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

create table if not exists public.memberships (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null,
  organization_id uuid not null,
  role text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint memberships_role_check check (
    role = any (array['admin'::text, 'company_owner'::text, 'company_member'::text])
  )
);

-- Keep production constraint names where possible.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'memberships_user_id_fkey'
      and conrelid = 'public.memberships'::regclass
  ) then
    alter table public.memberships
      add constraint memberships_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if to_regclass('public.organizations') is not null
     and not exists (
       select 1
       from pg_constraint
       where conname = 'memberships_organization_id_fkey'
         and conrelid = 'public.memberships'::regclass
     ) then
    alter table public.memberships
      add constraint memberships_organization_id_fkey
      foreign key (organization_id) references public.organizations(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'memberships_user_id_organization_id_key'
      and conrelid = 'public.memberships'::regclass
  ) then
    alter table public.memberships
      add constraint memberships_user_id_organization_id_key
      unique (user_id, organization_id);
  end if;
end $$;

-- Production currently has both idx_* and memberships_*_idx names because later
-- migrations added indexes after the original table already existed. Keep both
-- names idempotently to preserve production parity and satisfy later migrations.
create index if not exists idx_memberships_user_id
  on public.memberships using btree (user_id);

create index if not exists idx_memberships_org_id
  on public.memberships using btree (organization_id);

create index if not exists memberships_user_id_idx
  on public.memberships using btree (user_id);

create index if not exists memberships_role_idx
  on public.memberships using btree (role);

create index if not exists memberships_org_idx
  on public.memberships using btree (organization_id);

alter table public.memberships enable row level security;

commit;
