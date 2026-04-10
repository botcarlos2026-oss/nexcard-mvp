-- NexCard - RPC para reasignar tarjetas

create or replace function public.reassign_card(
  target_card_id uuid,
  target_profile_id uuid,
  actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
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
    raise exception 'card_not_found';
  end if;

  if current_card.deleted_at is not null or current_card.status = 'archived' then
    raise exception 'cannot_reassign_archived_card';
  end if;

  if current_card.status = 'revoked' then
    raise exception 'cannot_reassign_revoked_card';
  end if;

  if current_card.activation_status = 'activated' or current_card.status = 'active' then
    raise exception 'cannot_reassign_active_card';
  end if;

  if current_card.profile_id = target_profile_id then
    return jsonb_build_object(
      'ok', true,
      'skipped', true,
      'reason', 'already_assigned',
      'card_id', target_card_id,
      'profile_id', target_profile_id
    );
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
    'reassigned',
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
    'reassign',
    jsonb_build_object(
      'previous_profile_id', current_card.profile_id,
      'new_profile_id', target_profile_id,
      'previous_status', current_card.status,
      'previous_activation_status', current_card.activation_status
    ),
    now()
  );

  return jsonb_build_object(
    'ok', true,
    'card_id', target_card_id,
    'previous_profile_id', current_card.profile_id,
    'profile_id', target_profile_id
  );
end;
$$;
