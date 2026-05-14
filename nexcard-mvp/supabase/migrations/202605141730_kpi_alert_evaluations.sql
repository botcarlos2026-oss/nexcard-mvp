create table if not exists public.kpi_alert_evaluations (
  id uuid primary key default gen_random_uuid(),
  trigger_source text not null default 'manual',
  score numeric not null,
  band text not null,
  should_send boolean not null default false,
  dispatched boolean not null default false,
  dry_run boolean not null default true,
  blocked_reason text null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists kpi_alert_evaluations_created_at_idx
  on public.kpi_alert_evaluations (created_at desc);

alter table public.kpi_alert_evaluations enable row level security;

drop policy if exists "kpi_alert_evaluations_auth_all" on public.kpi_alert_evaluations;
create policy "kpi_alert_evaluations_auth_all"
  on public.kpi_alert_evaluations for all
  to authenticated
  using (true)
  with check (true);
