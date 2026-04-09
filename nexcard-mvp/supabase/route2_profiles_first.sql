-- NexCard Route 2.2 — Profiles first
-- Snapshot, restore and soft delete helpers for profiles.
-- Draft. Review before execution.

begin;

create or replace function public.snapshot_profile(target_profile_id uuid, actor_id uuid default auth.uid())
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  next_version integer;
  current_profile jsonb;
begin
  select to_jsonb(p.*)
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

  insert into public.audit_log (actor_user_id, actor_role, entity_type, entity_id, action, before, after, context)
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

create or replace function public.soft_delete_profile(target_profile_id uuid, actor_id uuid default auth.uid())
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  before_state jsonb;
begin
  select to_jsonb(p.*)
  into before_state
  from public.profiles p
  where p.id = target_profile_id;

  if before_state is null then
    raise exception 'Profile not found';
  end if;

  perform public.snapshot_profile(target_profile_id, actor_id);

  update public.profiles
  set deleted_at = now(),
      status = case when status is null then 'archived' else status end,
      updated_at = now()
  where id = target_profile_id;

  insert into public.audit_log (actor_user_id, actor_role, entity_type, entity_id, action, before, after, context)
  values (
    actor_id,
    null,
    'profile',
    target_profile_id,
    'profile_soft_delete',
    before_state,
    (select to_jsonb(p.*) from public.profiles p where p.id = target_profile_id),
    '{}'::jsonb
  );
end;
$$;

create or replace function public.restore_profile_version(target_profile_id uuid, target_version integer, actor_id uuid default auth.uid())
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  restore_snapshot jsonb;
  before_state jsonb;
begin
  select snapshot
  into restore_snapshot
  from public.profile_versions
  where profile_id = target_profile_id
    and version = target_version;

  if restore_snapshot is null then
    raise exception 'Profile version not found';
  end if;

  select to_jsonb(p.*)
  into before_state
  from public.profiles p
  where p.id = target_profile_id;

  if before_state is null then
    raise exception 'Profile not found';
  end if;

  perform public.snapshot_profile(target_profile_id, actor_id);

  update public.profiles
  set slug = restore_snapshot->>'slug',
      full_name = restore_snapshot->>'full_name',
      profession = restore_snapshot->>'profession',
      bio = restore_snapshot->>'bio',
      avatar_url = restore_snapshot->>'avatar_url',
      theme_color = restore_snapshot->>'theme_color',
      is_dark_mode = coalesce((restore_snapshot->>'is_dark_mode')::boolean, is_dark_mode),
      whatsapp = restore_snapshot->>'whatsapp',
      instagram = restore_snapshot->>'instagram',
      linkedin = restore_snapshot->>'linkedin',
      website = restore_snapshot->>'website',
      vcard_enabled = coalesce((restore_snapshot->>'vcard_enabled')::boolean, vcard_enabled),
      calendar_url = restore_snapshot->>'calendar_url',
      bank_enabled = coalesce((restore_snapshot->>'bank_enabled')::boolean, bank_enabled),
      bank_name = restore_snapshot->>'bank_name',
      bank_type = restore_snapshot->>'bank_type',
      bank_number = restore_snapshot->>'bank_number',
      bank_rut = restore_snapshot->>'bank_rut',
      bank_email = restore_snapshot->>'bank_email',
      status = restore_snapshot->>'status',
      account_type = restore_snapshot->>'account_type',
      tiktok = restore_snapshot->>'tiktok',
      whatsapp_enabled = coalesce((restore_snapshot->>'whatsapp_enabled')::boolean, whatsapp_enabled),
      instagram_enabled = coalesce((restore_snapshot->>'instagram_enabled')::boolean, instagram_enabled),
      linkedin_enabled = coalesce((restore_snapshot->>'linkedin_enabled')::boolean, linkedin_enabled),
      tiktok_enabled = coalesce((restore_snapshot->>'tiktok_enabled')::boolean, tiktok_enabled),
      website_enabled = coalesce((restore_snapshot->>'website_enabled')::boolean, website_enabled),
      calendar_url_enabled = coalesce((restore_snapshot->>'calendar_url_enabled')::boolean, calendar_url_enabled),
      company = restore_snapshot->>'company',
      location = restore_snapshot->>'location',
      contact_email = restore_snapshot->>'contact_email',
      contact_phone = restore_snapshot->>'contact_phone',
      facebook = restore_snapshot->>'facebook',
      facebook_enabled = coalesce((restore_snapshot->>'facebook_enabled')::boolean, facebook_enabled),
      contact_phone_enabled = coalesce((restore_snapshot->>'contact_phone_enabled')::boolean, contact_phone_enabled),
      contact_email_enabled = coalesce((restore_snapshot->>'contact_email_enabled')::boolean, contact_email_enabled),
      portfolio_url = restore_snapshot->>'portfolio_url',
      portfolio_enabled = coalesce((restore_snapshot->>'portfolio_enabled')::boolean, portfolio_enabled),
      cover_image_url = restore_snapshot->>'cover_image_url',
      deleted_at = null,
      updated_at = now()
  where id = target_profile_id;

  insert into public.audit_log (actor_user_id, actor_role, entity_type, entity_id, action, before, after, context)
  values (
    actor_id,
    null,
    'profile',
    target_profile_id,
    'profile_restore',
    before_state,
    (select to_jsonb(p.*) from public.profiles p where p.id = target_profile_id),
    jsonb_build_object('restored_version', target_version)
  );
end;
$$;

commit;
