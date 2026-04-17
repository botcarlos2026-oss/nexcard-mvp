-- Formal Supabase migration for NexCard
-- Source: supabase/route2_profiles_snapshot_minimal.sql
-- Validation: validated manually before promotion; run in staging before prod.

-- NexCard Route 2.2.1 — Minimal profile snapshot foundation
-- Safer first step: create a verified snapshot helper before restore logic.

begin;

create or replace function public.snapshot_profile(target_profile_id uuid, actor_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  next_version integer;
  current_profile jsonb;
begin
  select to_jsonb(p)
  into current_profile
  from public.profiles p
  where p.id = target_profile_id;

  if current_profile is null then
    raise exception 'Profile not found';
  end if;

  select coalesce(max(version), 0) + 1
  into next_version
  from public.profile_versions
  where profile_id = target_profile_id;

  insert into public.profile_versions (profile_id, version, snapshot, created_by)
  values (target_profile_id, next_version, current_profile, actor_id);

  insert into public.audit_log (
    actor_user_id,
    actor_role,
    entity_type,
    entity_id,
    action,
    before,
    after,
    context
  )
  values (
    actor_id,
    null,
    'profile',
    target_profile_id,
    'profile_snapshot',
    current_profile,
    null,
    jsonb_build_object('version', next_version)
  );

  return next_version;
end;
$$;

create or replace function public.soft_delete_profile(target_profile_id uuid, actor_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  before_state jsonb;
begin
  select to_jsonb(p)
  into before_state
  from public.profiles p
  where p.id = target_profile_id;

  if before_state is null then
    raise exception 'Profile not found';
  end if;

  perform public.snapshot_profile(target_profile_id, actor_id);

  update public.profiles
  set deleted_at = now(),
      updated_at = now()
  where id = target_profile_id;

  insert into public.audit_log (
    actor_user_id,
    actor_role,
    entity_type,
    entity_id,
    action,
    before,
    after,
    context
  )
  values (
    actor_id,
    null,
    'profile',
    target_profile_id,
    'profile_soft_delete',
    before_state,
    (select to_jsonb(p) from public.profiles p where p.id = target_profile_id),
    '{}'::jsonb
  );
end;
$$;

commit;
