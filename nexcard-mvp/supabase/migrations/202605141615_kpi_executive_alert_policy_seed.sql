insert into public.kpi_runtime_config (key, config, active)
values (
  'executive_alert_policy',
  '{"enabled":1,"cooldown_minutes":180,"dedupe_by_band":1,"min_band_watch":1,"min_band_critical":1}'::jsonb,
  true
)
on conflict (key) do update
set config = excluded.config,
    active = excluded.active,
    updated_at = now();
