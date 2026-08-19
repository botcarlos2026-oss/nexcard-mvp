begin;

create table if not exists public.watchdog_alert_state (
  id text primary key,
  last_alert_at timestamptz,
  last_fingerprint text,
  updated_at timestamptz not null default now()
);

comment on table public.watchdog_alert_state is
  'Cooldown state for the operational watchdog cron (api/cron/operational-watchdog.js). Prevents repeated Telegram alerts for the same unresolved issue on every cron tick.';

alter table public.watchdog_alert_state enable row level security;

commit;
