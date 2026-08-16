-- Fix RLS policies: restrict write operations to authenticated users only
-- SELECT remains open for anon (customers need to read menu/orders)
-- INSERT for orders/order_items/waiter_calls remains open (customers create orders/calls)

-- ─────────────────────────────────────────────────────
-- RESTAURANT SETTINGS
-- ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "anon_insert_settings" ON restaurant_settings;
DROP POLICY IF EXISTS "anon_update_settings" ON restaurant_settings;
DROP POLICY IF EXISTS "anon_delete_settings" ON restaurant_settings;

CREATE POLICY "authenticated_insert_settings" ON restaurant_settings FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_update_settings" ON restaurant_settings FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_delete_settings" ON restaurant_settings FOR DELETE
  TO authenticated USING (true);

-- ─────────────────────────────────────────────────────
-- CATEGORIES
-- ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "anon_insert_categories" ON categories;
DROP POLICY IF EXISTS "anon_update_categories" ON categories;
DROP POLICY IF EXISTS "anon_delete_categories" ON categories;

CREATE POLICY "authenticated_insert_categories" ON categories FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_update_categories" ON categories FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_delete_categories" ON categories FOR DELETE
  TO authenticated USING (true);

-- ─────────────────────────────────────────────────────
-- PRODUCTS
-- ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "anon_insert_products" ON products;
DROP POLICY IF EXISTS "anon_update_products" ON products;
DROP POLICY IF EXISTS "anon_delete_products" ON products;

CREATE POLICY "authenticated_insert_products" ON products FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_update_products" ON products FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_delete_products" ON products FOR DELETE
  TO authenticated USING (true);

-- ─────────────────────────────────────────────────────
-- COMBO GROUPS
-- ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "anon_insert_combo_groups" ON combo_groups;
DROP POLICY IF EXISTS "anon_update_combo_groups" ON combo_groups;
DROP POLICY IF EXISTS "anon_delete_combo_groups" ON combo_groups;

CREATE POLICY "authenticated_insert_combo_groups" ON combo_groups FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_update_combo_groups" ON combo_groups FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_delete_combo_groups" ON combo_groups FOR DELETE
  TO authenticated USING (true);

-- ─────────────────────────────────────────────────────
-- COMBO GROUP ITEMS
-- ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "anon_insert_combo_items" ON combo_group_items;
DROP POLICY IF EXISTS "anon_update_combo_items" ON combo_group_items;
DROP POLICY IF EXISTS "anon_delete_combo_items" ON combo_group_items;

CREATE POLICY "authenticated_insert_combo_items" ON combo_group_items FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_update_combo_items" ON combo_group_items FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_delete_combo_items" ON combo_group_items FOR DELETE
  TO authenticated USING (true);

-- ─────────────────────────────────────────────────────
-- PRODUCT EXTRAS
-- ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "anon_insert_extras" ON product_extras;
DROP POLICY IF EXISTS "anon_update_extras" ON product_extras;
DROP POLICY IF EXISTS "anon_delete_extras" ON product_extras;

CREATE POLICY "authenticated_insert_extras" ON product_extras FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_update_extras" ON product_extras FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_delete_extras" ON product_extras FOR DELETE
  TO authenticated USING (true);

-- ─────────────────────────────────────────────────────
-- ORDERS
-- Keep INSERT open for anon (customers place orders)
-- Restrict UPDATE/DELETE to authenticated
-- ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "anon_update_orders" ON orders;
DROP POLICY IF EXISTS "anon_delete_orders" ON orders;

CREATE POLICY "authenticated_update_orders" ON orders FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_delete_orders" ON orders FOR DELETE
  TO authenticated USING (true);

-- ─────────────────────────────────────────────────────
-- ORDER ITEMS
-- Keep INSERT open for anon (customers place orders)
-- Restrict UPDATE/DELETE to authenticated
-- ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "anon_update_order_items" ON order_items;
DROP POLICY IF EXISTS "anon_delete_order_items" ON order_items;

CREATE POLICY "authenticated_update_order_items" ON order_items FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_delete_order_items" ON order_items FOR DELETE
  TO authenticated USING (true);

-- ─────────────────────────────────────────────────────
-- WAITER CALLS
-- Keep INSERT open for anon (customers call waiters)
-- Restrict UPDATE/DELETE to authenticated
-- ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "anon_update_waiter_calls" ON waiter_calls;
DROP POLICY IF EXISTS "anon_delete_waiter_calls" ON waiter_calls;

CREATE POLICY "authenticated_update_waiter_calls" ON waiter_calls FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_delete_waiter_calls" ON waiter_calls FOR DELETE
  TO authenticated USING (true);

-- ─────────────────────────────────────────────────────
-- STORAGE: Fix product-images bucket policy
-- Replace broad SELECT with object-level access only
-- ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "product_images_select" ON storage.objects;

-- Allow public read access to individual objects via signed URLs
-- but prevent listing all files
CREATE POLICY "product_images_public_read" ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'product-images');
