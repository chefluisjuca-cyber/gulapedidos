-- ── 1. Fix function: lock search_path, revoke anon execute ────────────────────
ALTER FUNCTION public.auth_owned_restaurant_ids()
  SET search_path = 'public';

REVOKE EXECUTE ON FUNCTION public.auth_owned_restaurant_ids() FROM anon;

-- ── 2. combo_groups: scope write to owner's products ──────────────────────────
DROP POLICY IF EXISTS "owner_write_combo_groups" ON combo_groups;
CREATE POLICY "owner_write_combo_groups" ON combo_groups FOR ALL TO authenticated
  USING (
    product_id IN (
      SELECT id FROM products
      WHERE restaurant_id IN (SELECT * FROM auth_owned_restaurant_ids())
    )
  )
  WITH CHECK (
    product_id IN (
      SELECT id FROM products
      WHERE restaurant_id IN (SELECT * FROM auth_owned_restaurant_ids())
    )
  );

-- ── 3. combo_group_items: scope write through product ownership ────────────────
DROP POLICY IF EXISTS "owner_write_combo_items" ON combo_group_items;
CREATE POLICY "owner_write_combo_items" ON combo_group_items FOR ALL TO authenticated
  USING (
    combo_group_id IN (
      SELECT cg.id FROM combo_groups cg
      JOIN products p ON p.id = cg.product_id
      WHERE p.restaurant_id IN (SELECT * FROM auth_owned_restaurant_ids())
    )
  )
  WITH CHECK (
    combo_group_id IN (
      SELECT cg.id FROM combo_groups cg
      JOIN products p ON p.id = cg.product_id
      WHERE p.restaurant_id IN (SELECT * FROM auth_owned_restaurant_ids())
    )
  );

-- ── 4. product_extras: scope write to owner's products ────────────────────────
DROP POLICY IF EXISTS "owner_write_extras" ON product_extras;
CREATE POLICY "owner_write_extras" ON product_extras FOR ALL TO authenticated
  USING (
    product_id IN (
      SELECT id FROM products
      WHERE restaurant_id IN (SELECT * FROM auth_owned_restaurant_ids())
    )
  )
  WITH CHECK (
    product_id IN (
      SELECT id FROM products
      WHERE restaurant_id IN (SELECT * FROM auth_owned_restaurant_ids())
    )
  );

-- ── 5. delivery_motoboys: require valid restaurant on GPS updates ───────────────
DROP POLICY IF EXISTS "anon_update_motoboy_location" ON delivery_motoboys;
CREATE POLICY "anon_update_motoboy_location" ON delivery_motoboys FOR UPDATE TO anon
  USING (restaurant_id IS NOT NULL)
  WITH CHECK (restaurant_id IS NOT NULL);

-- ── 6. fila_espera: require restaurant_id on insert ───────────────────────────
DROP POLICY IF EXISTS "anon_insert_fila_espera" ON fila_espera;
CREATE POLICY "anon_insert_fila_espera" ON fila_espera
  FOR INSERT TO anon, authenticated
  WITH CHECK (restaurant_id IS NOT NULL);

-- ── 7. fila_espera: align WITH CHECK to USING on anon update ──────────────────
DROP POLICY IF EXISTS "anon_update_fila" ON fila_espera;
CREATE POLICY "anon_update_fila" ON fila_espera FOR UPDATE TO anon
  USING  (restaurant_id IN (SELECT id FROM restaurants))
  WITH CHECK (restaurant_id IN (SELECT id FROM restaurants));

-- ── 8. ifood_orders_integration: require restaurant_id for webhook ops ─────────
DROP POLICY IF EXISTS "ifood_anon_insert" ON ifood_orders_integration;
DROP POLICY IF EXISTS "ifood_anon_update" ON ifood_orders_integration;
DROP POLICY IF EXISTS "ifood_anon_delete" ON ifood_orders_integration;

CREATE POLICY "ifood_anon_insert" ON ifood_orders_integration
  FOR INSERT TO anon
  WITH CHECK (restaurant_id IS NOT NULL);

CREATE POLICY "ifood_anon_update" ON ifood_orders_integration
  FOR UPDATE TO anon
  USING  (restaurant_id IS NOT NULL)
  WITH CHECK (restaurant_id IS NOT NULL);

CREATE POLICY "ifood_anon_delete" ON ifood_orders_integration
  FOR DELETE TO anon
  USING (restaurant_id IS NOT NULL);

-- ── 9. loyalty_customers: require restaurant_id; align WITH CHECK ─────────────
DROP POLICY IF EXISTS "anon_update_loyalty_customers" ON loyalty_customers;
CREATE POLICY "anon_update_loyalty_customers" ON loyalty_customers FOR UPDATE TO anon
  USING  (restaurant_id IS NOT NULL)
  WITH CHECK (restaurant_id IS NOT NULL);

DROP POLICY IF EXISTS "auth_update_loyalty_customers_active" ON loyalty_customers;
CREATE POLICY "auth_update_loyalty_customers_active" ON loyalty_customers FOR UPDATE TO authenticated
  USING (
    restaurant_id IS NULL OR
    restaurant_id IN (SELECT id FROM restaurants WHERE status IN ('active', 'trial'))
  )
  WITH CHECK (
    restaurant_id IS NULL OR
    restaurant_id IN (SELECT id FROM restaurants WHERE status IN ('active', 'trial'))
  );

-- ── 10. order_items: require parent order to have a restaurant ────────────────
DROP POLICY IF EXISTS "anon_insert_order_items" ON order_items;
CREATE POLICY "anon_insert_order_items" ON order_items FOR INSERT TO anon
  WITH CHECK (
    order_id IN (SELECT id FROM orders WHERE restaurant_id IS NOT NULL)
  );

DROP POLICY IF EXISTS "auth_customer_insert_order_items" ON order_items;
CREATE POLICY "auth_customer_insert_order_items" ON order_items FOR INSERT TO authenticated
  WITH CHECK (
    order_id IN (SELECT id FROM orders WHERE restaurant_id IS NOT NULL)
  );

-- ── 11. orders: require restaurant_id on anon updates (kitchen/KDS) ───────────
DROP POLICY IF EXISTS "anon_update_orders" ON orders;
CREATE POLICY "anon_update_orders" ON orders FOR UPDATE TO anon
  USING  (restaurant_id IS NOT NULL)
  WITH CHECK (restaurant_id IS NOT NULL);

-- ── 12. waiter_calls: align WITH CHECK to USING for authenticated updates ─────
DROP POLICY IF EXISTS "auth_update_waiter_calls_active" ON waiter_calls;
CREATE POLICY "auth_update_waiter_calls_active" ON waiter_calls FOR UPDATE TO authenticated
  USING (
    restaurant_id IS NULL OR
    restaurant_id IN (SELECT id FROM restaurants WHERE status IN ('active', 'trial'))
  )
  WITH CHECK (
    restaurant_id IS NULL OR
    restaurant_id IN (SELECT id FROM restaurants WHERE status IN ('active', 'trial'))
  );

-- ── 13. Storage: remove broad listing SELECT from public buckets ──────────────
DROP POLICY IF EXISTS "product_images_select"          ON storage.objects;
DROP POLICY IF EXISTS "product_images_public_read"     ON storage.objects;
CREATE POLICY "product_images_authenticated_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "sounds_select" ON storage.objects;
CREATE POLICY "sounds_authenticated_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'sounds');
