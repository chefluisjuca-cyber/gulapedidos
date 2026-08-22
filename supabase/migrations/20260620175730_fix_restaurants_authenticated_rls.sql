CREATE POLICY "auth_select_restaurants" ON restaurants FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_restaurants" ON restaurants FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_restaurants" ON restaurants FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_restaurants" ON restaurants FOR DELETE TO authenticated USING (true);
