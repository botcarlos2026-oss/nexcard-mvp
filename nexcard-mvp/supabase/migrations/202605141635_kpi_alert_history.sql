create table if not exists public.kpi_alert_history (
  id uuid primary key default gen_random_uuid(),
  alert_key text not null,
  alert_band text null,
  payload_hash text not null,
  channel text not null default 'email',
  status text not null default 'sent',
  provider text null,
  provider_message_id text null,
  payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists kpi_alert_history_alert_key_created_at_idx
  on public.kpi_alert_history (alert_key, created_at desc);

create index if not exists kpi_alert_history_payload_hash_idx
  on public.kpi_alert_history (payload_hash);

alter table public.kpi_alert_history enable row level security;

drop policy if exists "kpi_alert_history_auth_all" on public.kpi_alert_history;
create policy "kpi_alert_history_auth_all"
  on public.kpi_alert_history for all
  to authenticated
  using (true)
  with check (true);
