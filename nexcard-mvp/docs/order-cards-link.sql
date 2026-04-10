-- NexCard - vínculo formal order <-> cards

begin;

create table if not exists public.order_cards (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  card_id uuid not null references public.cards(id) on delete cascade,
  linked_by uuid null,
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

create policy order_cards_admin_read on public.order_cards
for select
using (public.has_role('admin'));

create policy order_cards_admin_manage on public.order_cards
for all
using (public.has_role('admin'))
with check (public.has_role('admin'));

create or replace function public.link_order_card(
  target_order_id uuid,
  target_card_id uuid,
  actor_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_card record;
  existing_link record;
begin
  select id, status, activation_status, profile_id
  into current_card
  from public.cards
  where id = target_card_id;

  if not found then
    raise exception 'card_not_found';
  end if;

  select *
  into existing_link
  from public.order_cards
  where card_id = target_card_id;

  if found and existing_link.order_id <> target_order_id then
    raise exception 'card_already_linked_to_other_order';
  end if;

  insert into public.order_cards(order_id, card_id, linked_by)
  values (target_order_id, target_card_id, actor_id)
  on conflict (order_id, card_id) do update
    set linked_by = excluded.linked_by
  returning * into existing_link;

  insert into public.audit_log(entity_type, entity_id, action, context)
  values (
    'order',
    target_order_id,
    'link_card',
    jsonb_build_object(
      'actor_id', actor_id,
      'card_id', target_card_id,
      'card_status', current_card.status,
      'activation_status', current_card.activation_status,
      'profile_id', current_card.profile_id
    )
  );

  return jsonb_build_object(
    'ok', true,
    'order_id', target_order_id,
    'card_id', target_card_id
  );
end;
$$;

commit;
