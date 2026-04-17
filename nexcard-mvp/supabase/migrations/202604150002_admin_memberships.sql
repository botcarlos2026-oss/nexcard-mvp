-- Migration: 202604150002 — Admin memberships bootstrap
-- Ensures hardcoded admin emails have the 'admin' role in the memberships
-- table so that RLS policies using has_role('admin') work correctly.
-- Idempotent: safe to run multiple times.

begin;

do $$
begin
  insert into public.memberships (id, user_id, role, created_at)
  select
    gen_random_uuid(),
    u.id,
    'admin',
    now()
  from auth.users u
  where u.email in (
    'bot.carlos.2026@gmail.com',
    'carlos.alvarez.contreras@gmail.com'
  )
  and not exists (
    select 1
    from public.memberships m
    where m.user_id = u.id
      and m.role = 'admin'
  );
exception when others then
  raise warning 'admin_memberships bootstrap: %', sqlerrm;
end;
$$;

commit;
