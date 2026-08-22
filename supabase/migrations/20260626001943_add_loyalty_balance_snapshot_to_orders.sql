-- Snapshot of customer's accumulated balance after this order
-- Used to print the total on the receipt without a separate DB query
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS loyalty_points_total integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loyalty_cashback_total numeric(10,2) NOT NULL DEFAULT 0;
