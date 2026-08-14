-- Cyber Neo remediation 2026-08-13: close broad RLS reads and prevent self-service status tampering.

-- CN-003: replace broad authenticated policies with admin-scoped policies.
alter table if exists public.email_log enable row level security;
alter table if exists public.email_unsubscribe enable row level security;
alter table if exists public.abandoned_carts enable row level security;
alter table if exists public.card_scans enable row level security;

drop policy if exists "email_log_authenticated_select" on public.email_log;
drop policy if exists "email_log_admin_select" on public.email_log;
create policy "email_log_admin_select"
  on public.email_log for select to authenticated
  using (public.has_role('admin'));

drop policy if exists "email_unsubscribe_authenticated_select" on public.email_unsubscribe;
drop policy if exists "email_unsubscribe_admin_select" on public.email_unsubscribe;
create policy "email_unsubscribe_admin_select"
  on public.email_unsubscribe for select to authenticated
  using (public.has_role('admin'));

drop policy if exists "abandoned_carts_authenticated_all" on public.abandoned_carts;
drop policy if exists "abandoned_carts_admin_all" on public.abandoned_carts;
create policy "abandoned_carts_admin_all"
  on public.abandoned_carts for all to authenticated
  using (public.has_role('admin'))
  with check (public.has_role('admin'));

drop policy if exists "card_scans_auth_select" on public.card_scans;
drop policy if exists "card_scans_admin_read" on public.card_scans;
drop policy if exists "card_scans_admin_select" on public.card_scans;
create policy "card_scans_admin_select"
  on public.card_scans for select to authenticated
  using (public.has_role('admin'));



-- Public abandoned-cart lifecycle remains available without broad SELECT/UPDATE.
-- The function returns a row-scoped token; later public conversion updates must present it.
create or replace function public.save_abandoned_cart_public(
  cart_email text,
  cart_customer_name text,
  cart_items jsonb,
  cart_total_cents integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_cart public.abandoned_carts;
  saved_cart public.abandoned_carts;
begin
  if nullif(trim(cart_email), '') is null then
    raise exception 'email_required' using errcode = '23502';
  end if;
  if cart_items is null or jsonb_typeof(cart_items) <> 'array' then
    raise exception 'items_required' using errcode = '23502';
  end if;
  if coalesce(cart_total_cents, -1) < 0 then
    raise exception 'invalid_total' using errcode = '22003';
  end if;

  select * into existing_cart
    from public.abandoned_carts
   where lower(email) = lower(trim(cart_email))
     and status in ('abandoned', 'email_sent')
     and created_at >= now() - interval '2 hours'
   order by created_at desc
   limit 1;

  if existing_cart.id is not null then
    update public.abandoned_carts
       set customer_name = nullif(trim(cart_customer_name), ''),
           items = cart_items,
           total_cents = cart_total_cents,
           updated_at = now()
     where id = existing_cart.id
     returning * into saved_cart;
  else
    insert into public.abandoned_carts (email, customer_name, items, total_cents, status)
    values (lower(trim(cart_email)), nullif(trim(cart_customer_name), ''), cart_items, cart_total_cents, 'abandoned')
    returning * into saved_cart;
  end if;

  return jsonb_build_object('id', saved_cart.id, 'update_token', saved_cart.update_token);
end;
$$;

revoke all on function public.save_abandoned_cart_public(text, text, jsonb, integer) from public;
grant execute on function public.save_abandoned_cart_public(text, text, jsonb, integer) to anon, authenticated;

create or replace function public.mark_abandoned_cart_converted_public(cart_id uuid, cart_update_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  if cart_id is null or cart_update_token is null then
    return false;
  end if;

  update public.abandoned_carts
     set status = 'converted',
         converted_at = now(),
         updated_at = now()
   where id = cart_id
     and update_token = cart_update_token
     and status in ('abandoned', 'email_sent');

  get diagnostics updated_count = row_count;
  return updated_count > 0;
end;
$$;

revoke all on function public.mark_abandoned_cart_converted_public(uuid, uuid) from public;
grant execute on function public.mark_abandoned_cart_converted_public(uuid, uuid) to anon, authenticated;

-- CN-007: only service role/admin can change profile.status.
create or replace function public.prevent_profile_status_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' or coalesce(public.has_role('admin'), false) then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    raise exception 'profile_status_admin_only' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.prevent_profile_status_self_update() from public;

drop trigger if exists trg_prevent_profile_status_self_update on public.profiles;
create trigger trg_prevent_profile_status_self_update
before update on public.profiles
for each row
execute function public.prevent_profile_status_self_update();

create or replace function public.set_profile_status(profile_id uuid, new_status text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_profile public.profiles;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not coalesce(public.has_role('admin'), false) then
    raise exception 'admin_required' using errcode = '42501';
  end if;

  update public.profiles
     set status = new_status,
         updated_at = coalesce(now(), updated_at)
   where id = profile_id
   returning * into updated_profile;

  if updated_profile.id is null then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;

  return updated_profile;
end;
$$;

revoke all on function public.set_profile_status(uuid, text) from public;
grant execute on function public.set_profile_status(uuid, text) to authenticated;
