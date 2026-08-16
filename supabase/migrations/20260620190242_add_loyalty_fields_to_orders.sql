-- Add loyalty tracking columns to orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS loyalty_customer_phone text,
  ADD COLUMN IF NOT EXISTS loyalty_customer_name  text,
  ADD COLUMN IF NOT EXISTS loyalty_reward_id      uuid REFERENCES loyalty_rewards(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS loyalty_discount       numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loyalty_benefit_action text CHECK (loyalty_benefit_action IN ('applied','accumulated','pending','none')) DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS loyalty_points_earned  int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loyalty_cashback_earned numeric(10,2) DEFAULT 0;

-- Index for looking up orders by customer phone
CREATE INDEX IF NOT EXISTS idx_orders_loyalty_phone ON orders(loyalty_customer_phone) WHERE loyalty_customer_phone IS NOT NULL;
