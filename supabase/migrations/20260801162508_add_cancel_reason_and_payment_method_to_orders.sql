/*
# Add cancel_reason and payment_method columns to orders

1. Purpose
   - Support post-sale cancellation with justification (cancel_reason text field)
   - Track payment method for all orders (not just delivery) for financial reporting

2. New Columns on `orders`
   - `cancel_reason` (text, nullable) — stores the justification when an order is cancelled
   - `payment_method` (text, nullable) — stores payment method like 'pix', 'card', 'cash', 'pix_delivery', etc.

3. Security
   - No RLS policy changes — existing policies on orders remain unchanged.
   - No new tables created.

4. Notes
   - Both columns are nullable so existing orders are unaffected.
   - The frontend will set cancel_reason when an admin cancels an order.
   - payment_method is set at order creation time.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'cancel_reason'
  ) THEN
    ALTER TABLE orders ADD COLUMN cancel_reason text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'payment_method'
  ) THEN
    ALTER TABLE orders ADD COLUMN payment_method text;
  END IF;
END $$;
