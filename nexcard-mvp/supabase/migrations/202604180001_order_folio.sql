-- Folio de producción correlativo por orden: NX-YYYY-NNN
begin;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS folio TEXT UNIQUE;

CREATE SEQUENCE IF NOT EXISTS order_folio_seq START 1;

CREATE OR REPLACE FUNCTION generate_order_folio()
RETURNS TRIGGER AS $$
BEGIN
  NEW.folio := 'NX-' || EXTRACT(YEAR FROM NOW())::TEXT || '-' ||
               LPAD(nextval('order_folio_seq')::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_order_folio ON orders;
CREATE TRIGGER set_order_folio
BEFORE INSERT ON orders
FOR EACH ROW
WHEN (NEW.folio IS NULL)
EXECUTE FUNCTION generate_order_folio();

-- Asignar folios a órdenes existentes sin folio
UPDATE orders
SET folio = 'NX-' || EXTRACT(YEAR FROM created_at)::TEXT || '-' ||
            LPAD(ROW_NUMBER() OVER (ORDER BY created_at)::TEXT, 3, '0')
WHERE folio IS NULL;

commit;
