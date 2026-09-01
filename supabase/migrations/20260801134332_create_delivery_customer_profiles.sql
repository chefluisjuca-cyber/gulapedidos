/*
# Create delivery_customer_profiles table

1. New Tables
- `delivery_customer_profiles`
  - `id` (uuid, primary key)
  - `restaurant_id` (uuid, references restaurants)
  - `phone` (text, not null) — primary lookup key
  - `name` (text)
  - `cep` (text)
  - `street` (text)
  - `number` (text)
  - `bairro` (text)
  - `complement` (text)
  - `reference` (text)
  - `lat` (numeric)
  - `lng` (numeric)
  - `created_at`, `updated_at` (timestamps)
  - Unique constraint on (restaurant_id, phone) so each phone maps to one profile per restaurant.

2. Purpose
- When a customer types their phone in the delivery form, the system can look up this table
  and auto-fill all address fields if the customer has ordered before.
- This is a no-auth (anon-accessible) table since customers don't sign in to place delivery orders.

3. Security
- Enable RLS.
- Allow anon + authenticated CRUD — the data is customer-entered delivery info, intentionally
  accessible by the anon-key frontend (no sign-in required to place a delivery order).
*/

CREATE TABLE IF NOT EXISTS delivery_customer_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE,
  phone text NOT NULL,
  name text,
  cep text,
  street text,
  number text,
  bairro text,
  complement text,
  reference text,
  lat numeric,
  lng numeric,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (restaurant_id, phone)
);

ALTER TABLE delivery_customer_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_profiles" ON delivery_customer_profiles;
CREATE POLICY "anon_select_profiles" ON delivery_customer_profiles FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_profiles" ON delivery_customer_profiles;
CREATE POLICY "anon_insert_profiles" ON delivery_customer_profiles FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_profiles" ON delivery_customer_profiles;
CREATE POLICY "anon_update_profiles" ON delivery_customer_profiles FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_profiles" ON delivery_customer_profiles;
CREATE POLICY "anon_delete_profiles" ON delivery_customer_profiles FOR DELETE
  TO anon, authenticated USING (true);
