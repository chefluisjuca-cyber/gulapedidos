/*
# Knowledge Base + Virtual Assistant Display Toggle

1. Purpose
   - Creates a `knowledge_base` table to store Q&A topics that the AI assistant will consult.
   - Adds a `show_virtual_assistant` boolean column to `restaurant_settings` to control
     public visibility of the Gula Especialista widget on the landing page (default: false / hidden).

2. New Tables
   - `knowledge_base`
     - `id` (uuid, primary key)
     - `restaurant_id` (uuid, nullable — null means global/platform-wide topics)
     - `category` (text, not null — e.g. "Validade", "Armazenamento", "Higiene")
     - `question` (text, not null — the topic/question text)
     - `answer` (text, not null — the answer/knowledge content)
     - `keywords` (text array, default empty — optional keywords for matching)
     - `sort_order` (integer, default 0)
     - `active` (boolean, default true)
     - `created_at` (timestamptz, default now)
     - `updated_at` (timestamptz, default now)

3. Modified Tables
   - `restaurant_settings`: adds column `show_virtual_assistant` (boolean, default false).
     When false, the Gula Especialista widget is hidden from all visitors.
     When true (set by Super Admin), the widget becomes visible on the landing page.

4. Security
   - RLS enabled on `knowledge_base`.
   - SELECT: allowed for `anon, authenticated` (the AI assistant and test panel need to read topics).
   - INSERT/UPDATE/DELETE: restricted to `authenticated` (Super Admin manages topics).
   - `restaurant_settings` already has RLS; the new column inherits existing policies.

5. Notes
   - The `show_virtual_assistant` column defaults to `false`, meaning the widget is hidden by default.
   - Only Super Admin can toggle it on via the admin panel.
*/

-- ── knowledge_base table ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS knowledge_base (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE,
  category text NOT NULL,
  question text NOT NULL,
  answer text NOT NULL,
  keywords text[] DEFAULT '{}',
  sort_order integer DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;

-- SELECT: anyone (including anon) can read — the AI assistant needs to query topics
DROP POLICY IF EXISTS "kb_select_all" ON knowledge_base;
CREATE POLICY "kb_select_all" ON knowledge_base FOR SELECT
  TO anon, authenticated USING (true);

-- INSERT: only authenticated (Super Admin)
DROP POLICY IF EXISTS "kb_insert_authenticated" ON knowledge_base;
CREATE POLICY "kb_insert_authenticated" ON knowledge_base FOR INSERT
  TO authenticated WITH CHECK (true);

-- UPDATE: only authenticated (Super Admin)
DROP POLICY IF EXISTS "kb_update_authenticated" ON knowledge_base;
CREATE POLICY "kb_update_authenticated" ON knowledge_base FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

-- DELETE: only authenticated (Super Admin)
DROP POLICY IF EXISTS "kb_delete_authenticated" ON knowledge_base;
CREATE POLICY "kb_delete_authenticated" ON knowledge_base FOR DELETE
  TO authenticated USING (true);

-- ── show_virtual_assistant column on restaurant_settings ─────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'restaurant_settings' AND column_name = 'show_virtual_assistant'
  ) THEN
    ALTER TABLE restaurant_settings ADD COLUMN show_virtual_assistant boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- ── Index for efficient queries ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_knowledge_base_active ON knowledge_base (active);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_restaurant ON knowledge_base (restaurant_id);
