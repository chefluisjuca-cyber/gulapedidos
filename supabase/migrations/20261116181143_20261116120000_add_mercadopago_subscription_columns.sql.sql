/*
# Mercado Pago subscription columns on restaurants

1. Plain-English explanation
- Replaces the Stripe-based subscription tracking with Mercado Pago ("preapproval") fields.
- Adds columns to `restaurants` so each restaurant stores its Mercado Pago subscription ID,
  payer ID, subscription status, plan type, billing cycle and the end of the current paid period.
- Records whether the 7-day free trial was already used, so it is never granted twice.

2. Modified Tables
- `restaurants` — new nullable columns:
  - `mp_preapproval_id` (text): ID of the recurring subscription in Mercado Pago.
  - `mp_payer_id` (text): ID of the payer in Mercado Pago.
  - `subscription_status` (text): 'trialing' | 'active' | 'past_due' | 'canceled'.
  - `plan_type` (text): 'essencial' | 'profissional' | 'premium' | 'etiquetas' | 'fila' | 'feedback'.
  - `billing_cycle` (text): 'monthly' | 'semiannual' | 'annual'.
  - `current_period_end` (timestamptz): when the current paid period ends.
  - `mp_trial_used` (boolean, default false): whether the 7-day free trial was already consumed.
- Check constraints keep the new status columns limited to the documented values.

3. Security
- No RLS changes: the new columns are covered by the existing `restaurants` policies.
- Edge functions use the service role, which bypasses RLS but is required to write
  subscription state from trusted server-side webhooks.

4. Important notes
- All columns are nullable so existing restaurant rows keep working during the migration.
- No data is dropped or overwritten; the legacy `plan`, `modules`, `status` and
  `trial_ends_at` columns remain in place and continue to drive app behavior.
*/

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS mp_preapproval_id text,
  ADD COLUMN IF NOT EXISTS mp_payer_id text,
  ADD COLUMN IF NOT EXISTS subscription_status text,
  ADD COLUMN IF NOT EXISTS plan_type text,
  ADD COLUMN IF NOT EXISTS billing_cycle text,
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS mp_trial_used boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'restaurants_subscription_status_check'
  ) THEN
    ALTER TABLE restaurants ADD CONSTRAINT restaurants_subscription_status_check
      CHECK (subscription_status IN ('trialing', 'active', 'past_due', 'canceled'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'restaurants_plan_type_check'
  ) THEN
    ALTER TABLE restaurants ADD CONSTRAINT restaurants_plan_type_check
      CHECK (plan_type IN ('essencial', 'profissional', 'premium', 'etiquetas', 'fila', 'feedback'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'restaurants_billing_cycle_check'
  ) THEN
    ALTER TABLE restaurants ADD CONSTRAINT restaurants_billing_cycle_check
      CHECK (billing_cycle IN ('monthly', 'semiannual', 'annual'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS restaurants_mp_preapproval_id_idx
  ON restaurants (mp_preapproval_id)
  WHERE mp_preapproval_id IS NOT NULL;
