insert into public.kpi_runtime_config (key, config, active)
values (
  'executive_alert_band_policy',
  '{"kill_switch":0,"watch_cooldown_minutes":180,"critical_cooldown_minutes":60,"watch_recipients_csv":"bot.carlos.2026@gmail.com","critical_recipients_csv":"carlos.alvarez.contreras@gmail.com,bot.carlos.2026@gmail.com"}'::jsonb,
  true
)
on conflict (key) do update
set config = excluded.config,
    active = excluded.active,
    updated_at = now();
