-- NexCard P0 hotfix — close anonymous reads on the profiles base table.
begin;

drop policy if exists "profiles_public_read" on public.profiles;
revoke select on table public.profiles from anon;

revoke all on table public.profiles_public from public;
grant select on table public.profiles_public to anon, authenticated;

commit;

notify pgrst, 'reload schema';

-- NO INSECURE ROLLBACK.
-- ROLL FORWARD ONLY: repair or recreate public.profiles_public with its safe
-- projection, restore its SELECT grant to anon and authenticated, then reload
-- the PostgREST schema cache. Never reopen anonymous reads on the base table.