begin;

-- Tabla de configuración de insumos por despacho
create table if not exists public.dispatch_config (
  id uuid default gen_random_uuid() primary key,
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  quantity_per_dispatch integer not null default 1,
  description text,
  active boolean default true,
  created_at timestamptz default now()
);

alter table public.dispatch_config enable row level security;

drop policy if exists "dispatch_config_admin_all" on public.dispatch_config;
create policy "dispatch_config_admin_all"
  on public.dispatch_config for all
  to authenticated
  using (public.has_role('admin'))
  with check (public.has_role('admin'));

commit;
