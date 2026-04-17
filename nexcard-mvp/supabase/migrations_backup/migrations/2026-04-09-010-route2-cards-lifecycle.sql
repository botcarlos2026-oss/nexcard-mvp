-- Formal Supabase migration for NexCard
-- Source: supabase/route2_cards_minimal.sql
-- Validation: validated manually before promotion; run in staging before prod.

-- NexCard Route 2.3 — Minimal cards lifecycle helpers
-- Draft. Review before execution.

begin;

create or replace function public.snapshot_card(target_card_id uuid, actor_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  before_state jsonb;
begin
  select to_jsonb(c)
  into before_state
  from public.cards c
  where c.id = target_card_id;

  if before_state is null then
    raise exception 'Card not found';
  end if;

  insert into public.audit_log (
    actor_user_id,
    actor_role,
    entity_type,
    entity_id,
    action,
    before,
    after,
    context
  )
  values (
    actor_id,
    null,
    'card',
    target_card_id,
    'card_snapshot',
    before_state,
    null,
    '{}'::jsonb
  );
end;
$$;

create or replace function public.soft_delete_card(target_card_id uuid, actor_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  before_state jsonb;
begin
  select to_jsonb(c)
  into before_state
  from public.cards c
  where c.id = target_card_id;

  if before_state is null then
    raise exception 'Card not found';
  end if;

  perform public.snapshot_card(target_card_id, actor_id);

  update public.cards
  set deleted_at = now(),
      status = 'archived',
      updated_at = now()
  where id = target_card_id;

  insert into public.card_events (card_id, event_type, actor_user_id, context)
  values (
    target_card_id,
    'soft_deleted',
    actor_id,
    '{}'::jsonb
  );

  insert into public.audit_log (
    actor_user_id,
    actor_role,
    entity_type,
    entity_id,
    action,
    before,
    after,
    context
  )
  values (
    actor_id,
    null,
    'card',
    target_card_id,
    'card_soft_delete',
    before_state,
    (select to_jsonb(c) from public.cards c where c.id = target_card_id),
    '{}'::jsonb
  );
end;
$$;

create or replace function public.revoke_card(target_card_id uuid, actor_id uuid, reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  before_state jsonb;
begin
  select to_jsonb(c)
  into before_state
  from public.cards c
  where c.id = target_card_id;

  if before_state is null then
    raise exception 'Card not found';
  end if;

  perform public.snapshot_card(target_card_id, actor_id);

  update public.cards
  set status = 'revoked',
      activation_status = 'revoked',
      revoked_at = now(),
      updated_at = now()
  where id = target_card_id;

  insert into public.card_events (card_id, event_type, actor_user_id, context)
  values (
    target_card_id,
    'revoked',
    actor_id,
    jsonb_build_object('reason', reason)
  );

  insert into public.audit_log (
    actor_user_id,
    actor_role,
    entity_type,
    entity_id,
    action,
    before,
    after,
    context
  )
  values (
    actor_id,
    null,
    'card',
    target_card_id,
    'card_revoke',
    before_state,
    (select to_jsonb(c) from public.cards c where c.id = target_card_id),
    jsonb_build_object('reason', reason)
  );
end;
$$;

commit;
