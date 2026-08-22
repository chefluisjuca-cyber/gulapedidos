
/*
# Restaurant Digital Menu System — Full Schema

## Overview
Creates all tables needed for a QR-code-based digital menu and self-service
system for restaurants. No user authentication is required — all data is
shared/public within the restaurant's single-tenant context.

## New Tables

### restaurant_settings
Stores a single row of restaurant configuration:
- name, logo_url: branding
- service_mode: 'table' (garçom traz) or 'counter' (cliente retira)

### categories
Menu categories (e.g., Entradas, Pratos Principais, Bebidas, Sobremesas).
- sort_order: display position
- active: hide/show category

### products
Individual menu items.
- category_id → categories
- price: base price in BRL
- is_combo: whether the product has combo groups
- active: hide/show item

### combo_groups
Groups of options within a combo product (e.g., "Escolha o Burguer").
- min_qty / max_qty: selection limits (enforced on frontend)
- is_required: whether customer must choose at least min_qty

### combo_group_items
Individual selectable options within a combo group.
- price_delta: extra cost above the product's base price

### product_extras
Free-form add-ons (up-selling) for a product (e.g., bacon, queijo).
- No limit on quantity — customer can add as many as desired.

### orders
Customer orders, linked by table_number (from URL /mesa/:number).
- status: pending → preparing → ready → closed
- service_mode: snapshot of the restaurant's mode at order time

### order_items
Line items within an order.
- customizations (jsonb): stores combo selections and extras chosen

### waiter_calls
Customer-initiated calls from a table.
- call_type: 'attention' | 'request' | 'bill'
- status: pending → resolved

## Security
All tables use RLS with anon + authenticated access (single-tenant, no login).
*/

-- ─────────────────────────────────────────────
-- RESTAURANT SETTINGS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS restaurant_settings (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text        NOT NULL DEFAULT 'Meu Restaurante',
  logo_url      text,
  service_mode  text        NOT NULL DEFAULT 'table'
                            CHECK (service_mode IN ('table', 'counter')),
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE restaurant_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_settings" ON restaurant_settings;
CREATE POLICY "anon_select_settings" ON restaurant_settings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_settings" ON restaurant_settings;
CREATE POLICY "anon_insert_settings" ON restaurant_settings FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_settings" ON restaurant_settings;
CREATE POLICY "anon_update_settings" ON restaurant_settings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_settings" ON restaurant_settings;
CREATE POLICY "anon_delete_settings" ON restaurant_settings FOR DELETE
  TO anon, authenticated USING (true);

-- Seed one row so settings always exist
INSERT INTO restaurant_settings (name, service_mode)
SELECT 'Restaurante Digital', 'table'
WHERE NOT EXISTS (SELECT 1 FROM restaurant_settings);

-- ─────────────────────────────────────────────
-- CATEGORIES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id         uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text    NOT NULL,
  icon       text,
  sort_order integer NOT NULL DEFAULT 0,
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_categories" ON categories;
CREATE POLICY "anon_select_categories" ON categories FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_categories" ON categories;
CREATE POLICY "anon_insert_categories" ON categories FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_categories" ON categories;
CREATE POLICY "anon_update_categories" ON categories FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_categories" ON categories;
CREATE POLICY "anon_delete_categories" ON categories FOR DELETE
  TO anon, authenticated USING (true);

-- ─────────────────────────────────────────────
-- PRODUCTS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid         REFERENCES categories(id) ON DELETE SET NULL,
  name        text         NOT NULL,
  description text,
  price       numeric(10,2) NOT NULL DEFAULT 0,
  image_url   text,
  active      boolean      NOT NULL DEFAULT true,
  is_combo    boolean      NOT NULL DEFAULT false,
  sort_order  integer      NOT NULL DEFAULT 0,
  created_at  timestamptz  DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_products" ON products;
CREATE POLICY "anon_select_products" ON products FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_products" ON products;
CREATE POLICY "anon_insert_products" ON products FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_products" ON products;
CREATE POLICY "anon_update_products" ON products FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_products" ON products;
CREATE POLICY "anon_delete_products" ON products FOR DELETE
  TO anon, authenticated USING (true);

-- ─────────────────────────────────────────────
-- COMBO GROUPS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS combo_groups (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid    NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name        text    NOT NULL,
  min_qty     integer NOT NULL DEFAULT 0,
  max_qty     integer NOT NULL DEFAULT 1,
  is_required boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_combo_groups_product ON combo_groups(product_id);

ALTER TABLE combo_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_combo_groups" ON combo_groups;
CREATE POLICY "anon_select_combo_groups" ON combo_groups FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_combo_groups" ON combo_groups;
CREATE POLICY "anon_insert_combo_groups" ON combo_groups FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_combo_groups" ON combo_groups;
CREATE POLICY "anon_update_combo_groups" ON combo_groups FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_combo_groups" ON combo_groups;
CREATE POLICY "anon_delete_combo_groups" ON combo_groups FOR DELETE
  TO anon, authenticated USING (true);

-- ─────────────────────────────────────────────
-- COMBO GROUP ITEMS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS combo_group_items (
  id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  combo_group_id uuid         NOT NULL REFERENCES combo_groups(id) ON DELETE CASCADE,
  name           text         NOT NULL,
  price_delta    numeric(10,2) NOT NULL DEFAULT 0,
  sort_order     integer      NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_combo_items_group ON combo_group_items(combo_group_id);

ALTER TABLE combo_group_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_combo_items" ON combo_group_items;
CREATE POLICY "anon_select_combo_items" ON combo_group_items FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_combo_items" ON combo_group_items;
CREATE POLICY "anon_insert_combo_items" ON combo_group_items FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_combo_items" ON combo_group_items;
CREATE POLICY "anon_update_combo_items" ON combo_group_items FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_combo_items" ON combo_group_items;
CREATE POLICY "anon_delete_combo_items" ON combo_group_items FOR DELETE
  TO anon, authenticated USING (true);

-- ─────────────────────────────────────────────
-- PRODUCT EXTRAS (up-sell, no max limit)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_extras (
  id         uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid         NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name       text         NOT NULL,
  price      numeric(10,2) NOT NULL DEFAULT 0,
  sort_order integer      NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_extras_product ON product_extras(product_id);

ALTER TABLE product_extras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_extras" ON product_extras;
CREATE POLICY "anon_select_extras" ON product_extras FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_extras" ON product_extras;
CREATE POLICY "anon_insert_extras" ON product_extras FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_extras" ON product_extras;
CREATE POLICY "anon_update_extras" ON product_extras FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_extras" ON product_extras;
CREATE POLICY "anon_delete_extras" ON product_extras FOR DELETE
  TO anon, authenticated USING (true);

-- ─────────────────────────────────────────────
-- ORDERS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  table_number text         NOT NULL,
  status       text         NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'preparing', 'ready', 'closed')),
  service_mode text         NOT NULL DEFAULT 'table',
  total        numeric(10,2) NOT NULL DEFAULT 0,
  notes        text,
  created_at   timestamptz  DEFAULT now(),
  updated_at   timestamptz  DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_table ON orders(table_number);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_orders" ON orders;
CREATE POLICY "anon_select_orders" ON orders FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_orders" ON orders;
CREATE POLICY "anon_insert_orders" ON orders FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_orders" ON orders;
CREATE POLICY "anon_update_orders" ON orders FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_orders" ON orders;
CREATE POLICY "anon_delete_orders" ON orders FOR DELETE
  TO anon, authenticated USING (true);

-- ─────────────────────────────────────────────
-- ORDER ITEMS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
  id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       uuid         NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id     uuid         REFERENCES products(id) ON DELETE SET NULL,
  product_name   text         NOT NULL,
  quantity       integer      NOT NULL DEFAULT 1,
  unit_price     numeric(10,2) NOT NULL,
  customizations jsonb        DEFAULT '{}',
  created_at     timestamptz  DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_order_items" ON order_items;
CREATE POLICY "anon_select_order_items" ON order_items FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_order_items" ON order_items;
CREATE POLICY "anon_insert_order_items" ON order_items FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_order_items" ON order_items;
CREATE POLICY "anon_update_order_items" ON order_items FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_order_items" ON order_items;
CREATE POLICY "anon_delete_order_items" ON order_items FOR DELETE
  TO anon, authenticated USING (true);

-- ─────────────────────────────────────────────
-- WAITER CALLS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS waiter_calls (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  table_number text        NOT NULL,
  call_type    text        NOT NULL
               CHECK (call_type IN ('attention', 'request', 'bill')),
  message      text,
  status       text        NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'resolved')),
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_waiter_calls_status ON waiter_calls(status);

ALTER TABLE waiter_calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_waiter_calls" ON waiter_calls;
CREATE POLICY "anon_select_waiter_calls" ON waiter_calls FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_waiter_calls" ON waiter_calls;
CREATE POLICY "anon_insert_waiter_calls" ON waiter_calls FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_waiter_calls" ON waiter_calls;
CREATE POLICY "anon_update_waiter_calls" ON waiter_calls FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_waiter_calls" ON waiter_calls;
CREATE POLICY "anon_delete_waiter_calls" ON waiter_calls FOR DELETE
  TO anon, authenticated USING (true);

-- Enable realtime on all key tables
ALTER PUBLICATION supabase_realtime ADD TABLE restaurant_settings;
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE waiter_calls;
