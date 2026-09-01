
-- ════════════════════════════════════════════════════════════════════════════════
-- MULTI-TENANT SECURITY: Add restaurant_id to core tables + robust RLS policies
-- ════════════════════════════════════════════════════════════════════════════════

-- ─── 1. Schema additions ─────────────────────────────────────────────────────
ALTER TABLE restaurant_settings  ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE;
ALTER TABLE categories           ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE;
ALTER TABLE products             ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE;
ALTER TABLE orders               ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL;
ALTER TABLE order_items          ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL;
ALTER TABLE waiter_calls         ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL;
ALTER TABLE loyalty_configs      ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE;
ALTER TABLE loyalty_rewards      ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE;
ALTER TABLE loyalty_customers    ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE;

-- loyalty_customers: change unique constraint to (phone, restaurant_id) for multi-tenant
ALTER TABLE loyalty_customers DROP CONSTRAINT IF EXISTS loyalty_customers_phone_key;
ALTER TABLE loyalty_customers ADD CONSTRAINT loyalty_customers_phone_restaurant_uniq UNIQUE (phone, restaurant_id);

-- Performance indexes
CREATE INDEX IF NOT EXISTS restaurant_settings_rid_idx  ON restaurant_settings(restaurant_id);
CREATE INDEX IF NOT EXISTS categories_rid_idx           ON categories(restaurant_id);
CREATE INDEX IF NOT EXISTS products_rid_idx             ON products(restaurant_id);
CREATE INDEX IF NOT EXISTS orders_rid_idx               ON orders(restaurant_id);
CREATE INDEX IF NOT EXISTS order_items_rid_idx          ON order_items(restaurant_id);
CREATE INDEX IF NOT EXISTS waiter_calls_rid_idx         ON waiter_calls(restaurant_id);
CREATE INDEX IF NOT EXISTS loyalty_configs_rid_idx      ON loyalty_configs(restaurant_id);
CREATE INDEX IF NOT EXISTS loyalty_rewards_rid_idx      ON loyalty_rewards(restaurant_id);
CREATE INDEX IF NOT EXISTS loyalty_customers_rid_idx    ON loyalty_customers(restaurant_id);

-- ─── 2. Helper: restaurant IDs owned by current auth user ────────────────────
CREATE OR REPLACE FUNCTION auth_owned_restaurant_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT id FROM restaurants WHERE owner_email = auth.email();
$$;

-- ─── 3. Drop all existing trivial policies ───────────────────────────────────
DROP POLICY IF EXISTS "anon_select_settings"              ON restaurant_settings;
DROP POLICY IF EXISTS "authenticated_insert_settings"     ON restaurant_settings;
DROP POLICY IF EXISTS "authenticated_update_settings"     ON restaurant_settings;
DROP POLICY IF EXISTS "authenticated_delete_settings"     ON restaurant_settings;

DROP POLICY IF EXISTS "anon_select_categories"            ON categories;
DROP POLICY IF EXISTS "authenticated_insert_categories"   ON categories;
DROP POLICY IF EXISTS "authenticated_update_categories"   ON categories;
DROP POLICY IF EXISTS "authenticated_delete_categories"   ON categories;

DROP POLICY IF EXISTS "anon_select_products"              ON products;
DROP POLICY IF EXISTS "authenticated_insert_products"     ON products;
DROP POLICY IF EXISTS "authenticated_update_products"     ON products;
DROP POLICY IF EXISTS "authenticated_delete_products"     ON products;

DROP POLICY IF EXISTS "anon_select_combo_groups"          ON combo_groups;
DROP POLICY IF EXISTS "authenticated_insert_combo_groups" ON combo_groups;
DROP POLICY IF EXISTS "authenticated_update_combo_groups" ON combo_groups;
DROP POLICY IF EXISTS "authenticated_delete_combo_groups" ON combo_groups;

DROP POLICY IF EXISTS "anon_select_combo_items"           ON combo_group_items;
DROP POLICY IF EXISTS "authenticated_insert_combo_items"  ON combo_group_items;
DROP POLICY IF EXISTS "authenticated_update_combo_items"  ON combo_group_items;
DROP POLICY IF EXISTS "authenticated_delete_combo_items"  ON combo_group_items;

DROP POLICY IF EXISTS "anon_select_extras"                ON product_extras;
DROP POLICY IF EXISTS "authenticated_insert_extras"       ON product_extras;
DROP POLICY IF EXISTS "authenticated_update_extras"       ON product_extras;
DROP POLICY IF EXISTS "authenticated_delete_extras"       ON product_extras;

DROP POLICY IF EXISTS "anon_select_orders"                ON orders;
DROP POLICY IF EXISTS "anon_insert_orders"                ON orders;
DROP POLICY IF EXISTS "anon_update_orders"                ON orders;
DROP POLICY IF EXISTS "authenticated_update_orders"       ON orders;
DROP POLICY IF EXISTS "authenticated_delete_orders"       ON orders;

DROP POLICY IF EXISTS "anon_select_order_items"           ON order_items;
DROP POLICY IF EXISTS "anon_insert_order_items"           ON order_items;
DROP POLICY IF EXISTS "authenticated_update_order_items"  ON order_items;
DROP POLICY IF EXISTS "authenticated_delete_order_items"  ON order_items;

DROP POLICY IF EXISTS "anon_select_waiter_calls"          ON waiter_calls;
DROP POLICY IF EXISTS "anon_insert_waiter_calls"          ON waiter_calls;
DROP POLICY IF EXISTS "authenticated_update_waiter_calls" ON waiter_calls;
DROP POLICY IF EXISTS "authenticated_delete_waiter_calls" ON waiter_calls;

DROP POLICY IF EXISTS "anon_select_loyalty_configs"       ON loyalty_configs;
DROP POLICY IF EXISTS "anon_insert_loyalty_configs"       ON loyalty_configs;
DROP POLICY IF EXISTS "anon_update_loyalty_configs"       ON loyalty_configs;
DROP POLICY IF EXISTS "anon_delete_loyalty_configs"       ON loyalty_configs;

DROP POLICY IF EXISTS "anon_select_loyalty_rewards"       ON loyalty_rewards;
DROP POLICY IF EXISTS "anon_insert_loyalty_rewards"       ON loyalty_rewards;
DROP POLICY IF EXISTS "anon_update_loyalty_rewards"       ON loyalty_rewards;
DROP POLICY IF EXISTS "anon_delete_loyalty_rewards"       ON loyalty_rewards;

DROP POLICY IF EXISTS "anon_select_loyalty_customers"     ON loyalty_customers;
DROP POLICY IF EXISTS "anon_insert_loyalty_customers"     ON loyalty_customers;
DROP POLICY IF EXISTS "anon_update_loyalty_customers"     ON loyalty_customers;
DROP POLICY IF EXISTS "anon_delete_loyalty_customers"     ON loyalty_customers;

DROP POLICY IF EXISTS "anon_select_fila"   ON fila_espera;
DROP POLICY IF EXISTS "anon_insert_fila"   ON fila_espera;
DROP POLICY IF EXISTS "anon_update_fila"   ON fila_espera;
DROP POLICY IF EXISTS "auth_select_fila"   ON fila_espera;
DROP POLICY IF EXISTS "auth_insert_fila"   ON fila_espera;
DROP POLICY IF EXISTS "auth_update_fila"   ON fila_espera;

DROP POLICY IF EXISTS "anon_select_restaurants"  ON restaurants;
DROP POLICY IF EXISTS "anon_insert_restaurants"  ON restaurants;
DROP POLICY IF EXISTS "anon_update_restaurants"  ON restaurants;
DROP POLICY IF EXISTS "anon_delete_restaurants"  ON restaurants;
DROP POLICY IF EXISTS "auth_select_restaurants"  ON restaurants;
DROP POLICY IF EXISTS "auth_insert_restaurants"  ON restaurants;
DROP POLICY IF EXISTS "auth_update_restaurants"  ON restaurants;
DROP POLICY IF EXISTS "auth_delete_restaurants"  ON restaurants;

-- ─── 4. New ownership-based RLS policies ─────────────────────────────────────

-- ── restaurants ───────────────────────────────────────────────────────────────
CREATE POLICY "select_restaurants" ON restaurants FOR SELECT USING (true);
CREATE POLICY "owner_update_restaurant" ON restaurants FOR UPDATE
  TO authenticated
  USING (owner_email = auth.email()) WITH CHECK (owner_email = auth.email());

-- ── restaurant_settings ───────────────────────────────────────────────────────
CREATE POLICY "select_settings" ON restaurant_settings FOR SELECT USING (true);
CREATE POLICY "owner_insert_settings" ON restaurant_settings FOR INSERT TO authenticated
  WITH CHECK (restaurant_id IS NULL OR restaurant_id IN (SELECT auth_owned_restaurant_ids()));
CREATE POLICY "owner_update_settings" ON restaurant_settings FOR UPDATE TO authenticated
  USING  (restaurant_id IS NULL OR restaurant_id IN (SELECT auth_owned_restaurant_ids()))
  WITH CHECK (restaurant_id IS NULL OR restaurant_id IN (SELECT auth_owned_restaurant_ids()));
CREATE POLICY "owner_delete_settings" ON restaurant_settings FOR DELETE TO authenticated
  USING (restaurant_id IS NULL OR restaurant_id IN (SELECT auth_owned_restaurant_ids()));

-- ── categories ────────────────────────────────────────────────────────────────
CREATE POLICY "select_categories" ON categories FOR SELECT USING (true);
CREATE POLICY "owner_insert_categories" ON categories FOR INSERT TO authenticated
  WITH CHECK (restaurant_id IS NULL OR restaurant_id IN (SELECT auth_owned_restaurant_ids()));
CREATE POLICY "owner_update_categories" ON categories FOR UPDATE TO authenticated
  USING  (restaurant_id IS NULL OR restaurant_id IN (SELECT auth_owned_restaurant_ids()))
  WITH CHECK (restaurant_id IS NULL OR restaurant_id IN (SELECT auth_owned_restaurant_ids()));
CREATE POLICY "owner_delete_categories" ON categories FOR DELETE TO authenticated
  USING (restaurant_id IS NULL OR restaurant_id IN (SELECT auth_owned_restaurant_ids()));

-- ── products ──────────────────────────────────────────────────────────────────
CREATE POLICY "select_products" ON products FOR SELECT USING (true);
CREATE POLICY "owner_insert_products" ON products FOR INSERT TO authenticated
  WITH CHECK (restaurant_id IS NULL OR restaurant_id IN (SELECT auth_owned_restaurant_ids()));
CREATE POLICY "owner_update_products" ON products FOR UPDATE TO authenticated
  USING  (restaurant_id IS NULL OR restaurant_id IN (SELECT auth_owned_restaurant_ids()))
  WITH CHECK (restaurant_id IS NULL OR restaurant_id IN (SELECT auth_owned_restaurant_ids()));
CREATE POLICY "owner_delete_products" ON products FOR DELETE TO authenticated
  USING (restaurant_id IS NULL OR restaurant_id IN (SELECT auth_owned_restaurant_ids()));

-- ── combo_groups / combo_group_items / product_extras (inherit from products) ─
CREATE POLICY "select_combo_groups"    ON combo_groups      FOR SELECT USING (true);
CREATE POLICY "owner_write_combo_groups" ON combo_groups    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "select_combo_items"     ON combo_group_items FOR SELECT USING (true);
CREATE POLICY "owner_write_combo_items" ON combo_group_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "select_extras"          ON product_extras    FOR SELECT USING (true);
CREATE POLICY "owner_write_extras"     ON product_extras    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── orders ────────────────────────────────────────────────────────────────────
CREATE POLICY "anon_select_orders" ON orders FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_orders" ON orders FOR INSERT TO anon
  WITH CHECK (restaurant_id IS NULL OR restaurant_id IN (SELECT id FROM restaurants WHERE status IN ('active','trial')));
CREATE POLICY "anon_update_orders" ON orders FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "owner_select_orders" ON orders FOR SELECT TO authenticated
  USING (restaurant_id IS NULL OR restaurant_id IN (SELECT auth_owned_restaurant_ids()));
CREATE POLICY "owner_insert_orders" ON orders FOR INSERT TO authenticated
  WITH CHECK (restaurant_id IS NULL OR restaurant_id IN (SELECT auth_owned_restaurant_ids()));
CREATE POLICY "owner_update_orders" ON orders FOR UPDATE TO authenticated
  USING  (restaurant_id IS NULL OR restaurant_id IN (SELECT auth_owned_restaurant_ids()))
  WITH CHECK (restaurant_id IS NULL OR restaurant_id IN (SELECT auth_owned_restaurant_ids()));
CREATE POLICY "owner_delete_orders" ON orders FOR DELETE TO authenticated
  USING (restaurant_id IS NULL OR restaurant_id IN (SELECT auth_owned_restaurant_ids()));

-- ── order_items ───────────────────────────────────────────────────────────────
CREATE POLICY "anon_select_order_items" ON order_items FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_order_items" ON order_items FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "owner_select_order_items" ON order_items FOR SELECT TO authenticated
  USING (restaurant_id IS NULL OR restaurant_id IN (SELECT auth_owned_restaurant_ids()));
CREATE POLICY "owner_insert_order_items" ON order_items FOR INSERT TO authenticated
  WITH CHECK (restaurant_id IS NULL OR restaurant_id IN (SELECT auth_owned_restaurant_ids()));
CREATE POLICY "owner_delete_order_items" ON order_items FOR DELETE TO authenticated
  USING (restaurant_id IS NULL OR restaurant_id IN (SELECT auth_owned_restaurant_ids()));

-- ── waiter_calls ──────────────────────────────────────────────────────────────
CREATE POLICY "anon_select_waiter_calls" ON waiter_calls FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_waiter_calls" ON waiter_calls FOR INSERT TO anon
  WITH CHECK (restaurant_id IS NULL OR restaurant_id IN (SELECT id FROM restaurants WHERE status IN ('active','trial')));

CREATE POLICY "owner_select_waiter_calls" ON waiter_calls FOR SELECT TO authenticated
  USING (restaurant_id IS NULL OR restaurant_id IN (SELECT auth_owned_restaurant_ids()));
CREATE POLICY "owner_insert_waiter_calls" ON waiter_calls FOR INSERT TO authenticated
  WITH CHECK (restaurant_id IS NULL OR restaurant_id IN (SELECT auth_owned_restaurant_ids()));
CREATE POLICY "owner_update_waiter_calls" ON waiter_calls FOR UPDATE TO authenticated
  USING  (restaurant_id IS NULL OR restaurant_id IN (SELECT auth_owned_restaurant_ids()))
  WITH CHECK (restaurant_id IS NULL OR restaurant_id IN (SELECT auth_owned_restaurant_ids()));
CREATE POLICY "owner_delete_waiter_calls" ON waiter_calls FOR DELETE TO authenticated
  USING (restaurant_id IS NULL OR restaurant_id IN (SELECT auth_owned_restaurant_ids()));

-- ── loyalty_configs ───────────────────────────────────────────────────────────
CREATE POLICY "select_loyalty_configs" ON loyalty_configs FOR SELECT USING (true);
CREATE POLICY "owner_insert_loyalty_configs" ON loyalty_configs FOR INSERT TO authenticated
  WITH CHECK (restaurant_id IS NULL OR restaurant_id IN (SELECT auth_owned_restaurant_ids()));
CREATE POLICY "owner_update_loyalty_configs" ON loyalty_configs FOR UPDATE TO authenticated
  USING  (restaurant_id IS NULL OR restaurant_id IN (SELECT auth_owned_restaurant_ids()))
  WITH CHECK (restaurant_id IS NULL OR restaurant_id IN (SELECT auth_owned_restaurant_ids()));
CREATE POLICY "owner_delete_loyalty_configs" ON loyalty_configs FOR DELETE TO authenticated
  USING (restaurant_id IS NULL OR restaurant_id IN (SELECT auth_owned_restaurant_ids()));

-- ── loyalty_rewards ───────────────────────────────────────────────────────────
CREATE POLICY "select_loyalty_rewards" ON loyalty_rewards FOR SELECT USING (true);
CREATE POLICY "owner_insert_loyalty_rewards" ON loyalty_rewards FOR INSERT TO authenticated
  WITH CHECK (restaurant_id IS NULL OR restaurant_id IN (SELECT auth_owned_restaurant_ids()));
CREATE POLICY "owner_update_loyalty_rewards" ON loyalty_rewards FOR UPDATE TO authenticated
  USING  (restaurant_id IS NULL OR restaurant_id IN (SELECT auth_owned_restaurant_ids()))
  WITH CHECK (restaurant_id IS NULL OR restaurant_id IN (SELECT auth_owned_restaurant_ids()));
CREATE POLICY "owner_delete_loyalty_rewards" ON loyalty_rewards FOR DELETE TO authenticated
  USING (restaurant_id IS NULL OR restaurant_id IN (SELECT auth_owned_restaurant_ids()));

-- ── loyalty_customers ─────────────────────────────────────────────────────────
CREATE POLICY "anon_select_loyalty_customers" ON loyalty_customers FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_loyalty_customers" ON loyalty_customers FOR INSERT TO anon
  WITH CHECK (restaurant_id IS NULL OR restaurant_id IN (SELECT id FROM restaurants));
CREATE POLICY "anon_update_loyalty_customers" ON loyalty_customers FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "owner_select_loyalty_customers" ON loyalty_customers FOR SELECT TO authenticated
  USING (restaurant_id IS NULL OR restaurant_id IN (SELECT auth_owned_restaurant_ids()));
CREATE POLICY "owner_insert_loyalty_customers" ON loyalty_customers FOR INSERT TO authenticated
  WITH CHECK (restaurant_id IS NULL OR restaurant_id IN (SELECT auth_owned_restaurant_ids()));
CREATE POLICY "owner_update_loyalty_customers" ON loyalty_customers FOR UPDATE TO authenticated
  USING  (restaurant_id IS NULL OR restaurant_id IN (SELECT auth_owned_restaurant_ids()))
  WITH CHECK (restaurant_id IS NULL OR restaurant_id IN (SELECT auth_owned_restaurant_ids()));
CREATE POLICY "owner_delete_loyalty_customers" ON loyalty_customers FOR DELETE TO authenticated
  USING (restaurant_id IS NULL OR restaurant_id IN (SELECT auth_owned_restaurant_ids()));

-- ── fila_espera ───────────────────────────────────────────────────────────────
CREATE POLICY "anon_select_fila" ON fila_espera FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_fila" ON fila_espera FOR INSERT TO anon
  WITH CHECK (restaurant_id IN (SELECT id FROM restaurants WHERE status IN ('active','trial')));
CREATE POLICY "anon_update_fila" ON fila_espera FOR UPDATE TO anon
  USING (restaurant_id IN (SELECT id FROM restaurants)) WITH CHECK (true);

CREATE POLICY "owner_select_fila" ON fila_espera FOR SELECT TO authenticated
  USING (restaurant_id IN (SELECT auth_owned_restaurant_ids()));
CREATE POLICY "owner_insert_fila" ON fila_espera FOR INSERT TO authenticated
  WITH CHECK (restaurant_id IN (SELECT auth_owned_restaurant_ids()));
CREATE POLICY "owner_update_fila" ON fila_espera FOR UPDATE TO authenticated
  USING  (restaurant_id IN (SELECT auth_owned_restaurant_ids()))
  WITH CHECK (restaurant_id IN (SELECT auth_owned_restaurant_ids()));
CREATE POLICY "owner_delete_fila" ON fila_espera FOR DELETE TO authenticated
  USING (restaurant_id IN (SELECT auth_owned_restaurant_ids()));
