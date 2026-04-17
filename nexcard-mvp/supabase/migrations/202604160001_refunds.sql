-- Migración: tabla refunds + columna mp_payment_id en orders
-- Aplicar en Supabase Dashboard → SQL Editor

begin;

-- Agregar columna mp_payment_id a orders si no existe
-- (guardada por el webhook mp-webhook al confirmar el pago)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS mp_payment_id TEXT;

-- Tabla de devoluciones
CREATE TABLE IF NOT EXISTS refunds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id),
  reason TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'processed')),
  mp_refund_id TEXT,
  notes TEXT,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  processed_by TEXT
);

ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "refunds_authenticated_all"
ON refunds FOR ALL TO authenticated
USING (true) WITH CHECK (true);

commit;
