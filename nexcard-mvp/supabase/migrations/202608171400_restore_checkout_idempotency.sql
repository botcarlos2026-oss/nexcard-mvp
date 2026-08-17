-- NexCard — Restore checkout double-submit idempotency in create_order_with_items().
--
-- 202608120001_claude_security_audit_hardening.sql (deployed 11 minutes after
-- 202608112350_checkout_attempt_idempotency.sql) did `CREATE OR REPLACE FUNCTION
-- create_order_with_items(...)` and, without intending to, dropped the
-- client_checkout_attempt_id / client_checkout_fingerprint dedup logic that the
-- idempotency migration had just added. The frontend
-- (src/services/api/orders.js) still generates and sends both fields on every
-- checkout call, but the function in production silently ignores them —
-- meaning a network retry or double-click on "pay" can create two separate
-- paid orders for the same cart right now.
--
-- This re-adds the idempotency check on top of the current (newer, hardened)
-- function body — invoice/RUT validation and the `for update` coupon lock
-- added by the security-hardening migration are preserved unchanged.

begin;

create or replace function public.create_order_with_items(
  p_order jsonb,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_existing_order record;
  v_subtotal integer := 0;
  v_discount integer := 0;
  v_total integer := 0;
  v_coupon_code text := upper(nullif(trim(p_order->>'coupon_code'), ''));
  v_desired_slug text := public.normalize_profile_slug(p_order->>'desired_profile_slug');
  v_requires_invoice boolean := coalesce((p_order->>'requires_invoice')::boolean, false);
  v_invoice_rut text := nullif(trim(p_order->>'invoice_rut'), '');
  v_invoice_razon_social text := nullif(trim(p_order->>'invoice_razon_social'), '');
  v_checkout_attempt_id text := nullif(trim(p_order->>'client_checkout_attempt_id'), '');
  v_checkout_fingerprint text := nullif(trim(p_order->>'client_checkout_fingerprint'), '');
  v_item jsonb;
  v_product record;
  v_qty integer;
  v_prize_type text;
  v_prize_value integer;
  v_spin_id uuid;
begin
  if v_checkout_attempt_id is null or v_checkout_fingerprint is null then
    raise exception 'Intento de checkout inválido' using errcode = 'P0001';
  end if;

  select id, client_checkout_fingerprint, payment_status
    into v_existing_order
  from public.orders
  where client_checkout_attempt_id = v_checkout_attempt_id
    and deleted_at is null
  limit 1;

  if found then
    if v_existing_order.client_checkout_fingerprint is distinct from v_checkout_fingerprint then
      raise exception 'Intento de checkout no pertenece a esta sesión' using errcode = 'P0001';
    end if;
    if coalesce(v_existing_order.payment_status, 'pending') not in ('pending', 'failed') then
      raise exception 'La orden existente no permite reintentar checkout' using errcode = 'P0001';
    end if;
    return v_existing_order.id;
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La orden no contiene productos';
  end if;

  if nullif(trim(p_order->>'customer_name'), '') is null then
    raise exception 'Nombre de cliente requerido';
  end if;

  if nullif(trim(p_order->>'customer_email'), '') is null then
    raise exception 'Email de cliente requerido';
  end if;

  if v_desired_slug is null then
    raise exception 'Usuario público requerido';
  end if;

  if v_requires_invoice then
    if v_invoice_rut is null then
      raise exception 'RUT de factura requerido';
    end if;
    if not public.is_valid_chilean_rut(v_invoice_rut) then
      raise exception 'RUT de factura inválido';
    end if;
    if v_invoice_razon_social is null then
      raise exception 'Razón social de factura requerida';
    end if;
  elsif v_invoice_rut is not null and not public.is_valid_chilean_rut(v_invoice_rut) then
    raise exception 'RUT de factura inválido';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    if nullif(v_item->>'product_id', '') is null then
      raise exception 'Producto inválido en la orden';
    end if;

    v_qty := greatest(coalesce((v_item->>'quantity')::integer, 0), 0);
    if v_qty <= 0 then
      raise exception 'Cantidad inválida para producto %', v_item->>'product_id';
    end if;

    select id, price_cents, status, deleted_at
      into v_product
    from public.products
    where id = (v_item->>'product_id')::uuid;

    if not found or v_product.deleted_at is not null or coalesce(v_product.status, 'active') <> 'active' then
      raise exception 'Producto no disponible: %', v_item->>'product_id';
    end if;

    v_subtotal := v_subtotal + (coalesce(v_product.price_cents, 0) * v_qty);
  end loop;

  if v_coupon_code is not null then
    select ws.id, wp.type, wp.value
      into v_spin_id, v_prize_type, v_prize_value
    from public.wheel_spins ws
    join public.wheel_prizes wp on wp.id = ws.prize_id
    where upper(ws.generated_coupon_code) = v_coupon_code
      and coalesce(wp.active, true) = true
      and coalesce(ws.redeemed, false) = false
    order by ws.spun_at asc
    limit 1
    for update of ws;

    if not found then
      raise exception 'Cupón inválido o ya utilizado';
    end if;

    if v_prize_type = 'discount_percent' then
      v_discount := round(v_subtotal * (greatest(v_prize_value, 0)::numeric / 100.0));
    elsif v_prize_type = 'discount_amount' then
      v_discount := least(greatest(v_prize_value, 0), v_subtotal);
    else
      v_discount := 0;
    end if;
  end if;

  v_total := greatest(v_subtotal - v_discount, 0);
  if v_total <= 0 then
    raise exception 'Monto final inválido para la orden';
  end if;

  insert into public.orders (
    user_id,
    client_checkout_attempt_id,
    client_checkout_fingerprint,
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
    nullif(p_order->>'user_id', '')::uuid,
    v_checkout_attempt_id,
    v_checkout_fingerprint,
    trim(p_order->>'customer_name'),
    lower(trim(p_order->>'customer_email')),
    nullif(trim(p_order->>'customer_phone'), ''),
    nullif(trim(p_order->>'customer_address'), ''),
    p_order->>'payment_method',
    'pending',
    'new',
    v_total,
    coalesce(p_order->>'currency', 'CLP'),
    coalesce(p_order->'card_customization', '{}'::jsonb) || jsonb_build_object('desired_slug', v_desired_slug),
    v_requires_invoice,
    v_invoice_rut,
    v_invoice_razon_social
  )
  returning id into v_order_id;

  if v_spin_id is not null then
    update public.wheel_spins
      set redeemed = true,
          redeemed_at = now(),
          order_id = v_order_id
    where id = v_spin_id
      and coalesce(redeemed, false) = false;

    if not found then
      raise exception 'Cupón inválido o ya utilizado';
    end if;
  end if;

  perform public.reserve_profile_slug_for_order(
    v_order_id,
    v_desired_slug,
    lower(trim(p_order->>'customer_email')),
    interval '2 hours'
  );

  insert into public.order_items (order_id, product_id, quantity, unit_price_cents, currency)
  select
    v_order_id,
    p.id,
    greatest(coalesce((item->>'quantity')::integer, 0), 1),
    p.price_cents,
    coalesce(item->>'currency', p_order->>'currency', 'CLP')
  from jsonb_array_elements(p_items) as item
  join public.products p on p.id = (item->>'product_id')::uuid
  where p.deleted_at is null
    and coalesce(p.status, 'active') = 'active';

  return v_order_id;
end;
$$;

grant execute on function public.create_order_with_items(jsonb, jsonb) to anon, authenticated;

commit;
