begin;

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

  insert into public.order_status_history (order_id, field, old_value, new_value)
  values
    (target_order_id, 'is_test', case when previous_order.is_test then 'true' else 'false' end, case when updated_order.is_test then 'true' else 'false' end),
    (target_order_id, 'test_reason', coalesce(previous_order.test_reason, ''), coalesce(updated_order.test_reason, ''));

  return updated_order;
end;
$$;

grant execute on function public.admin_override_order_test_classification(uuid, boolean, text) to authenticated, service_role;

comment on function public.admin_override_order_test_classification(uuid, boolean, text)
  is 'Permite a un admin forzar manualmente la clasificación QA/test de una orden sin depender del clasificador automático.';

commit;
