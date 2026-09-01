/*
# Add business_hours to restaurant_settings

1. New Column
   - `restaurant_settings.business_hours` (jsonb, nullable): stores the
     weekly operating schedule. When null, the restaurant is treated as
     always open (backward-compatible with existing restaurants).

   Structure:
   {
     "0": { "active": true,  "shifts": [{ "open": "11:00", "close": "15:00" }, { "open": "18:00", "close": "23:30" }] },
     "1": { "active": true,  "shifts": [{ "open": "11:00", "close": "15:00" }] },
     ...
     "6": { "active": false, "shifts": [] }
   }
   Keys 0-6 = Sunday-Saturday (JS Date.getDay()).

2. Security
   - No new tables. No RLS policy changes.
   - Existing policies on restaurant_settings already cover CRUD.
*/

ALTER TABLE restaurant_settings
  ADD COLUMN IF NOT EXISTS business_hours jsonb;
