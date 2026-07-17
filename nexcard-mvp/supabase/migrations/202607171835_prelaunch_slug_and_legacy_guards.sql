begin;

-- DB-level guard: frontend slug checks are UX only; this is the source-of-truth
-- protection against duplicate active public URLs under nexcard.cl/<slug>.
create unique index if not exists profiles_active_slug_unique_idx
  on public.profiles(slug)
  where deleted_at is null
    and slug is not null;

comment on index public.profiles_active_slug_unique_idx is
  'Pre-launch guard: prevents duplicate active public NexCard profile slugs.';

-- Read-only operational view for separating old/manual/test paid orders from
-- current Mercado Pago orders before launch. It does not mutate any order.
create or replace view public.prelaunch_order_integrity_audit as
select
  o.id as order_id,
  o.folio,
  o.created_at,
  o.customer_email,
  o.payment_status,
  o.fulfillment_status,
  o.amount_cents,
  o.currency,
  o.mp_payment_id,
  (o.mp_payment_id is null and o.payment_status = 'paid') as paid_without_mp_payment_id,
  coalesce(payment_counts.active_payment_ledgers, 0) as active_payment_ledgers,
  coalesce(claim_counts.profile_claims, 0) as profile_claims,
  coalesce(card_counts.cards, 0) as cards,
  case
    when o.payment_status = 'paid' and o.mp_payment_id is null then 'legacy_or_manual_paid_without_mp'
    when o.payment_status = 'paid' and coalesce(payment_counts.active_payment_ledgers, 0) = 0 then 'paid_without_payment_ledger'
    when o.payment_status = 'paid' and coalesce(claim_counts.profile_claims, 0) = 0 then 'paid_without_activation_claim'
    when o.payment_status = 'paid' and coalesce(card_counts.cards, 0) = 0 then 'paid_without_card_lifecycle'
    else 'ok'
  end as prelaunch_integrity_status
from public.orders o
left join (
  select order_id, count(*)::integer as active_payment_ledgers
  from public.payments
  where coalesce(deleted_at is null, true)
  group by order_id
) payment_counts on payment_counts.order_id = o.id
left join (
  select order_id, count(*)::integer as profile_claims
  from public.profile_claims
  group by order_id
) claim_counts on claim_counts.order_id = o.id
left join (
  select order_id, count(*)::integer as cards
  from public.cards
  where deleted_at is null
  group by order_id
) card_counts on card_counts.order_id = o.id
where o.deleted_at is null;

comment on view public.prelaunch_order_integrity_audit is
  'Read-only pre-launch audit view for legacy/manual/test order hygiene.';

commit;
