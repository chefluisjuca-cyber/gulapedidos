/*
# Add link_code to print_agents

## Purpose
Enables a short 6-digit linking code flow: the web panel generates a code,
the desktop Print Agent app enters it to connect. Previously both sides asked
the user to paste a code that was never generated.

## Changes
- `print_agents.link_code` (text, unique, nullable) — 6-digit code the web panel generates
- `print_agents.link_code_expires_at` (timestamptz, nullable) — when the code expires (10 min)
- Index on `link_code` for fast lookups by the edge function

## Security
- No RLS policy changes. The edge function uses the service role key to look up
  by link_code, bypassing RLS. Existing owner-scoped policies remain intact.
*/

ALTER TABLE print_agents
  ADD COLUMN IF NOT EXISTS link_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS link_code_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_print_agents_link_code ON print_agents(link_code) WHERE link_code IS NOT NULL;
