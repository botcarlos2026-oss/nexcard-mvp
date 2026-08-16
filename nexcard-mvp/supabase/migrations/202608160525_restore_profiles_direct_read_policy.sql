-- NexCard — Restore direct anon/authenticated read policy on public.profiles.
-- 202608160510_restore_profiles_public_view.sql dropped "profiles_public_read" assuming the
-- profiles_public view fully replaced it, but middleware.js queries public.profiles directly
-- (rest/v1/profiles?slug=eq...&status=eq.active&deleted_at=is.null) for the edge 404 check —
-- with the policy gone, every public profile route started 404ing. Both access paths are real
-- and both need to keep working: the view for the SPA render, this policy for the edge check.
begin;

drop policy if exists "profiles_public_read" on public.profiles;
create policy "profiles_public_read"
  on public.profiles
  for select
  to anon, authenticated
  using (coalesce(status, 'active') = 'active');

commit;

notify pgrst, 'reload schema';
