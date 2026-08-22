/*
# Add printer config columns to restaurants

## Purpose
Allows the desktop Print Agent to persist its selected printer names directly
on the restaurant row, so the web panel can display them in real time.

## Changes
- `restaurants.printer_cashier` (text, nullable)
- `restaurants.printer_kitchen` (text, nullable)
- `restaurants.same_printer` (boolean, default false)
- `restaurants.print_agent_connected` (boolean, default false)
*/

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS printer_cashier text,
  ADD COLUMN IF NOT EXISTS printer_kitchen text,
  ADD COLUMN IF NOT EXISTS same_printer boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS print_agent_connected boolean DEFAULT false;
