-- Migration: 202604160001 — Shipping tracking
-- Adds carrier, tracking_code, delivery token and confirmation fields to orders.
-- Idempotent.

begin;

alter table public.orders
  add column if not exists carrier            text,
  add column if not exists tracking_code      text,
  add column if not exists shipped_at         timestamptz,
  add column if not exists delivered_at       timestamptz,
  add column if not exists delivery_token     uuid default gen_random_uuid(),
  add column if not exists delivery_confirmed_by text;

-- carrier constraint — add new carriers here as they are onboarded
alter table public.orders
  drop constraint if exists orders_carrier_check;

alter table public.orders
  add constraint orders_carrier_check
  check (carrier is null or carrier in ('blueexpress', 'chilexpress', 'starken', 'correos', 'dhl', 'fedex', 'manual'));

-- delivery_confirmed_by constraint
alter table public.orders
  drop constraint if exists orders_delivery_confirmed_by_check;

alter table public.orders
  add constraint orders_delivery_confirmed_by_check
  check (delivery_confirmed_by is null or delivery_confirmed_by in ('carrier_webhook', 'admin', 'customer'));

-- Unique delivery token per order
create unique index if not exists orders_delivery_token_idx on public.orders(delivery_token)
  where delivery_token is not null;

-- Fast lookup for tracking
create index if not exists orders_tracking_code_idx on public.orders(tracking_code)
  where tracking_code is not null;

commit;
