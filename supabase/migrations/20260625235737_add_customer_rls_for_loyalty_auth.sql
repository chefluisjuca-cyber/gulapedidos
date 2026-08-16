-- Allow loyalty customers (email/password auth) to manage their own record
-- These customers are authenticated users who are NOT restaurant owners

CREATE POLICY "customer_select_own_loyalty" ON loyalty_customers
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

CREATE POLICY "customer_insert_own_loyalty" ON loyalty_customers
  FOR INSERT TO authenticated
  WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "customer_update_own_loyalty" ON loyalty_customers
  FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());
