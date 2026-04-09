-- NexCard Route 2.4 — Minimal orders/payments lifecycle helpers
-- Draft. Review before execution.

begin;

create or replace function public.assert_order_payment_status_transition(
  current_status text,
  next_status text
)
returns void
language plpgsql
as $$
begin
  if next_status not in ('pending', 'authorized', 'paid', 'failed', 'refunded') then
    raise exception 'Invalid order payment status: %', next_status;
  end if;

  if current_status is null then
    return;
  end if;

  if current_status = next_status then
    raise exception 'Order payment status already %', next_status;
  end if;

  if current_status = 'refunded' then
    raise exception 'Cannot transition order payment status from refunded to %', next_status;
  end if;

  if current_status = 'failed' and next_status = 'authorized' then
    raise exception 'Invalid order payment transition: % -> %', current_status, next_status;
  end if;

  if current_status = 'paid' and next_status in ('pending', 'authorized') then
    raise exception 'Invalid order payment transition: % -> %', current_status, next_status;
  end if;
end;
$$;

create or replace function public.assert_order_fulfillment_status_transition(
  current_status text,
  next_status text
)
returns void
language plpgsql
as $$
begin
  if next_status not in ('new', 'printing', 'shipping', 'delivered', 'canceled') then
    raise exception 'Invalid order fulfillment status: %', next_status;
  end if;

  if current_status is null then
    return;
  end if;

  if current_status = next_status then
    raise exception 'Order fulfillment status already %', next_status;
  end if;

  if current_status in ('delivered', 'canceled') then
    raise exception 'Cannot transition order fulfillment status from % to %', current_status, next_status;
  end if;

  if current_status = 'new' and next_status not in ('printing', 'canceled') then
    raise exception 'Invalid order fulfillment transition: % -> %', current_status, next_status;
  end if;

  if current_status = 'printing' and next_status not in ('shipping', 'canceled') then
    raise exception 'Invalid order fulfillment transition: % -> %', current_status, next_status;
  end if;

  if current_status = 'shipping' and next_status not in ('delivered', 'canceled') then
    raise exception 'Invalid order fulfillment transition: % -> %', current_status, next_status;
  end if;
end;
$$;

create or replace function public.assert_payment_status_transition(
  current_status text,
  next_status text
)
returns void
language plpgsql
as $$
begin
  if next_status not in ('pending', 'authorized', 'paid', 'failed', 'refunded') then
    raise exception 'Invalid payment status: %', next_status;
  end if;

  if current_status is null then
    return;
  end if;

  if current_status = next_status then
    raise exception 'Payment status already %', next_status;
  end if;

  if current_status = 'refunded' then
    raise exception 'Cannot transition payment status from refunded to %', next_status;
  end if;

  if current_status = 'failed' and next_status = 'authorized' then
    raise exception 'Invalid payment transition: % -> %', current_status, next_status;
  end if;

  if current_status = 'paid' and next_status in ('pending', 'authorized') then
    raise exception 'Invalid payment transition: % -> %', current_status, next_status;
  end if;
end;
$$;

create or replace function public.reconcile_order_payment_status(
  target_order_id uuid,
  actor_id uuid,
  reason text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  before_state jsonb;
  current_status text;
  resolved_status text;
  payment_summary jsonb;
begin
  select to_jsonb(o), o.payment_status
  into before_state, current_status
  from public.orders o
  where o.id = target_order_id;

  if before_state is null then
    raise exception 'Order not found';
  end if;

  if (before_state ->> 'deleted_at') is not null then
    raise exception 'Cannot reconcile payment status on soft deleted order';
  end if;

  select jsonb_agg(
           jsonb_build_object(
             'payment_id', p.id,
             'status', p.status,
             'external_id', p.external_id,
             'updated_at', p.updated_at
           )
           order by p.updated_at desc nulls last, p.created_at desc nulls last
         )
  into payment_summary
  from public.payments p
  where p.order_id = target_order_id
    and p.deleted_at is null;

  if payment_summary is null then
    raise exception 'No active payments found for order %', target_order_id;
  end if;

  resolved_status := case
    when exists (
      select 1 from public.payments p
      where p.order_id = target_order_id
        and p.deleted_at is null
        and p.status = 'refunded'
    ) then 'refunded'
    when exists (
      select 1 from public.payments p
      where p.order_id = target_order_id
        and p.deleted_at is null
        and p.status = 'paid'
    ) then 'paid'
    when exists (
      select 1 from public.payments p
      where p.order_id = target_order_id
        and p.deleted_at is null
        and p.status = 'authorized'
    ) then 'authorized'
    when exists (
      select 1 from public.payments p
      where p.order_id = target_order_id
        and p.deleted_at is null
        and p.status = 'pending'
    ) then 'pending'
    when exists (
      select 1 from public.payments p
      where p.order_id = target_order_id
        and p.deleted_at is null
        and p.status = 'failed'
    ) then 'failed'
    else current_status
  end;

  if current_status = resolved_status then
    raise exception 'Order payment status already reconciled as %', resolved_status;
  end if;

  perform public.snapshot_order(target_order_id, actor_id);

  update public.orders
  set payment_status = resolved_status,
      updated_at = now()
  where id = target_order_id;

  insert into public.audit_log (
    actor_user_id,
    actor_role,
    entity_type,
    entity_id,
    action,
    before,
    after,
    context
  )
  values (
    actor_id,
    null,
    'order',
    target_order_id,
    'order_payment_status_reconciled',
    before_state,
    (select to_jsonb(o) from public.orders o where o.id = target_order_id),
    jsonb_build_object(
      'from_status', current_status,
      'to_status', resolved_status,
      'reason', reason,
      'payments', payment_summary
    )
  );

  return resolved_status;
end;
$$;

create or replace function public.snapshot_order(target_order_id uuid, actor_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  before_state jsonb;
begin
  select to_jsonb(o)
  into before_state
  from public.orders o
  where o.id = target_order_id;

  if before_state is null then
    raise exception 'Order not found';
  end if;

  insert into public.audit_log (
    actor_user_id,
    actor_role,
    entity_type,
    entity_id,
    action,
    before,
    after,
    context
  )
  values (
    actor_id,
    null,
    'order',
    target_order_id,
    'order_snapshot',
    before_state,
    null,
    '{}'::jsonb
  );
end;
$$;

create or replace function public.soft_delete_order(target_order_id uuid, actor_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  before_state jsonb;
begin
  select to_jsonb(o)
  into before_state
  from public.orders o
  where o.id = target_order_id;

  if before_state is null then
    raise exception 'Order not found';
  end if;

  if (before_state ->> 'deleted_at') is not null then
    raise exception 'Order already soft deleted';
  end if;

  perform public.snapshot_order(target_order_id, actor_id);

  update public.orders
  set deleted_at = now(),
      updated_at = now()
  where id = target_order_id;

  insert into public.audit_log (
    actor_user_id,
    actor_role,
    entity_type,
    entity_id,
    action,
    before,
    after,
    context
  )
  values (
    actor_id,
    null,
    'order',
    target_order_id,
    'order_soft_delete',
    before_state,
    (select to_jsonb(o) from public.orders o where o.id = target_order_id),
    '{}'::jsonb
  );
end;
$$;

create or replace function public.mark_order_payment_status(
  target_order_id uuid,
  new_status text,
  actor_id uuid,
  reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  before_state jsonb;
  current_status text;
begin
  select to_jsonb(o), o.payment_status
  into before_state, current_status
  from public.orders o
  where o.id = target_order_id;

  if before_state is null then
    raise exception 'Order not found';
  end if;

  if (before_state ->> 'deleted_at') is not null then
    raise exception 'Cannot change payment status on soft deleted order';
  end if;

  perform public.assert_order_payment_status_transition(current_status, new_status);

  perform public.snapshot_order(target_order_id, actor_id);

  update public.orders
  set payment_status = new_status,
      updated_at = now()
  where id = target_order_id;

  insert into public.audit_log (
    actor_user_id,
    actor_role,
    entity_type,
    entity_id,
    action,
    before,
    after,
    context
  )
  values (
    actor_id,
    null,
    'order',
    target_order_id,
    'order_payment_status_change',
    before_state,
    (select to_jsonb(o) from public.orders o where o.id = target_order_id),
    jsonb_build_object(
      'from_status', current_status,
      'to_status', new_status,
      'reason', reason
    )
  );
end;
$$;

create or replace function public.mark_order_fulfillment_status(
  target_order_id uuid,
  new_status text,
  actor_id uuid,
  reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  before_state jsonb;
  current_status text;
begin
  select to_jsonb(o), o.fulfillment_status
  into before_state, current_status
  from public.orders o
  where o.id = target_order_id;

  if before_state is null then
    raise exception 'Order not found';
  end if;

  if (before_state ->> 'deleted_at') is not null then
    raise exception 'Cannot change fulfillment status on soft deleted order';
  end if;

  perform public.assert_order_fulfillment_status_transition(current_status, new_status);

  perform public.snapshot_order(target_order_id, actor_id);

  update public.orders
  set fulfillment_status = new_status,
      updated_at = now()
  where id = target_order_id;

  insert into public.audit_log (
    actor_user_id,
    actor_role,
    entity_type,
    entity_id,
    action,
    before,
    after,
    context
  )
  values (
    actor_id,
    null,
    'order',
    target_order_id,
    'order_fulfillment_status_change',
    before_state,
    (select to_jsonb(o) from public.orders o where o.id = target_order_id),
    jsonb_build_object(
      'from_status', current_status,
      'to_status', new_status,
      'reason', reason
    )
  );
end;
$$;

create or replace function public.snapshot_payment(target_payment_id uuid, actor_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  before_state jsonb;
begin
  select to_jsonb(p)
  into before_state
  from public.payments p
  where p.id = target_payment_id;

  if before_state is null then
    raise exception 'Payment not found';
  end if;

  insert into public.audit_log (
    actor_user_id,
    actor_role,
    entity_type,
    entity_id,
    action,
    before,
    after,
    context
  )
  values (
    actor_id,
    null,
    'payment',
    target_payment_id,
    'payment_snapshot',
    before_state,
    null,
    '{}'::jsonb
  );
end;
$$;

create or replace function public.soft_delete_payment(target_payment_id uuid, actor_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  before_state jsonb;
begin
  select to_jsonb(p)
  into before_state
  from public.payments p
  where p.id = target_payment_id;

  if before_state is null then
    raise exception 'Payment not found';
  end if;

  if (before_state ->> 'deleted_at') is not null then
    raise exception 'Payment already soft deleted';
  end if;

  perform public.snapshot_payment(target_payment_id, actor_id);

  update public.payments
  set deleted_at = now(),
      updated_at = now()
  where id = target_payment_id;

  insert into public.audit_log (
    actor_user_id,
    actor_role,
    entity_type,
    entity_id,
    action,
    before,
    after,
    context
  )
  values (
    actor_id,
    null,
    'payment',
    target_payment_id,
    'payment_soft_delete',
    before_state,
    (select to_jsonb(p) from public.payments p where p.id = target_payment_id),
    '{}'::jsonb
  );
end;
$$;

create or replace function public.mark_payment_status(
  target_payment_id uuid,
  new_status text,
  actor_id uuid,
  reason text default null,
  external_ref text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  before_state jsonb;
  current_status text;
  current_external_id text;
begin
  select to_jsonb(p), p.status, p.external_id
  into before_state, current_status, current_external_id
  from public.payments p
  where p.id = target_payment_id;

  if before_state is null then
    raise exception 'Payment not found';
  end if;

  if (before_state ->> 'deleted_at') is not null then
    raise exception 'Cannot change status on soft deleted payment';
  end if;

  if current_status = new_status
     and coalesce(current_external_id, '') = coalesce(external_ref, current_external_id, '') then
    raise exception 'Payment status/external reference already in requested state';
  end if;

  perform public.assert_payment_status_transition(current_status, new_status);

  perform public.snapshot_payment(target_payment_id, actor_id);

  update public.payments
  set status = new_status,
      external_id = coalesce(external_ref, external_id),
      updated_at = now()
  where id = target_payment_id;

  insert into public.audit_log (
    actor_user_id,
    actor_role,
    entity_type,
    entity_id,
    action,
    before,
    after,
    context
  )
  values (
    actor_id,
    null,
    'payment',
    target_payment_id,
    'payment_status_change',
    before_state,
    (select to_jsonb(p) from public.payments p where p.id = target_payment_id),
    jsonb_build_object(
      'from_status', current_status,
      'to_status', new_status,
      'from_external_id', current_external_id,
      'to_external_id', coalesce(external_ref, current_external_id),
      'reason', reason
    )
  );
end;
$$;

commit;
