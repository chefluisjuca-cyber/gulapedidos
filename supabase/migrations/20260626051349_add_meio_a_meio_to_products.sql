
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_meio_a_meio    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS meio_a_meio_cat_1_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS meio_a_meio_cat_2_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS meio_a_meio_price_rule TEXT NOT NULL DEFAULT 'highest';
