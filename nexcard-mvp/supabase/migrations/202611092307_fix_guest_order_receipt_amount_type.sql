begin;

drop function if exists public.get_guest_order_receipt(uuid, text, text);

create function public.get_guest_order_receipt(
  p_order_id uuid,
  p_checkout_attempt_id text,
  p_checkout_fingerprint text
)
returns table (
  id uuid,
  folio text,
  customer_email text,
  payment_method text,
  payment_status text,
  paid_at timestamptz,
  fulfillment_status text,
  amount_cents bigint,
  currency text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_order_id is null
     or nullif(btrim(p_checkout_attempt_id), '') is null
     or nullif(btrim(p_checkout_fingerprint), '') is null then
    return;
  end if;

  return query
  select
    o.id,
    o.folio,
    o.customer_email,
    o.payment_method,
    o.payment_status,
    o.paid_at,
    o.fulfillment_status,
    o.amount_cents,
    o.currency,
    o.created_at,
    o.updated_at
  from public.orders as o
  where o.id = p_order_id
    and o.client_checkout_attempt_id = p_checkout_attempt_id
    and o.client_checkout_fingerprint = p_checkout_fingerprint
    and o.deleted_at is null
  limit 1;
end;
$$;

revoke all on function public.get_guest_order_receipt(uuid, text, text) from public;
grant execute on function public.get_guest_order_receipt(uuid, text, text)
  to anon, authenticated, service_role;

notify pgrst, 'reload schema';
commit;
