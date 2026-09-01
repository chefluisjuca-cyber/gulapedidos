/*
# Add print_agent_api_key to restaurants

## Purpose
Replaces the temporary 6-digit link code flow with a permanent API key per restaurant.
The web panel displays this key; the desktop Print Agent app uses it to authenticate
directly — no more expiring codes.

## Changes
- `restaurants.print_agent_api_key` (text, unique, not null) — auto-generated on insert
  via a trigger for existing and future rows.

## Security
- No RLS policy changes. The edge function uses the service role key to look up
  by api_key, bypassing RLS. The column is readable by the restaurant owner via
  existing owner-scoped SELECT policies.
*/

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS print_agent_api_key text;

-- Backfill existing rows with a unique key
UPDATE restaurants
SET print_agent_api_key = encode(gen_random_bytes(18), 'hex')
WHERE print_agent_api_key IS NULL;

-- Add unique constraint
ALTER TABLE restaurants
  ALTER COLUMN print_agent_api_key SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_restaurants_print_agent_api_key
  ON restaurants(print_agent_api_key);

-- Auto-generate a key for any future inserts that omit it
CREATE OR REPLACE FUNCTION set_print_agent_api_key()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.print_agent_api_key IS NULL THEN
    NEW.print_agent_api_key := encode(gen_random_bytes(18), 'hex');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_print_agent_api_key ON restaurants;
CREATE TRIGGER trg_set_print_agent_api_key
  BEFORE INSERT ON restaurants
  FOR EACH ROW
  EXECUTE FUNCTION set_print_agent_api_key();
