begin;

-- Retain RLS as the authorization boundary for direct orders access.
alter table public.orders enable row level security;

-- Legacy policy was PUBLIC and matched guest orders where user_id is null.
drop policy if exists "Allow users to read their own orders" on public.orders;

-- Defense in depth: guest receipts must be read only through the proof-gated RPC.
revoke select on table public.orders from anon;

notify pgrst, 'reload schema';
commit;
