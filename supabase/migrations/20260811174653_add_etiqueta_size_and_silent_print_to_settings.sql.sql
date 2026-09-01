/*
# Add etiqueta size and silent print settings

1. Modified Tables
- `restaurant_settings`
  - `etiqueta_size` (text, default '60x40'): stores the label roll model ('60x40' or '50x40').
  - `silent_print` (boolean, default false): enables direct/silent printing without the browser print dialog.

2. Security
- No new tables. Existing RLS policies on restaurant_settings remain unchanged.
- No changes to policies.

3. Important Notes
- Both columns are nullable-safe with defaults so existing rows and inserts work without modification.
- `etiqueta_size` accepts '60x40' (Modelo A, 60mm x 40mm) or '50x40' (Modelo B, 50mm x 40mm).
- `silent_print` when true triggers `window.print()` immediately without user interaction (requires Chrome `--kiosk-printing` flag for truly silent output).
*/

ALTER TABLE restaurant_settings
  ADD COLUMN IF NOT EXISTS etiqueta_size text DEFAULT '60x40',
  ADD COLUMN IF NOT EXISTS silent_print boolean DEFAULT false;
