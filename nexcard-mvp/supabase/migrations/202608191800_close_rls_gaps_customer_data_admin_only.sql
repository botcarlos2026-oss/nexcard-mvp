-- NexCard — Close RLS gaps found during Cyber Neo security audit (2026-08-19).
--
-- refunds, crm_contacts, crm_deals, crm_activities, card_scans (select), team_members,
-- wheel_config, wheel_prizes, wheel_spins, and review_cards were originally found with
-- `FOR ALL TO authenticated USING (true) WITH CHECK (true)` policies, letting any
-- Supabase-authenticated principal (including ordinary customers, who become
-- authenticated the moment they claim their card) read/write every other customer's
-- data. Those 10 tables were independently remediated to the has_role('admin') pattern
-- before this migration ran (verified via `supabase db dump --schema public`), so only
-- the remaining 4 kpi_* tables are fixed here:
--
--   kpi_runtime_config, kpi_alert_state, kpi_alert_history, kpi_alert_evaluations
--
-- These are internal admin/cron-only tables (revenue KPIs, alert routing state and
-- history) — never customer-facing. This mirrors the has_role('admin') pattern already
-- applied in 202608120001_claude_security_audit_hardening.sql and
-- 202608171200_close_rls_gaps_inventory_claims.sql.

begin;

drop policy if exists "kpi_runtime_config_auth_all" on public.kpi_runtime_config;
create policy "kpi_runtime_config_admin_all"
  on public.kpi_runtime_config for all
  to authenticated
  using (public.has_role('admin'))
  with check (public.has_role('admin'));

drop policy if exists "kpi_alert_state_auth_all" on public.kpi_alert_state;
create policy "kpi_alert_state_admin_all"
  on public.kpi_alert_state for all
  to authenticated
  using (public.has_role('admin'))
  with check (public.has_role('admin'));

drop policy if exists "kpi_alert_history_auth_all" on public.kpi_alert_history;
create policy "kpi_alert_history_admin_all"
  on public.kpi_alert_history for all
  to authenticated
  using (public.has_role('admin'))
  with check (public.has_role('admin'));

drop policy if exists "kpi_alert_evaluations_auth_all" on public.kpi_alert_evaluations;
create policy "kpi_alert_evaluations_admin_all"
  on public.kpi_alert_evaluations for all
  to authenticated
  using (public.has_role('admin'))
  with check (public.has_role('admin'));

commit;
