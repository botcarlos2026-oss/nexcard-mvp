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

  perform setval('public.order_folio_seq', greatest(v_max_suffix, 0), true);

  new.folio := 'NX-' || v_year || '-' || lpad(nextval('public.order_folio_seq')::text, 3, '0');
  return new;
end;
$$;

select setval(
  'public.order_folio_seq',
  greatest(
    coalesce((
      select max(split_part(folio, '-', 3)::integer)
      from public.orders
      where folio like ('NX-' || extract(year from now())::text || '-%')
    ), 0),
    0
  ),
  true
);

commit;
