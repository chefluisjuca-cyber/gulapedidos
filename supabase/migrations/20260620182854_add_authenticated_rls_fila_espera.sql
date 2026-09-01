CREATE POLICY "auth_select_fila"  ON fila_espera FOR SELECT  TO authenticated USING (true);
CREATE POLICY "auth_insert_fila"  ON fila_espera FOR INSERT  TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_fila"  ON fila_espera FOR UPDATE  TO authenticated USING (true) WITH CHECK (true);
