begin;

-- Normalize drifted dispatch_config schemas. The canonical migrations use
-- inventory_item_id, but some deployed DBs still have only sku; backfill the
-- relation once from inventory_items.sku before replacing admin_dispatch_order.
alter table public.dispatch_config
  add column if not exists inventory_item_id uuid references public.inventory_items(id) on delete cascade;

-- Backfill only when the legacy sku column exists.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'dispatch_config'
      and column_name = 'sku'
  ) then
    execute $sql$
      update public.dispatch_config dc
      set inventory_item_id = ii.id
      from public.inventory_items ii
      where dc.inventory_item_id is null
        and ii.sku = dc.sku
    $sql$;
  end if;
end;
$$;

-- Fail closed if an active dispatch row cannot be tied to inventory.
do $$
begin
  if exists (
    select 1
    from public.dispatch_config
    where active = true
      and inventory_item_id is null
  ) then
    raise exception 'dispatch_config active rows require inventory_item_id before admin_dispatch_order can be fixed';
  end if;
end;
$$;

alter table public.dispatch_config
  alter column inventory_item_id set not null;

-- Fix 1: use the real relation dispatch_config.inventory_item_id ->
-- inventory_items.id. Recreate the latest admin_dispatch_order implementation using that relation for
-- validation, stock decrement, movement logging, and response metadata.
create or replace function public.admin_dispatch_order(
  target_order_id uuid,
  p_carrier text,
  p_tracking_code text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_order public.orders%rowtype;
  cfg record;
  inventory_row public.inventory_items%rowtype;
  normalized_carrier text := lower(trim(coalesce(p_carrier, '')));
  normalized_tracking text := upper(trim(coalesce(p_tracking_code, '')));
  items_decremented jsonb := '[]'::jsonb;
  shipped_at_value timestamptz := now();
  new_delivery_token uuid := gen_random_uuid();
  new_delivery_token_expires_at timestamptz := now() + interval '45 days';
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.has_role('admin') then
    raise exception 'Solo administradores pueden despachar órdenes';
  end if;

  if normalized_carrier not in ('blueexpress', 'chilexpress', 'starken', 'correos', 'dhl', 'fedex', 'manual') then
    raise exception 'Carrier inválido: %', p_carrier;
  end if;

  if normalized_tracking = '' or length(normalized_tracking) < 4 then
    raise exception 'Código de seguimiento inválido';
  end if;

  if normalized_tracking !~ '^[A-Z0-9-]+$' then
    raise exception 'El código de seguimiento solo puede contener letras, números y guiones';
  end if;

  select *
  into current_order
  from public.orders
  where id = target_order_id
  for update;

  if not found then
    raise exception 'Orden no encontrada';
  end if;

  if current_order.deleted_at is not null then
    raise exception 'No puedes despachar una orden archivada';
  end if;

  if current_order.payment_status <> 'paid' then
    raise exception 'Solo puedes despachar órdenes pagadas';
  end if;

  if current_order.fulfillment_status <> 'ready' then
    raise exception 'Solo puedes despachar órdenes en estado ready';
  end if;

  if coalesce(current_order.inventory_decremented, false) then
    raise exception 'Esta orden ya descontó stock; no se puede despachar dos veces';
  end if;

  for cfg in
    select dc.*
    from public.dispatch_config dc
    join public.inventory_items ii on ii.id = dc.inventory_item_id
    where dc.active = true
    order by coalesce(ii.sku, ii.item, ii.name), dc.id
  loop
    select *
    into inventory_row
    from public.inventory_items
    where id = cfg.inventory_item_id
    for update;

    if not found then
      raise exception 'Dispatch config apunta a inventario inexistente: %', cfg.inventory_item_id;
    end if;

    if coalesce(inventory_row.stock, 0) < cfg.quantity_per_dispatch then
      raise exception 'Stock insuficiente para "%": disponible %, requerido %', coalesce(inventory_row.item, inventory_row.name, inventory_row.sku), coalesce(inventory_row.stock, 0), cfg.quantity_per_dispatch;
    end if;
  end loop;

  for cfg in
    select dc.*
    from public.dispatch_config dc
    join public.inventory_items ii on ii.id = dc.inventory_item_id
    where dc.active = true
    order by coalesce(ii.sku, ii.item, ii.name), dc.id
  loop
    update public.inventory_items
    set stock = stock - cfg.quantity_per_dispatch,
        updated_at = now()
    where id = cfg.inventory_item_id
    returning * into inventory_row;

    insert into public.inventory_movements (
      inventory_item_id,
      movement_type,
      quantity,
      reason,
      order_id
    ) values (
      inventory_row.id,
      'out',
      cfg.quantity_per_dispatch,
      format('Despacho orden %s', target_order_id),
      target_order_id
    );

    items_decremented := items_decremented || jsonb_build_array(jsonb_build_object(
      'inventory_item_id', inventory_row.id,
      'sku', inventory_row.sku,
      'name', coalesce(inventory_row.item, inventory_row.name, inventory_row.sku),
      'quantity', cfg.quantity_per_dispatch,
      'remaining_stock', inventory_row.stock
    ));
  end loop;

  shipped_at_value := coalesce(current_order.shipped_at, now());
  new_delivery_token_expires_at := shipped_at_value + interval '45 days';

  perform set_config('app.order_transition_bypass', 'true', true);

  update public.orders
  set carrier = normalized_carrier,
      tracking_code = normalized_tracking,
      fulfillment_status = 'shipped',
      shipped_at = shipped_at_value,
      inventory_reserved = true,
      inventory_reserved_at = coalesce(current_order.inventory_reserved_at, now()),
      inventory_decremented = true,
      inventory_decremented_at = now(),
      delivery_token = new_delivery_token,
      delivery_token_expires_at = new_delivery_token_expires_at,
      updated_at = now()
  where id = target_order_id;

  perform public.insert_order_history_entry(target_order_id, 'carrier', coalesce(current_order.carrier, ''), normalized_carrier);
  perform public.insert_order_history_entry(target_order_id, 'tracking_code', coalesce(current_order.tracking_code, ''), normalized_tracking);
  perform public.insert_order_history_entry(target_order_id, 'fulfillment_status', current_order.fulfillment_status, 'shipped');
  perform public.insert_order_history_entry(target_order_id, 'shipped_at', coalesce(current_order.shipped_at::text, ''), coalesce(shipped_at_value::text, ''));
  perform public.insert_order_history_entry(target_order_id, 'inventory_reserved', coalesce(current_order.inventory_reserved::text, ''), 'true');
  perform public.insert_order_history_entry(target_order_id, 'inventory_decremented', coalesce(current_order.inventory_decremented::text, ''), 'true');
  perform public.insert_order_history_entry(target_order_id, 'delivery_token', coalesce(current_order.delivery_token::text, ''), new_delivery_token::text);
  perform public.insert_order_history_entry(target_order_id, 'delivery_token_expires_at', coalesce(current_order.delivery_token_expires_at::text, ''), new_delivery_token_expires_at::text);

  return jsonb_build_object(
    'order_id', target_order_id,
    'carrier', normalized_carrier,
    'tracking_code', normalized_tracking,
    'fulfillment_status', 'shipped',
    'delivery_token', new_delivery_token,
    'delivery_token_expires_at', new_delivery_token_expires_at,
    'items_decremented', items_decremented
  );
end;
$$;

revoke all on function public.admin_dispatch_order(uuid, text, text) from public;
grant execute on function public.admin_dispatch_order(uuid, text, text) to authenticated, service_role;

-- Fix 2: avoid PL/pgSQL ambiguity in the retry UPDATE branch. Call-sites pass
-- arguments positionally, so renaming customer_email -> p_customer_email keeps
-- the function signature unchanged while making references explicit. PostgreSQL
-- requires dropping the function before changing input parameter names.
drop function if exists public.reserve_profile_slug_for_order(uuid, text, text, interval);

create or replace function public.reserve_profile_slug_for_order(
  target_order_id uuid,
  candidate_slug text,
  p_customer_email text,
  reserve_for interval default interval '2 hours'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text := public.normalize_profile_slug(candidate_slug);
  availability jsonb;
  existing_reservation public.profile_slug_reservations%rowtype;
begin
  availability := public.check_profile_slug_availability(normalized, target_order_id);
  if coalesce((availability->>'available')::boolean, false) is not true then
    raise exception '%', availability->>'message' using errcode = 'P0001';
  end if;

  delete from public.profile_slug_reservations
  where slug = normalized
    and status in ('expired', 'released');

  select * into existing_reservation
  from public.profile_slug_reservations
  where order_id = target_order_id
  for update;

  if existing_reservation.id is not null then
    if existing_reservation.status = 'consumed' then
      raise exception 'La reserva de usuario ya fue consumida para esta orden' using errcode = 'P0001';
    end if;

    update public.profile_slug_reservations
    set slug = normalized,
        customer_email = lower(trim(p_customer_email)),
        status = 'reserved',
        expires_at = now() + reserve_for,
        consumed_at = null,
        released_at = null,
        updated_at = now()
    where id = existing_reservation.id;
  else
    insert into public.profile_slug_reservations(slug, order_id, customer_email, expires_at)
    values (normalized, target_order_id, lower(trim(p_customer_email)), now() + reserve_for);
  end if;

  return jsonb_build_object(
    'reserved', true,
    'slug', normalized,
    'order_id', target_order_id,
    'expires_at', now() + reserve_for
  );
end;
$$;

revoke all on function public.reserve_profile_slug_for_order(uuid, text, text, interval) from public;
grant execute on function public.reserve_profile_slug_for_order(uuid, text, text, interval) to service_role;

commit;
