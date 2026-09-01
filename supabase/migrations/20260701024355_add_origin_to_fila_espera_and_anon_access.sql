-- Add origin field to fila_espera to distinguish online vs presential entries
ALTER TABLE fila_espera ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'presencial';

-- Allow anonymous users to insert into fila_espera (self-service)
CREATE POLICY "anon_insert_fila_espera" ON fila_espera
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Allow anonymous users to select their own entry (for the self-service tracking page)
-- Already handled by existing policy; ensure anon can read by restaurant for queue position display
CREATE POLICY "anon_select_fila_espera" ON fila_espera
  FOR SELECT TO anon
  USING (true);
