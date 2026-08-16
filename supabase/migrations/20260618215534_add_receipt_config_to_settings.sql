ALTER TABLE restaurant_settings
  ADD COLUMN IF NOT EXISTS cnpj text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS receipt_footer text;
