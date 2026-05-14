create table if not exists public.kpi_alert_state (
  id uuid primary key default gen_random_uuid(),
  alert_key text not null unique,
  last_band text null,
  last_score numeric null,
  cooldown_minutes integer null,
  last_sent_at timestamptz null,
  last_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists kpi_alert_state_updated_at_idx
  on public.kpi_alert_state (updated_at desc);

create or replace function public.set_kpi_alert_state_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_kpi_alert_state_updated_at on public.kpi_alert_state;
create trigger trg_kpi_alert_state_updated_at
before update on public.kpi_alert_state
for each row
execute function public.set_kpi_alert_state_updated_at();

alter table public.kpi_alert_state enable row level security;

drop policy if exists "kpi_alert_state_auth_all" on public.kpi_alert_state;
create policy "kpi_alert_state_auth_all"
  on public.kpi_alert_state for all
  to authenticated
  using (true)
  with check (true);
