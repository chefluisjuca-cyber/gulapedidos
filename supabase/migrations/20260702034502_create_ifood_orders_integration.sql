CREATE TABLE IF NOT EXISTS ifood_orders_integration (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ifood_order_id text NOT NULL,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  customer_name text,
  display_id text,
  status text NOT NULL DEFAULT 'PLACED'
    CHECK (status IN ('PLACED', 'CONFIRMED', 'DISPATCHED', 'DELIVERED', 'CANCELLED')),
  -- Address
  street text,
  number text,
  neighborhood text,
  complement text,
  postal_code text,
  -- Coordinates for map plotting
  latitude double precision,
  longitude double precision,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ifood_orders_integration_order_id_idx
  ON ifood_orders_integration (ifood_order_id, restaurant_id);

ALTER TABLE ifood_orders_integration ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ifood_select_own" ON ifood_orders_integration
  FOR SELECT TO authenticated USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_email = auth.email()
    )
  );

CREATE POLICY "ifood_insert_own" ON ifood_orders_integration
  FOR INSERT TO authenticated WITH CHECK (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_email = auth.email()
    )
  );

CREATE POLICY "ifood_update_own" ON ifood_orders_integration
  FOR UPDATE TO authenticated
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_email = auth.email()))
  WITH CHECK (restaurant_id IN (SELECT id FROM restaurants WHERE owner_email = auth.email()));

CREATE POLICY "ifood_delete_own" ON ifood_orders_integration
  FOR DELETE TO authenticated USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_email = auth.email()
    )
  );

-- Allow anon (admin panel uses anon key) full access scoped by restaurant_id
CREATE POLICY "ifood_anon_select" ON ifood_orders_integration
  FOR SELECT TO anon USING (true);

CREATE POLICY "ifood_anon_insert" ON ifood_orders_integration
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "ifood_anon_update" ON ifood_orders_integration
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "ifood_anon_delete" ON ifood_orders_integration
  FOR DELETE TO anon USING (true);
