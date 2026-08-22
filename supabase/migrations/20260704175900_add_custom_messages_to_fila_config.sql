ALTER TABLE restaurant_settings
  ADD COLUMN IF NOT EXISTS fila_mensagem_link_inicial text,
  ADD COLUMN IF NOT EXISTS fila_mensagem_chamada text;
