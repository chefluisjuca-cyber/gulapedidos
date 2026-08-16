/*
# Gula Entregas — Módulo de Logística de Entregas

Cria a infraestrutura isolada para o sistema de gerenciamento de entregas
do Gula Pedidos Digital. Completamente separado das tabelas do salão (orders,
order_items) para garantir zero impacto no fluxo atual.

## 1. Novas Tabelas

### delivery_motoboys
Cadastro de entregadores do restaurante.
- id, restaurant_id, name, phone, active, created_at

### delivery_settings
Configurações do módulo por restaurante: canais de entrada (Telefone, iFood,
99Food), credenciais de API dos marketplaces, diária fixa do motoboy e tabela
de faixas de cobrança por km.
- Canais: channel_phone, channel_ifood (+credenciais+logística própria), channel_99food
- Taxas: daily_rate (diária fixa), km_zones JSONB [{from, to, rate}]
- Endereço do restaurante como Ponto Zero para cálculo de distância

### delivery_customers
Histórico de clientes para autopreenchimento em pedidos manuais.
UNIQUE(restaurant_id, phone) — evita duplicatas por restaurante.

### delivery_orders
Pedidos de entrega totalmente separado da tabela orders do salão.
- channel: phone | ifood | 99food
- status: pending → dispatched → delivered | third_party
- motoboy_id, distance_km, delivery_fee (calculada das zonas), tip (caixinha)

### delivery_closings
Fechamentos financeiros individuais por motoboy.
Snapshot dos pedidos + totais calculados na hora do fechamento.

## 2. Segurança (RLS)
Todas as tabelas têm RLS habilitado. Todas as operações são restritas
a usuários autenticados que sejam proprietários do restaurante usando
a função auth_owned_restaurant_ids() existente.
*/

-- ── delivery_motoboys ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS delivery_motoboys (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  phone          TEXT,
  active         BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE delivery_motoboys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_select_delivery_motoboys" ON delivery_motoboys;
CREATE POLICY "owner_select_delivery_motoboys" ON delivery_motoboys FOR SELECT TO authenticated
  USING (restaurant_id IN (SELECT auth_owned_restaurant_ids()));

DROP POLICY IF EXISTS "owner_insert_delivery_motoboys" ON delivery_motoboys;
CREATE POLICY "owner_insert_delivery_motoboys" ON delivery_motoboys FOR INSERT TO authenticated
  WITH CHECK (restaurant_id IN (SELECT auth_owned_restaurant_ids()));

DROP POLICY IF EXISTS "owner_update_delivery_motoboys" ON delivery_motoboys;
CREATE POLICY "owner_update_delivery_motoboys" ON delivery_motoboys FOR UPDATE TO authenticated
  USING (restaurant_id IN (SELECT auth_owned_restaurant_ids()))
  WITH CHECK (restaurant_id IN (SELECT auth_owned_restaurant_ids()));

DROP POLICY IF EXISTS "owner_delete_delivery_motoboys" ON delivery_motoboys;
CREATE POLICY "owner_delete_delivery_motoboys" ON delivery_motoboys FOR DELETE TO authenticated
  USING (restaurant_id IN (SELECT auth_owned_restaurant_ids()));

-- ── delivery_settings ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS delivery_settings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id         UUID NOT NULL UNIQUE REFERENCES restaurants(id) ON DELETE CASCADE,
  restaurant_address    TEXT,
  channel_phone         BOOLEAN NOT NULL DEFAULT true,
  channel_ifood         BOOLEAN NOT NULL DEFAULT false,
  ifood_client_id       TEXT,
  ifood_client_secret   TEXT,
  ifood_own_logistics   BOOLEAN NOT NULL DEFAULT true,
  channel_99food        BOOLEAN NOT NULL DEFAULT false,
  food99_app_key        TEXT,
  food99_app_secret     TEXT,
  food99_own_logistics  BOOLEAN NOT NULL DEFAULT false,
  daily_rate            NUMERIC(10,2) NOT NULL DEFAULT 0,
  km_zones              JSONB NOT NULL DEFAULT '[]',
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE delivery_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_select_delivery_settings" ON delivery_settings;
CREATE POLICY "owner_select_delivery_settings" ON delivery_settings FOR SELECT TO authenticated
  USING (restaurant_id IN (SELECT auth_owned_restaurant_ids()));

DROP POLICY IF EXISTS "owner_insert_delivery_settings" ON delivery_settings;
CREATE POLICY "owner_insert_delivery_settings" ON delivery_settings FOR INSERT TO authenticated
  WITH CHECK (restaurant_id IN (SELECT auth_owned_restaurant_ids()));

DROP POLICY IF EXISTS "owner_update_delivery_settings" ON delivery_settings;
CREATE POLICY "owner_update_delivery_settings" ON delivery_settings FOR UPDATE TO authenticated
  USING (restaurant_id IN (SELECT auth_owned_restaurant_ids()))
  WITH CHECK (restaurant_id IN (SELECT auth_owned_restaurant_ids()));

DROP POLICY IF EXISTS "owner_delete_delivery_settings" ON delivery_settings;
CREATE POLICY "owner_delete_delivery_settings" ON delivery_settings FOR DELETE TO authenticated
  USING (restaurant_id IN (SELECT auth_owned_restaurant_ids()));

-- ── delivery_customers ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS delivery_customers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  phone          TEXT NOT NULL,
  name           TEXT,
  address        TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(restaurant_id, phone)
);
ALTER TABLE delivery_customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_select_delivery_customers" ON delivery_customers;
CREATE POLICY "owner_select_delivery_customers" ON delivery_customers FOR SELECT TO authenticated
  USING (restaurant_id IN (SELECT auth_owned_restaurant_ids()));

DROP POLICY IF EXISTS "owner_insert_delivery_customers" ON delivery_customers;
CREATE POLICY "owner_insert_delivery_customers" ON delivery_customers FOR INSERT TO authenticated
  WITH CHECK (restaurant_id IN (SELECT auth_owned_restaurant_ids()));

DROP POLICY IF EXISTS "owner_update_delivery_customers" ON delivery_customers;
CREATE POLICY "owner_update_delivery_customers" ON delivery_customers FOR UPDATE TO authenticated
  USING (restaurant_id IN (SELECT auth_owned_restaurant_ids()))
  WITH CHECK (restaurant_id IN (SELECT auth_owned_restaurant_ids()));

DROP POLICY IF EXISTS "owner_delete_delivery_customers" ON delivery_customers;
CREATE POLICY "owner_delete_delivery_customers" ON delivery_customers FOR DELETE TO authenticated
  USING (restaurant_id IN (SELECT auth_owned_restaurant_ids()));

-- ── delivery_orders ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS delivery_orders (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id     UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  channel           TEXT NOT NULL DEFAULT 'phone',
  external_id       TEXT,
  customer_name     TEXT,
  customer_phone    TEXT,
  customer_address  TEXT NOT NULL DEFAULT '',
  items             JSONB NOT NULL DEFAULT '[]',
  total             NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_method    TEXT NOT NULL DEFAULT 'cash',
  status            TEXT NOT NULL DEFAULT 'pending',
  motoboy_id        UUID REFERENCES delivery_motoboys(id),
  distance_km       NUMERIC(10,3),
  delivery_fee      NUMERIC(10,2) NOT NULL DEFAULT 0,
  tip               NUMERIC(10,2) NOT NULL DEFAULT 0,
  dispatched_at     TIMESTAMPTZ,
  delivered_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE delivery_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_select_delivery_orders" ON delivery_orders;
CREATE POLICY "owner_select_delivery_orders" ON delivery_orders FOR SELECT TO authenticated
  USING (restaurant_id IN (SELECT auth_owned_restaurant_ids()));

DROP POLICY IF EXISTS "owner_insert_delivery_orders" ON delivery_orders;
CREATE POLICY "owner_insert_delivery_orders" ON delivery_orders FOR INSERT TO authenticated
  WITH CHECK (restaurant_id IN (SELECT auth_owned_restaurant_ids()));

DROP POLICY IF EXISTS "owner_update_delivery_orders" ON delivery_orders;
CREATE POLICY "owner_update_delivery_orders" ON delivery_orders FOR UPDATE TO authenticated
  USING (restaurant_id IN (SELECT auth_owned_restaurant_ids()))
  WITH CHECK (restaurant_id IN (SELECT auth_owned_restaurant_ids()));

DROP POLICY IF EXISTS "owner_delete_delivery_orders" ON delivery_orders;
CREATE POLICY "owner_delete_delivery_orders" ON delivery_orders FOR DELETE TO authenticated
  USING (restaurant_id IN (SELECT auth_owned_restaurant_ids()));

-- ── delivery_closings ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS delivery_closings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id         UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  motoboy_id            UUID NOT NULL REFERENCES delivery_motoboys(id),
  period_start          TIMESTAMPTZ,
  period_end            TIMESTAMPTZ,
  daily_rate            NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_delivery_fees   NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_tips            NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_payout          NUMERIC(10,2) NOT NULL DEFAULT 0,
  order_details         JSONB NOT NULL DEFAULT '[]',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE delivery_closings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_select_delivery_closings" ON delivery_closings;
CREATE POLICY "owner_select_delivery_closings" ON delivery_closings FOR SELECT TO authenticated
  USING (restaurant_id IN (SELECT auth_owned_restaurant_ids()));

DROP POLICY IF EXISTS "owner_insert_delivery_closings" ON delivery_closings;
CREATE POLICY "owner_insert_delivery_closings" ON delivery_closings FOR INSERT TO authenticated
  WITH CHECK (restaurant_id IN (SELECT auth_owned_restaurant_ids()));

DROP POLICY IF EXISTS "owner_update_delivery_closings" ON delivery_closings;
CREATE POLICY "owner_update_delivery_closings" ON delivery_closings FOR UPDATE TO authenticated
  USING (restaurant_id IN (SELECT auth_owned_restaurant_ids()))
  WITH CHECK (restaurant_id IN (SELECT auth_owned_restaurant_ids()));

DROP POLICY IF EXISTS "owner_delete_delivery_closings" ON delivery_closings;
CREATE POLICY "owner_delete_delivery_closings" ON delivery_closings FOR DELETE TO authenticated
  USING (restaurant_id IN (SELECT auth_owned_restaurant_ids()));
