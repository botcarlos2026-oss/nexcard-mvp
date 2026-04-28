begin;

CREATE TABLE IF NOT EXISTS team_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  bio TEXT,
  photo_url TEXT,
  linkedin_url TEXT,
  email TEXT,
  display_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'team_members' AND policyname = 'team_members_anon_select') THEN
    CREATE POLICY "team_members_anon_select" ON team_members FOR SELECT TO anon USING (active = true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'team_members' AND policyname = 'team_members_auth_all') THEN
    CREATE POLICY "team_members_auth_all" ON team_members FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

commit;
