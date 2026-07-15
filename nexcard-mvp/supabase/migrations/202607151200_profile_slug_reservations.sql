begin;

create extension if not exists unaccent with schema public;

create table if not exists public.profile_slug_reservations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  order_id uuid not null unique references public.orders(id) on delete cascade,
  customer_email text not null,
  status text not null default 'reserved' check (status in ('reserved', 'consumed', 'released', 'expired')),
  profile_id uuid null references public.profiles(id) on delete set null,
  reserved_by_user_id uuid null references auth.users(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '2 hours'),
  consumed_at timestamptz null,
  released_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profile_slug_reservations_order_id_idx
  on public.profile_slug_reservations(order_id);
create index if not exists profile_slug_reservations_active_idx
  on public.profile_slug_reservations(slug, status, expires_at);

alter table public.profile_slug_reservations enable row level security;

drop policy if exists profile_slug_reservations_admin_read on public.profile_slug_reservations;
create policy profile_slug_reservations_admin_read on public.profile_slug_reservations
for select to authenticated
using (public.has_role('admin'));

drop policy if exists profile_slug_reservations_admin_manage on public.profile_slug_reservations;
create policy profile_slug_reservations_admin_manage on public.profile_slug_reservations
for all to authenticated
using (public.has_role('admin'))
with check (public.has_role('admin'));

create or replace function public.normalize_profile_slug(input text)
returns text
language sql
stable
as $$
  select regexp_replace(
    regexp_replace(
      trim(lower(unaccent(coalesce(input, '')))),
      '[^a-z0-9\s-]', '', 'g'
    ),
    '[\s-]+', '-', 'g'
  )
$$;

create or replace function public.is_valid_profile_slug(input text)
returns boolean
language sql
immutable
as $$
  select coalesce(input, '') ~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$'
$$;

create or replace function public.expire_profile_slug_reservations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer := 0;
begin
  update public.profile_slug_reservations
  set status = 'expired', updated_at = now()
  where status = 'reserved'
    and expires_at <= now();

  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.expire_profile_slug_reservations() from public;
grant execute on function public.expire_profile_slug_reservations() to authenticated, service_role;

create or replace function public.check_profile_slug_availability(candidate_slug text, current_order_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text := public.normalize_profile_slug(candidate_slug);
  existing_profile uuid;
  reservation public.profile_slug_reservations%rowtype;
begin
  perform public.expire_profile_slug_reservations();

  if not public.is_valid_profile_slug(normalized) then
    return jsonb_build_object(
      'available', false,
      'slug', normalized,
      'reason', 'invalid_format',
      'message', 'Usa 3-40 caracteres: letras, números y guiones.'
    );
  end if;

  select id into existing_profile
  from public.profiles
  where slug = normalized
    and deleted_at is null
  limit 1;

  if existing_profile is not null then
    return jsonb_build_object(
      'available', false,
      'slug', normalized,
      'reason', 'profile_exists',
      'message', 'Ese usuario ya está ocupado. Prueba otro.'
    );
  end if;

  select * into reservation
  from public.profile_slug_reservations
  where slug = normalized
    and status = 'reserved'
    and expires_at > now()
  limit 1;

  if reservation.id is not null and (current_order_id is null or reservation.order_id <> current_order_id) then
    return jsonb_build_object(
      'available', false,
      'slug', normalized,
      'reason', 'reserved',
      'message', 'Ese usuario está reservado por otra compra. Prueba otro.'
    );
  end if;

  return jsonb_build_object(
    'available', true,
    'slug', normalized,
    'reason', 'available',
    'message', 'Usuario disponible.'
  );
end;
$$;

revoke all on function public.check_profile_slug_availability(text, uuid) from public;
grant execute on function public.check_profile_slug_availability(text, uuid) to anon, authenticated, service_role;

create or replace function public.reserve_profile_slug_for_order(
  target_order_id uuid,
  candidate_slug text,
  customer_email text,
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
        customer_email = lower(trim(customer_email)),
        status = 'reserved',
        expires_at = now() + reserve_for,
        consumed_at = null,
        released_at = null,
        updated_at = now()
    where id = existing_reservation.id;
  else
    insert into public.profile_slug_reservations(slug, order_id, customer_email, expires_at)
    values (normalized, target_order_id, lower(trim(customer_email)), now() + reserve_for);
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

create or replace function public.enforce_profile_slug_reservation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text := public.normalize_profile_slug(new.slug);
  active_reservation public.profile_slug_reservations%rowtype;
  caller_user_id uuid := auth.uid();
  jwt_role text := current_setting('request.jwt.claim.role', true);
  allowed_by_claim boolean := false;
begin
  if not public.is_valid_profile_slug(normalized) then
    raise exception 'Usa 3-40 caracteres: letras, números y guiones.' using errcode = 'P0001';
  end if;

  new.slug := normalized;

  perform public.expire_profile_slug_reservations();

  select * into active_reservation
  from public.profile_slug_reservations
  where slug = normalized
    and status = 'reserved'
    and expires_at > now()
  limit 1;

  if active_reservation.id is null then
    return new;
  end if;

  if jwt_role = 'service_role' then
    return new;
  end if;

  select exists (
    select 1
    from public.profile_claims pc
    where pc.order_id = active_reservation.order_id
      and pc.status = 'claimed'
      and pc.claimed_by_user_id = caller_user_id
  ) into allowed_by_claim;

  if not allowed_by_claim then
    raise exception 'Ese usuario está reservado por otra compra. Prueba otro.' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create or replace function public.consume_profile_slug_reservation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text := public.normalize_profile_slug(new.slug);
  caller_user_id uuid := auth.uid();
begin
  update public.profile_slug_reservations psr
  set status = 'consumed',
      profile_id = new.id,
      reserved_by_user_id = caller_user_id,
      consumed_at = now(),
      updated_at = now()
  where psr.slug = normalized
    and psr.status = 'reserved'
    and psr.expires_at > now()
    and exists (
      select 1
      from public.profile_claims pc
      where pc.order_id = psr.order_id
        and pc.status = 'claimed'
        and pc.claimed_by_user_id = caller_user_id
    );

  return new;
end;
$$;

drop trigger if exists trg_profiles_enforce_slug_reservation on public.profiles;
create trigger trg_profiles_enforce_slug_reservation
before insert or update of slug on public.profiles
for each row execute procedure public.enforce_profile_slug_reservation();

drop trigger if exists trg_profiles_consume_slug_reservation on public.profiles;
create trigger trg_profiles_consume_slug_reservation
after insert or update of slug on public.profiles
for each row execute procedure public.consume_profile_slug_reservation();

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
  v_subtotal integer := 0;
  v_discount integer := 0;
  v_total integer := 0;
  v_coupon_code text := upper(nullif(trim(p_order->>'coupon_code'), ''));
  v_desired_slug text := public.normalize_profile_slug(p_order->>'desired_profile_slug');
  v_item jsonb;
  v_product record;
  v_qty integer;
  v_prize_type text;
  v_prize_value integer;
begin
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
