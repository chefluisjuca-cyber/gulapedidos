/*
# Store VAPID keys for Web Push notifications

1. New Tables
   - `push_vapid_keys`: Stores VAPID public and private keys for
     sending Web Push notifications. The edge function `send-mass-push`
     reads these keys at runtime instead of relying on environment
     secrets (which can't be set via CLI in this environment).

2. Columns
   - `id` (int, primary key, always 1): singleton row
   - `public_key` (text, not null): VAPID public key (base64url)
   - `private_key` (text, not null): VAPID private key (base64url)
   - `subject` (text): VAPID subject (mailto: or https: URL)
   - `created_at` (timestamptz)

3. Security
   - RLS enabled. Only authenticated (restaurant admin) can SELECT.
   - No INSERT/UPDATE/DELETE policies — keys are managed via execute_sql
     or the super admin panel.

4. Notes
   - A single row is inserted with id=1 containing the VAPID keys.
*/

CREATE TABLE IF NOT EXISTS push_vapid_keys (
  id int PRIMARY KEY DEFAULT 1,
  public_key text NOT NULL,
  private_key text NOT NULL,
  subject text NOT NULL DEFAULT 'mailto:contato@gula.com.br',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE push_vapid_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_vapid_keys" ON push_vapid_keys;
CREATE POLICY "auth_select_vapid_keys" ON push_vapid_keys
  FOR SELECT TO authenticated USING (true);

-- Insert the VAPID keys
INSERT INTO push_vapid_keys (id, public_key, private_key, subject)
VALUES (1, 'BHnnBo3h5evlOO1GYU9YlVpBdm3uLPGsqguhGiBInTmP4DuxSUk3aARjbR_Jmann-mcrJkXicDjAW-xjT89tixw', 'cnNUCEd4-usUc-kvMEHRLzpz2YvTlMl9vyGOF_BklLM', 'mailto:contato@gula.com.br')
ON CONFLICT (id) DO UPDATE SET
  public_key = EXCLUDED.public_key,
  private_key = EXCLUDED.private_key,
  subject = EXCLUDED.subject;