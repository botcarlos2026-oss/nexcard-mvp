begin;

-- Claude Code external security audit hardening.
-- This migration is intentionally additive because earlier migrations may already
-- be applied in remote Supabase environments.

-- 1) Backoffice/audit tables: RLS enabled and admin-only access.
alter table if exists public.audit_log enable row level security;
alter table if exists public.profile_versions enable row level security;

-- Force RLS for non-owner table access paths; service_role still bypasses RLS.
alter table if exists public.audit_log force row level security;
alter table if exists public.profile_versions force row level security;

drop policy if exists "audit_log_admin_all" on public.audit_log;
create policy "audit_log_admin_all"
on public.audit_log for all to authenticated
using (public.has_role('admin'))
with check (public.has_role('admin'));

drop policy if exists "profile_versions_admin_all" on public.profile_versions;
create policy "profile_versions_admin_all"
on public.profile_versions for all to authenticated
using (public.has_role('admin'))
with check (public.has_role('admin'));

-- 2) abandoned_carts: remove broad authenticated access and broad anonymous update.
-- Anonymous checkout can create abandoned-cart rows. Subsequent public updates must
-- present the row-scoped update token in x-cart-token and can only move rows along
-- the public checkout lifecycle;
-- admin/backoffice access is limited to authenticated admins.
alter table if exists public.abandoned_carts enable row level security;
alter table if exists public.abandoned_carts
  add column if not exists update_token uuid not null default gen_random_uuid();

create unique index if not exists abandoned_carts_update_token_idx
  on public.abandoned_carts(update_token);

create or replace function public.current_cart_update_token()
returns uuid
language plpgsql
stable
as $$
declare
  raw_headers text := current_setting('request.headers', true);
  token text;
begin
  if raw_headers is null or raw_headers = '' then
    return null;
  end if;

  token := nullif(raw_headers::jsonb ->> 'x-cart-token', '');
  if token is null then
    return null;
  end if;

  begin
    return token::uuid;
  exception when invalid_text_representation then
    return null;
  end;
end;
$$;

drop policy if exists "abandoned_carts_anon_insert" on public.abandoned_carts;
drop policy if exists "abandoned_carts_anon_update" on public.abandoned_carts;
drop policy if exists "abandoned_carts_authenticated_all" on public.abandoned_carts;
drop policy if exists "abandoned_carts_admin_all" on public.abandoned_carts;
drop policy if exists "abandoned_carts_anon_lifecycle_update" on public.abandoned_carts;

create policy "abandoned_carts_anon_insert"
on public.abandoned_carts for insert to anon
with check (
  status = 'abandoned'
  and nullif(trim(email), '') is not null
  and total_cents >= 0
);

create policy "abandoned_carts_anon_lifecycle_update"
on public.abandoned_carts for update to anon
using (
  update_token = public.current_cart_update_token()
  and status in ('abandoned', 'email_sent')
)
with check (
  update_token = public.current_cart_update_token()
  and status in ('converted', 'ignored')
);

create policy "abandoned_carts_admin_all"
on public.abandoned_carts for all to authenticated
using (public.has_role('admin'))
with check (public.has_role('admin'));

-- 3) email_log: service-role writes by default; admin read is explicit.
alter table if exists public.email_log enable row level security;

drop policy if exists "email_log_authenticated_insert" on public.email_log;
drop policy if exists "email_log_authenticated_select" on public.email_log;
drop policy if exists "email_log_admin_select" on public.email_log;
drop policy if exists "email_log_admin_insert" on public.email_log;

create policy "email_log_admin_select"
on public.email_log for select to authenticated
using (public.has_role('admin'));

create policy "email_log_admin_insert"
on public.email_log for insert to authenticated
with check (public.has_role('admin'));

-- 4) Server-side RUT validation for invoice fields accepted by the public RPC.
create or replace function public.is_valid_chilean_rut(raw_rut text)
returns boolean
language plpgsql
immutable
as $$
declare
  clean text;
  body text;
  check_digit text;
  reversed_body text;
  sum_value integer := 0;
  multiplier integer := 2;
  i integer;
  digit integer;
  remainder integer;
  expected text;
begin
  clean := upper(regexp_replace(coalesce(raw_rut, ''), '[^0-9K]', '', 'g'));
  if clean !~ '^[0-9]{7,8}[0-9K]$' then
    return false;
  end if;

  body := substring(clean from 1 for length(clean) - 1);
  check_digit := substring(clean from length(clean) for 1);
  reversed_body := reverse(body);

  for i in 1..length(reversed_body) loop
    digit := substring(reversed_body from i for 1)::integer;
    sum_value := sum_value + (digit * multiplier);
    multiplier := multiplier + 1;
    if multiplier > 7 then
      multiplier := 2;
    end if;
  end loop;

  remainder := 11 - (sum_value % 11);
  expected := case
    when remainder = 11 then '0'
    when remainder = 10 then 'K'
    else remainder::text
  end;

  return expected = check_digit;
end;
$$;

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
  v_requires_invoice boolean := coalesce((p_order->>'requires_invoice')::boolean, false);
  v_invoice_rut text := nullif(trim(p_order->>'invoice_rut'), '');
  v_invoice_razon_social text := nullif(trim(p_order->>'invoice_razon_social'), '');
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

grant execute on function public.is_valid_chilean_rut(text) to anon, authenticated;
grant execute on function public.current_cart_update_token() to anon, authenticated;
grant execute on function public.create_order_with_items(jsonb, jsonb) to anon, authenticated;

commit;
