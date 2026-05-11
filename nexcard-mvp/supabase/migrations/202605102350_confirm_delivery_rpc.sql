begin;

create or replace function public.confirm_order_delivery_by_token(
  target_order_id uuid,
  provided_delivery_token uuid,
  confirmed_by text default 'customer'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_order public.orders%rowtype;
  delivered_at_value timestamptz := now();
begin
  if confirmed_by not in ('customer', 'admin', 'carrier_webhook') then
    raise exception 'confirmed_by inválido: %', confirmed_by;
  end if;

  select *
  into current_order
  from public.orders
  where id = target_order_id
    and delivery_token = provided_delivery_token
  for update;

  if not found then
    raise exception 'Orden o token inválido';
  end if;

  if current_order.deleted_at is not null then
    raise exception 'No puedes confirmar una orden archivada';
  end if;

  if current_order.delivery_token_expires_at is not null
     and current_order.delivery_token_expires_at < now() then
    raise exception 'El token de entrega expiró';
  end if;

  if current_order.delivered_at is not null or current_order.delivery_confirmed_by is not null then
    return jsonb_build_object(
      'status', 'already_confirmed',
      'order_id', current_order.id,
      'fulfillment_status', current_order.fulfillment_status,
      'delivered_at', current_order.delivered_at,
      'delivery_confirmed_by', current_order.delivery_confirmed_by
    );
  end if;

  if current_order.fulfillment_status <> 'shipped' then
    raise exception 'La orden no está en estado despachado';
  end if;

  perform set_config('app.order_transition_bypass', 'true', true);

  update public.orders
  set fulfillment_status = 'delivered',
      delivered_at = delivered_at_value,
      delivery_confirmed_by = confirmed_by,
      updated_at = delivered_at_value
  where id = target_order_id;

  perform public.insert_order_history_entry(target_order_id, 'fulfillment_status', current_order.fulfillment_status, 'delivered');
  perform public.insert_order_history_entry(target_order_id, 'delivered_at', coalesce(current_order.delivered_at::text, ''), delivered_at_value::text);
  perform public.insert_order_history_entry(target_order_id, 'delivery_confirmed_by', coalesce(current_order.delivery_confirmed_by, ''), confirmed_by);

  return jsonb_build_object(
    'status', 'success',
    'order_id', current_order.id,
    'fulfillment_status', 'delivered',
    'delivered_at', delivered_at_value,
    'delivery_confirmed_by', confirmed_by,
    'customer_name', current_order.customer_name
  );
end;
$$;

revoke all on function public.confirm_order_delivery_by_token(uuid, uuid, text) from public;
grant execute on function public.confirm_order_delivery_by_token(uuid, uuid, text) to anon, authenticated, service_role;

commit;
