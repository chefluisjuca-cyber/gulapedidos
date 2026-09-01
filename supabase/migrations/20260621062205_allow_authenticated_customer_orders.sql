
-- Allow any authenticated user to insert/select orders and order_items for active restaurants
-- (Covers the case where an admin opens the customer menu while logged in)

CREATE POLICY "auth_customer_insert_orders" ON orders FOR INSERT TO authenticated
  WITH CHECK (restaurant_id IS NULL OR restaurant_id IN (
    SELECT id FROM restaurants WHERE status IN ('active', 'trial')
  ));

CREATE POLICY "auth_select_all_orders" ON orders FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "auth_customer_insert_order_items" ON order_items FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "auth_customer_insert_waiter_calls" ON waiter_calls FOR INSERT TO authenticated
  WITH CHECK (restaurant_id IS NULL OR restaurant_id IN (
    SELECT id FROM restaurants WHERE status IN ('active', 'trial')
  ));
