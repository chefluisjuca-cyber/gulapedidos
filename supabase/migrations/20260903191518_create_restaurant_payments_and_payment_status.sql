/*
# Add Online Payment Module (Mercado Pago)

Creates restaurant_payments table and adds payment_status column to orders.

## 1. New Table: restaurant_payments
- restaurant_id (FK to restaurants, unique)
- online_payment_active (boolean, default false)
- mp_access_token (text, nullable)
- allow_pix (boolean, default true)
- allow_credit_card (boolean, default true)

## 2. Modified Table: orders
- payment_status (text, nullable): 'pending', 'paid', 'rejected', 'refunded'

## 3. Security
- RLS enabled. SELECT public (anon + authenticated). INSERT/UPDATE/DELETE owner-scoped via auth_owned_restaurant_ids().
*/

CREATE TABLE IF NOT EXISTS restaurant_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid UNIQUE REFERENCES restaurants(id) ON DELETE CASCADE,
  online_payment_active boolean NOT NULL DEFAULT false,
  mp_access_token text,
  allow_pix boolean NOT NULL DEFAULT true,
  allow_credit_card boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE restaurant_payments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS restaurant_payments_rid_idx ON restaurant_payments(restaurant_id);

DROP POLICY IF EXISTS "select_payments" ON restaurant_payments;
CREATE POLICY "select_payments" ON restaurant_payments FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "owner_insert_payments" ON restaurant_payments;
CREATE POLICY "owner_insert_payments" ON restaurant_payments FOR INSERT
  TO authenticated
  WITH CHECK (restaurant_id IS NULL OR restaurant_id IN (SELECT auth_owned_restaurant_ids()));

DROP POLICY IF EXISTS "owner_update_payments" ON restaurant_payments;
CREATE POLICY "owner_update_payments" ON restaurant_payments FOR UPDATE
  TO authenticated
  USING (restaurant_id IS NULL OR restaurant_id IN (SELECT auth_owned_restaurant_ids()))
  WITH CHECK (restaurant_id IS NULL OR restaurant_id IN (SELECT auth_owned_restaurant_ids()));

DROP POLICY IF EXISTS "owner_delete_payments" ON restaurant_payments;
CREATE POLICY "owner_delete_payments" ON restaurant_payments FOR DELETE
  TO authenticated
  USING (restaurant_id IS NULL OR restaurant_id IN (SELECT auth_owned_restaurant_ids()));

ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status text;
