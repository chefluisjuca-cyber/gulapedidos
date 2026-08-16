ALTER TABLE delivery_motoboys
  ADD COLUMN IF NOT EXISTS queue_position integer;
