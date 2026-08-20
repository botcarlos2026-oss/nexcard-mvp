-- NexCard — Close 3 payment-integrity gaps found during Cyber Neo payment-focused audit (2026-08-20).
--
-- 1) orders/order_items had leftover direct-INSERT RLS policies (some with NO role
--    restriction at all — "Allow anonymous users to insert orders"/"Allow inserting
--    order items", both `WITH CHECK (true)` and no `TO` clause, meaning PUBLIC —
--    plus authenticated-scoped ones that only checked ownership, never payment_status
--    or price integrity). Confirmed via `grep -rn "from('orders').insert" src/` that
--    the app NEVER inserts orders/order_items directly from the client — checkout
--    exclusively calls the `create_order_with_items` SECURITY DEFINER RPC, which
--    computes prices server-side from `products` and bypasses RLS on its own (it
--    runs as its definer). Removing every direct-INSERT policy makes INSERT via
--    PostgREST deny-all for these two tables without touching the checkout flow at
--    all — closing a path where anyone (anonymous, in the worst policy) could POST a
--    self-declared "paid" order at any amount, with any order_items price, completely
--    bypassing Mercado Pago, create-mp-preference, and mp-webhook.
--
-- 2) mark_payment_status() (called only by mp-webhook and process-refund, both via a
--    service-role client) had no `REVOKE ... FROM PUBLIC`, so it kept Postgres'
--    default EXECUTE grant to PUBLIC — any anon/authenticated caller who obtained a
--    payment_id could rewrite that payment's status directly. Restricted to
--    service_role only, matching the pattern already used correctly by
--    admin_transition_order_state/reconcile_order_payment_status.
--
-- 3) reserve_inventory_for_order() was granted to anon+authenticated, had no
--    authorization/ownership check, no payment_status check (would decrement real
--    stock for an unpaid/pending order), and a TOCTOU race (stock checked in one loop,
--    decremented in a second loop with no row lock). It also has zero callers anywhere
--    in the current app/edge-function code (`grep -rln reserve_inventory_for_order
--    src/ supabase/functions/ scripts/` — no matches) and existed only in an untracked
--    prod schema dump, never in a versioned migration. Restricted to service_role,
--    and hardened (payment_status='paid' required, `for update` row locks on
--    inventory_items) in case it's ever wired up again — mirroring the locking
--    pattern already used correctly in admin_dispatch_order.

begin;

-- (1) orders / order_items — remove every direct-INSERT policy.
drop policy if exists "Allow anonymous users to insert orders" on public.orders;
drop policy if exists "orders_owner_insert" on public.orders;

drop policy if exists "Allow inserting order items" on public.order_items;
drop policy if exists "order_items_owner_insert" on public.order_items;
drop policy if exists "order_items_insert_anon" on public.order_items;

-- (2) mark_payment_status — service_role only.
revoke all on function public.mark_payment_status(uuid, text, uuid, text, text) from public;
revoke all on function public.mark_payment_status(uuid, text, uuid, text, text) from anon;
revoke all on function public.mark_payment_status(uuid, text, uuid, text, text) from authenticated;
grant execute on function public.mark_payment_status(uuid, text, uuid, text, text) to service_role;

-- (2b) snapshot_payment — same missing-revoke pattern, called only from within
-- mark_payment_status (SECURITY DEFINER context), no legitimate direct caller.
revoke all on function public.snapshot_payment(uuid, uuid) from public;
revoke all on function public.snapshot_payment(uuid, uuid) from anon;
revoke all on function public.snapshot_payment(uuid, uuid) from authenticated;
grant execute on function public.snapshot_payment(uuid, uuid) to service_role;

-- (3) reserve_inventory_for_order — service_role only, hardened logic.
revoke all on function public.reserve_inventory_for_order(uuid, uuid) from public;
revoke all on function public.reserve_inventory_for_order(uuid, uuid) from anon;
revoke all on function public.reserve_inventory_for_order(uuid, uuid) from authenticated;
grant execute on function public.reserve_inventory_for_order(uuid, uuid) to service_role;

create or replace function public.reserve_inventory_for_order(target_order_id uuid, actor_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  req_rec record;
  reserved_count integer := 0;
  order_payment_status text;
begin
  if target_order_id is null then
    raise exception 'target_order_id is required';
  end if;

  select o.payment_status into order_payment_status
  from public.orders o
  where o.id = target_order_id;

  if order_payment_status is null then
    raise exception 'Order not found';
  end if;

  if order_payment_status <> 'paid' then
    raise exception 'Cannot reserve inventory for an order that is not paid (current status: %)', order_payment_status;
  end if;

  if exists (
    select 1
    from public.inventory_movements m
    where m.order_id = target_order_id
      and m.movement_type = 'out'
  ) then
    return jsonb_build_object(
      'ok', true,
      'skipped', true,
      'reason', 'already_reserved'
    );
  end if;

  -- Lock the affected inventory rows up front so concurrent reservations against the
  -- same SKU can't both pass the stock check before either decrements (TOCTOU fix).
  perform 1
  from public.inventory_items ii
  where ii.id in (
    select pir.inventory_item_id
    from public.order_items oi
    join public.product_inventory_requirements pir on pir.product_id = oi.product_id
    where oi.order_id = target_order_id
      and oi.deleted_at is null
  )
  for update;

  for req_rec in
    select
      oi.order_id,
      oi.product_id,
      oi.quantity as order_quantity,
      pir.inventory_item_id,
      pir.quantity_required,
      ii.item as inventory_item_name,
      ii.stock as current_stock
    from public.order_items oi
    join public.product_inventory_requirements pir
      on pir.product_id = oi.product_id
    join public.inventory_items ii
      on ii.id = pir.inventory_item_id
    where oi.order_id = target_order_id
      and oi.deleted_at is null
  loop
    if coalesce(req_rec.current_stock, 0) < (coalesce(req_rec.order_quantity, 0) * coalesce(req_rec.quantity_required, 0)) then
      raise exception 'Insufficient stock for %, available %, needed %',
        req_rec.inventory_item_name,
        coalesce(req_rec.current_stock, 0),
        (coalesce(req_rec.order_quantity, 0) * coalesce(req_rec.quantity_required, 0));
    end if;
  end loop;

  for req_rec in
    select
      oi.order_id,
      oi.product_id,
      oi.quantity as order_quantity,
      pir.inventory_item_id,
      pir.quantity_required,
      ii.item as inventory_item_name
    from public.order_items oi
    join public.product_inventory_requirements pir
      on pir.product_id = oi.product_id
    join public.inventory_items ii
      on ii.id = pir.inventory_item_id
    where oi.order_id = target_order_id
      and oi.deleted_at is null
  loop
    insert into public.inventory_movements (
      inventory_item_id,
      movement_type,
      quantity,
      reason,
      order_id,
      created_at
    ) values (
      req_rec.inventory_item_id,
      'out',
      (coalesce(req_rec.order_quantity, 0) * coalesce(req_rec.quantity_required, 0)),
      format('Reserva automática por orden %s', target_order_id),
      target_order_id,
      now()
    );

    update public.inventory_items
    set stock = stock - (coalesce(req_rec.order_quantity, 0) * coalesce(req_rec.quantity_required, 0))
    where id = req_rec.inventory_item_id;

    reserved_count := reserved_count + 1;
  end loop;

  insert into public.audit_log (
    actor_user_id,
    entity_type,
    entity_id,
    action,
    context,
    created_at
  ) values (
    actor_id,
    'order',
    target_order_id,
    'inventory_reserved',
    jsonb_build_object('reserved_rows', reserved_count),
    now()
  );

  return jsonb_build_object(
    'ok', true,
    'skipped', false,
    'reserved_rows', reserved_count
  );
end;
$$;

commit;
