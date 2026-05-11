begin;

alter table public.email_log
  add column if not exists subject text,
  add column if not exists provider text,
  add column if not exists provider_message_id text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.email_log
  drop constraint if exists email_log_email_type_check;

alter table public.email_log
  add constraint email_log_email_type_check
  check (email_type in (
    'order_confirmation',
    'shipping',
    'profile_activation',
    'abandoned_cart',
    'followup',
    'upsell',
    'campaign',
    'waitlist_launch',
    'low_stock_alert',
    'internal_notification'
  ));

create or replace function public.log_email_event(
  p_recipient_email text,
  p_email_type text,
  p_order_id uuid default null,
  p_subject text default null,
  p_status text default 'sent',
  p_provider text default 'resend',
  p_provider_message_id text default null,
  p_metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_id uuid;
begin
  if p_recipient_email is null or btrim(p_recipient_email) = '' then
    raise exception 'recipient_email requerido';
  end if;

  insert into public.email_log (
    recipient_email,
    email_type,
    order_id,
    subject,
    status,
    provider,
    provider_message_id,
    metadata
  ) values (
    lower(trim(p_recipient_email)),
    p_email_type,
    p_order_id,
    p_subject,
    coalesce(p_status, 'sent'),
    coalesce(p_provider, 'resend'),
    p_provider_message_id,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into inserted_id;

  return inserted_id;
end;
$$;

revoke all on function public.log_email_event(text, text, uuid, text, text, text, text, jsonb) from public;
grant execute on function public.log_email_event(text, text, uuid, text, text, text, text, jsonb) to authenticated, service_role;

commit;
