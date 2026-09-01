
-- loyalty_configs: single config row for the restaurant
CREATE TABLE IF NOT EXISTS loyalty_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_promocao text NOT NULL DEFAULT 'pontos_por_real'
    CHECK (tipo_promocao IN ('pontos_por_real', 'carimbo_visitas', 'cashback')),
  valor_conversao numeric NOT NULL DEFAULT 1,
  visitas_para_premio int NOT NULL DEFAULT 10,
  validade_dias int NOT NULL DEFAULT 365,
  valor_minimo_pedido numeric NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  termos text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- loyalty_rewards: redeemable rewards
CREATE TABLE IF NOT EXISTS loyalty_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_recompensa text NOT NULL,
  tipo_recompensa text NOT NULL
    CHECK (tipo_recompensa IN ('desconto_fixo', 'desconto_percentual', 'produto_gratis')),
  valor_recompensa numeric NOT NULL DEFAULT 0,
  pontos_necessarios int NOT NULL DEFAULT 100,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- loyalty_customers: phone-based identification (no auth required)
CREATE TABLE IF NOT EXISTS loyalty_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL UNIQUE,
  nome text,
  saldo_pontos int NOT NULL DEFAULT 0,
  saldo_cashback numeric NOT NULL DEFAULT 0,
  carimbos_atuais int NOT NULL DEFAULT 0,
  total_visitas int NOT NULL DEFAULT 0,
  historico_transacoes jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE loyalty_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_customers ENABLE ROW LEVEL SECURITY;

-- Allow anon full access (admin uses anon key via custom AuthGate)
CREATE POLICY "anon_select_loyalty_configs"  ON loyalty_configs FOR SELECT  TO anon USING (true);
CREATE POLICY "anon_insert_loyalty_configs"  ON loyalty_configs FOR INSERT  TO anon WITH CHECK (true);
CREATE POLICY "anon_update_loyalty_configs"  ON loyalty_configs FOR UPDATE  TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_loyalty_configs"  ON loyalty_configs FOR DELETE  TO anon USING (true);

CREATE POLICY "anon_select_loyalty_rewards"  ON loyalty_rewards FOR SELECT  TO anon USING (true);
CREATE POLICY "anon_insert_loyalty_rewards"  ON loyalty_rewards FOR INSERT  TO anon WITH CHECK (true);
CREATE POLICY "anon_update_loyalty_rewards"  ON loyalty_rewards FOR UPDATE  TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_loyalty_rewards"  ON loyalty_rewards FOR DELETE  TO anon USING (true);

CREATE POLICY "anon_select_loyalty_customers" ON loyalty_customers FOR SELECT  TO anon USING (true);
CREATE POLICY "anon_insert_loyalty_customers" ON loyalty_customers FOR INSERT  TO anon WITH CHECK (true);
CREATE POLICY "anon_update_loyalty_customers" ON loyalty_customers FOR UPDATE  TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_loyalty_customers" ON loyalty_customers FOR DELETE  TO anon USING (true);
