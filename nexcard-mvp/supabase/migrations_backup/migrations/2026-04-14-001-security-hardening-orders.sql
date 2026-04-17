-- Migration: 2026-04-14-001-security-hardening-orders
-- Fixes:
--   1. Drop orders_owner_update — prevents authenticated users from modifying
--      payment_status, fulfillment_status or amount_cents on their own orders.
--      Only admin role and service_role webhooks should mutate order state.
--   2. Add order_items_owner_insert — allows authenticated users to insert
--      order_items belonging to their own orders (required for checkout flow).
-- Apply after B.3 migration has been validated.

begin;

-- 1) Remove overly permissive update policy on orders -------------------------
-- Users should only read and create orders, never modify them directly.
drop policy if exists "orders_owner_update" on public.orders;

-- 2) Allow authenticated users to insert order_items for their own orders -----
drop policy if exists "order_items_owner_insert" on public.order_items;

create policy "order_items_owner_insert"
on public.order_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.orders o
    where o.id = order_items.order_id
      and o.user_id = auth.uid()
  )
);

commit;
