/*
# Create order_messages table for real-time order chat

1. New Tables
- `order_messages`
  - `id` (uuid, primary key)
  - `order_id` (uuid, foreign key to orders.id, ON DELETE CASCADE)
  - `restaurant_id` (uuid, nullable)
  - `sender_type` (text: 'client' | 'restaurant', not null)
  - `message` (text, not null)
  - `read` (boolean, default false)
  - `created_at` (timestamptz, default now())

2. Indexes
- `idx_order_messages_order_id` on `order_id`
- `idx_order_messages_created_at` on `created_at`

3. Realtime
- Enable Supabase Realtime for this table via publication

4. Security
- Enable RLS on `order_messages`.
- Allow anon + authenticated CRUD (single-tenant, no sign-in on customer side).
*/

CREATE TABLE IF NOT EXISTS order_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  restaurant_id uuid,
  sender_type text NOT NULL CHECK (sender_type IN ('client', 'restaurant')),
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_messages_order_id ON order_messages(order_id);
CREATE INDEX IF NOT EXISTS idx_order_messages_created_at ON order_messages(created_at);

ALTER TABLE order_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_order_messages" ON order_messages;
CREATE POLICY "anon_select_order_messages" ON order_messages FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_order_messages" ON order_messages;
CREATE POLICY "anon_insert_order_messages" ON order_messages FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_order_messages" ON order_messages;
CREATE POLICY "anon_update_order_messages" ON order_messages FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_order_messages" ON order_messages;
CREATE POLICY "anon_delete_order_messages" ON order_messages FOR DELETE
  TO anon, authenticated USING (true);

-- Enable Realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE order_messages;
