begin;

alter table public.orders
  add column if not exists is_test boolean not null default false,
  add column if not exists test_reason text null;

create index if not exists idx_orders_is_test on public.orders (is_test);

create or replace function public.classify_order_test_signal(
  input_customer_name text,
  input_customer_email text
) returns jsonb
language plpgsql
immutable
as $$
declare
  v_email text := lower(trim(coalesce(input_customer_email, '')));
  v_name text := trim(coalesce(input_customer_name, ''));
begin
  if v_email = '' and v_name = '' then
    return jsonb_build_object('is_test', false, 'reason', null);
  end if;

  if v_email in (
    'bot.carlos.2026@gmail.com',
    'carlos.alvarez.contreras@gmail.com',
    'admin@nexcard.cl',
    'carlos@nexcard.cl',
    'hola@nexcard.cl'
  ) then
    return jsonb_build_object('is_test', true, 'reason', 'internal_email');
  end if;

  if v_email like '%@nexcard.cl' then
    return jsonb_build_object('is_test', true, 'reason', 'internal_domain');
  end if;

  if v_name ~* '(^|[^a-z])(qa|test|tst|smoke|demo|bot)([^a-z]|$)' then
    return jsonb_build_object('is_test', true, 'reason', 'name_pattern');
  end if;

  return jsonb_build_object('is_test', false, 'reason', null);
end;
$$;

create or replace function public.apply_order_test_segmentation()
returns trigger
language plpgsql
as $$
declare
  classification jsonb;
begin
  classification := public.classify_order_test_signal(new.customer_name, new.customer_email);
  new.is_test := coalesce((classification->>'is_test')::boolean, false);
  new.test_reason := classification->>'reason';
  return new;
end;
$$;

drop trigger if exists trg_orders_apply_test_segmentation on public.orders;
create trigger trg_orders_apply_test_segmentation
before insert or update of customer_name, customer_email
on public.orders
for each row
execute function public.apply_order_test_segmentation();

update public.orders
set
  is_test = coalesce((public.classify_order_test_signal(customer_name, customer_email)->>'is_test')::boolean, false),
  test_reason = public.classify_order_test_signal(customer_name, customer_email)->>'reason'
where true;

comment on column public.orders.is_test is 'Bandera estructural para segregar órdenes QA/internas del reporting operativo real.';
comment on column public.orders.test_reason is 'Motivo de clasificación QA/interna (internal_email, internal_domain, name_pattern).';

commit;
