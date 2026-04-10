-- NexCard - siguiente paso recomendado para endurecer inventario
-- Objetivo: dejar lista una ruta SQL real para
-- 1) reserva transaccional de stock por order_id
-- 2) soporte explícito de sku en inventory_items
--
-- Este archivo no se aplica automáticamente desde la app.
-- Queda como siguiente migración recomendada para Supabase SQL editor / migrations.

begin;

alter table public.inventory_items
  add column if not exists sku text;

create index if not exists idx_inventory_items_sku
  on public.inventory_items (sku);

create or replace function public.reserve_inventory_for_order(
  target_order_id uuid,
  actor_id uuid default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  order_rec record;
  item_rec record;
  inv_rec record;
  reserved_count integer := 0;
begin
  if target_order_id is null then
    raise exception 'target_order_id is required';
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

  for item_rec in
    select *
    from public.order_items
    where order_id = target_order_id
      and deleted_at is null
  loop
    select *
      into inv_rec
    from public.inventory_items i
    where (
      item_rec.sku is not null
      and i.sku = item_rec.sku
    )
    or (
      item_rec.sku is null
      and item_rec.product_name is not null
      and lower(i.item) = lower(item_rec.product_name)
    )
    order by case when item_rec.sku is not null and i.sku = item_rec.sku then 0 else 1 end
    limit 1;

    if inv_rec.id is null then
      raise exception 'No inventory match for order item %', coalesce(item_rec.sku, item_rec.product_name, item_rec.product_id::text);
    end if;

    if coalesce(inv_rec.stock, 0) < coalesce(item_rec.quantity, 0) then
      raise exception 'Insufficient stock for %, available %, needed %', inv_rec.item, coalesce(inv_rec.stock, 0), coalesce(item_rec.quantity, 0);
    end if;

    insert into public.inventory_movements (
      inventory_item_id,
      movement_type,
      quantity,
      reason,
      order_id,
      created_at
    ) values (
      inv_rec.id,
      'out',
      coalesce(item_rec.quantity, 0),
      format('Reserva automática por orden %s', target_order_id),
      target_order_id,
      now()
    );

    update public.inventory_items
    set stock = stock - coalesce(item_rec.quantity, 0)
    where id = inv_rec.id;

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
    jsonb_build_object('reserved_items', reserved_count),
    now()
  );

  return jsonb_build_object(
    'ok', true,
    'skipped', false,
    'reserved_items', reserved_count
  );
end;
$$;

commit;
