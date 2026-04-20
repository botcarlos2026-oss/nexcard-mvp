begin;

ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS name TEXT;
UPDATE inventory_items SET name = item WHERE name IS NULL;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_address TEXT;

commit;
