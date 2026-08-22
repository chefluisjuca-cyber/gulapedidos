ALTER TABLE loyalty_configs
  ADD COLUMN IF NOT EXISTS campanha_ativa boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS campanha_dia_semana smallint DEFAULT 1,
  ADD COLUMN IF NOT EXISTS campanha_horario text DEFAULT '18:00',
  ADD COLUMN IF NOT EXISTS campanha_mensagem text DEFAULT '';

COMMENT ON COLUMN loyalty_configs.campanha_dia_semana IS '0=Domingo, 1=Segunda, 2=Terça, 3=Quarta, 4=Quinta, 5=Sexta, 6=Sábado';
