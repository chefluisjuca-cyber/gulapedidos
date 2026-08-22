CREATE TABLE IF NOT EXISTS super_admins (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL UNIQUE,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;

-- Super admins table is only readable/writable via service role (edge function)
-- Deny all access to anon and authenticated users — managed by the Edge Function
CREATE POLICY "deny_all_anon" ON super_admins FOR ALL TO anon USING (false);
CREATE POLICY "deny_all_authenticated" ON super_admins FOR ALL TO authenticated USING (false);
