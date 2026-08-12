-- Ensure Mercado Pago webhook retries cannot create duplicate active ledger rows.
-- Soft-deleted historical rows are excluded; rows without provider external_id remain allowed.

create unique index if not exists payments_provider_external_id_active_unique
  on public.payments (provider, external_id)
  where deleted_at is null
    and external_id is not null;
