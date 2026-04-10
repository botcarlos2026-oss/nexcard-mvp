-- NexCard - hardening de revoke_card

create or replace function public.revoke_card(
  target_card_id uuid,
  actor_id uuid,
  reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_card record;
  linked_order_id uuid;
begin
  if target_card_id is null then
    raise exception 'target_card_id is required';
  end if;

  select * into current_card
  from public.cards
  where id = target_card_id;

  if current_card.id is null then
    raise exception 'card_not_found';
  end if;

  if current_card.deleted_at is not null or current_card.status = 'archived' then
    raise exception 'cannot_revoke_archived_card';
  end if;

  if current_card.status = 'revoked' then
    return jsonb_build_object(
      'ok', true,
      'skipped', true,
      'reason', 'already_revoked',
      'card_id', target_card_id
    );
  end if;

  select order_id
  into linked_order_id
  from public.order_cards
  where card_id = target_card_id
  limit 1;

  update public.cards
  set
    status = 'revoked',
    activation_status = 'revoked',
    revoked_at = now()
  where id = target_card_id;

  insert into public.card_events (
    card_id,
    event_type,
    created_at
  ) values (
    target_card_id,
    'revoked',
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
    'revoke',
    jsonb_build_object(
      'reason', reason,
      'previous_status', current_card.status,
      'previous_activation_status', current_card.activation_status,
      'profile_id', current_card.profile_id,
      'linked_order_id', linked_order_id
    ),
    now()
  );

  return jsonb_build_object(
    'ok', true,
    'card_id', target_card_id,
    'linked_order_id', linked_order_id
  );
end;
$$;
