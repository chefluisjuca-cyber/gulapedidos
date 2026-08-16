/*
# Add Agent Type to Knowledge Base

1. Purpose
   - Adds an `agent` column to the `knowledge_base` table to distinguish between two AI agents:
     - 'etiquetas' — Especialista em Etiquetas & Segurança Alimentar
     - 'geral' — Especialista do Ecossistema Gula (pedidos, delivery, fidelidade, gestão, config)
   - Defaults to 'geral' so existing rows are treated as general-ecosystem topics.

2. Modified Tables
   - `knowledge_base`: adds `agent` text column, NOT NULL, DEFAULT 'geral'.
     A CHECK constraint limits values to 'etiquetas' or 'geral'.

3. Security
   - No policy changes needed — existing RLS policies cover the new column.

4. Notes
   - Existing topics are automatically assigned to the 'geral' agent.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_base' AND column_name = 'agent'
  ) THEN
    ALTER TABLE knowledge_base ADD COLUMN agent text NOT NULL DEFAULT 'geral';
    ALTER TABLE knowledge_base ADD CONSTRAINT knowledge_base_agent_check
      CHECK (agent IN ('etiquetas', 'geral'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_knowledge_base_agent ON knowledge_base (agent);
