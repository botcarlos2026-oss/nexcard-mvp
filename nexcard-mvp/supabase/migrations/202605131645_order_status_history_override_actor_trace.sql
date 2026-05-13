begin;

alter table public.order_status_history
  add column if not exists actor_user_id uuid references auth.users(id) on delete set null,
  add column if not exists actor_role text,
  add column if not exists actor_label text;

create index if not exists order_status_history_actor_user_idx
  on public.order_status_history(actor_user_id);

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
    (
      target_order_id,
      'is_test',
      case when previous_order.is_test then 'true' else 'false' end,
      case when updated_order.is_test then 'true' else 'false' end,
      actor_id,
      actor_role_value,
      actor_label_value
    ),
    (
      target_order_id,
      'test_reason',
      coalesce(previous_order.test_reason, ''),
      coalesce(updated_order.test_reason, ''),
      actor_id,
      actor_role_value,
      actor_label_value
    );

  return updated_order;
end;
$$;

comment on function public.admin_override_order_test_classification(uuid, boolean, text)
  is 'Permite a un admin forzar manualmente la clasificación QA/test de una orden y registrar quién hizo el override.';

commit;
