begin;

create or replace function public.guard_orders_sensitive_updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  bypass_enabled text := current_setting('app.order_transition_bypass', true);
begin
  if bypass_enabled = 'true' then
    return new;
  end if;

  if new.payment_status is distinct from old.payment_status
     or new.fulfillment_status is distinct from old.fulfillment_status
     or new.carrier is distinct from old.carrier
     or new.tracking_code is distinct from old.tracking_code
     or new.shipped_at is distinct from old.shipped_at
     or new.delivered_at is distinct from old.delivered_at
     or new.inventory_reserved is distinct from old.inventory_reserved
     or new.inventory_reserved_at is distinct from old.inventory_reserved_at
     or new.inventory_decremented is distinct from old.inventory_decremented
     or new.inventory_decremented_at is distinct from old.inventory_decremented_at then
    raise exception 'Los campos sensibles de órdenes solo pueden cambiarse mediante RPCs protegidos';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_orders_sensitive_updates() from public;

commit;
