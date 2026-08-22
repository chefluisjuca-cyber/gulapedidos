-- Add priority/preferential support to fila_espera (Lei nº 10.048)

ALTER TABLE fila_espera
  ADD COLUMN IF NOT EXISTS prioridade boolean NOT NULL DEFAULT false;

ALTER TABLE fila_espera
  ADD COLUMN IF NOT EXISTS prioridade_categoria text
  CHECK (prioridade_categoria IS NULL OR prioridade_categoria IN ('idoso','gestante','pcd','autista','crianca_colo'));

-- When prioridade is false, categoria must be null (kept consistent by app)
-- No index needed for low-cardinality boolean; composite index below helps filtering
CREATE INDEX IF NOT EXISTS fila_espera_restaurant_status_prioridade_idx
  ON fila_espera (restaurant_id, status, prioridade, criado_em);
