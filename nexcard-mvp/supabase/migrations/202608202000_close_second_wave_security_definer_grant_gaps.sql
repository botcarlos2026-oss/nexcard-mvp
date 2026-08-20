-- NexCard — Close a second wave of SECURITY DEFINER grant gaps, found by a follow-up
-- migrations-consistency review (2026-08-20) after 202608201900 restricted 18 similar
-- functions. These 3 slipped past that sweep — same root cause (Supabase's default
-- ALTER DEFAULT PRIVILEGES auto-grants EXECUTE to anon/authenticated on new functions,
-- independent of PUBLIC), independently re-verified before writing this migration.
--
-- public.snapshot_profile(uuid, uuid): zero GRANT/REVOKE statements anywhere in
-- migration history (unlike its sibling snapshot_card, fixed in 202608201900) — callable
-- by anyone via supabase.rpc('snapshot_profile', ...). Takes an unchecked
-- target_profile_id/actor_id, reads any profile, and writes profile_versions +
-- audit_log with a fully forgeable actor_id — an audit-trail forgery primitive. Zero
-- callers in src/ or supabase/functions/; only invoked internally by
-- soft_delete_profile/restore_profile_version, which remain unaffected since those run
-- as their SECURITY DEFINER owner, not as the original caller's role.
--
-- public.decrement_stock(...): no internal role check, zero callers anywhere in the
-- app — same shape as reserve_inventory_for_order pre-fix (202608201700). Ground-truth
-- checked against the live database before writing this (see below) because the
-- signature actually deployed does NOT match migration 202604210001's
-- decrement_stock(uuid, integer, text, uuid): the live function is
-- decrement_stock(p_sku text, p_quantity integer) — a different, untracked version,
-- same "applied in prod, never versioned" drift pattern already documented for
-- assign_card/reassign_card/link_order_card. It is granted to `anon` AND
-- `authenticated` (worse than first assessed) — any visitor, logged in or not, could
-- corrupt real inventory counts with no payment/ownership check.
--
-- public.log_email_event(...): has 7 legitimate callers, all edge functions using the
-- service_role client — but ground-truth check shows it is granted to BOTH `anon` and
-- `authenticated` (Supabase's default-privilege auto-grant applies independently of
-- the explicit `grant ... to authenticated, service_role` in 202605102400, which never
-- mentioned anon at all), letting any visitor — no login required — insert arbitrary
-- email_log rows, bypassing the email_log_admin_insert RLS policy meant to restrict
-- that to admins. Both grants are revoked here; service_role keeps working unchanged.

begin;

revoke all on function public.snapshot_profile(uuid, uuid) from public, anon, authenticated;
grant execute on function public.snapshot_profile(uuid, uuid) to service_role;

revoke all on function public.decrement_stock(text, integer) from public, anon, authenticated;
grant execute on function public.decrement_stock(text, integer) to service_role;

revoke all on function public.log_email_event(text, text, uuid, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.log_email_event(text, text, uuid, text, text, text, text, jsonb) to service_role;

commit;
