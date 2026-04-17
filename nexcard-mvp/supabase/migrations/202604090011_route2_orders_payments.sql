-- Formal Supabase migration for NexCard
-- Source: supabase/route2_orders_payments_minimal.sql
-- Validation: validated manually before promotion; run in staging before prod.

-- NexCard Route 2.4 — Minimal orders/payments lifecycle helpers
-- Draft. Review before execution.

begin;

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
  if new_status not in ('pending', 'authorized', 'paid', 'failed', 'refunded') then
    raise exception 'Invalid order payment status: %', new_status;
  end if;

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

  if current_status = new_status then
    raise exception 'Order payment status already %', new_status;
  end if;

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
  if new_status not in ('new', 'printing', 'shipping', 'delivered', 'canceled') then
    raise exception 'Invalid order fulfillment status: %', new_status;
  end if;

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

  if current_status = new_status then
    raise exception 'Order fulfillment status already %', new_status;
  end if;

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
  if new_status not in ('pending', 'authorized', 'paid', 'failed', 'refunded') then
    raise exception 'Invalid payment status: %', new_status;
  end if;

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
