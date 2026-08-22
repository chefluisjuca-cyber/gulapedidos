CREATE TABLE IF NOT EXISTS fila_espera (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  nome_cliente text NOT NULL,
  whatsapp text NOT NULL,
  quantidade_pessoas integer NOT NULL DEFAULT 1 CHECK (quantidade_pessoas >= 1),
  status text NOT NULL DEFAULT 'aguardando'
    CHECK (status IN ('aguardando', 'chamado', 'atendido', 'cancelado')),
  criado_em timestamptz DEFAULT now()
);

CREATE INDEX fila_espera_restaurant_status_idx ON fila_espera (restaurant_id, status, criado_em);

ALTER TABLE fila_espera ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_select_fila"  ON fila_espera FOR SELECT  TO anon USING (true);
CREATE POLICY "anon_insert_fila"  ON fila_espera FOR INSERT  TO anon WITH CHECK (true);
CREATE POLICY "anon_update_fila"  ON fila_espera FOR UPDATE  TO anon USING (true) WITH CHECK (true);
