/*
# AI Validade Usage Tracking

1. Purpose
   Tracks daily AI consultation usage per restaurant for the Gula Etiquetas module.
   Each restaurant gets up to 10 AI consultations per day, resetting at midnight (00:00).

2. New Tables
   - `ai_validade_usage`
     - `id` (uuid, primary key)
     - `restaurant_id` (uuid, references restaurants, not null)
     - `usage_date` (date, not null) — the day the consultations were used
     - `count` (integer, not null, default 0) — number of consultations used that day
     - `created_at` (timestamptz, default now())
     - `updated_at` (timestamptz, default now())
   - Unique constraint on (restaurant_id, usage_date) so there's one row per restaurant per day.

3. Indexes
   - Index on (restaurant_id, usage_date) for fast lookups.

4. Security
   - RLS enabled on `ai_validade_usage`.
   - Policies for anon + authenticated to allow the edge functions (using service role)
     and the frontend (using anon key) to read and update usage counts.
   - The edge functions use the service role key which bypasses RLS, so these policies
     are for frontend reads (showing the counter in the UI).
*/

CREATE TABLE IF NOT EXISTS ai_validade_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  usage_date date NOT NULL,
  count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ai_validade_usage_restaurant_date_idx
  ON ai_validade_usage (restaurant_id, usage_date);

CREATE INDEX IF NOT EXISTS ai_validade_usage_lookup_idx
  ON ai_validade_usage (restaurant_id, usage_date);

ALTER TABLE ai_validade_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_ai_usage" ON ai_validade_usage;
CREATE POLICY "anon_select_ai_usage"
  ON ai_validade_usage FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_ai_usage" ON ai_validade_usage;
CREATE POLICY "anon_insert_ai_usage"
  ON ai_validade_usage FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_ai_usage" ON ai_validade_usage;
CREATE POLICY "anon_update_ai_usage"
  ON ai_validade_usage FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_ai_usage" ON ai_validade_usage;
CREATE POLICY "anon_delete_ai_usage"
  ON ai_validade_usage FOR DELETE
  TO anon, authenticated USING (true);
