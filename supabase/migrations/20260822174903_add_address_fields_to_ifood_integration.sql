ALTER TABLE ifood_orders_integration
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS reference text,
  ADD COLUMN IF NOT EXISTS formatted_address text;

-- Store iFood OAuth tokens per restaurant for reuse until expiry
CREATE TABLE IF NOT EXISTS ifood_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ifood_tokens_restaurant_idx
  ON ifood_tokens (restaurant_id);

ALTER TABLE ifood_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ifood_tokens_select_own" ON ifood_tokens
  FOR SELECT TO authenticated USING (
    restaurant_id IN (SELECT id FROM restaurants WHERE owner_email = auth.email())
  );
CREATE POLICY "ifood_tokens_insert_own" ON ifood_tokens
  FOR INSERT TO authenticated WITH CHECK (
    restaurant_id IN (SELECT id FROM restaurants WHERE owner_email = auth.email())
  );
CREATE POLICY "ifood_tokens_update_own" ON ifood_tokens
  FOR UPDATE TO authenticated
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_email = auth.email()))
  WITH CHECK (restaurant_id IN (SELECT id FROM restaurants WHERE owner_email = auth.email()));
CREATE POLICY "ifood_tokens_delete_own" ON ifood_tokens
  FOR DELETE TO authenticated USING (
    restaurant_id IN (SELECT id FROM restaurants WHERE owner_email = auth.email())
  );

-- Allow the service role (used by edge functions) full access
CREATE POLICY "ifood_tokens_service_all" ON ifood_tokens
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
