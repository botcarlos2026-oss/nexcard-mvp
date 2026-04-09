-- NexCard Route 1 — Secure card_events access
-- Apply after review.

begin;

alter table if exists public.card_events enable row level security;

drop policy if exists "card_events_admin_read" on public.card_events;
drop policy if exists "card_events_admin_manage" on public.card_events;

-- card_events is lifecycle/audit telemetry, not public interaction telemetry.
-- Keep it admin-only.
create policy "card_events_admin_read"
on public.card_events
for select
to authenticated
using (
  public.has_role('admin')
);

create policy "card_events_admin_manage"
on public.card_events
for all
to authenticated
using (
  public.has_role('admin')
)
with check (
  public.has_role('admin')
);

commit;
