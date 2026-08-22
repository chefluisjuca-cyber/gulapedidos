ALTER TABLE delivery_orders
  ADD COLUMN IF NOT EXISTS customer_lat NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS customer_lng NUMERIC(10, 7);
