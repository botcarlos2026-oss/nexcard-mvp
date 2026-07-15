begin;

create extension if not exists pgcrypto;

create table if not exists public.order_cards (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  card_id uuid not null references public.cards(id) on delete cascade,
  linked_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists ux_order_cards_order_card
  on public.order_cards(order_id, card_id);

create unique index if not exists ux_order_cards_card_id
  on public.order_cards(card_id);

create index if not exists idx_order_cards_order_id
  on public.order_cards(order_id);

create index if not exists idx_order_cards_card_id
  on public.order_cards(card_id);

alter table public.order_cards enable row level security;

drop policy if exists order_cards_admin_read on public.order_cards;
create policy order_cards_admin_read on public.order_cards
for select to authenticated
using (public.has_role('admin'));

drop policy if exists order_cards_admin_manage on public.order_cards;
create policy order_cards_admin_manage on public.order_cards
for all to authenticated
using (public.has_role('admin'))
with check (public.has_role('admin'));

alter table public.cards
  drop constraint if exists cards_status_check;

alter table public.cards
  add constraint cards_status_check
  check (status in ('pending_production', 'printed', 'assigned', 'programmed', 'active', 'suspended', 'revoked', 'lost', 'replaced', 'archived'));

create index if not exists cards_order_id_deleted_idx
  on public.cards(order_id)
  where deleted_at is null;

create or replace function public.ensure_order_pending_cards(target_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_order public.orders%rowtype;
  expected_count integer := 0;
  existing_count integer := 0;
  missing_count integer := 0;
  claimed_profile_id uuid := null;
  new_card_id uuid;
  first_card_id uuid;
  created_count integer := 0;
begin
  select *
  into current_order
  from public.orders
  where id = target_order_id
  for update;

  if not found then
    raise exception 'order_not_found';
  end if;

  if current_order.payment_status <> 'paid' then
    return jsonb_build_object(
      'ok', true,
      'skipped', true,
      'reason', 'order_not_paid',
      'order_id', target_order_id,
      'payment_status', current_order.payment_status
    );
  end if;

  select greatest(coalesce(sum(oi.quantity), 0), 1)::integer
  into expected_count
  from public.order_items oi
  where oi.order_id = target_order_id
    and coalesce(oi.deleted_at is null, true);

  select pc.claimed_profile_id
  into claimed_profile_id
  from public.profile_claims pc
  where pc.order_id = target_order_id
    and pc.status = 'claimed'
    and pc.claimed_profile_id is not null
  order by pc.updated_at desc nulls last, pc.created_at desc
  limit 1;

  select count(distinct card_id)::integer
  into existing_count
  from (
    select c.id as card_id
    from public.cards c
    where c.order_id = target_order_id
      and c.deleted_at is null

    union

    select oc.card_id
    from public.order_cards oc
    join public.cards c on c.id = oc.card_id
    where oc.order_id = target_order_id
      and c.deleted_at is null
  ) existing_cards;

  missing_count := greatest(expected_count - existing_count, 0);

  for _ in 1..missing_count loop
    insert into public.cards (
      organization_id,
      order_id,
      profile_id,
      public_token,
      status,
      activation_status,
      issued_at,
      assigned_at,
      metadata
    ) values (
      current_order.organization_id,
      target_order_id,
      claimed_profile_id,
      replace(gen_random_uuid()::text, '-', ''),
      'pending_production',
      case when claimed_profile_id is null then 'unassigned' else 'assigned' end,
      now(),
      case when claimed_profile_id is null then null else now() end,
      jsonb_build_object(
        'source', 'ensure_order_pending_cards',
        'mode', 'hybrid_manual_nfc_setup',
        'auto_created_from_paid_order', true
      )
    )
    returning id into new_card_id;

    insert into public.order_cards(order_id, card_id, linked_by)
    values (target_order_id, new_card_id, null)
    on conflict (order_id, card_id) do nothing;

    insert into public.card_events(card_id, event_type, actor_user_id, context)
    values (
      new_card_id,
      'created_from_paid_order',
      null,
      jsonb_build_object(
        'order_id', target_order_id,
        'profile_id', claimed_profile_id,
        'status', 'pending_production',
        'activation_status', case when claimed_profile_id is null then 'unassigned' else 'assigned' end
      )
    );

    insert into public.audit_log(actor_user_id, actor_role, entity_type, entity_id, action, context)
    values (
      null,
      'system',
      'card',
      new_card_id,
      'card_created_from_paid_order',
      jsonb_build_object('order_id', target_order_id, 'profile_id', claimed_profile_id)
    );

    created_count := created_count + 1;
  end loop;

  if claimed_profile_id is not null then
    with updated_cards as (
      update public.cards
      set profile_id = claimed_profile_id,
          activation_status = 'assigned',
          assigned_at = coalesce(assigned_at, now()),
          updated_at = now()
      where order_id = target_order_id
        and deleted_at is null
        and profile_id is null
      returning id
    )
    insert into public.card_events(card_id, event_type, actor_user_id, context)
    select
      id,
      'assigned_to_claimed_profile',
      null,
      jsonb_build_object('order_id', target_order_id, 'profile_id', claimed_profile_id)
    from updated_cards;
  end if;

  select c.id
  into first_card_id
  from public.cards c
  where c.order_id = target_order_id
    and c.deleted_at is null
  order by c.created_at asc
  limit 1;

  if first_card_id is not null then
    update public.profile_claims
    set card_id = coalesce(card_id, first_card_id),
        updated_at = now()
    where order_id = target_order_id
      and card_id is null;
  end if;

  perform public.log_order_operational_event(
    target_order_id,
    'ready',
    case when created_count > 0 then 'pending_cards_created' else 'pending_cards_confirmed' end,
    'ensure_order_pending_cards',
    now(),
    jsonb_build_object(
      'expected_count', expected_count,
      'existing_count', existing_count,
      'created_count', created_count,
      'profile_id', claimed_profile_id
    )
  );

  return jsonb_build_object(
    'ok', true,
    'order_id', target_order_id,
    'expected_count', expected_count,
    'existing_count', existing_count,
    'created_count', created_count,
    'profile_id', claimed_profile_id
  );
end;
$$;

revoke all on function public.ensure_order_pending_cards(uuid) from public;
grant execute on function public.ensure_order_pending_cards(uuid) to authenticated, service_role;

create or replace function public.ensure_order_pending_cards_from_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.payment_status = 'paid'
     and (tg_op = 'INSERT' or new.payment_status is distinct from old.payment_status) then
    perform public.ensure_order_pending_cards(new.id);
  end if;

  return new;
end;
$$;

create or replace function public.ensure_order_pending_cards_from_claim()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'claimed'
     and new.claimed_profile_id is not null
     and (tg_op = 'INSERT'
       or new.status is distinct from old.status
       or new.claimed_profile_id is distinct from old.claimed_profile_id) then
    perform public.ensure_order_pending_cards(new.order_id);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_orders_ensure_pending_cards on public.orders;
create trigger trg_orders_ensure_pending_cards
after insert or update on public.orders
for each row execute procedure public.ensure_order_pending_cards_from_order();

drop trigger if exists trg_profile_claims_ensure_pending_cards on public.profile_claims;
create trigger trg_profile_claims_ensure_pending_cards
after insert or update on public.profile_claims
for each row execute procedure public.ensure_order_pending_cards_from_claim();

commit;
