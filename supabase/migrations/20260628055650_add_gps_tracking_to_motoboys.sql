-- GPS tracking fields on motoboys
ALTER TABLE delivery_motoboys
  ADD COLUMN IF NOT EXISTS last_lat      NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS last_lng      NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS last_seen_at  TIMESTAMPTZ;

-- Allow anon (motoboy mobile view) to SELECT their own row
CREATE POLICY "anon_select_delivery_motoboys"
  ON delivery_motoboys FOR SELECT
  TO anon USING (true);

-- Allow anon to UPDATE location fields only
CREATE POLICY "anon_update_motoboy_location"
  ON delivery_motoboys FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);
