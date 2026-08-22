
-- Allow authenticated users to check if they are super admins (own row only)
DROP POLICY IF EXISTS "deny_all_authenticated" ON super_admins;
CREATE POLICY "select_own_super_admin" ON super_admins
  FOR SELECT TO authenticated
  USING (email = auth.email());

-- Allow super admins (authenticated users in super_admins table) to fully manage restaurants
CREATE POLICY "superadmin_insert_restaurant" ON restaurants
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM super_admins WHERE email = auth.email()));

-- Merge with existing owner_update by adding a superadmin update policy
CREATE POLICY "superadmin_update_restaurant" ON restaurants
  FOR UPDATE TO authenticated
  USING  (EXISTS (SELECT 1 FROM super_admins WHERE email = auth.email()))
  WITH CHECK (EXISTS (SELECT 1 FROM super_admins WHERE email = auth.email()));

CREATE POLICY "superadmin_delete_restaurant" ON restaurants
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM super_admins WHERE email = auth.email()));
