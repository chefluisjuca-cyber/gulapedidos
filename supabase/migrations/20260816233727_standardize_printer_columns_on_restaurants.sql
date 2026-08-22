/*
# Standardize printer config columns on restaurants

## Purpose
Consolidate all Print Agent state into the restaurants table with consistent
column names: is_connected, cashier_printer, kitchen_printer, last_seen.

## Changes
- Add is_connected (boolean, default false)
- Add cashier_printer (text, nullable)
- Add kitchen_printer (text, nullable)
- Add last_seen (timestamptz, nullable)
- Migrate data from old columns (print_agent_connected, printer_cashier, printer_kitchen)
- Drop old columns to avoid confusion
- Enable Realtime on restaurants table
*/

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS is_connected boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS cashier_printer text,
  ADD COLUMN IF NOT EXISTS kitchen_printer text,
  ADD COLUMN IF NOT EXISTS last_seen timestamptz;

-- Migrate data from old columns
UPDATE restaurants
SET
  is_connected = COALESCE(print_agent_connected, false),
  cashier_printer = printer_cashier,
  kitchen_printer = printer_kitchen
WHERE print_agent_connected IS NOT NULL
   OR printer_cashier IS NOT NULL
   OR printer_kitchen IS NOT NULL;

-- Drop old columns
ALTER TABLE restaurants
  DROP COLUMN IF EXISTS print_agent_connected,
  DROP COLUMN IF EXISTS printer_cashier,
  DROP COLUMN IF EXISTS printer_kitchen;

-- Enable Realtime on restaurants table
ALTER TABLE restaurants REPLICA IDENTITY FULL;
