-- NexCard — Reconcile schema drift found during prelaunch audit (2026-08-16).
-- These 4 objects were defined in earlier migrations but never landed in production
-- (partial apply / manual drift). All statements are additive and idempotent.

begin;

-- 1) abandoned_carts.updated_at was never wired to auto-update.
create or replace function public.update_abandoned_carts_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_abandoned_carts_updated_at on public.abandoned_carts;
create trigger trg_abandoned_carts_updated_at
  before update on public.abandoned_carts
  for each row execute function public.update_abandoned_carts_updated_at();

-- 2) Missing performance index for the abandoned-carts recovery job.
create index if not exists idx_abandoned_carts_status_created
  on public.abandoned_carts (status, created_at);

-- 3) Missing unique index that guards create_order_with_items() against duplicate
-- orders from a concurrent double-submit of the same checkout attempt.
create unique index if not exists orders_client_checkout_attempt_active_unique
  on public.orders (client_checkout_attempt_id)
  where deleted_at is null
    and client_checkout_attempt_id is not null;

-- 4) increment_review_scan() was called by src/services/api/reviewCards.js but never
-- had a migration, so the app was always falling back to a non-atomic
-- read-then-write increment (race condition under concurrent scans of the same slug).
create or replace function public.increment_review_scan(target_slug text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.review_cards
  set scan_count = coalesce(scan_count, 0) + 1
  where slug = target_slug;
$$;

grant execute on function public.increment_review_scan(text) to anon;
grant execute on function public.increment_review_scan(text) to authenticated;

commit;
