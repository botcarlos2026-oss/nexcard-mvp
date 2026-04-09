-- NexCard B1 — Secure card_scans access
-- Apply after review.

begin;

alter table if exists public.card_scans enable row level security;

drop policy if exists "card_scans_public_insert" on public.card_scans;
drop policy if exists "card_scans_admin_read" on public.card_scans;
drop policy if exists "card_scans_admin_manage" on public.card_scans;

-- Allow controlled inserts from public traffic / bridge.
create policy "card_scans_public_insert"
on public.card_scans
for insert
to anon, authenticated
with check (
  card_id is not null
  and scan_source is not null
  and coalesce(risk_score, 0) >= 0
);

-- Admin can read telemetry.
create policy "card_scans_admin_read"
on public.card_scans
for select
to authenticated
using (
  public.has_role('admin')
);

-- Admin can manage telemetry if needed for internal operations.
create policy "card_scans_admin_manage"
on public.card_scans
for all
to authenticated
using (
  public.has_role('admin')
)
with check (
  public.has_role('admin')
);

commit;
