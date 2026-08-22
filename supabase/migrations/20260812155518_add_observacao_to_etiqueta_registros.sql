/*
# Add observacao column to etiqueta_registros

## Overview
Adds an optional `observacao` text column to the `etiqueta_registros` table
so that custom/personalized labels can store a free-form note (e.g. storage
instructions, batch number, etc.) alongside the standard fields.

## 1. Modified Table
- `etiqueta_registros`
  - `observacao` (text, nullable): optional free-form note for custom labels.

## 2. Security
- No new tables. Existing RLS policies on etiqueta_registros remain unchanged.
*/

ALTER TABLE etiqueta_registros
  ADD COLUMN IF NOT EXISTS observacao text;
