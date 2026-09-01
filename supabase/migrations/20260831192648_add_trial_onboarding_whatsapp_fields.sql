/*
# Add WhatsApp onboarding automation fields to restaurants

1. Purpose
   This migration adds the columns needed to automate a WhatsApp
   onboarding/relationship drip campaign for restaurants in their
   7-day free trial period. The cron edge function will read these
   columns to decide which message to send and when.

2. New Columns on `restaurants`
   - `trial_status` (text, nullable): tracks the trial lifecycle.
     Values: 'active' (trial in progress), 'converted' (user subscribed),
     'expired' (trial ended without conversion).
     Defaults to 'active' for rows whose status = 'trial'.
   - `whatsapp_step` (integer, not null, default 0): controls the drip
     sequence so each message is sent exactly once.
     0 = no message sent yet
     1 = Day-1 welcome message sent
     2 = Day-3 tutorial reminder sent
     3 = Day-6 expiration warning sent

3. Backfill
   - Existing restaurants with status = 'trial' get trial_status = 'active'.
   - All existing restaurants get whatsapp_step = 0 (no messages sent).

4. Indexes
   - Partial index on restaurants where trial_status = 'active' to speed
     up the daily cron query that selects eligible restaurants.

5. Security
   - No RLS policy changes. The restaurants table already has RLS enabled
     with existing policies. The new columns are read/written by the
     service-role key inside edge functions, not by the frontend.
*/

-- Add trial_status column
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS trial_status text;

-- Add whatsapp_step column
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS whatsapp_step integer NOT NULL DEFAULT 0;

-- Backfill trial_status for existing trialing restaurants
UPDATE restaurants
  SET trial_status = 'active'
  WHERE status = 'trial' AND trial_status IS NULL;

-- Partial index for the daily cron query
CREATE INDEX IF NOT EXISTS restaurants_trial_status_active_idx
  ON restaurants (created_at)
  WHERE trial_status = 'active';