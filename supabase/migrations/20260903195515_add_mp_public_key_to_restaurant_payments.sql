-- Add mp_public_key to restaurant_payments for frontend SDK tokenization
ALTER TABLE restaurant_payments ADD COLUMN IF NOT EXISTS mp_public_key text;
