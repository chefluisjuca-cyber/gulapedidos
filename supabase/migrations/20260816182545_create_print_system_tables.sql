/*
# Print System: Agents, Printers, Jobs, Settings

## Purpose
Creates the database layer for a professional thermal printing system.
A local "Print Agent" (Windows Electron app) connects to the SaaS, receives
print jobs, and prints directly to thermal printers via ESC/POS — no browser
print dialog.

## New Tables

### 1. print_agents
- `id` (uuid PK)
- `restaurant_id` (uuid FK → restaurants, ON DELETE CASCADE)
- `agent_token` (text, unique) — secret token the agent uses to authenticate
- `machine_name` (text) — Windows machine name reported by the agent
- `status` (text: 'connected' | 'disconnected') — current connection state
- `last_seen_at` (timestamptz) — last heartbeat timestamp
- `version` (text) — agent software version
- `created_at` / `updated_at` (timestamptz)

### 2. printers
- `id` (uuid PK)
- `restaurant_id` (uuid FK → restaurants, ON DELETE CASCADE)
- `agent_id` (uuid FK → print_agents, ON DELETE SET NULL)
- `sector` (text: 'caixa' | 'cozinha' | 'bar' | 'expedicao' | 'fritura' | 'delivery' | 'outros')
- `printer_name` (text) — Windows printer name as reported by the agent
- `is_default` (boolean, default false)
- `paper_width` (int, default 80) — 58 or 80 mm
- `status` (text: 'online' | 'offline' | 'error' | 'unknown', default 'unknown')
- `last_error` (text, nullable)
- `created_at` / `updated_at` (timestamptz)

### 3. print_jobs
- `id` (uuid PK)
- `restaurant_id` (uuid FK → restaurants, ON DELETE CASCADE)
- `printer_id` (uuid FK → printers, ON DELETE CASCADE)
- `order_id` (uuid FK → orders, ON DELETE SET NULL, nullable)
- `sector` (text) — which sector this job targets
- `job_type` (text: 'receipt' | 'kitchen' | 'test')
- `payload` (jsonb) — the full print content (order data, items, etc.)
- `idempotency_key` (text, unique) — prevents duplicate prints
- `status` (text: 'pending' | 'printing' | 'printed' | 'failed', default 'pending')
- `attempts` (int, default 0)
- `max_attempts` (int, default 5)
- `error_message` (text, nullable)
- `created_at` / `updated_at` / `printed_at` (timestamptz)

### 4. print_settings
- `id` (uuid PK)
- `restaurant_id` (uuid, unique, FK → restaurants, ON DELETE CASCADE)
- `auto_print` (boolean, default true) — print automatically on new orders
- `auto_print_caixa` (boolean, default true)
- `auto_print_cozinha` (boolean, default true)
- `copies` (int, default 1)
- `allow_reprint` (boolean, default true)
- `same_printer_caixa_cozinha` (boolean, default false)
- `created_at` / `updated_at` (timestamptz)

## Security
- RLS enabled on all 4 tables.
- print_agents: owner-scoped (authenticated restaurant owner) for CRUD.
  Agent token is used for API-level auth in the edge function, not RLS.
- printers: owner-scoped for CRUD.
- print_jobs: owner-scoped for SELECT/INSERT/UPDATE. The edge function
  uses the service role key to insert and update jobs, bypassing RLS.
- print_settings: owner-scoped for CRUD.

## Important Notes
1. The edge function `print-agent` will use the service role key to
   read/insert/update print_jobs and update print_agents status.
2. The agent_token is generated at registration time and stored hashed
   is NOT necessary here — the token is a random UUID-like string that
   the agent must present. It is unique and unguessable.
3. idempotency_key on print_jobs prevents duplicate prints when the
   server retries or the agent reconnects.
4. print_settings uses a unique restaurant_id so there is at most one
   settings row per restaurant.
*/

-- ── print_agents ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS print_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  agent_token text UNIQUE NOT NULL,
  machine_name text,
  status text NOT NULL DEFAULT 'disconnected',
  last_seen_at timestamptz,
  version text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE print_agents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_print_agents" ON print_agents;
CREATE POLICY "select_own_print_agents" ON print_agents FOR SELECT
  TO authenticated USING (
    restaurant_id IN (SELECT auth_owned_restaurant_ids())
  );

DROP POLICY IF EXISTS "insert_own_print_agents" ON print_agents;
CREATE POLICY "insert_own_print_agents" ON print_agents FOR INSERT
  TO authenticated WITH CHECK (
    restaurant_id IN (SELECT auth_owned_restaurant_ids())
  );

DROP POLICY IF EXISTS "update_own_print_agents" ON print_agents;
CREATE POLICY "update_own_print_agents" ON print_agents FOR UPDATE
  TO authenticated USING (
    restaurant_id IN (SELECT auth_owned_restaurant_ids())
  ) WITH CHECK (
    restaurant_id IN (SELECT auth_owned_restaurant_ids())
  );

DROP POLICY IF EXISTS "delete_own_print_agents" ON print_agents;
CREATE POLICY "delete_own_print_agents" ON print_agents FOR DELETE
  TO authenticated USING (
    restaurant_id IN (SELECT auth_owned_restaurant_ids())
  );

-- ── printers ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS printers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES print_agents(id) ON DELETE SET NULL,
  sector text NOT NULL DEFAULT 'caixa',
  printer_name text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  paper_width int NOT NULL DEFAULT 80,
  status text NOT NULL DEFAULT 'unknown',
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE printers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_printers" ON printers;
CREATE POLICY "select_own_printers" ON printers FOR SELECT
  TO authenticated USING (
    restaurant_id IN (SELECT auth_owned_restaurant_ids())
  );

DROP POLICY IF EXISTS "insert_own_printers" ON printers;
CREATE POLICY "insert_own_printers" ON printers FOR INSERT
  TO authenticated WITH CHECK (
    restaurant_id IN (SELECT auth_owned_restaurant_ids())
  );

DROP POLICY IF EXISTS "update_own_printers" ON printers;
CREATE POLICY "update_own_printers" ON printers FOR UPDATE
  TO authenticated USING (
    restaurant_id IN (SELECT auth_owned_restaurant_ids())
  ) WITH CHECK (
    restaurant_id IN (SELECT auth_owned_restaurant_ids())
  );

DROP POLICY IF EXISTS "delete_own_printers" ON printers;
CREATE POLICY "delete_own_printers" ON printers FOR DELETE
  TO authenticated USING (
    restaurant_id IN (SELECT auth_owned_restaurant_ids())
  );

-- ── print_jobs ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS print_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  printer_id uuid NOT NULL REFERENCES printers(id) ON DELETE CASCADE,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  sector text NOT NULL,
  job_type text NOT NULL DEFAULT 'receipt',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 5,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  printed_at timestamptz
);

ALTER TABLE print_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_print_jobs" ON print_jobs;
CREATE POLICY "select_own_print_jobs" ON print_jobs FOR SELECT
  TO authenticated USING (
    restaurant_id IN (SELECT auth_owned_restaurant_ids())
  );

DROP POLICY IF EXISTS "insert_own_print_jobs" ON print_jobs;
CREATE POLICY "insert_own_print_jobs" ON print_jobs FOR INSERT
  TO authenticated WITH CHECK (
    restaurant_id IN (SELECT auth_owned_restaurant_ids())
  );

DROP POLICY IF EXISTS "update_own_print_jobs" ON print_jobs;
CREATE POLICY "update_own_print_jobs" ON print_jobs FOR UPDATE
  TO authenticated USING (
    restaurant_id IN (SELECT auth_owned_restaurant_ids())
  ) WITH CHECK (
    restaurant_id IN (SELECT auth_owned_restaurant_ids())
  );

DROP POLICY IF EXISTS "delete_own_print_jobs" ON print_jobs;
CREATE POLICY "delete_own_print_jobs" ON print_jobs FOR DELETE
  TO authenticated USING (
    restaurant_id IN (SELECT auth_owned_restaurant_ids())
  );

-- ── print_settings ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS print_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid UNIQUE NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  auto_print boolean NOT NULL DEFAULT true,
  auto_print_caixa boolean NOT NULL DEFAULT true,
  auto_print_cozinha boolean NOT NULL DEFAULT true,
  copies int NOT NULL DEFAULT 1,
  allow_reprint boolean NOT NULL DEFAULT true,
  same_printer_caixa_cozinha boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE print_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_print_settings" ON print_settings;
CREATE POLICY "select_own_print_settings" ON print_settings FOR SELECT
  TO authenticated USING (
    restaurant_id IN (SELECT auth_owned_restaurant_ids())
  );

DROP POLICY IF EXISTS "insert_own_print_settings" ON print_settings;
CREATE POLICY "insert_own_print_settings" ON print_settings FOR INSERT
  TO authenticated WITH CHECK (
    restaurant_id IN (SELECT auth_owned_restaurant_ids())
  );

DROP POLICY IF EXISTS "update_own_print_settings" ON print_settings;
CREATE POLICY "update_own_print_settings" ON print_settings FOR UPDATE
  TO authenticated USING (
    restaurant_id IN (SELECT auth_owned_restaurant_ids())
  ) WITH CHECK (
    restaurant_id IN (SELECT auth_owned_restaurant_ids())
  );

DROP POLICY IF EXISTS "delete_own_print_settings" ON print_settings;
CREATE POLICY "delete_own_print_settings" ON print_settings FOR DELETE
  TO authenticated USING (
    restaurant_id IN (SELECT auth_owned_restaurant_ids())
  );

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_print_agents_restaurant ON print_agents(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_print_agents_token ON print_agents(agent_token);
CREATE INDEX IF NOT EXISTS idx_printers_restaurant ON printers(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_print_jobs_restaurant ON print_jobs(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_print_jobs_printer ON print_jobs(printer_id);
CREATE INDEX IF NOT EXISTS idx_print_jobs_status ON print_jobs(status);
CREATE INDEX IF NOT EXISTS idx_print_jobs_idempotency ON print_jobs(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_print_settings_restaurant ON print_settings(restaurant_id);
