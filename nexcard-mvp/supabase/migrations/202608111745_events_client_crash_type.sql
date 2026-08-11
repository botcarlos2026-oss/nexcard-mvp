-- NexCard analytics/crash monitoring event type hardening.
-- Adds app-owned client crash telemetry while preserving existing public CTA/view event types.

begin;

alter table public.events
  drop constraint if exists chk_event_type_valid;

alter table public.events
  add constraint chk_event_type_valid
  check (event_type = any (array[
    'view'::text,
    'whatsapp'::text,
    'vcard'::text,
    'instagram'::text,
    'linkedin'::text,
    'website'::text,
    'calendar'::text,
    'share'::text,
    'client_crash'::text
  ]));

commit;
