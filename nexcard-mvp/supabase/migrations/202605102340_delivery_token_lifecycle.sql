begin;

alter table public.orders
  add column if not exists delivery_token_expires_at timestamptz;

update public.orders
set delivery_token_expires_at = coalesce(
  delivery_token_expires_at,
  case
    when shipped_at is not null then shipped_at + interval '45 days'
    when delivered_at is not null then delivered_at + interval '45 days'
    else now() + interval '45 days'
  end
)
where delivery_token is not null
  and delivery_token_expires_at is null;

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
    select *
    from public.dispatch_config
    where active = true
    order by sku
  loop
    select *
    into inventory_row
    from public.inventory_items
    where sku = cfg.sku
    for update;

    if not found then
      raise exception 'Dispatch config apunta a SKU inexistente: %', cfg.sku;
    end if;

    if coalesce(inventory_row.stock, 0) < cfg.quantity_per_dispatch then
      raise exception 'Stock insuficiente para "%": disponible %, requerido %', coalesce(inventory_row.item, inventory_row.name, inventory_row.sku), coalesce(inventory_row.stock, 0), cfg.quantity_per_dispatch;
    end if;
  end loop;

  for cfg in
    select *
    from public.dispatch_config
    where active = true
    order by sku
  loop
    update public.inventory_items
    set stock = stock - cfg.quantity_per_dispatch,
        updated_at = now()
    where sku = cfg.sku;

    select *
    into inventory_row
    from public.inventory_items
    where sku = cfg.sku;

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
      'sku', cfg.sku,
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

commit;
