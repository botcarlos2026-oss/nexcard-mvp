begin;

alter table public.wheel_spins
  add column if not exists generated_coupon_code text;

alter table public.wheel_spins
  add column if not exists client_ip text;

alter table public.wheel_spins
  add column if not exists user_agent text;

create unique index if not exists wheel_spins_generated_coupon_code_key
  on public.wheel_spins (upper(generated_coupon_code))
  where generated_coupon_code is not null;

create index if not exists wheel_spins_coupon_unredeemed_idx
  on public.wheel_spins (upper(generated_coupon_code), redeemed)
  where generated_coupon_code is not null;

create index if not exists wheel_spins_visitor_recent_idx
  on public.wheel_spins (wheel_id, visitor_id, spun_at);

create index if not exists wheel_spins_client_ip_recent_idx
  on public.wheel_spins (wheel_id, client_ip, spun_at)
  where client_ip is not null;

create or replace view public.wheel_prizes_public as
select
  id,
  wheel_id,
  label,
  color,
  display_order,
  active
from public.wheel_prizes
where coalesce(active, true) = true;

revoke all on public.wheel_prizes_public from public;
grant select on public.wheel_prizes_public to anon;
grant select on public.wheel_prizes_public to authenticated;

alter table public.wheel_config enable row level security;
alter table public.wheel_prizes enable row level security;
alter table public.wheel_spins enable row level security;

drop policy if exists "wheel_prizes_anon_select" on public.wheel_prizes;
drop policy if exists "wheel_spins_anon_insert" on public.wheel_spins;
drop policy if exists "wheel_config_auth_all" on public.wheel_config;
drop policy if exists "wheel_prizes_auth_all" on public.wheel_prizes;
drop policy if exists "wheel_spins_auth_all" on public.wheel_spins;
drop policy if exists "wheel_config_admin_all" on public.wheel_config;
drop policy if exists "wheel_prizes_admin_all" on public.wheel_prizes;
drop policy if exists "wheel_spins_admin_all" on public.wheel_spins;

create policy "wheel_config_admin_all"
  on public.wheel_config
  for all to authenticated
  using (public.has_role('admin'))
  with check (public.has_role('admin'));

create policy "wheel_prizes_admin_all"
  on public.wheel_prizes
  for all to authenticated
  using (public.has_role('admin'))
  with check (public.has_role('admin'));

create policy "wheel_spins_admin_all"
  on public.wheel_spins
  for all to authenticated
  using (public.has_role('admin'))
  with check (public.has_role('admin'));

-- keep public campaign config readable, but prize internals/coupon prefixes are not anon-readable.
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'wheel_spins' and policyname = 'wheel_spins_anon_update_own_email'
  ) then
    create policy "wheel_spins_anon_update_own_email"
      on public.wheel_spins
      for update to anon
      using (false)
      with check (false);
  end if;
end $$;

create or replace function public.spin_wheel(
  p_wheel_id uuid,
  p_visitor_id text,
  p_client_ip text default null,
  p_user_agent text default null
)
returns table(
  prize_id uuid,
  prize_label text,
  coupon_code text,
  spin_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prize record;
  v_total integer;
  v_rnd numeric;
  v_acc numeric := 0;
  v_code text;
  v_prefix text;
begin
  if p_wheel_id is null then
    raise exception 'wheel_id requerido';
  end if;

  p_visitor_id := nullif(trim(p_visitor_id), '');
  p_client_ip := nullif(trim(p_client_ip), '');
  p_user_agent := left(coalesce(nullif(trim(p_user_agent), ''), ''), 512);
  if p_visitor_id is null or length(p_visitor_id) < 8 then
    raise exception 'visitor_id inválido';
  end if;

  -- Serialize spins for the same campaign+visitor/IP so the rate-limit check and
  -- coupon insert are atomic under concurrent public Edge Function requests.
  perform pg_advisory_xact_lock(hashtext('wheel_spin_visitor'), hashtext(p_wheel_id::text || ':' || p_visitor_id));
  if p_client_ip is not null then
    perform pg_advisory_xact_lock(hashtext('wheel_spin_ip'), hashtext(p_wheel_id::text || ':' || p_client_ip));
  end if;

  if exists (
    select 1
    from public.wheel_spins ws
    where ws.wheel_id = p_wheel_id
      and ws.spun_at > now() - interval '24 hours'
      and (ws.visitor_id = p_visitor_id or (p_client_ip is not null and ws.client_ip = p_client_ip))
  ) then
    raise exception 'Ya giraste recientemente';
  end if;

  if not exists (
    select 1
    from public.wheel_config wc
    where wc.id = p_wheel_id
      and coalesce(wc.active, false) = true
      and (wc.start_date is null or wc.start_date <= now())
      and (wc.end_date is null or wc.end_date >= now())
  ) then
    raise exception 'Ruleta no disponible';
  end if;

  select coalesce(sum(greatest(coalesce(weight, 10), 1)), 0)
    into v_total
  from public.wheel_prizes
  where wheel_id = p_wheel_id
    and coalesce(active, true) = true;

  if coalesce(v_total, 0) <= 0 then
    raise exception 'Ruleta sin premios activos';
  end if;

  v_rnd := random() * v_total;

  for v_prize in
    select *
    from public.wheel_prizes
    where wheel_id = p_wheel_id
      and coalesce(active, true) = true
    order by display_order asc, created_at asc
  loop
    v_acc := v_acc + greatest(coalesce(v_prize.weight, 10), 1);
    if v_rnd <= v_acc then
      exit;
    end if;
  end loop;

  if v_prize.id is null then
    raise exception 'No se pudo seleccionar premio';
  end if;

  v_prefix := upper(regexp_replace(coalesce(nullif(v_prize.coupon_code, ''), 'NEXCARD'), '[^A-Za-z0-9]+', '', 'g'));
  v_prefix := left(coalesce(nullif(v_prefix, ''), 'NEXCARD'), 14);

  loop
    v_code := v_prefix || '-' || substr(upper(replace(gen_random_uuid()::text, '-', '')), 1, 8);
    exit when not exists (
      select 1
      from public.wheel_spins ws
      where upper(ws.generated_coupon_code) = upper(v_code)
    );
  end loop;

  insert into public.wheel_spins(wheel_id, prize_id, visitor_id, generated_coupon_code, client_ip, user_agent, redeemed)
  values (p_wheel_id, v_prize.id, p_visitor_id, v_code, p_client_ip, p_user_agent, false)
  returning id into spin_id;

  prize_id := v_prize.id;
  prize_label := v_prize.label;
  coupon_code := v_code;
  return next;
end;
$$;

create or replace function public.validate_wheel_coupon(p_code text)
returns table(
  prize_id uuid,
  spin_id uuid,
  type text,
  value integer,
  label text
)
language sql
security definer
set search_path = public
as $$
  select
    wp.id as prize_id,
    ws.id as spin_id,
    wp.type,
    wp.value,
    wp.label
  from public.wheel_spins ws
  join public.wheel_prizes wp on wp.id = ws.prize_id
  where upper(ws.generated_coupon_code) = upper(nullif(trim(p_code), ''))
    and coalesce(ws.redeemed, false) = false
    and coalesce(wp.active, true) = true
  order by ws.spun_at asc
  limit 1;
$$;

revoke all on function public.spin_wheel(uuid, text, text, text) from public;
grant execute on function public.spin_wheel(uuid, text, text, text) to service_role;
grant execute on function public.validate_wheel_coupon(text) to anon;
grant execute on function public.validate_wheel_coupon(text) to authenticated;

create or replace function public.record_wheel_spin_email(p_spin_id uuid, p_visitor_id text, p_email text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  p_visitor_id := nullif(trim(p_visitor_id), '');
  p_email := lower(nullif(trim(p_email), ''));
  if p_spin_id is null or p_visitor_id is null or p_email is null or position('@' in p_email) <= 1 then
    return false;
  end if;

  update public.wheel_spins
    set email = p_email
  where id = p_spin_id
    and visitor_id = p_visitor_id
    and email is null;

  return found;
end;
$$;

grant execute on function public.record_wheel_spin_email(uuid, text, text) to anon;
grant execute on function public.record_wheel_spin_email(uuid, text, text) to authenticated;

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
  v_spin_id uuid;
begin
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

grant execute on function public.create_order_with_items(jsonb, jsonb) to anon;
grant execute on function public.create_order_with_items(jsonb, jsonb) to authenticated;

commit;
