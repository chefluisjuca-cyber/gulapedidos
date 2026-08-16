/*
# Add Subcategorias to Gula Etiquetas

## Overview
Adds a new `etiqueta_subcategorias` table so each restaurant can create custom
subcategories (e.g. Carnes, Molhos, Laticínios) to organize products within the
Manipulado / Industrializado categories. Products get an optional FK to their
subcategoria, enabling filtering and search on the print screen.

## 1. New Table
- `etiqueta_subcategorias`
  - `id` (uuid PK)
  - `restaurant_id` (uuid FK → restaurants, cascade delete)
  - `nome` (text, not null) — e.g. "Carnes", "Molhos"
  - `categoria` (text, not null) — 'manipulado' | 'industrializado'
  - `created_at` (timestamptz)

## 2. Modified Table
- `etiqueta_produtos`: add nullable `subcategoria_id` (uuid FK →
  etiqueta_subcategorias, ON DELETE SET NULL). Nullable so existing products
  are unaffected; deleting a subcategory simply unlinks its products.

## 3. Security
- RLS enabled on `etiqueta_subcategorias` with owner-scoped CRUD via
  auth_owned_restaurant_ids() (same pattern as the other etiqueta tables).

## 4. Indexes
- Composite index on (restaurant_id, categoria) for fast filtering by category.
*/

-- ── Create etiqueta_subcategorias table ──────────────────────────────────
CREATE TABLE IF NOT EXISTS etiqueta_subcategorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  nome text NOT NULL,
  categoria text NOT NULL DEFAULT 'manipulado',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_etiqueta_subcategorias_restaurant_cat
  ON etiqueta_subcategorias(restaurant_id, categoria);

ALTER TABLE etiqueta_subcategorias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_etiqueta_subcategorias" ON etiqueta_subcategorias;
CREATE POLICY "select_own_etiqueta_subcategorias" ON etiqueta_subcategorias FOR SELECT
  TO authenticated USING (
    restaurant_id IN (SELECT auth_owned_restaurant_ids())
  );

DROP POLICY IF EXISTS "insert_own_etiqueta_subcategorias" ON etiqueta_subcategorias;
CREATE POLICY "insert_own_etiqueta_subcategorias" ON etiqueta_subcategorias FOR INSERT
  TO authenticated WITH CHECK (
    restaurant_id IN (SELECT auth_owned_restaurant_ids())
  );

DROP POLICY IF EXISTS "update_own_etiqueta_subcategorias" ON etiqueta_subcategorias;
CREATE POLICY "update_own_etiqueta_subcategorias" ON etiqueta_subcategorias FOR UPDATE
  TO authenticated USING (
    restaurant_id IN (SELECT auth_owned_restaurant_ids())
  ) WITH CHECK (
    restaurant_id IN (SELECT auth_owned_restaurant_ids())
  );

DROP POLICY IF EXISTS "delete_own_etiqueta_subcategorias" ON etiqueta_subcategorias;
CREATE POLICY "delete_own_etiqueta_subcategorias" ON etiqueta_subcategorias FOR DELETE
  TO authenticated USING (
    restaurant_id IN (SELECT auth_owned_restaurant_ids())
  );

-- ── Add subcategoria_id to etiqueta_produtos ─────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'etiqueta_produtos' AND column_name = 'subcategoria_id'
  ) THEN
    ALTER TABLE etiqueta_produtos
      ADD COLUMN subcategoria_id uuid REFERENCES etiqueta_subcategorias(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_etiqueta_produtos_subcategoria
  ON etiqueta_produtos(subcategoria_id);
