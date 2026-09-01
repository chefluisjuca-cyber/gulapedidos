/*
# Add trial_ends_at and plan to restaurants

1. New Columns
- `restaurants.trial_ends_at` (timestamptz, nullable): timestamp when the
  7-day native trial expires. Set automatically to created_at + 7 days when
  a new restaurant is created by the Super Admin.
- `restaurants.plan` (text, nullable): internal plan code identifying the
  Stripe product family the restaurant subscribed to. Values:
    'essencial'       -> modules ['gula_pedidos']
    'pedidos_fidelidade' -> modules ['gula_pedidos','gula_fidelidade']
    'pedidos_fidelidade_fila' -> modules ['gula_pedidos','gula_fidelidade','gula_fila']
  NULL means no plan chosen yet (still in trial or manually managed).

2. Backfill
- Existing restaurants with status='trial' and no trial_ends_at get
  trial_ends_at = created_at + interval '7 days' so the paywall logic has
  a concrete date to compare against.

3. Security
- No RLS policy changes. Existing policies continue to govern access.
*/

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS plan text;

-- Backfill trial_ends_at for existing trialing restaurants that lack it
UPDATE restaurants
SET trial_ends_at = created_at + (interval '7 days')
WHERE status = 'trial' AND trial_ends_at IS NULL;

-- Index to speed up paywall / trial-expiry checks
CREATE INDEX IF NOT EXISTS restaurants_trial_ends_at_idx
  ON restaurants (trial_ends_at)
  WHERE status = 'trial';
