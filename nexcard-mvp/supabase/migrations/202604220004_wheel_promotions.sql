begin;

CREATE TABLE IF NOT EXISTS wheel_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  active BOOLEAN DEFAULT false,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  banner_url TEXT,
  banner_title TEXT DEFAULT 'Gira la ruleta',
  banner_subtitle TEXT DEFAULT 'Premio garantizado en tu primera compra',
  show_on_first_visit BOOLEAN DEFAULT true,
  show_floating_button BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wheel_prizes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wheel_id UUID REFERENCES wheel_config(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('discount_percent','discount_amount','free_shipping','free_product','other')),
  value INTEGER DEFAULT 0,
  coupon_code TEXT,
  weight INTEGER DEFAULT 10 CHECK (weight BETWEEN 1 AND 100),
  color TEXT DEFAULT '#10B981',
  display_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wheel_spins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wheel_id UUID REFERENCES wheel_config(id) ON DELETE SET NULL,
  prize_id UUID REFERENCES wheel_prizes(id) ON DELETE SET NULL,
  visitor_id TEXT NOT NULL,
  email TEXT,
  redeemed BOOLEAN DEFAULT false,
  redeemed_at TIMESTAMPTZ,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  spun_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS wheel_spins_visitor_idx ON wheel_spins(visitor_id);
CREATE INDEX IF NOT EXISTS wheel_prizes_wheel_idx ON wheel_prizes(wheel_id);

ALTER TABLE wheel_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE wheel_prizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE wheel_spins ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'wheel_config' AND policyname = 'wheel_config_anon_select') THEN
    CREATE POLICY "wheel_config_anon_select" ON wheel_config FOR SELECT TO anon USING (active = true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'wheel_prizes' AND policyname = 'wheel_prizes_anon_select') THEN
    CREATE POLICY "wheel_prizes_anon_select" ON wheel_prizes FOR SELECT TO anon USING (active = true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'wheel_spins' AND policyname = 'wheel_spins_anon_insert') THEN
    CREATE POLICY "wheel_spins_anon_insert" ON wheel_spins FOR INSERT TO anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'wheel_config' AND policyname = 'wheel_config_auth_all') THEN
    CREATE POLICY "wheel_config_auth_all" ON wheel_config FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'wheel_prizes' AND policyname = 'wheel_prizes_auth_all') THEN
    CREATE POLICY "wheel_prizes_auth_all" ON wheel_prizes FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'wheel_spins' AND policyname = 'wheel_spins_auth_all') THEN
    CREATE POLICY "wheel_spins_auth_all" ON wheel_spins FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

commit;
