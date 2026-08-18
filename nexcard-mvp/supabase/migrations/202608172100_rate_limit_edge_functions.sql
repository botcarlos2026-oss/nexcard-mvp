-- NexCard — generic DB-backed rate limiter for public/sensitive Edge Functions
-- Used by create-mp-preference and process-refund to bound repeated calls
-- against the same key (order id) within a sliding time window.

begin;

create table if not exists public.rate_limit_hits (
  id bigint generated always as identity primary key,
  bucket text not null,
  key text not null,
  created_at timestamptz not null default now()
);

create index if not exists rate_limit_hits_bucket_key_created_at_idx
  on public.rate_limit_hits (bucket, key, created_at desc);

alter table public.rate_limit_hits enable row level security;

-- Only service_role (used by Edge Functions) may touch this table directly.
revoke all on public.rate_limit_hits from anon, authenticated;

create or replace function public.check_and_record_rate_limit(
  p_bucket text,
  p_key text,
  p_max_count integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  delete from public.rate_limit_hits
  where bucket = p_bucket
    and created_at < now() - make_interval(secs => p_window_seconds * 4);

  select count(*) into v_count
  from public.rate_limit_hits
  where bucket = p_bucket
    and key = p_key
    and created_at >= now() - make_interval(secs => p_window_seconds);

  if v_count >= p_max_count then
    return false;
  end if;

  insert into public.rate_limit_hits (bucket, key) values (p_bucket, p_key);
  return true;
end;
$$;

revoke all on function public.check_and_record_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_and_record_rate_limit(text, text, integer, integer) to service_role;

commit;
