begin;

-- ============================================================
-- email_log — registro de emails enviados
-- ============================================================
create table if not exists public.email_log (
  id              uuid primary key default gen_random_uuid(),
  recipient_email text not null,
  email_type      text not null check (email_type in (
                    'order_confirmation', 'shipping', 'followup',
                    'upsell', 'campaign', 'waitlist_launch'
                  )),
  order_id        uuid references public.orders(id) on delete set null,
  subject         text,
  status          text not null default 'sent',
  sent_at         timestamptz not null default now()
);

-- ============================================================
-- email_unsubscribe — lista de bajas
-- ============================================================
create table if not exists public.email_unsubscribe (
  id                uuid primary key default gen_random_uuid(),
  email             text not null unique,
  reason            text,
  unsubscribed_at   timestamptz not null default now()
);

-- ============================================================
-- RLS
-- ============================================================
alter table public.email_log        enable row level security;
alter table public.email_unsubscribe enable row level security;

-- email_log: INSERT y SELECT solo para autenticados
drop policy if exists "email_log_authenticated_insert" on public.email_log;
create policy "email_log_authenticated_insert"
  on public.email_log for insert
  to authenticated
  with check (true);

drop policy if exists "email_log_authenticated_select" on public.email_log;
create policy "email_log_authenticated_select"
  on public.email_log for select
  to authenticated
  using (true);

-- email_unsubscribe: INSERT para anon (baja pública), SELECT para autenticados
drop policy if exists "email_unsubscribe_anon_insert" on public.email_unsubscribe;
create policy "email_unsubscribe_anon_insert"
  on public.email_unsubscribe for insert
  to anon, authenticated
  with check (true);

drop policy if exists "email_unsubscribe_authenticated_select" on public.email_unsubscribe;
create policy "email_unsubscribe_authenticated_select"
  on public.email_unsubscribe for select
  to authenticated
  using (true);

commit;
