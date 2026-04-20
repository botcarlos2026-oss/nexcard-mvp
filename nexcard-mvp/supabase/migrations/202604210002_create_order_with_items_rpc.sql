begin;

create or replace function create_order_with_items(
  p_order jsonb,
  p_items jsonb
) returns uuid
language plpgsql
security definer
as $$
declare
  v_order_id uuid;
begin
  insert into orders (
    user_id,
    customer_name,
    customer_email,
    customer_phone,
    customer_address,
    payment_method,
    payment_status,
    fulfillment_status,
    amount_cents,
    currency,
    card_customization,
    requires_invoice,
    invoice_rut,
    invoice_razon_social
  ) values (
    (p_order->>'user_id')::uuid,
    p_order->>'customer_name',
    p_order->>'customer_email',
    p_order->>'customer_phone',
    p_order->>'customer_address',
    p_order->>'payment_method',
    'pending',
    'new',
    (p_order->>'amount_cents')::integer,
    coalesce(p_order->>'currency', 'CLP'),
    p_order->'card_customization',
    coalesce((p_order->>'requires_invoice')::boolean, false),
    p_order->>'invoice_rut',
    p_order->>'invoice_razon_social'
  )
  returning id into v_order_id;

  insert into order_items (order_id, product_id, quantity, unit_price_cents, currency)
  select
    v_order_id,
    (item->>'product_id')::uuid,
    (item->>'quantity')::integer,
    (item->>'unit_price_cents')::integer,
    coalesce(item->>'currency', 'CLP')
  from jsonb_array_elements(p_items) as item;

  return v_order_id;
end;
$$;

grant execute on function create_order_with_items(jsonb, jsonb) to anon;
grant execute on function create_order_with_items(jsonb, jsonb) to authenticated;

commit;
