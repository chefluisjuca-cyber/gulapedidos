-- Add columns to store MP payment details on orders for KDS display
ALTER TABLE orders ADD COLUMN IF NOT EXISTS mp_payment_id bigint;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS mp_payment_method text;
