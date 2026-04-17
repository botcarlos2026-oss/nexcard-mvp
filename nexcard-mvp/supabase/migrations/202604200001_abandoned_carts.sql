begin;

-- Tabla: carritos abandonados
CREATE TABLE IF NOT EXISTS abandoned_carts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  customer_name TEXT,
  items JSONB NOT NULL,
  total_cents INTEGER NOT NULL,
  status TEXT DEFAULT 'abandoned'
    CHECK (status IN ('abandoned', 'converted', 'email_sent', 'ignored')),
  reminder_sent_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE abandoned_carts ENABLE ROW LEVEL SECURITY;

-- Anon puede insertar y actualizar (checkout sin sesión)
CREATE POLICY "abandoned_carts_anon_insert"
  ON abandoned_carts FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "abandoned_carts_anon_update"
  ON abandoned_carts FOR UPDATE TO anon
  USING (true);

-- Usuarios autenticados (admin) tienen acceso completo
CREATE POLICY "abandoned_carts_authenticated_all"
  ON abandoned_carts FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Índice para el cron (busca por status + created_at)
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_status_created
  ON abandoned_carts (status, created_at)
  WHERE status = 'abandoned';

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_abandoned_carts_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_abandoned_carts_updated_at ON abandoned_carts;
CREATE TRIGGER trg_abandoned_carts_updated_at
  BEFORE UPDATE ON abandoned_carts
  FOR EACH ROW EXECUTE FUNCTION update_abandoned_carts_updated_at();

commit;
