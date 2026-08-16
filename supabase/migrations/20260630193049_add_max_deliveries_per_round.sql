ALTER TABLE delivery_settings
  ADD COLUMN IF NOT EXISTS max_deliveries_per_round integer NOT NULL DEFAULT 0;
