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

commit;
