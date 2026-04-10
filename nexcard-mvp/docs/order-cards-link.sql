-- NexCard - vínculo formal order <-> cards

begin;

create table if not exists public.order_cards (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  card_id uuid not null references public.cards(id),
  created_at timestamptz not null default now()
);

create unique index if not exists ux_order_cards_order_card
  on public.order_cards(order_id, card_id);

create index if not exists idx_order_cards_order_id
  on public.order_cards(order_id);

create index if not exists idx_order_cards_card_id
  on public.order_cards(card_id);

commit;
