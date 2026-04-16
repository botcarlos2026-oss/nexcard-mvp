begin;

-- Separar el policy combinado en dos políticas explícitas
drop policy if exists "email_unsubscribe_anon_insert" on public.email_unsubscribe;

create policy "email_unsubscribe_anon_insert"
  on public.email_unsubscribe for insert
  to anon
  with check (true);

create policy "email_unsubscribe_auth_insert"
  on public.email_unsubscribe for insert
  to authenticated
  with check (true);

commit;
