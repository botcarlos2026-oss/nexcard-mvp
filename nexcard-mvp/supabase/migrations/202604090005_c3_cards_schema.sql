-- Formal Supabase migration for NexCard
-- Source: supabase/c3_cards_schema.sql
-- Validation: validated manually before promotion; run in staging before prod.

-- NexCard C3 — Cards durable schema foundation
-- Draft migration design. Review before execution.

begin;

create extension if not exists pgcrypto;

-- 1) Extend cards -----------------------------------------------------------
alter table public.cards
  add column if not exists public_token text,
  add column if not exists status text,
  add column if not exists issued_at timestamptz,
  add column if not exists assigned_at timestamptz,
  add column if not exists activated_at timestamptz,
  add column if not exists revoked_at timestamptz,
  add column if not exists replaced_by_card_id uuid,
  add column if not exists replacement_reason text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists deleted_at timestamptz;

-- Backfill lifecycle basics from current real data.
-- Current observed activation_status values:
--   activated -> active
--   assigned -> assigned
--   unassigned -> printed
-- Future-compatible fallback kept for revoked/lost.
update public.cards
set status = case
  when activation_status in ('revoked', 'lost') then activation_status
  when activation_status = 'activated' then 'active'
  when activation_status = 'assigned' then 'assigned'
  when activation_status in ('unassigned', 'pending') then 'printed'
  else coalesce(status, 'printed')
end
where status is null;

update public.cards
set issued_at = coalesce(issued_at, created_at)
where issued_at is null;

update public.cards
set assigned_at = coalesce(assigned_at, created_at)
where assigned_at is null and profile_id is not null;

update public.cards
set activated_at = coalesce(activated_at, updated_at, created_at)
where activated_at is null and status = 'active';

-- Generate durable public tokens for existing rows.
update public.cards
set public_token = replace(gen_random_uuid()::text, '-', '')
where public_token is null;

alter table public.cards
  alter column public_token set not null,
  alter column status set not null,
  alter column issued_at set not null;

create unique index if not exists cards_public_token_key on public.cards(public_token);
create unique index if not exists cards_card_code_key on public.cards(card_code);
create index if not exists cards_status_idx on public.cards(status);
create index if not exists cards_profile_id_idx on public.cards(profile_id);
create index if not exists cards_org_id_idx on public.cards(organization_id);
create index if not exists cards_order_id_idx on public.cards(order_id);

alter table public.cards
  drop constraint if exists cards_status_check;

alter table public.cards
  add constraint cards_status_check
  check (status in ('printed', 'assigned', 'active', 'suspended', 'revoked', 'lost', 'replaced', 'archived'));

alter table public.cards
  drop constraint if exists cards_replaced_by_fk;

alter table public.cards
  add constraint cards_replaced_by_fk
  foreign key (replaced_by_card_id)
  references public.cards(id)
  on delete set null;

-- 2) Card scan log ----------------------------------------------------------
create table if not exists public.card_scans (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  profile_id uuid null references public.profiles(id) on delete set null,
  organization_id uuid null references public.organizations(id) on delete set null,
  scan_source text not null default 'nfc',
  ip_hash text null,
  country text null,
  region text null,
  city text null,
  user_agent text null,
  referrer text null,
  risk_score integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists card_scans_card_id_idx on public.card_scans(card_id);
create index if not exists card_scans_created_at_idx on public.card_scans(created_at desc);
create index if not exists card_scans_org_id_idx on public.card_scans(organization_id);

-- 3) Card lifecycle log -----------------------------------------------------
create table if not exists public.card_events (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  event_type text not null,
  actor_user_id uuid null references auth.users(id) on delete set null,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists card_events_card_id_idx on public.card_events(card_id);
create index if not exists card_events_event_type_idx on public.card_events(event_type);
create index if not exists card_events_created_at_idx on public.card_events(created_at desc);

-- 4) Recommended helper for card resolution --------------------------------
create or replace function public.resolve_card_by_token(input_token text)
returns table (
  card_id uuid,
  profile_id uuid,
  organization_id uuid,
  public_token text,
  status text,
  activation_status text,
  slug text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id as card_id,
    c.profile_id,
    c.organization_id,
    c.public_token,
    c.status,
    c.activation_status,
    p.slug
  from public.cards c
  left join public.profiles p on p.id = c.profile_id
  where c.public_token = input_token
    and c.deleted_at is null
  limit 1
$$;

revoke all on function public.resolve_card_by_token(text) from public;
grant execute on function public.resolve_card_by_token(text) to anon, authenticated;

commit;
