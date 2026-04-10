-- NexCard - RPCs para lifecycle de cards

begin;

create or replace function public.assign_card(
  target_card_id uuid,
  target_profile_id uuid,
  actor_id uuid
)
returns jsonb
language plpgsql
security definer
as $$
declare
  current_card record;
begin
  if target_card_id is null then
    raise exception 'target_card_id is required';
  end if;

  if target_profile_id is null then
    raise exception 'target_profile_id is required';
  end if;

  select * into current_card
  from public.cards
  where id = target_card_id;

  if current_card.id is null then
    raise exception 'Card not found';
  end if;

  if current_card.deleted_at is not null or current_card.status = 'archived' then
    raise exception 'Cannot assign archived card';
  end if;

  if current_card.status = 'revoked' then
    raise exception 'Cannot assign revoked card';
  end if;

  update public.cards
  set
    profile_id = target_profile_id,
    status = 'assigned',
    activation_status = 'assigned'
  where id = target_card_id;

  insert into public.card_events (
    card_id,
    event_type,
    created_at
  ) values (
    target_card_id,
    'assigned',
    now()
  );

  insert into public.audit_log (
    actor_user_id,
    entity_type,
    entity_id,
    action,
    context,
    created_at
  ) values (
    actor_id,
    'card',
    target_card_id,
    'assign',
    jsonb_build_object('profile_id', target_profile_id),
    now()
  );

  return jsonb_build_object(
    'ok', true,
    'card_id', target_card_id,
    'profile_id', target_profile_id
  );
end;
$$;

create or replace function public.activate_card(
  target_card_id uuid,
  actor_id uuid
)
returns jsonb
language plpgsql
security definer
as $$
declare
  current_card record;
begin
  if target_card_id is null then
    raise exception 'target_card_id is required';
  end if;

  select * into current_card
  from public.cards
  where id = target_card_id;

  if current_card.id is null then
    raise exception 'Card not found';
  end if;

  if current_card.profile_id is null then
    raise exception 'Card must be assigned before activation';
  end if;

  if current_card.deleted_at is not null or current_card.status = 'archived' then
    raise exception 'Cannot activate archived card';
  end if;

  if current_card.status = 'revoked' then
    raise exception 'Cannot activate revoked card';
  end if;

  update public.cards
  set
    status = 'active',
    activation_status = 'active'
  where id = target_card_id;

  insert into public.card_events (
    card_id,
    event_type,
    created_at
  ) values (
    target_card_id,
    'activated',
    now()
  );

  insert into public.audit_log (
    actor_user_id,
    entity_type,
    entity_id,
    action,
    context,
    created_at
  ) values (
    actor_id,
    'card',
    target_card_id,
    'activate',
    jsonb_build_object('previous_status', current_card.status, 'previous_activation_status', current_card.activation_status),
    now()
  );

  return jsonb_build_object(
    'ok', true,
    'card_id', target_card_id
  );
end;
$$;

commit;
