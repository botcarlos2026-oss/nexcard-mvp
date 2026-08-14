-- Emergency rollback for 202608132300_cyber_neo_rls_profile_status_hardening.sql
-- DO NOT run during normal deploys.
-- Validated only in disposable Postgres 17 restored from production schema dump.
-- Running this removes the public abandoned-cart RPCs and the profile.status guard.
--
-- Original local evidence path from execution machine:
-- /tmp/nexcard-rollback-verify-20260814135703/post-rollback-verification.log

-- rollback_202608132300.sql — CORREGIDO tras revisión independiente
-- NO ejecutar salvo emergencia funcional real.
-- Objetivo: volver al estado inmediatamente previo a 202608132300 sin reabrir accesos más amplios.
-- Nota: este rollback elimina las nuevas RPC públicas y el guard de profile.status.

begin;

-- CN-007 rollback: quitar guard de status introducido por 202608132300.
drop trigger if exists trg_prevent_profile_status_self_update on public.profiles;
drop function if exists public.prevent_profile_status_self_update();
drop function if exists public.set_profile_status(uuid, text);

-- CN-003 rollback parcial: quitar RPCs públicas introducidas por 202608132300.
drop function if exists public.mark_abandoned_cart_converted_public(uuid, uuid);
drop function if exists public.save_abandoned_cart_public(text, text, jsonb, integer);

-- email_log: el estado inmediatamente previo ya era admin-scoped por 202608120001.
-- No restaurar email_log_authenticated_select, porque reabriría lectura autenticada amplia.
drop policy if exists "email_log_admin_select" on public.email_log;
create policy "email_log_admin_select"
  on public.email_log for select to authenticated
  using (public.has_role('admin'));

-- email_unsubscribe: antes de 202608132300 la lectura autenticada era amplia.
-- Esto es inseguro, pero es el inverso fiel del cambio puntual si se requiere rollback total.
drop policy if exists "email_unsubscribe_admin_select" on public.email_unsubscribe;
drop policy if exists "email_unsubscribe_authenticated_select" on public.email_unsubscribe;
create policy "email_unsubscribe_authenticated_select"
  on public.email_unsubscribe for select to authenticated
  using (true);

-- abandoned_carts: el estado inmediatamente previo ya era admin_all + anon_insert + anon_lifecycle_update.
-- No restaurar abandoned_carts_authenticated_all, porque reabriría acceso amplio.
drop policy if exists "abandoned_carts_admin_all" on public.abandoned_carts;
create policy "abandoned_carts_admin_all"
  on public.abandoned_carts for all to authenticated
  using (public.has_role('admin'))
  with check (public.has_role('admin'));

-- card_scans: restaurar nombres/policies previos admin_read/admin_manage; conservar inserciones públicas existentes.
drop policy if exists "card_scans_admin_select" on public.card_scans;
drop policy if exists "card_scans_auth_select" on public.card_scans;
drop policy if exists "card_scans_admin_read" on public.card_scans;
drop policy if exists "card_scans_admin_manage" on public.card_scans;

create policy "card_scans_admin_read"
  on public.card_scans
  for select
  to authenticated
  using (public.has_role('admin'));

create policy "card_scans_admin_manage"
  on public.card_scans
  for all
  to authenticated
  using (public.has_role('admin'))
  with check (public.has_role('admin'));

commit;
