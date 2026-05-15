begin;

create or replace view public.order_payment_reconciliation_queue as
with payment_rollup as (
  select
    o.id as order_id,
    o.payment_status as order_payment_status,
    array_remove(array_agg(distinct p.status), null) filter (where p.deleted_at is null) as payment_statuses,
    count(p.*) filter (where p.deleted_at is null) as active_payments,
    bool_or(p.status = 'refunded') filter (where p.deleted_at is null) as has_refunded,
    bool_or(p.status = 'paid') filter (where p.deleted_at is null) as has_paid,
    bool_or(p.status in ('pending', 'authorized')) filter (where p.deleted_at is null) as has_pending_like,
    bool_or(p.status = 'failed') filter (where p.deleted_at is null) as has_failed
  from public.orders o
  left join public.payments p
    on p.order_id = o.id
  where o.deleted_at is null
  group by o.id, o.payment_status
)
select
  order_id,
  order_payment_status,
  coalesce(payment_statuses, '{}'::text[]) as payment_statuses,
  active_payments,
  case
    when active_payments = 0 then null
    when has_refunded then 'refunded'
    when has_paid then 'paid'
    when has_pending_like then 'pending'
    when has_failed then 'failed'
    else null
  end as suggested_order_payment_status,
  case
    when active_payments = 0 then false
    else order_payment_status is distinct from (
      case
        when has_refunded then 'refunded'
        when has_paid then 'paid'
        when has_pending_like then 'pending'
        when has_failed then 'failed'
        else null
      end
    )
  end as has_drift,
  case
    when active_payments = 0 then 'missing_active_payment_ledger'
    when order_payment_status is distinct from (
      case
        when has_refunded then 'refunded'
        when has_paid then 'paid'
        when has_pending_like then 'pending'
        when has_failed then 'failed'
        else null
      end
    ) then 'payment_status_mismatch'
    else null
  end as drift_reason
from payment_rollup;

create or replace function public.reconcile_order_payment_status(
  target_order_id uuid,
  actor_id uuid default null,
  reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_order public.orders%rowtype;
  queue_row public.order_payment_reconciliation_queue%rowtype;
  next_fulfillment text;
  effective_reason text := coalesce(reason, 'payment_ledger_reconciliation');
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.has_role('admin') then
    raise exception 'Solo admins o service role pueden reconciliar órdenes';
  end if;

  select *
  into current_order
  from public.orders
  where id = target_order_id
  for update;

  if not found then
    raise exception 'Orden no encontrada';
  end if;

  if current_order.deleted_at is not null then
    raise exception 'No puedes reconciliar una orden archivada';
  end if;

  select *
  into queue_row
  from public.order_payment_reconciliation_queue
  where order_id = target_order_id;

  if queue_row.active_payments = 0 then
    return jsonb_build_object(
      'order_id', target_order_id,
      'changed', false,
      'status', 'missing_active_payment_ledger',
      'order_payment_status', current_order.payment_status,
      'payment_statuses', queue_row.payment_statuses
    );
  end if;

  if queue_row.suggested_order_payment_status is null then
    return jsonb_build_object(
      'order_id', target_order_id,
      'changed', false,
      'status', 'no_recommendation',
      'order_payment_status', current_order.payment_status,
      'payment_statuses', queue_row.payment_statuses
    );
  end if;

  if queue_row.suggested_order_payment_status = current_order.payment_status then
    return jsonb_build_object(
      'order_id', target_order_id,
      'changed', false,
      'status', 'already_aligned',
      'order_payment_status', current_order.payment_status,
      'payment_statuses', queue_row.payment_statuses
    );
  end if;

  if current_order.payment_status = 'paid' and queue_row.suggested_order_payment_status not in ('paid', 'refunded') then
    return jsonb_build_object(
      'order_id', target_order_id,
      'changed', false,
      'status', 'manual_review_required',
      'order_payment_status', current_order.payment_status,
      'suggested_order_payment_status', queue_row.suggested_order_payment_status,
      'payment_statuses', queue_row.payment_statuses,
      'reason', 'paid_order_would_be_downgraded'
    );
  end if;

  if current_order.payment_status = 'refunded' and queue_row.suggested_order_payment_status <> 'refunded' then
    return jsonb_build_object(
      'order_id', target_order_id,
      'changed', false,
      'status', 'manual_review_required',
      'order_payment_status', current_order.payment_status,
      'suggested_order_payment_status', queue_row.suggested_order_payment_status,
      'payment_statuses', queue_row.payment_statuses,
      'reason', 'refunded_order_should_not_be_reopened'
    );
  end if;

  next_fulfillment := case
    when queue_row.suggested_order_payment_status = 'paid' and current_order.fulfillment_status = 'new' then 'in_production'
    else null
  end;

  perform public.admin_transition_order_state(
    target_order_id,
    queue_row.suggested_order_payment_status,
    next_fulfillment,
    effective_reason
  );

  return jsonb_build_object(
    'order_id', target_order_id,
    'changed', true,
    'status', 'reconciled',
    'from_payment_status', current_order.payment_status,
    'to_payment_status', queue_row.suggested_order_payment_status,
    'next_fulfillment_status', coalesce(next_fulfillment, current_order.fulfillment_status),
    'payment_statuses', queue_row.payment_statuses
  );
end;
$$;

revoke all on function public.reconcile_order_payment_status(uuid, uuid, text) from public;
grant execute on function public.reconcile_order_payment_status(uuid, uuid, text) to authenticated, service_role;

commit;
