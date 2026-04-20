begin;

CREATE TABLE IF NOT EXISTS crm_contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  source TEXT DEFAULT 'nfc_tap',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_deals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  amount_cents INTEGER DEFAULT 0,
  stage TEXT DEFAULT 'nuevo_lead'
    CHECK (stage IN ('nuevo_lead','contactado','propuesta','negociacion','cerrado_ganado','cerrado_perdido')),
  probability INTEGER DEFAULT 0 CHECK (probability BETWEEN 0 AND 100),
  closing_at DATE,
  closed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID REFERENCES crm_deals(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
  type TEXT CHECK (type IN ('call','email','meeting','note','whatsapp')),
  title TEXT NOT NULL,
  description TEXT,
  scheduled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS card_scans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_slug TEXT NOT NULL,
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
  scanned_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_contacts_auth" ON crm_contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "crm_deals_auth" ON crm_deals FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "crm_activities_auth" ON crm_activities FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "card_scans_anon_insert" ON card_scans FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "card_scans_auth_select" ON card_scans FOR SELECT TO authenticated USING (true);

commit;
