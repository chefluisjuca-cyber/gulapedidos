/*
# Create delivery_customer_addresses table

1. New Tables
- `delivery_customer_addresses`
  - `id` (uuid, primary key)
  - `restaurant_id` (uuid, references restaurants) — scoped per restaurant
  - `phone` (text, not null) — lookup key matching delivery_customer_profiles
  - `nickname` (text, not null) — short label like "Casa", "Trabalho"
  - `cep` (text)
  - `street` (text)
  - `number` (text)
  - `bairro` (text)
  - `complement` (text)
  - `reference` (text)
  - `lat` (numeric)
  - `lng` (numeric)
  - `is_default` (boolean, default false) — which address to pre-select
  - `created_at`, `updated_at` (timestamps)
  - Unique constraint on (restaurant_id, phone, nickname) so a customer can't have two addresses with the same nickname.

2. Purpose
- Allows a logged-in (or phone-identified) delivery customer to save multiple addresses with nicknames
  (e.g. "Casa", "Trabalho") and pick one at checkout instead of retyping the full address every order.

3. Security
- Enable RLS.
- Allow anon + authenticated CRUD — delivery ordering does not require sign-in, and the address data
  is customer-entered, intentionally accessible by the anon-key frontend (same model as
  delivery_customer_profiles).
*/

CREATE TABLE IF NOT EXISTS delivery_customer_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE,
  phone text NOT NULL,
  nickname text NOT NULL,
  cep text,
  street text,
  number text,
  bairro text,
  complement text,
  reference text,
  lat numeric,
  lng numeric,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (restaurant_id, phone, nickname)
);

ALTER TABLE delivery_customer_addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_addresses" ON delivery_customer_addresses;
CREATE POLICY "anon_select_addresses" ON delivery_customer_addresses FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_addresses" ON delivery_customer_addresses;
CREATE POLICY "anon_insert_addresses" ON delivery_customer_addresses FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_addresses" ON delivery_customer_addresses;
CREATE POLICY "anon_update_addresses" ON delivery_customer_addresses FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_addresses" ON delivery_customer_addresses;
CREATE POLICY "anon_delete_addresses" ON delivery_customer_addresses FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_delivery_addresses_phone ON delivery_customer_addresses(restaurant_id, phone);
