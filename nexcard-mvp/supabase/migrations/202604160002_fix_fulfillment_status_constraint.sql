-- Migration: 202604160002 — Align fulfillment_status check constraint with frontend values
-- The DB had 'printing/shipping/canceled' from the legacy mark_order_fulfillment_status RPC.
-- The frontend pipeline uses: new → in_production → ready → shipped → delivered (+ cancelled).
-- This migration drops the old constraint and replaces it with the frontend values.
-- Idempotent.

begin;

-- Migrate any existing rows using legacy values to the canonical frontend values
update public.orders set fulfillment_status = 'in_production' where fulfillment_status = 'printing';
update public.orders set fulfillment_status = 'shipped'       where fulfillment_status = 'shipping';
update public.orders set fulfillment_status = 'cancelled'     where fulfillment_status = 'canceled';

-- Drop old constraint (may or may not exist)
alter table public.orders
  drop constraint if exists orders_fulfillment_status_check;

-- Add canonical constraint matching frontend FULFILLMENT_NEXT pipeline
alter table public.orders
  add constraint orders_fulfillment_status_check
  check (fulfillment_status in ('new', 'in_production', 'ready', 'shipped', 'delivered', 'cancelled'));

commit;
