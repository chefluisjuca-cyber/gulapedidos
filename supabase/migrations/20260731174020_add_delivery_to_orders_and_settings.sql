-- Add delivery module fields to restaurant_settings
ALTER TABLE restaurant_settings
  ADD COLUMN IF NOT EXISTS delivery_enabled         BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_origin_lat      NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS delivery_origin_lng      NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS delivery_origin_address  TEXT,
  ADD COLUMN IF NOT EXISTS delivery_max_radius_km   NUMERIC(6,2) NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS delivery_km_zones        JSONB NOT NULL DEFAULT '[]';

-- Add delivery fields to orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_mode              TEXT NOT NULL DEFAULT 'pickup',
  ADD COLUMN IF NOT EXISTS delivery_name              TEXT,
  ADD COLUMN IF NOT EXISTS delivery_whatsapp          TEXT,
  ADD COLUMN IF NOT EXISTS delivery_cep               TEXT,
  ADD COLUMN IF NOT EXISTS delivery_street            TEXT,
  ADD COLUMN IF NOT EXISTS delivery_number            TEXT,
  ADD COLUMN IF NOT EXISTS delivery_bairro            TEXT,
  ADD COLUMN IF NOT EXISTS delivery_complement        TEXT,
  ADD COLUMN IF NOT EXISTS delivery_reference         TEXT,
  ADD COLUMN IF NOT EXISTS delivery_lat               NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS delivery_lng               NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS delivery_distance_km       NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS delivery_fee               NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_payment_method    TEXT NOT NULL DEFAULT 'counter',
  ADD COLUMN IF NOT EXISTS delivery_change_for        NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS delivery_estimated_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS delivery_motoboy_id        UUID,
  ADD COLUMN IF NOT EXISTS delivery_status            TEXT NOT NULL DEFAULT 'pending';
-- delivery_status values: pending | preparing | dispatched | delivered
