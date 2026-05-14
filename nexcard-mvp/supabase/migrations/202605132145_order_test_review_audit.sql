begin;

alter table public.orders
  add column if not exists qa_reviewed_at timestamptz,
  add column if not exists qa_reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists qa_reviewed_by_label text,
  add column if not exists qa_review_note text;

create index if not exists orders_qa_reviewed_at_idx
  on public.orders(qa_reviewed_at);

create or replace function public.admin_override_order_test_classification(
  target_order_id uuid,
  target_is_test boolean,
  target_reason text default null
) returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  previous_order public.orders;
  updated_order public.orders;
  normalized_reason text := nullif(trim(coalesce(target_reason, '')), '');
  actor_id uuid := auth.uid();
  actor_role_value text := case
    when auth.role() = 'service_role' then 'service_role'
    when coalesce(public.has_role('admin'), false) then 'admin'
    else coalesce(auth.role(), 'unknown')
  end;
  actor_label_value text := coalesce(
    nullif(auth.jwt() ->> 'email', ''),
    nullif(auth.jwt() -> 'user_metadata' ->> 'email', ''),
    nullif(auth.jwt() -> 'app_metadata' ->> 'email', ''),
    case when auth.role() = 'service_role' then 'service_role' else null end,
    'admin'
  );
begin
  if not (coalesce(public.has_role('admin'), false) or auth.role() = 'service_role') then
    raise exception 'Solo admin puede modificar la clasificación QA/test de órdenes';
  end if;

  select * into previous_order
  from public.orders
  where id = target_order_id;

  if previous_order.id is null then
    raise exception 'Orden no encontrada';
  end if;

  update public.orders
  set
    is_test = target_is_test,
    test_reason = case
      when target_is_test then coalesce(normalized_reason, 'manual_admin_override')
      else coalesce(normalized_reason, 'manual_admin_override_real')
    end,
    qa_reviewed_at = null,
    qa_reviewed_by = null,
    qa_reviewed_by_label = null,
    qa_review_note = null,
    updated_at = now()
  where id = target_order_id
  returning * into updated_order;

  insert into public.order_status_history (
    order_id,
    field,
    old_value,
    new_value,
    actor_user_id,
    actor_role,
    actor_label
  )
  values
    (target_order_id, 'is_test', case when previous_order.is_test then 'true' else 'false' end, case when updated_order.is_test then 'true' else 'false' end, actor_id, actor_role_value, actor_label_value),
    (target_order_id, 'test_reason', coalesce(previous_order.test_reason, ''), coalesce(updated_order.test_reason, ''), actor_id, actor_role_value, actor_label_value),
    (target_order_id, 'qa_review_reset', coalesce(previous_order.qa_reviewed_by_label, ''), '', actor_id, actor_role_value, actor_label_value);

  return updated_order;
end;
$$;

create or replace function public.admin_review_order_test_classification(
  target_order_id uuid,
  review_note text default null
) returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  previous_order public.orders;
  updated_order public.orders;
  normalized_note text := nullif(trim(coalesce(review_note, '')), '');
  actor_id uuid := auth.uid();
  actor_role_value text := case
    when auth.role() = 'service_role' then 'service_role'
    when coalesce(public.has_role('admin'), false) then 'admin'
    else coalesce(auth.role(), 'unknown')
  end;
  actor_label_value text := coalesce(
    nullif(auth.jwt() ->> 'email', ''),
    nullif(auth.jwt() -> 'user_metadata' ->> 'email', ''),
    nullif(auth.jwt() -> 'app_metadata' ->> 'email', ''),
    case when auth.role() = 'service_role' then 'service_role' else null end,
    'admin'
  );
begin
  if not (coalesce(public.has_role('admin'), false) or auth.role() = 'service_role') then
    raise exception 'Solo admin puede revisar la clasificación QA/test de órdenes';
  end if;

  select * into previous_order
  from public.orders
  where id = target_order_id;

  if previous_order.id is null then
    raise exception 'Orden no encontrada';
  end if;

  update public.orders
  set
    qa_reviewed_at = now(),
    qa_reviewed_by = actor_id,
    qa_reviewed_by_label = actor_label_value,
    qa_review_note = normalized_note,
    updated_at = now()
  where id = target_order_id
  returning * into updated_order;

  insert into public.order_status_history (
    order_id,
    field,
    old_value,
    new_value,
    actor_user_id,
    actor_role,
    actor_label
  )
  values
    (target_order_id, 'qa_reviewed_at', coalesce(previous_order.qa_reviewed_at::text, ''), coalesce(updated_order.qa_reviewed_at::text, ''), actor_id, actor_role_value, actor_label_value),
    (target_order_id, 'qa_reviewed_by_label', coalesce(previous_order.qa_reviewed_by_label, ''), coalesce(updated_order.qa_reviewed_by_label, ''), actor_id, actor_role_value, actor_label_value),
    (target_order_id, 'qa_review_note', coalesce(previous_order.qa_review_note, ''), coalesce(updated_order.qa_review_note, ''), actor_id, actor_role_value, actor_label_value);

  return updated_order;
end;
$$;

grant execute on function public.admin_review_order_test_classification(uuid, text) to authenticated, service_role;

comment on function public.admin_review_order_test_classification(uuid, text)
  is 'Permite a un admin marcar como revisada una clasificación QA/test y registrar quién auditó después del override.';

commit;
