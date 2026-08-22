/*
# Add etiqueta_registros table — Controle de Validades

## Overview
Creates a new table to persist every printed label (etiqueta) so the kitchen
can track which products are nearing expiration. Each row represents one
label that was printed, with its fabrication date, expiration date, the
responsible operator, and a status that the team can update when the
product is consumed or discarded.

## 1. New Table
- `etiqueta_registros`
  - `id` (uuid PK)
  - `restaurant_id` (uuid FK → restaurants, cascade delete)
  - `produto` (text) — name of the product at print time (denormalized for history)
  - `produto_id` (uuid, nullable) — FK to etiqueta_produtos for reference
  - `data_fabricacao` (date) — fabrication date printed on the label
  - `data_validade` (date) — expiration date printed on the label
  - `responsavel` (text) — name of the operator who printed the label
  - `status` (text) — 'ativo' | 'consumido' | 'descartado', default 'ativo'
  - `created_at` (timestamptz) — when the label was printed

## 2. Indexes
- `idx_etiqueta_registros_restaurant` on (restaurant_id)
- `idx_etiqueta_registros_status` on (restaurant_id, status)
- `idx_etiqueta_registros_validade` on (restaurant_id, data_validade)

## 3. Security
- RLS enabled, owner-scoped CRUD via auth_owned_restaurant_ids()
- 4 policies (SELECT, INSERT, UPDATE, DELETE) matching existing etiqueta tables
*/

CREATE TABLE IF NOT EXISTS etiqueta_registros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  produto text NOT NULL,
  produto_id uuid REFERENCES etiqueta_produtos(id) ON DELETE SET NULL,
  data_fabricacao date NOT NULL,
  data_validade date NOT NULL,
  responsavel text NOT NULL DEFAULT '—',
  status text NOT NULL DEFAULT 'ativo',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_etiqueta_registros_restaurant
  ON etiqueta_registros(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_etiqueta_registros_status
  ON etiqueta_registros(restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_etiqueta_registros_validade
  ON etiqueta_registros(restaurant_id, data_validade);

ALTER TABLE etiqueta_registros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_etiqueta_registros" ON etiqueta_registros;
CREATE POLICY "select_own_etiqueta_registros" ON etiqueta_registros FOR SELECT
  TO authenticated USING (
    restaurant_id IN (SELECT auth_owned_restaurant_ids())
  );

DROP POLICY IF EXISTS "insert_own_etiqueta_registros" ON etiqueta_registros;
CREATE POLICY "insert_own_etiqueta_registros" ON etiqueta_registros FOR INSERT
  TO authenticated WITH CHECK (
    restaurant_id IN (SELECT auth_owned_restaurant_ids())
  );

DROP POLICY IF EXISTS "update_own_etiqueta_registros" ON etiqueta_registros;
CREATE POLICY "update_own_etiqueta_registros" ON etiqueta_registros FOR UPDATE
  TO authenticated USING (
    restaurant_id IN (SELECT auth_owned_restaurant_ids())
  ) WITH CHECK (
    restaurant_id IN (SELECT auth_owned_restaurant_ids())
  );

DROP POLICY IF EXISTS "delete_own_etiqueta_registros" ON etiqueta_registros;
CREATE POLICY "delete_own_etiqueta_registros" ON etiqueta_registros FOR DELETE
  TO authenticated USING (
    restaurant_id IN (SELECT auth_owned_restaurant_ids())
  );
