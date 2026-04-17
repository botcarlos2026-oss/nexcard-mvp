begin;

-- Campos para programación NFC en cards
ALTER TABLE cards ADD COLUMN IF NOT EXISTS nfc_url TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS programmed_at TIMESTAMPTZ;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS programmed_by TEXT;

-- Asegurar que profiles tiene slug
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS slug TEXT;

commit;
