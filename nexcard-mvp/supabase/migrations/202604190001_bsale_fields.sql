begin;

-- Bsale SII fields on orders table
-- These are NO-OP until BSALE_ACCESS_TOKEN is configured in Supabase Secrets

ALTER TABLE orders ADD COLUMN IF NOT EXISTS bsale_document_id INTEGER;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS bsale_document_url TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS bsale_emitted_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS requires_invoice BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_rut TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_razon_social TEXT;

commit;
