-- Migration: 202604150003 — NexReview card type
-- Extends profiles with card_type and review_url to support
-- Google Reviews Cards that redirect on NFC tap.
-- Idempotent.

begin;

alter table public.profiles
  add column if not exists card_type text not null default 'nfc',
  add column if not exists review_url text;

alter table public.profiles
  drop constraint if exists profiles_card_type_check;

alter table public.profiles
  add constraint profiles_card_type_check
  check (card_type in ('nfc', 'review'));

-- Index for fast lookup of review cards
create index if not exists profiles_card_type_idx on public.profiles(card_type);

commit;
