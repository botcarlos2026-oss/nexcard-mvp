begin;

CREATE TABLE IF NOT EXISTS review_cards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  customer_email TEXT NOT NULL,
  business_name TEXT NOT NULL,
  google_review_url TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  scan_count INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE review_cards ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'review_cards' AND policyname = 'review_cards_anon_select'
  ) THEN
    CREATE POLICY "review_cards_anon_select"
    ON review_cards FOR SELECT TO anon
    USING (active = true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'review_cards' AND policyname = 'review_cards_authenticated_all'
  ) THEN
    CREATE POLICY "review_cards_authenticated_all"
    ON review_cards FOR ALL TO authenticated
    USING (true) WITH CHECK (true);
  END IF;
END $$;

commit;
