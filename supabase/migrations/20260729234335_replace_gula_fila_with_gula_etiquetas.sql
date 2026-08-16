/*
# Replace Gula Fila module with Gula Etiquetas

## Overview
Removes the "Gula Fila" (waiting queue) module and introduces "Gula Etiquetas"
(food safety labeling) in its place. Stripe price IDs and plan structure are
preserved — only the module identity changes.

## 1. New Tables
- `etiqueta_produtos` — products for label printing (manipulado / industrializado)
- `etiqueta_colaboradores` — kitchen operators who print labels

## 2. Data Migration
- `restaurants.modules` (jsonb): replace 'gula_fila' with 'gula_etiquetas'
- `restaurants.plan`: 'pedidos_fidelidade_fila' → 'pedidos_fidelidade_etiquetas',
  'gula_fila_standalone' → 'gula_etiquetas_standalone'

## 3. Security
- RLS enabled on both new tables with owner-scoped CRUD via auth_owned_restaurant_ids().

## 4. Dropping old table
- DROP TABLE IF EXISTS fila_espera CASCADE
*/

-- ── Data migration: rename module keys in restaurants (modules is jsonb) ──
UPDATE restaurants
SET modules = REPLACE(modules::text, 'gula_fila', 'gula_etiquetas')::jsonb
WHERE modules::text LIKE '%gula_fila%';

UPDATE restaurants
SET plan = 'pedidos_fidelidade_etiquetas'
WHERE plan = 'pedidos_fidelidade_fila';

UPDATE restaurants
SET plan = 'gula_etiquetas_standalone'
WHERE plan = 'gula_fila_standalone';

-- ── Drop the old waiting-queue table ──────────────────────────────────────
DROP TABLE IF EXISTS fila_espera CASCADE;

-- ── Create etiqueta_produtos table ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS etiqueta_produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  nome text NOT NULL,
  categoria text NOT NULL DEFAULT 'manipulado',
  validade_dias integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_etiqueta_produtos_restaurant
  ON etiqueta_produtos(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_etiqueta_produtos_categoria
  ON etiqueta_produtos(restaurant_id, categoria);

ALTER TABLE etiqueta_produtos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_etiqueta_produtos" ON etiqueta_produtos;
CREATE POLICY "select_own_etiqueta_produtos" ON etiqueta_produtos FOR SELECT
  TO authenticated USING (
    restaurant_id IN (SELECT auth_owned_restaurant_ids())
  );

DROP POLICY IF EXISTS "insert_own_etiqueta_produtos" ON etiqueta_produtos;
CREATE POLICY "insert_own_etiqueta_produtos" ON etiqueta_produtos FOR INSERT
  TO authenticated WITH CHECK (
    restaurant_id IN (SELECT auth_owned_restaurant_ids())
  );

DROP POLICY IF EXISTS "update_own_etiqueta_produtos" ON etiqueta_produtos;
CREATE POLICY "update_own_etiqueta_produtos" ON etiqueta_produtos FOR UPDATE
  TO authenticated USING (
    restaurant_id IN (SELECT auth_owned_restaurant_ids())
  ) WITH CHECK (
    restaurant_id IN (SELECT auth_owned_restaurant_ids())
  );

DROP POLICY IF EXISTS "delete_own_etiqueta_produtos" ON etiqueta_produtos;
CREATE POLICY "delete_own_etiqueta_produtos" ON etiqueta_produtos FOR DELETE
  TO authenticated USING (
    restaurant_id IN (SELECT auth_owned_restaurant_ids())
  );

-- ── Create etiqueta_colaboradores table ───────────────────────────────────
CREATE TABLE IF NOT EXISTS etiqueta_colaboradores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_etiqueta_colaboradores_restaurant
  ON etiqueta_colaboradores(restaurant_id);

ALTER TABLE etiqueta_colaboradores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_etiqueta_colaboradores" ON etiqueta_colaboradores;
CREATE POLICY "select_own_etiqueta_colaboradores" ON etiqueta_colaboradores FOR SELECT
  TO authenticated USING (
    restaurant_id IN (SELECT auth_owned_restaurant_ids())
  );

DROP POLICY IF EXISTS "insert_own_etiqueta_colaboradores" ON etiqueta_colaboradores;
CREATE POLICY "insert_own_etiqueta_colaboradores" ON etiqueta_colaboradores FOR INSERT
  TO authenticated WITH CHECK (
    restaurant_id IN (SELECT auth_owned_restaurant_ids())
  );

DROP POLICY IF EXISTS "update_own_etiqueta_colaboradores" ON etiqueta_colaboradores;
CREATE POLICY "update_own_etiqueta_colaboradores" ON etiqueta_colaboradores FOR UPDATE
  TO authenticated USING (
    restaurant_id IN (SELECT auth_owned_restaurant_ids())
  ) WITH CHECK (
    restaurant_id IN (SELECT auth_owned_restaurant_ids())
  );

DROP POLICY IF EXISTS "delete_own_etiqueta_colaboradores" ON etiqueta_colaboradores;
CREATE POLICY "delete_own_etiqueta_colaboradores" ON etiqueta_colaboradores FOR DELETE
  TO authenticated USING (
    restaurant_id IN (SELECT auth_owned_restaurant_ids())
  );
