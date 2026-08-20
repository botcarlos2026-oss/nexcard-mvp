-- NexCard — Close remaining SECURITY DEFINER grant gaps found during the systematic
-- payment/system-wide audit (2026-08-20), following up on 202608201700.
--
-- A sweep of all 56 SECURITY DEFINER functions found that Supabase's schema-level
-- `ALTER DEFAULT PRIVILEGES ... GRANT ALL ON FUNCTIONS TO anon, authenticated` had
-- auto-granted EXECUTE to anon/authenticated on many internal-only functions at
-- creation time — independent of PUBLIC, so migrations that only did
-- `revoke all on function ... from public` (never naming anon/authenticated
-- explicitly) left these callable directly via PostgREST regardless of intent.
-- `check_and_record_rate_limit`'s migration (202608172100) is the one example that
-- did this correctly — this migration applies the same explicit-revoke pattern.
--
-- Two categories of fix:
--
-- (A) Functions actively used by the admin dashboard (src/services/api/cards.js,
--     profiles.js) via an authenticated session, but with NO internal role check —
--     any logged-in customer (not just admins) could call them directly against
--     someone else's card/profile. Fix: add the same
--     `auth.role() = 'service_role' or has_role('admin')` guard already used
--     correctly elsewhere (e.g. set_profile_status, admin_dispatch_order), keep the
--     `authenticated` grant (admin UI needs it), revoke `anon`.
--       - revoke_card, soft_delete_card: also reachable by anyone who scans/taps a
--         physical NexCard, since `resolve_card_by_token` (the public NFC-tap
--         resolver) discloses the real card_id — without this fix, tapping any
--         card in the wild let an attacker disable or archive it with zero auth.
--       - soft_delete_profile, restore_profile_version: any authenticated customer
--         could archive or roll back (including un-delete) any OTHER user's public
--         profile page, not just their own.
--
-- (B) Functions with ZERO callers anywhere in src/ or supabase/functions/ (confirmed
--     via `grep -rln "rpc('<name>'" src/ supabase/functions/`) that were nonetheless
--     grantable to anon/authenticated — pure unused attack surface. Fix: restrict to
--     service_role only (some are called internally by triggers/other
--     SECURITY DEFINER functions, which remain unaffected since those run as the
--     `postgres`-owned definer, not as the original caller's role).
--       - assign_card, reassign_card: card-hijack vector via the same
--         resolve_card_by_token disclosure as above (reassign_card can steal an
--         already-assigned, not-yet-activated card from its rightful owner).
--       - soft_delete_order, soft_delete_payment: archive any order/payment by UUID.
--       - link_order_card, reserve_profile_slug_for_order: legacy/dead, exposed for
--         no reason.
--       - insert_order_history_entry, log_order_operational_event, snapshot_order,
--         snapshot_card: audit-trail/history forgery (could manufacture a fake
--         "marked as paid" history entry to support a bogus chargeback dispute).
--       - mark_order_payment_status, mark_order_fulfillment_status: legacy,
--         superseded by admin_transition_order_state/admin_dispatch_order. Currently
--         only harmless because guard_orders_sensitive_updates' trigger happens to
--         intercept their writes — that's incidental, not a real fix, so revoking
--         the grants removes the landmine instead of relying on it.
--       - mark_order_activated: forges card-activation timestamps (feeds SLA/exec
--         dashboards) on unpaid orders; only legitimate callers are the
--         sync_order_activation_from_card/_from_claim triggers.
--       - spin_wheel: the `spin-wheel` edge function already derives the caller's
--         real IP from the trusted `cf-connecting-ip` header and calls this RPC via
--         the service-role key — but because the RPC was ALSO anon/authenticated-
--         callable, an attacker could call it directly with a self-reported
--         p_client_ip/p_visitor_id, trivially defeating the 24h anti-abuse gate and
--         minting unlimited discount coupons. Restricting to service_role forces
--         all spins through the edge function's real IP derivation.

begin;

-- (A) Admin-dashboard functions — add internal role check, revoke anon, keep authenticated.

create or replace function public.revoke_card(target_card_id uuid, actor_id uuid, reason text default null::text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  before_state jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not coalesce(public.has_role('admin'), false) then
    raise exception 'admin_role_required' using errcode = '42501';
  end if;

  select to_jsonb(c)
  into before_state
  from public.cards c
  where c.id = target_card_id;

  if before_state is null then
    raise exception 'Card not found';
  end if;

  perform public.snapshot_card(target_card_id, actor_id);

  update public.cards
  set status = 'revoked',
      activation_status = 'revoked',
      revoked_at = now(),
      updated_at = now()
  where id = target_card_id;

  insert into public.card_events (card_id, event_type, actor_user_id, context)
  values (
    target_card_id,
    'revoked',
    actor_id,
    jsonb_build_object('reason', reason)
  );

  insert into public.audit_log (
    actor_user_id, actor_role, entity_type, entity_id, action, before, after, context
  )
  values (
    actor_id, null, 'card', target_card_id, 'card_revoke',
    before_state,
    (select to_jsonb(c) from public.cards c where c.id = target_card_id),
    jsonb_build_object('reason', reason)
  );
end;
$$;

revoke all on function public.revoke_card(uuid, uuid, text) from public;
revoke all on function public.revoke_card(uuid, uuid, text) from anon;
grant execute on function public.revoke_card(uuid, uuid, text) to authenticated, service_role;


create or replace function public.soft_delete_card(target_card_id uuid, actor_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  before_state jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not coalesce(public.has_role('admin'), false) then
    raise exception 'admin_role_required' using errcode = '42501';
  end if;

  select to_jsonb(c)
  into before_state
  from public.cards c
  where c.id = target_card_id;

  if before_state is null then
    raise exception 'Card not found';
  end if;

  perform public.snapshot_card(target_card_id, actor_id);

  update public.cards
  set deleted_at = now(),
      status = 'archived',
      updated_at = now()
  where id = target_card_id;

  insert into public.card_events (card_id, event_type, actor_user_id, context)
  values (target_card_id, 'soft_deleted', actor_id, '{}'::jsonb);

  insert into public.audit_log (
    actor_user_id, actor_role, entity_type, entity_id, action, before, after, context
  )
  values (
    actor_id, null, 'card', target_card_id, 'card_soft_delete',
    before_state,
    (select to_jsonb(c) from public.cards c where c.id = target_card_id),
    '{}'::jsonb
  );
end;
$$;

revoke all on function public.soft_delete_card(uuid, uuid) from public;
revoke all on function public.soft_delete_card(uuid, uuid) from anon;
grant execute on function public.soft_delete_card(uuid, uuid) to authenticated, service_role;


create or replace function public.soft_delete_profile(target_profile_id uuid, actor_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  before_state jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not coalesce(public.has_role('admin'), false) then
    raise exception 'admin_role_required' using errcode = '42501';
  end if;

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
    actor_user_id, actor_role, entity_type, entity_id, action, before, after, context
  )
  values (
    actor_id, null, 'profile', target_profile_id, 'profile_soft_delete',
    before_state,
    (select to_jsonb(p) from public.profiles p where p.id = target_profile_id),
    '{}'::jsonb
  );
end;
$$;

revoke all on function public.soft_delete_profile(uuid, uuid) from public;
revoke all on function public.soft_delete_profile(uuid, uuid) from anon;
grant execute on function public.soft_delete_profile(uuid, uuid) to authenticated, service_role;


create or replace function public.restore_profile_version(target_profile_id uuid, target_version integer, actor_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  restore_snapshot jsonb;
  before_state jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not coalesce(public.has_role('admin'), false) then
    raise exception 'admin_role_required' using errcode = '42501';
  end if;

  select snapshot
  into restore_snapshot
  from public.profile_versions
  where profile_id = target_profile_id
    and version = target_version;

  if restore_snapshot is null then
    raise exception 'Profile version not found';
  end if;

  select to_jsonb(p)
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
      view_count = coalesce((restore_snapshot->>'view_count')::integer, view_count),
      status = coalesce(restore_snapshot->>'status', status),
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

  insert into public.audit_log (
    actor_user_id, actor_role, entity_type, entity_id, action, before, after, context
  )
  values (
    actor_id, null, 'profile', target_profile_id, 'profile_restore',
    before_state,
    (select to_jsonb(p) from public.profiles p where p.id = target_profile_id),
    jsonb_build_object('restored_version', target_version)
  );
end;
$$;

revoke all on function public.restore_profile_version(uuid, integer, uuid) from public;
revoke all on function public.restore_profile_version(uuid, integer, uuid) from anon;
grant execute on function public.restore_profile_version(uuid, integer, uuid) to authenticated, service_role;

-- (B) Zero-caller functions — restrict entirely to service_role.

revoke all on function public.assign_card(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.assign_card(uuid, uuid, uuid) to service_role;

revoke all on function public.reassign_card(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.reassign_card(uuid, uuid, uuid) to service_role;

revoke all on function public.soft_delete_order(uuid, uuid) from public, anon, authenticated;
grant execute on function public.soft_delete_order(uuid, uuid) to service_role;

revoke all on function public.soft_delete_payment(uuid, uuid) from public, anon, authenticated;
grant execute on function public.soft_delete_payment(uuid, uuid) to service_role;

revoke all on function public.link_order_card(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.link_order_card(uuid, uuid, uuid) to service_role;

revoke all on function public.reserve_profile_slug_for_order(uuid, text, text, interval) from public, anon, authenticated;
grant execute on function public.reserve_profile_slug_for_order(uuid, text, text, interval) to service_role;

revoke all on function public.insert_order_history_entry(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.insert_order_history_entry(uuid, text, text, text) to service_role;

revoke all on function public.log_order_operational_event(uuid, text, text, text, timestamp with time zone, jsonb) from public, anon, authenticated;
grant execute on function public.log_order_operational_event(uuid, text, text, text, timestamp with time zone, jsonb) to service_role;

revoke all on function public.snapshot_order(uuid, uuid) from public, anon, authenticated;
grant execute on function public.snapshot_order(uuid, uuid) to service_role;

revoke all on function public.snapshot_card(uuid, uuid) from public, anon, authenticated;
grant execute on function public.snapshot_card(uuid, uuid) to service_role;

revoke all on function public.mark_order_payment_status(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.mark_order_payment_status(uuid, text, uuid, text) to service_role;

revoke all on function public.mark_order_fulfillment_status(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.mark_order_fulfillment_status(uuid, text, uuid, text) to service_role;

revoke all on function public.mark_order_activated(uuid, uuid, text, jsonb, timestamp with time zone) from public, anon, authenticated;
grant execute on function public.mark_order_activated(uuid, uuid, text, jsonb, timestamp with time zone) to service_role;

revoke all on function public.spin_wheel(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.spin_wheel(uuid, text, text, text) to service_role;

commit;
