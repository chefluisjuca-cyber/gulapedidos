/*
# Add per-item extras to combo groups

## What this does
Allows each option inside a combo group (combo_group_items) to have its own
list of paid/free add-ons. For example, a combo with a "Escolha o Hambúrguer"
group can define that the "X-Burguer" option has extras like bacon (+R$3) and
cheddar (+R$2), while the "Escolha a Bebida" group's "Coca-Cola" option has no
extras. The customer picks the option and then sees only the extras that apply
to THAT option, inline — instead of all extras dumping at the bottom of the
product.

## Why
Previously the only extras on a combo product lived on the parent product via
`product_extras`, which meant they appeared in a single flat list at the end of
the drawer and the printed ticket. There was no way to say "bacon belongs to
the hambúrguer, not the bebida". This migration fixes that by giving every
combo group item its own extras.

## New table
- `combo_item_extras`
  - `id` (uuid, primary key)
  - `combo_group_item_id` (uuid, FK → combo_group_items(id) ON DELETE CASCADE)
  - `name` (text, not null) — e.g. "Bacon extra"
  - `price` (numeric(10,2), default 0)
  - `sort_order` (integer, default 0)

## Security
- RLS enabled on `combo_item_extras`.
- anon + authenticated CRUD (single-tenant shared data, same as the other
  combo/product tables).

## Notes
1. Existing restaurants are covered: the table is created for everyone at once.
   Existing combo items simply have no extras until the admin configures them.
2. No existing columns or tables are altered — purely additive.
3. The frontend product query is updated separately to nest
   `combo_item_extras(*)` under `combo_group_items`.
*/

CREATE TABLE IF NOT EXISTS combo_item_extras (
  id                  uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  combo_group_item_id uuid         NOT NULL REFERENCES combo_group_items(id) ON DELETE CASCADE,
  name                text         NOT NULL,
  price               numeric(10,2) NOT NULL DEFAULT 0,
  sort_order          integer      NOT NULL DEFAULT 0,
  created_at          timestamptz  DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_combo_item_extras_item ON combo_item_extras(combo_group_item_id);

ALTER TABLE combo_item_extras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_combo_item_extras" ON combo_item_extras;
CREATE POLICY "anon_select_combo_item_extras" ON combo_item_extras FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_combo_item_extras" ON combo_item_extras;
CREATE POLICY "anon_insert_combo_item_extras" ON combo_item_extras FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_combo_item_extras" ON combo_item_extras;
CREATE POLICY "anon_update_combo_item_extras" ON combo_item_extras FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_combo_item_extras" ON combo_item_extras;
CREATE POLICY "anon_delete_combo_item_extras" ON combo_item_extras FOR DELETE
  TO anon, authenticated USING (true);
