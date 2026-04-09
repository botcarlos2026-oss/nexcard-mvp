-- Formal Supabase migration for NexCard
-- Source: supabase/route2_foundation.sql
-- Validation: validated manually before promotion; run in staging before prod.

-- NexCard Route 2 — Foundation for audit log, profile versioning and soft delete
-- Draft. Review before execution.

begin;

create extension if not exists pgcrypto;

-- 1) audit_log --------------------------------------------------------------
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid null references auth.users(id) on delete set null,
  actor_role text null,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  before jsonb null,
  after jsonb null,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_entity_idx on public.audit_log(entity_type, entity_id);
create index if not exists audit_log_actor_idx on public.audit_log(actor_user_id);
create index if not exists audit_log_created_at_idx on public.audit_log(created_at desc);

-- 2) profile_versions -------------------------------------------------------
create table if not exists public.profile_versions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  version integer not null,
  snapshot jsonb not null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (profile_id, version)
);

create index if not exists profile_versions_profile_id_idx on public.profile_versions(profile_id);
create index if not exists profile_versions_created_at_idx on public.profile_versions(created_at desc);

-- 3) soft delete fields -----------------------------------------------------
alter table public.profiles add column if not exists deleted_at timestamptz;
alter table public.memberships add column if not exists deleted_at timestamptz;
alter table public.orders add column if not exists deleted_at timestamptz;
alter table public.order_items add column if not exists deleted_at timestamptz;
alter table public.payments add column if not exists deleted_at timestamptz;
alter table public.products add column if not exists deleted_at timestamptz;
alter table public.organizations add column if not exists deleted_at timestamptz;
alter table public.content_blocks add column if not exists deleted_at timestamptz;

-- cards already has deleted_at from C3; this keeps Route 2 consistent.

commit;
