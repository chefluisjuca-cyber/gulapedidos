
-- Allow any authenticated user to update/delete orders and related tables for active restaurants
-- (mirrors the insert policy added previously for customer panels and kitchen staff)

CREATE POLICY "auth_update_orders_active" ON orders FOR UPDATE TO authenticated
  USING (restaurant_id IS NULL OR restaurant_id IN (
    SELECT id FROM restaurants WHERE status IN ('active', 'trial')
  ))
  WITH CHECK (restaurant_id IS NULL OR restaurant_id IN (
    SELECT id FROM restaurants WHERE status IN ('active', 'trial')
  ));

CREATE POLICY "auth_delete_orders_active" ON orders FOR DELETE TO authenticated
  USING (restaurant_id IS NULL OR restaurant_id IN (
    SELECT id FROM restaurants WHERE status IN ('active', 'trial')
  ));

CREATE POLICY "auth_delete_order_items_active" ON order_items FOR DELETE TO authenticated
  USING (restaurant_id IS NULL OR restaurant_id IN (
    SELECT id FROM restaurants WHERE status IN ('active', 'trial')
  ));

CREATE POLICY "auth_update_waiter_calls_active" ON waiter_calls FOR UPDATE TO authenticated
  USING (restaurant_id IS NULL OR restaurant_id IN (
    SELECT id FROM restaurants WHERE status IN ('active', 'trial')
  ))
  WITH CHECK (true);

CREATE POLICY "auth_update_loyalty_customers_active" ON loyalty_customers FOR UPDATE TO authenticated
  USING (restaurant_id IS NULL OR restaurant_id IN (
    SELECT id FROM restaurants WHERE status IN ('active', 'trial')
  ))
  WITH CHECK (true);
