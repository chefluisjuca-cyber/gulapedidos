
CREATE TABLE IF NOT EXISTS restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  subdomain text,
  owner_email text NOT NULL,
  status text NOT NULL DEFAULT 'trial'
    CHECK (status IN ('active', 'suspended', 'trial')),
  modules jsonb NOT NULL DEFAULT '["gula_pedidos"]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;

-- Allow anon full access (super admin uses anon key, TenantGuard reads by slug)
CREATE POLICY "anon_select_restaurants"  ON restaurants FOR SELECT  TO anon USING (true);
CREATE POLICY "anon_insert_restaurants"  ON restaurants FOR INSERT  TO anon WITH CHECK (true);
CREATE POLICY "anon_update_restaurants"  ON restaurants FOR UPDATE  TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_restaurants"  ON restaurants FOR DELETE  TO anon USING (true);
