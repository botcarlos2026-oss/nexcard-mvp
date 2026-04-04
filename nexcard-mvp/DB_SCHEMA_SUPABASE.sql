-- NexCard Supabase Schema (MVP) 
-- Roles esperados: admin, individual_owner, company_owner, company_member
-- Supabase ya provee auth.users

-- Extensiones necesarias
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- Helpers de timestamp
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ORGANIZATIONS
create table if not exists public.organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_org_updated before update on public.organizations
for each row execute procedure public.set_updated_at();

-- MEMBERSHIPS (user <-> org con rol)
create table if not exists public.memberships (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role text not null check (role in ('admin','company_owner','company_member')),
  created_at timestamptz not null default now(),
  unique (user_id, organization_id)
);

-- PROFILES (tarjeta digital)
create table if not exists public.profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  slug text unique not null,
  full_name text not null,
  profession text,
  bio text,
  avatar_url text,
  theme_color text default '#10B981',
  is_dark_mode boolean default true,
  whatsapp text,
  instagram text,
  linkedin text,
  website text,
  vcard_enabled boolean default true,
  calendar_url text,
  bank_enabled boolean default false,
  bank_name text,
  bank_type text,
  bank_number text,
  bank_rut text,
  bank_email text,
  view_count integer default 0,
  status text default 'active' check (status in ('active','disabled','pending')),
  account_type text default 'individual' check (account_type in ('individual','company')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_profiles_updated before update on public.profiles
for each row execute procedure public.set_updated_at();

-- PRODUCTS
create table if not exists public.products (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  segment text check (segment in ('individual','sme','enterprise')),
  price_cents bigint not null,
  currency text not null default 'CLP',
  type text check (type in ('single','pack')),
  active boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_products_updated before update on public.products
for each row execute procedure public.set_updated_at();

-- ORDERS
create table if not exists public.orders (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  customer_name text,
  customer_email text,
  payment_method text,
  payment_status text default 'pending' check (payment_status in ('pending','authorized','paid','failed','refunded')),
  fulfillment_status text default 'new' check (fulfillment_status in ('new','printing','shipping','delivered','canceled')),
  amount_cents bigint not null,
  currency text not null default 'CLP',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_orders_updated before update on public.orders
for each row execute procedure public.set_updated_at();

-- ORDER ITEMS
create table if not exists public.order_items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  quantity integer not null check (quantity > 0),
  unit_price_cents bigint not null,
  currency text not null default 'CLP'
);

-- PAYMENTS
create table if not exists public.payments (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text check (provider in ('webpay','mercado_pago','manual')),
  status text default 'pending' check (status in ('pending','authorized','paid','failed','refunded')),
  amount_cents bigint not null,
  currency text not null default 'CLP',
  external_id text,
  payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_payments_updated before update on public.payments
for each row execute procedure public.set_updated_at();

-- CARDS (tarjetas físicas / NFC preparado)
create table if not exists public.cards (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references public.organizations(id) on delete set null,
  profile_id uuid references public.profiles(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  card_code text unique,
  activation_status text default 'unassigned' check (activation_status in ('unassigned','assigned','activated','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_cards_updated before update on public.cards
for each row execute procedure public.set_updated_at();

-- INVENTORY
create table if not exists public.inventory_items (
  id uuid primary key default uuid_generate_v4(),
  item text not null,
  category text,
  stock integer not null default 0,
  min_stock integer not null default 0,
  unit text,
  cost_cents bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_inv_items_updated before update on public.inventory_items
for each row execute procedure public.set_updated_at();

create table if not exists public.inventory_movements (
  id uuid primary key default uuid_generate_v4(),
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  movement_type text not null check (movement_type in ('in','out','adjust')),
  quantity integer not null,
  reason text,
  order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now()
);

-- CMS CONTENT BLOCKS
create table if not exists public.content_blocks (
  id uuid primary key default uuid_generate_v4(),
  block_key text not null,
  content jsonb not null,
  locale text default 'es-CL',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (block_key, locale)
);
create trigger trg_cb_updated before update on public.content_blocks
for each row execute procedure public.set_updated_at();

-- EVENTS (analytics liviano)
create table if not exists public.events (
  id uuid primary key default uuid_generate_v4(),
  profile_slug text,
  event_type text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- POLÍTICAS RLS
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.content_blocks enable row level security;
alter table public.cards enable row level security;
alter table public.events enable row level security;

-- Helpers para roles
create or replace view public.v_current_memberships as
select m.*, u.email
from public.memberships m
join auth.users u on u.id = m.user_id
where m.user_id = auth.uid();

-- Organizations
create policy org_select_public on public.organizations for select using (true);
create policy org_modify_owned on public.organizations for all using (
  exists (select 1 from public.memberships m where m.organization_id = organizations.id and m.user_id = auth.uid() and m.role in ('admin','company_owner'))
) with check (
  exists (select 1 from public.memberships m where m.organization_id = organizations.id and m.user_id = auth.uid() and m.role in ('admin','company_owner'))
);

-- Memberships
create policy mem_select_self on public.memberships for select using (user_id = auth.uid());
create policy mem_admin_manage on public.memberships for all using (
  exists (
    select 1 from public.memberships m
    where m.organization_id = memberships.organization_id
      and m.user_id = auth.uid()
      and m.role in ('admin','company_owner')
  )
) with check (
  exists (
    select 1 from public.memberships m
    where m.organization_id = memberships.organization_id
      and m.user_id = auth.uid()
      and m.role in ('admin','company_owner')
  )
);

-- Profiles
create policy profiles_public_read on public.profiles for select using (status = 'active');
create policy profiles_owner_manage on public.profiles for all using (
  (user_id = auth.uid())
  or exists (
    select 1 from public.memberships m
    where m.organization_id = profiles.organization_id
      and m.user_id = auth.uid()
      and m.role in ('admin','company_owner','company_member')
  )
) with check (
  (user_id = auth.uid())
  or exists (
    select 1 from public.memberships m
    where m.organization_id = profiles.organization_id
      and m.user_id = auth.uid()
      and m.role in ('admin','company_owner','company_member')
  )
);

-- Products (lectura pública, edición admin)
create policy products_public_read on public.products for select using (active = true);
create policy products_admin_write on public.products for all using (
  exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.role = 'admin')
) with check (
  exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.role = 'admin')
);

-- Orders
create policy orders_select_owner on public.orders for select using (
  user_id = auth.uid() or exists (
    select 1 from public.memberships m where m.organization_id = orders.organization_id and m.user_id = auth.uid()
  )
);
create policy orders_modify_owner on public.orders for all using (
  user_id = auth.uid() or exists (
    select 1 from public.memberships m where m.organization_id = orders.organization_id and m.user_id = auth.uid() and m.role in ('admin','company_owner')
  )
) with check (
  user_id = auth.uid() or exists (
    select 1 from public.memberships m where m.organization_id = orders.organization_id and m.user_id = auth.uid() and m.role in ('admin','company_owner')
  )
);

-- Order items
create policy order_items_access on public.order_items for all using (
  exists (select 1 from public.orders o where o.id = order_items.order_id and (o.user_id = auth.uid() or exists (select 1 from public.memberships m where m.organization_id = o.organization_id and m.user_id = auth.uid())))
) with check (
  exists (select 1 from public.orders o where o.id = order_items.order_id and (o.user_id = auth.uid() or exists (select 1 from public.memberships m where m.organization_id = o.organization_id and m.user_id = auth.uid())))
);

-- Payments
create policy payments_access on public.payments for all using (
  exists (select 1 from public.orders o where o.id = payments.order_id and (o.user_id = auth.uid() or exists (select 1 from public.memberships m where m.organization_id = o.organization_id and m.user_id = auth.uid())))
) with check (
  exists (select 1 from public.orders o where o.id = payments.order_id and (o.user_id = auth.uid() or exists (select 1 from public.memberships m where m.organization_id = o.organization_id and m.user_id = auth.uid())))
);

-- Cards
create policy cards_access on public.cards for all using (
  (exists (select 1 from public.profiles p where p.id = cards.profile_id and p.user_id = auth.uid()))
  or exists (select 1 from public.memberships m where m.organization_id = cards.organization_id and m.user_id = auth.uid())
) with check (
  (exists (select 1 from public.profiles p where p.id = cards.profile_id and p.user_id = auth.uid()))
  or exists (select 1 from public.memberships m where m.organization_id = cards.organization_id and m.user_id = auth.uid())
);

-- Inventory
create policy inv_read_public on public.inventory_items for select using (true);
create policy inv_admin_manage on public.inventory_items for all using (
  exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.role in ('admin','company_owner'))
) with check (
  exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.role in ('admin','company_owner'))
);
create policy inv_movements_manage on public.inventory_movements for all using (
  exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.role in ('admin','company_owner'))
) with check (
  exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.role in ('admin','company_owner'))
);

-- Content blocks (CMS landing)
create policy cb_public_read on public.content_blocks for select using (true);
create policy cb_admin_write on public.content_blocks for all using (
  exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.role = 'admin')
) with check (
  exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.role = 'admin')
);

-- Events (lectura pública, escritura abierta básica)
create policy events_public_read on public.events for select using (true);
create policy events_public_insert on public.events for insert with check (true);

-- Nota: ajusta valores de price_cents/amount_cents según unidades reales.
-- Revisa índices según necesidades (slugs, org_id, user_id).
-- Para ambientes productivos, agrega constraints adicionales de integridad según el flujo final.
