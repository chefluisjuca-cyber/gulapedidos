-- Allow phone to be null (email-based customers won't have a phone)
ALTER TABLE loyalty_customers ALTER COLUMN phone DROP NOT NULL;

-- Add email and Supabase Auth link columns
ALTER TABLE loyalty_customers
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_loyalty_customers_auth_user_id
  ON loyalty_customers(auth_user_id);

CREATE INDEX IF NOT EXISTS idx_loyalty_customers_email
  ON loyalty_customers(restaurant_id, email)
  WHERE email IS NOT NULL;
