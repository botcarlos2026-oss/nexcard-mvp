begin;

alter table public.orders
  add column if not exists paid_at timestamptz,
  add column if not exists ready_at timestamptz,
  add column if not exists activated_at timestamptz;

create table if not exists public.order_operational_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  stage text not null check (stage in ('paid', 'ready', 'shipped', 'delivered', 'activated')),
  event_type text not null,
  source text not null default 'system',
  event_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists order_operational_events_order_id_idx
  on public.order_operational_events(order_id, event_at desc);

create index if not exists order_operational_events_stage_idx
  on public.order_operational_events(stage, event_at desc);

alter table public.order_operational_events enable row level security;

drop policy if exists order_operational_events_admin_read on public.order_operational_events;
create policy order_operational_events_admin_read on public.order_operational_events
for select to authenticated
using (public.has_role('admin'));

drop policy if exists order_operational_events_admin_manage on public.order_operational_events;
create policy order_operational_events_admin_manage on public.order_operational_events
for all to authenticated
using (public.has_role('admin'))
with check (public.has_role('admin'));

update public.orders o
set paid_at = coalesce(
  o.paid_at,
  p.first_paid_at,
  case when o.payment_status = 'paid' then coalesce(o.updated_at, o.created_at, now()) else null end
)
from (
  select order_id, min(paid_at) as first_paid_at
  from public.payments
  where paid_at is not null
  group by order_id
) p
where o.id = p.order_id
  and o.paid_at is null;

update public.orders
set paid_at = coalesce(updated_at, created_at, now())
where paid_at is null
  and payment_status = 'paid';

update public.orders
set ready_at = coalesce(ready_at, shipped_at, delivered_at, updated_at, created_at, now())
where ready_at is null
  and fulfillment_status in ('ready', 'shipped', 'delivered');

update public.orders o
set activated_at = derived.activated_at
from (
  select order_id, max(ts) as activated_at
  from (
    select c.order_id as order_id, c.activated_at as ts
    from public.cards c
    where c.order_id is not null
      and c.activated_at is not null

    union all

    select oc.order_id as order_id, c.activated_at as ts
    from public.order_cards oc
    join public.cards c on c.id = oc.card_id
    where c.activated_at is not null

    union all

    select pc.order_id as order_id, pc.updated_at as ts
    from public.profile_claims pc
    where pc.status = 'claimed'
  ) activation_sources
  group by order_id
) derived
where o.id = derived.order_id
  and o.activated_at is null;

create or replace function public.log_order_operational_event(
  p_order_id uuid,
  p_stage text,
  p_event_type text,
  p_source text default 'system',
  p_event_at timestamptz default now(),
  p_payload jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.order_operational_events (
    order_id,
    stage,
    event_type,
    source,
    event_at,
    payload
  ) values (
    p_order_id,
    p_stage,
    p_event_type,
    coalesce(nullif(trim(p_source), ''), 'system'),
    coalesce(p_event_at, now()),
    coalesce(p_payload, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.log_order_operational_event(uuid, text, text, text, timestamptz, jsonb) from public;
grant execute on function public.log_order_operational_event(uuid, text, text, text, timestamptz, jsonb) to authenticated, service_role;

create or replace function public.set_order_operational_timestamps()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.payment_status = 'paid' and new.paid_at is null then
    new.paid_at := coalesce(new.paid_at, now());
  end if;

  if new.fulfillment_status in ('ready', 'shipped', 'delivered') and new.ready_at is null then
    new.ready_at := coalesce(new.shipped_at, new.delivered_at, now());
  end if;

  if new.fulfillment_status = 'shipped' and new.shipped_at is null then
    new.shipped_at := now();
  end if;

  if new.fulfillment_status = 'delivered' and new.delivered_at is null then
    new.delivered_at := now();
  end if;

  return new;
end;
$$;

create or replace function public.emit_order_operational_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  bypass_transition boolean := coalesce(current_setting('app.order_transition_bypass', true), '') = 'true';
begin
  if tg_op = 'INSERT' then
    if new.payment_status = 'paid' then
      perform public.log_order_operational_event(new.id, 'paid', 'payment_status_paid', 'orders_trigger', coalesce(new.paid_at, new.created_at, now()), jsonb_build_object('payment_status', new.payment_status));
    end if;

    if new.fulfillment_status in ('ready', 'shipped', 'delivered') then
      perform public.log_order_operational_event(new.id, 'ready', 'fulfillment_ready', 'orders_trigger', coalesce(new.ready_at, new.updated_at, new.created_at, now()), jsonb_build_object('fulfillment_status', new.fulfillment_status));
    end if;

    if new.fulfillment_status in ('shipped', 'delivered') then
      perform public.log_order_operational_event(new.id, 'shipped', 'fulfillment_shipped', 'orders_trigger', coalesce(new.shipped_at, new.updated_at, new.created_at, now()), jsonb_build_object('carrier', new.carrier, 'tracking_code', new.tracking_code));
    end if;

    if new.fulfillment_status = 'delivered' then
      perform public.log_order_operational_event(new.id, 'delivered', 'fulfillment_delivered', 'orders_trigger', coalesce(new.delivered_at, new.updated_at, new.created_at, now()), jsonb_build_object('delivery_confirmed_by', new.delivery_confirmed_by));
    end if;

    return new;
  end if;

  if not bypass_transition and new.payment_status is distinct from old.payment_status then
    perform public.insert_order_history_entry(new.id, 'payment_status', coalesce(old.payment_status, ''), coalesce(new.payment_status, ''));
  end if;

  if not bypass_transition and new.fulfillment_status is distinct from old.fulfillment_status then
    perform public.insert_order_history_entry(new.id, 'fulfillment_status', coalesce(old.fulfillment_status, ''), coalesce(new.fulfillment_status, ''));
  end if;

  if new.paid_at is distinct from old.paid_at then
    perform public.insert_order_history_entry(new.id, 'paid_at', coalesce(old.paid_at::text, ''), coalesce(new.paid_at::text, ''));
  end if;

  if new.ready_at is distinct from old.ready_at then
    perform public.insert_order_history_entry(new.id, 'ready_at', coalesce(old.ready_at::text, ''), coalesce(new.ready_at::text, ''));
  end if;

  if new.activated_at is distinct from old.activated_at then
    perform public.insert_order_history_entry(new.id, 'activated_at', coalesce(old.activated_at::text, ''), coalesce(new.activated_at::text, ''));
  end if;

  if new.payment_status is distinct from old.payment_status and new.payment_status = 'paid' then
    perform public.log_order_operational_event(new.id, 'paid', 'payment_status_paid', 'orders_trigger', coalesce(new.paid_at, now()), jsonb_build_object('old_payment_status', old.payment_status, 'new_payment_status', new.payment_status));
  end if;

  if new.fulfillment_status is distinct from old.fulfillment_status and new.fulfillment_status = 'ready' then
    perform public.log_order_operational_event(new.id, 'ready', 'fulfillment_ready', 'orders_trigger', coalesce(new.ready_at, now()), jsonb_build_object('old_fulfillment_status', old.fulfillment_status, 'new_fulfillment_status', new.fulfillment_status));
  end if;

  if new.fulfillment_status is distinct from old.fulfillment_status and new.fulfillment_status = 'shipped' then
    perform public.log_order_operational_event(new.id, 'shipped', 'fulfillment_shipped', 'orders_trigger', coalesce(new.shipped_at, now()), jsonb_build_object('carrier', new.carrier, 'tracking_code', new.tracking_code));
  end if;

  if new.fulfillment_status is distinct from old.fulfillment_status and new.fulfillment_status = 'delivered' then
    perform public.log_order_operational_event(new.id, 'delivered', 'fulfillment_delivered', 'orders_trigger', coalesce(new.delivered_at, now()), jsonb_build_object('delivery_confirmed_by', new.delivery_confirmed_by));
  end if;

  return new;
end;
$$;

create or replace function public.mark_order_activated(
  target_order_id uuid,
  target_card_id uuid default null,
  p_source text default 'system',
  p_payload jsonb default '{}'::jsonb,
  p_activated_at timestamptz default now()
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_order public.orders%rowtype;
  activation_time timestamptz := coalesce(p_activated_at, now());
  event_type text := 'activation_reconfirmed';
begin
  select *
  into current_order
  from public.orders
  where id = target_order_id
  for update;

  if not found then
    raise exception 'Orden no encontrada';
  end if;

  if current_order.deleted_at is not null then
    raise exception 'No puedes activar una orden archivada';
  end if;

  if current_order.activated_at is null then
    update public.orders
    set activated_at = activation_time,
        updated_at = now()
    where id = target_order_id;

    event_type := 'activation_completed';
  end if;

  perform public.log_order_operational_event(
    target_order_id,
    'activated',
    event_type,
    p_source,
    activation_time,
    coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('card_id', target_card_id)
  );

  return jsonb_build_object(
    'order_id', target_order_id,
    'activated_at', coalesce(current_order.activated_at, activation_time),
    'event_type', event_type
  );
end;
$$;

revoke all on function public.mark_order_activated(uuid, uuid, text, jsonb, timestamptz) from public;
grant execute on function public.mark_order_activated(uuid, uuid, text, jsonb, timestamptz) to authenticated, service_role;

create or replace function public.sync_order_activation_from_card()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  linked_order_id uuid;
begin
  if new.deleted_at is not null then
    return new;
  end if;

  if not (new.status = 'active' or new.activation_status = 'activated') then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and new.status is not distinct from old.status
     and new.activation_status is not distinct from old.activation_status
     and new.activated_at is not distinct from old.activated_at then
    return new;
  end if;

  linked_order_id := new.order_id;

  if linked_order_id is null then
    select oc.order_id
    into linked_order_id
    from public.order_cards oc
    where oc.card_id = new.id
    limit 1;
  end if;

  if linked_order_id is null then
    return new;
  end if;

  perform public.mark_order_activated(
    linked_order_id,
    new.id,
    'card_trigger',
    jsonb_build_object(
      'card_status', new.status,
      'activation_status', new.activation_status,
      'profile_id', new.profile_id
    ),
    coalesce(new.activated_at, now())
  );

  return new;
end;
$$;

create or replace function public.sync_order_activation_from_claim()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status <> 'claimed' then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  perform public.mark_order_activated(
    new.order_id,
    new.card_id,
    'profile_claim_trigger',
    jsonb_build_object(
      'claimed_by_user_id', new.claimed_by_user_id,
      'claimed_profile_id', new.claimed_profile_id,
      'customer_email', new.customer_email
    ),
    coalesce(new.updated_at, new.created_at, now())
  );

  return new;
end;
$$;

drop trigger if exists trg_orders_set_operational_timestamps on public.orders;
create trigger trg_orders_set_operational_timestamps
before insert or update on public.orders
for each row execute procedure public.set_order_operational_timestamps();

drop trigger if exists trg_orders_emit_operational_events on public.orders;
create trigger trg_orders_emit_operational_events
after insert or update on public.orders
for each row execute procedure public.emit_order_operational_events();

drop trigger if exists trg_cards_sync_order_activation on public.cards;
create trigger trg_cards_sync_order_activation
after insert or update on public.cards
for each row execute procedure public.sync_order_activation_from_card();

drop trigger if exists trg_profile_claims_sync_order_activation on public.profile_claims;
create trigger trg_profile_claims_sync_order_activation
after insert or update on public.profile_claims
for each row execute procedure public.sync_order_activation_from_claim();

commit;
