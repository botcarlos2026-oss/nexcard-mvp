-- NexCard — Align cards.activation_status with lifecycle model
-- Reflects the manual correction applied after validating revoke_card().

begin;

alter table public.cards
  drop constraint if exists cards_activation_status_check;

alter table public.cards
  add constraint cards_activation_status_check
  check (
    activation_status = any (
      array[
        'unassigned'::text,
        'assigned'::text,
        'activated'::text,
        'disabled'::text,
        'revoked'::text,
        'lost'::text
      ]
    )
  );

commit;
