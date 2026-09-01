/*
# Add AI Validade fields to etiqueta_produtos + cache table

## Overview
Adds food-safety metadata columns to `etiqueta_produtos` so the AI suggestion
feature can persist its results directly on the product row. Also creates a new
`etiqueta_validade_cache` table that stores AI responses keyed by a hash of the
input parameters, so identical products don't trigger a second OpenAI call.

## 1. Modified Table: etiqueta_produtos
New nullable columns:
- `armazenamento` (text) — e.g. "Refrigerado 2-4°C", "Ambiente", "Congelado -18°C"
- `ingredientes_criticos` (text) — e.g. "Maionese, creme de leite"
- `modo_preparo` (text) — e.g. "Cozido, frito, cru"
- `embalagem` (text) — e.g. "Vacuum, plástico, vidro"
- `observacao` (text) — AI-generated note about the validity suggestion

## 2. New Table: etiqueta_validade_cache
- `id` (uuid PK)
- `restaurant_id` (uuid FK → restaurants, cascade)
- `input_hash` (text, not null) — SHA256 of normalized input fields
- `validade_dias` (integer, not null)
- `armazenamento` (text)
- `observacao` (text)
- `created_at` (timestamptz)
- Unique constraint on `input_hash` per restaurant to avoid duplicates.

## 3. Security
- RLS enabled on `etiqueta_validade_cache` with owner-scoped CRUD via
  auth_owned_restaurant_ids() (same pattern as the other etiqueta tables).
*/

-- ── Add columns to etiqueta_produtos ──────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'etiqueta_produtos' AND column_name = 'armazenamento') THEN
    ALTER TABLE etiqueta_produtos ADD COLUMN armazenamento text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'etiqueta_produtos' AND column_name = 'ingredientes_criticos') THEN
    ALTER TABLE etiqueta_produtos ADD COLUMN ingredientes_criticos text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'etiqueta_produtos' AND column_name = 'modo_preparo') THEN
    ALTER TABLE etiqueta_produtos ADD COLUMN modo_preparo text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'etiqueta_produtos' AND column_name = 'embalagem') THEN
    ALTER TABLE etiqueta_produtos ADD COLUMN embalagem text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'etiqueta_produtos' AND column_name = 'observacao') THEN
    ALTER TABLE etiqueta_produtos ADD COLUMN observacao text;
  END IF;
END $$;

-- ── Create etiqueta_validade_cache table ──────────────────────────────────
CREATE TABLE IF NOT EXISTS etiqueta_validade_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  input_hash text NOT NULL,
  validade_dias integer NOT NULL,
  armazenamento text,
  observacao text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (restaurant_id, input_hash)
);

CREATE INDEX IF NOT EXISTS idx_etiqueta_validade_cache_restaurant
  ON etiqueta_validade_cache(restaurant_id);

ALTER TABLE etiqueta_validade_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_validade_cache" ON etiqueta_validade_cache;
CREATE POLICY "select_own_validade_cache" ON etiqueta_validade_cache FOR SELECT
  TO authenticated USING (
    restaurant_id IN (SELECT auth_owned_restaurant_ids())
  );

DROP POLICY IF EXISTS "insert_own_validade_cache" ON etiqueta_validade_cache;
CREATE POLICY "insert_own_validade_cache" ON etiqueta_validade_cache FOR INSERT
  TO authenticated WITH CHECK (
    restaurant_id IN (SELECT auth_owned_restaurant_ids())
  );

DROP POLICY IF EXISTS "update_own_validade_cache" ON etiqueta_validade_cache;
CREATE POLICY "update_own_validade_cache" ON etiqueta_validade_cache FOR UPDATE
  TO authenticated USING (
    restaurant_id IN (SELECT auth_owned_restaurant_ids())
  ) WITH CHECK (
    restaurant_id IN (SELECT auth_owned_restaurant_ids())
  );

DROP POLICY IF EXISTS "delete_own_validade_cache" ON etiqueta_validade_cache;
CREATE POLICY "delete_own_validade_cache" ON etiqueta_validade_cache FOR DELETE
  TO authenticated USING (
    restaurant_id IN (SELECT auth_owned_restaurant_ids())
  );
