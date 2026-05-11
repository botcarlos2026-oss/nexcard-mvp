begin;

create or replace function public.insert_order_history_entry(
  p_order_id uuid,
  p_field text,
  p_old_value text,
  p_new_value text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_old_value is distinct from p_new_value then
    insert into public.order_status_history (order_id, field, old_value, new_value)
    values (p_order_id, p_field, p_old_value, p_new_value);
  end if;
end;
$$;

revoke all on function public.insert_order_history_entry(uuid, text, text, text) from public;
grant execute on function public.insert_order_history_entry(uuid, text, text, text) to authenticated, service_role;

create or replace function public.admin_transition_order_state(
  target_order_id uuid,
  next_payment_status text default null,
  next_fulfillment_status text default null,
  reason text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_order public.orders%rowtype;
  desired_payment text;
  desired_fulfillment text;
  delivered_at_value timestamptz;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.has_role('admin') then
    raise exception 'Solo administradores pueden cambiar estados de órdenes';
  end if;

  if next_payment_status is null and next_fulfillment_status is null then
    raise exception 'Debes indicar al menos un cambio de estado';
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
    raise exception 'No puedes modificar una orden archivada';
  end if;

  desired_payment := current_order.payment_status;
  desired_fulfillment := current_order.fulfillment_status;
  delivered_at_value := current_order.delivered_at;

  if next_payment_status is not null and next_payment_status is distinct from current_order.payment_status then
    if next_payment_status not in ('pending', 'paid', 'failed', 'cancelled', 'refunded') then
      raise exception 'Estado de pago inválido: %', next_payment_status;
    end if;

    case current_order.payment_status
      when 'pending' then
        if next_payment_status not in ('paid', 'failed', 'cancelled') then
          raise exception 'Transición de pago no permitida: % -> %', current_order.payment_status, next_payment_status;
        end if;
      when 'failed' then
        if next_payment_status not in ('pending', 'cancelled') then
          raise exception 'Transición de pago no permitida: % -> %', current_order.payment_status, next_payment_status;
        end if;
      when 'cancelled' then
        raise exception 'La orden está cancelada; no se puede cambiar el estado de pago';
      when 'paid' then
        if next_payment_status <> 'refunded' then
          raise exception 'Una orden pagada solo puede pasar a refunded';
        end if;
      when 'refunded' then
        raise exception 'La orden ya fue reembolsada';
      else
        raise exception 'Estado de pago actual no soportado: %', current_order.payment_status;
    end case;

    desired_payment := next_payment_status;
  end if;

  if next_fulfillment_status is not null and next_fulfillment_status is distinct from current_order.fulfillment_status then
    if next_fulfillment_status not in ('new', 'in_production', 'ready', 'shipped', 'delivered', 'cancelled') then
      raise exception 'Estado operativo inválido: %', next_fulfillment_status;
    end if;

    case current_order.fulfillment_status
      when 'new' then
        if next_fulfillment_status not in ('in_production', 'cancelled') then
          raise exception 'Transición operativa no permitida: % -> %', current_order.fulfillment_status, next_fulfillment_status;
        end if;
      when 'in_production' then
        if next_fulfillment_status not in ('ready', 'cancelled') then
          raise exception 'Transición operativa no permitida: % -> %', current_order.fulfillment_status, next_fulfillment_status;
        end if;
      when 'ready' then
        if next_fulfillment_status = 'shipped' then
          raise exception 'Para pasar a shipped usa admin_dispatch_order()';
        end if;
        if next_fulfillment_status not in ('cancelled') then
          raise exception 'Transición operativa no permitida: % -> %', current_order.fulfillment_status, next_fulfillment_status;
        end if;
      when 'shipped' then
        if next_fulfillment_status <> 'delivered' then
          raise exception 'Transición operativa no permitida: % -> %', current_order.fulfillment_status, next_fulfillment_status;
        end if;
      when 'delivered' then
        raise exception 'La orden ya fue entregada';
      when 'cancelled' then
        raise exception 'La orden ya está cancelada';
      else
        raise exception 'Estado operativo actual no soportado: %', current_order.fulfillment_status;
    end case;

    if next_fulfillment_status in ('in_production', 'ready', 'shipped', 'delivered') and desired_payment <> 'paid' then
      raise exception 'La orden debe estar pagada antes de avanzar a %', next_fulfillment_status;
    end if;

    if next_fulfillment_status = 'delivered' and delivered_at_value is null then
      delivered_at_value := now();
    elsif next_fulfillment_status <> 'delivered' then
      delivered_at_value := current_order.delivered_at;
    end if;

    desired_fulfillment := next_fulfillment_status;
  end if;

  if desired_payment = current_order.payment_status and desired_fulfillment = current_order.fulfillment_status then
    raise exception 'La orden ya está en el estado solicitado';
  end if;

  perform set_config('app.order_transition_bypass', 'true', true);

  update public.orders
  set payment_status = desired_payment,
      fulfillment_status = desired_fulfillment,
      delivered_at = delivered_at_value,
      updated_at = now()
  where id = target_order_id;

  perform public.insert_order_history_entry(target_order_id, 'payment_status', current_order.payment_status, desired_payment);
  perform public.insert_order_history_entry(target_order_id, 'fulfillment_status', current_order.fulfillment_status, desired_fulfillment);
  perform public.insert_order_history_entry(target_order_id, 'delivered_at', coalesce(current_order.delivered_at::text, ''), coalesce(delivered_at_value::text, ''));

  return jsonb_build_object(
    'order_id', target_order_id,
    'payment_status', desired_payment,
    'fulfillment_status', desired_fulfillment,
    'reason', reason
  );
end;
$$;

revoke all on function public.admin_transition_order_state(uuid, text, text, text) from public;
grant execute on function public.admin_transition_order_state(uuid, text, text, text) to authenticated, service_role;

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
      updated_at = now()
  where id = target_order_id;

  perform public.insert_order_history_entry(target_order_id, 'carrier', coalesce(current_order.carrier, ''), normalized_carrier);
  perform public.insert_order_history_entry(target_order_id, 'tracking_code', coalesce(current_order.tracking_code, ''), normalized_tracking);
  perform public.insert_order_history_entry(target_order_id, 'fulfillment_status', current_order.fulfillment_status, 'shipped');
  perform public.insert_order_history_entry(target_order_id, 'shipped_at', coalesce(current_order.shipped_at::text, ''), coalesce(shipped_at_value::text, ''));
  perform public.insert_order_history_entry(target_order_id, 'inventory_reserved', coalesce(current_order.inventory_reserved::text, ''), 'true');
  perform public.insert_order_history_entry(target_order_id, 'inventory_decremented', coalesce(current_order.inventory_decremented::text, ''), 'true');

  return jsonb_build_object(
    'order_id', target_order_id,
    'carrier', normalized_carrier,
    'tracking_code', normalized_tracking,
    'fulfillment_status', 'shipped',
    'items_decremented', items_decremented
  );
end;
$$;

revoke all on function public.admin_dispatch_order(uuid, text, text) from public;
grant execute on function public.admin_dispatch_order(uuid, text, text) to authenticated, service_role;

drop policy if exists orders_authenticated_update on public.orders;
drop policy if exists orders_admin_update on public.orders;
create policy "orders_admin_update"
on public.orders for update to authenticated
using (public.has_role('admin'))
with check (public.has_role('admin'));

commit;
