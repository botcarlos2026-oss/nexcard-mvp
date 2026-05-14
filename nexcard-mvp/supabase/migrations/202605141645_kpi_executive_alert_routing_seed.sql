insert into public.kpi_runtime_config (key, config, active)
values (
  'executive_alert_routing',
  '{"enabled":1,"auto_dispatch":0,"dry_run_default":1,"recipients_csv":"carlos.alvarez.contreras@gmail.com,bot.carlos.2026@gmail.com"}'::jsonb,
  true
)
on conflict (key) do update
set config = excluded.config,
    active = excluded.active,
    updated_at = now();
