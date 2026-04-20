begin;

create or replace function decrement_stock(
  p_item_id uuid,
  p_quantity integer,
  p_reason text default null,
  p_order_id uuid default null
) returns void
language plpgsql
security definer
as $$
begin
  update inventory_items
  set
    stock      = stock - p_quantity,
    updated_at = now()
  where id = p_item_id
    and stock >= p_quantity;

  if not found then
    raise exception 'Stock insuficiente para el insumo con id: %', p_item_id;
  end if;

  insert into inventory_movements (
    inventory_item_id,
    movement_type,
    quantity,
    reason,
    order_id
  ) values (
    p_item_id,
    'out',
    p_quantity,
    p_reason,
    p_order_id
  );
end;
$$;

grant execute on function decrement_stock(uuid, integer, text, uuid) to authenticated;
grant execute on function decrement_stock(uuid, integer, text, uuid) to service_role;

commit;
