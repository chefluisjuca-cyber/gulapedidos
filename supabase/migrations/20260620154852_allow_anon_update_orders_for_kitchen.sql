CREATE POLICY "anon_update_orders"
  ON orders FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);