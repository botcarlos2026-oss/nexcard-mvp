create table if not exists public.kpi_runtime_config (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  config jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists kpi_runtime_config_active_idx
  on public.kpi_runtime_config (active, created_at desc);

create or replace function public.set_kpi_runtime_config_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_kpi_runtime_config_updated_at on public.kpi_runtime_config;
create trigger trg_kpi_runtime_config_updated_at
before update on public.kpi_runtime_config
for each row
execute function public.set_kpi_runtime_config_updated_at();

alter table public.kpi_runtime_config enable row level security;

drop policy if exists "kpi_runtime_config_auth_all" on public.kpi_runtime_config;
create policy "kpi_runtime_config_auth_all"
  on public.kpi_runtime_config for all
  to authenticated
  using (true)
  with check (true);
