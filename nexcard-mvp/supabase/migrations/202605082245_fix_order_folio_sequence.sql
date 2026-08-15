begin;

create sequence if not exists public.order_folio_seq start 1;

create or replace function public.generate_order_folio()
returns trigger
language plpgsql
as $$
declare
  v_year text := extract(year from coalesce(new.created_at, now()))::text;
  v_max_suffix integer := 0;
begin
  select coalesce(max(split_part(folio, '-', 3)::integer), 0)
    into v_max_suffix
  from public.orders
  where folio like ('NX-' || v_year || '-%');

  if v_max_suffix > 0 then
    perform setval('public.order_folio_seq', v_max_suffix, true);
  else
    perform setval('public.order_folio_seq', 1, false);
  end if;

  new.folio := 'NX-' || v_year || '-' || lpad(nextval('public.order_folio_seq')::text, 3, '0');
  return new;
end;
$$;

with current_suffix as (
  select coalesce(max(split_part(folio, '-', 3)::integer), 0) as max_suffix
  from public.orders
  where folio like ('NX-' || extract(year from now())::text || '-%')
)
select case
  when max_suffix > 0 then setval('public.order_folio_seq', max_suffix, true)
  else setval('public.order_folio_seq', 1, false)
end
from current_suffix;

commit;
