begin;

create table if not exists public.profile_claims (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  card_id uuid null references public.cards(id) on delete set null,
  customer_email text not null,
  claim_token text not null unique,
  quantity integer not null default 1 check (quantity > 0),
  status text not null default 'pending' check (status in ('pending', 'claimed', 'expired', 'cancelled')),
  claimed_by_user_id uuid null references auth.users(id) on delete set null,
  claimed_profile_id uuid null references public.profiles(id) on delete set null,
  expires_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id)
);

create index if not exists profile_claims_customer_email_idx on public.profile_claims(customer_email);
create index if not exists profile_claims_status_idx on public.profile_claims(status);
create index if not exists profile_claims_claimed_by_user_id_idx on public.profile_claims(claimed_by_user_id);

drop trigger if exists trg_profile_claims_updated on public.profile_claims;
create trigger trg_profile_claims_updated before update on public.profile_claims
for each row execute procedure public.set_updated_at();

alter table public.profile_claims enable row level security;

commit;
