-- Stock mínimo configurable por item con tracking de alerta enviada
begin;

ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS min_stock INTEGER DEFAULT 0;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS stock_alert_sent_at TIMESTAMPTZ;

commit;
