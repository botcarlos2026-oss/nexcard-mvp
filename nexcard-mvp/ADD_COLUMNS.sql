ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS facebook text,
ADD COLUMN IF NOT EXISTS facebook_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS contact_phone_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS contact_email_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS portfolio_url text,
ADD COLUMN IF NOT EXISTS portfolio_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS company text,
ADD COLUMN IF NOT EXISTS location text;
