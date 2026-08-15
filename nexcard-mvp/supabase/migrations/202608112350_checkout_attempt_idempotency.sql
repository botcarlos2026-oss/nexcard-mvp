-- NexCard — Server-side checkout attempt idempotency
-- Prevents double-submit/retry from creating duplicate active orders for the same checkout attempt.

begin;

alter table public.orders
  add column if not exists client_checkout_attempt_id text,
  add column if not exists client_checkout_fingerprint text;

drop view if exists public.profiles_public;
drop policy if exists "profiles_public_read" on public.profiles;

create view public.profiles_public
with (security_barrier = true)
as
select
  id,
  slug,
  full_name,
  profession,
  bio,
  avatar_url,
  theme_color,
  is_dark_mode,
  whatsapp,
  instagram,
  linkedin,
  website,
  vcard_enabled,
  calendar_url,
  account_type,
  company,
  location,
  cover_image_url,
  facebook,
  facebook_enabled,
  instagram_enabled,
  linkedin_enabled,
  contact_email_enabled,
  contact_phone_enabled,
  website_enabled,
  whatsapp_enabled,
  portfolio_enabled,
  portfolio_url,
  calendar_url_enabled,
  tiktok,
  tiktok_enabled,
  review_url,
  card_type,
  status,
  deleted_at
from public.profiles
where coalesce(status, 'active') = 'active'
  and deleted_at is null;

revoke all on public.profiles_public from public;
grant select on public.profiles_public to anon, authenticated;

create unique index if not exists orders_client_checkout_attempt_active_unique
  on public.orders (client_checkout_attempt_id)
  where deleted_at is null
    and client_checkout_attempt_id is not null;

create or replace function public.create_order_with_items(
  p_order jsonb,
  p_items jsonb
) returns uuid
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
  v_checkout_attempt_id text := nullif(trim(p_order->>'client_checkout_attempt_id'), '');
  v_checkout_fingerprint text := nullif(trim(p_order->>'client_checkout_fingerprint'), '');
  v_item jsonb;
  v_product record;
  v_qty integer;
  v_prize_type text;
  v_prize_value integer;
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

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La orden debe tener al menos un producto';
  end if;

  if not public.is_valid_profile_slug(v_desired_slug) then
    raise exception 'Debes reservar un usuario público válido para tu NexCard' using errcode = 'P0001';
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
    select wp.type, wp.value
      into v_prize_type, v_prize_value
    from public.wheel_spins ws
    join public.wheel_prizes wp on wp.id = ws.prize_id
    where upper(wp.coupon_code) = v_coupon_code
      and coalesce(wp.active, true) = true
      and coalesce(ws.redeemed, false) = false
    order by ws.spun_at asc
    limit 1;

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
    auth.uid(),
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
    coalesce((p_order->>'requires_invoice')::boolean, false),
    nullif(trim(p_order->>'invoice_rut'), ''),
    nullif(trim(p_order->>'invoice_razon_social'), '')
  )
  returning id into v_order_id;

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

grant execute on function public.create_order_with_items(jsonb, jsonb) to anon;
grant execute on function public.create_order_with_items(jsonb, jsonb) to authenticated;

commit;
