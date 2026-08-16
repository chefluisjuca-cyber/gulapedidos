/*
# Add observations field to combo_group_items

Adds an optional `observations` text column to combo_group_items.
This field is shown to customers as a free-text note associated with
the combo option (e.g., "sem cebola", "ponto da carne"), with no
additional charge.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'combo_group_items' AND column_name = 'observations'
  ) THEN
    ALTER TABLE combo_group_items ADD COLUMN observations text;
  END IF;
END $$;
