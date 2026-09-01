-- Allow authenticated users to SELECT from super_admins so TenantGuard can verify super admin status
DROP POLICY IF EXISTS "deny_all_authenticated" ON super_admins;

CREATE POLICY "super_admins_select_authenticated" ON super_admins
  FOR SELECT TO authenticated USING (true);
