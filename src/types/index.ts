export const MODULES = {
  GULA_PEDIDOS:    'gula_pedidos',
  GULA_FIDELIDADE: 'gula_fidelidade',
  GULA_ETIQUETAS:  'gula_etiquetas',
  GULA_ENTREGAS:   'gula_entregas',
  GULA_FILA:       'gula_fila',
  GULA_FEEDBACK:    'gula_feedback',
} as const;

export type ModuleKey = typeof MODULES[keyof typeof MODULES];

export interface Restaurant {
  id: string;
  name: string;
  slug: string;
  subdomain: string | null;
  owner_email: string;
  phone: string | null;
  status: 'active' | 'suspended' | 'trial';
  modules: ModuleKey[];
  trial_ends_at: string | null;
  plan: RestaurantPlan | null;
  created_at: string;
  updated_at: string;
}

export type RestaurantPlan = 'essencial' | 'pedidos_fidelidade' | 'pedidos_fidelidade_etiquetas' | 'gula_etiquetas_standalone' | 'gula_fila_standalone' | 'gula_feedback_standalone';

export type BillingCycle = 'mensal' | 'semestral' | 'anual';

export interface PlanPrice {
  cycle: BillingCycle;
  label: string;
  price: number;
  stripe_price_id: string;
}

export interface PlanVariant {
  tier: 'promo' | 'regular';
  label: string;
  prices: PlanPrice[];
}

export interface PlanDefinition {
  id: RestaurantPlan;
  name: string;
  tagline: string;
  features: string[];
  modules: ModuleKey[];
  variants: PlanVariant[];
}

export const PLANS: PlanDefinition[] = [
  {
    id: 'essencial',
    name: 'Gula Pedidos',
    tagline: 'Ideal para organizar a produção, gerenciar o salão e receber pedidos de delivery no seu próprio web app sem comissões.',
    features: [
      'Módulo de Delivery com Web App Próprio (Sem comissões)',
      'Cardápio Digital (mesas, balcão, garçons e delivery)',
      'Monitor de Cozinha KDS Web em tempo real',
      'Alertas sonoros de novos pedidos',
      'Atalhos de teclado no caixa',
    ],
    modules: [MODULES.GULA_PEDIDOS],
    variants: [
      {
        tier: 'promo',
        label: 'Promocional',
        prices: [
          { cycle: 'mensal',    label: 'Mensal',    price:  69.99, stripe_price_id: 'price_1U1Wf5RNhmPZU507wUTBXNij' },
          { cycle: 'semestral', label: 'Semestral', price:  62.99, stripe_price_id: 'price_1UAYfDRNhmPZU507tjFn3L1C' },
          { cycle: 'anual',     label: 'Anual',     price:  55.99, stripe_price_id: 'price_1UAYgWRNhmPZU507dqQISm3W' },
        ],
      },
      {
        tier: 'regular',
        label: 'Essencial',
        prices: [
          { cycle: 'mensal',    label: 'Mensal',    price:  69.99, stripe_price_id: 'price_1U1Wf5RNhmPZU507wUTBXNij' },
          { cycle: 'semestral', label: 'Semestral', price: 372.00, stripe_price_id: 'price_1Tuz5ORNhmPZU507VknLWyOF' },
          { cycle: 'anual',     label: 'Anual',     price: 649.00, stripe_price_id: 'price_1Tuz89RNhmPZU5070NrP6qzJ' },
        ],
      },
    ],
  },
  {
    id: 'pedidos_fidelidade',
    name: 'Pedidos + Fidelidade',
    tagline: 'Tudo do Plano Pedidos + Gula Fidelidade',
    features: [
      'Tudo do Plano Pedidos',
      'Módulo Gula Fidelidade',
      'Pontos de Fidelidade',
      'Cashback',
      'Recompensas',
    ],
    modules: [MODULES.GULA_PEDIDOS, MODULES.GULA_FIDELIDADE],
    variants: [
      {
        tier: 'promo',
        label: 'Promocional',
        prices: [
          { cycle: 'mensal',    label: 'Mensal',    price:  99.99, stripe_price_id: 'price_1TuzdHRNhmPZU507rVBBE8I1' },
          { cycle: 'semestral', label: 'Semestral', price:  89.99, stripe_price_id: 'price_1UAYsURNhmPZU507wlqcehA0' },
          { cycle: 'anual',     label: 'Anual',     price:  79.99, stripe_price_id: 'price_1UAYuhRNhmPZU50716OMAKIG' },
        ],
      },
      {
        tier: 'regular',
        label: 'Padrão',
        prices: [
          { cycle: 'mensal',    label: 'Mensal',    price:  99.00, stripe_price_id: 'price_1TuywTRNhmPZU507B54lpCTF' },
          { cycle: 'semestral', label: 'Semestral', price: 530.00, stripe_price_id: 'price_1TuzA3RNhmPZU507T9E5KJ8M' },
          { cycle: 'anual',     label: 'Anual',     price: 950.00, stripe_price_id: 'price_1Tuz9KRNhmPZU507Ovdijldz' },
        ],
      },
    ],
  },
  {
    id: 'pedidos_fidelidade_etiquetas',
    name: 'Completo',
    tagline: 'Pedidos + Fidelidade + Etiquetas',
    features: [
      'Tudo do Plano Pedidos',
      'Gula Fidelidade',
      'Módulo Gula Etiquetas',
      'Assistente de IA para cálculo de validades (10 consultas/dia)',
      'Etiquetas de Validade para Segurança Alimentar',
    ],
    modules: [MODULES.GULA_PEDIDOS, MODULES.GULA_FIDELIDADE, MODULES.GULA_ETIQUETAS],
    variants: [
      {
        tier: 'promo',
        label: 'Promocional',
        prices: [
          { cycle: 'mensal',    label: 'Mensal',    price: 139.99, stripe_price_id: 'price_1Tuz2tRNhmPZU5079NY2GmLc' },
          { cycle: 'semestral', label: 'Semestral', price: 125.99, stripe_price_id: 'price_1UAYwqRNhmPZU507jzoVedPS' },
          { cycle: 'anual',     label: 'Anual',     price: 111.99, stripe_price_id: 'price_1UAYy4RNhmPZU5076kRQPZTT' },
        ],
      },
    ],
  },
  {
    id: 'gula_etiquetas_standalone',
    name: 'Gula Etiquetas',
    tagline: 'Apenas Etiquetas de Validade',
    features: [
      'Etiquetas térmicas 57×40mm para segurança alimentar',
      'Cálculo automático de validade por produto',
      'Assistente de IA para cálculo de validades (10 consultas/dia)',
      'Produtos Manipulados e Industrializados',
      'Cadastro de colaboradores e produtos',
      'Impressão direta via impressora térmica genérica',
    ],
    modules: [MODULES.GULA_ETIQUETAS],
    variants: [
      {
        tier: 'promo',
        label: 'Avulso',
        prices: [
          { cycle: 'mensal',    label: 'Mensal',    price:  39.99, stripe_price_id: 'price_1U1XvRRNhmPZU507MjkznLVg' },
          { cycle: 'semestral', label: 'Semestral', price:  35.99, stripe_price_id: 'price_1UAZFMRNhmPZU507EQN9orkH' },
          { cycle: 'anual',     label: 'Anual',     price:  31.99, stripe_price_id: 'price_1UAZGHRNhmPZU507BxrR98yR' },
        ],
      },
    ],
  },
  {
    id: 'gula_fila_standalone',
    name: 'Gula Fila',
    tagline: 'Gestão inteligente de filas de espera e atendimento',
    features: [
      'Fila virtual via QR Code no celular do cliente',
      'Painel de controle e chamada de mesas em tempo real',
      'Notificações automáticas via WhatsApp',
      'Possibilidade de entrada na fila de onde o cliente estiver',
      'Gestão de atendimento preferencial conforme Lei nº 14.626',
    ],
    modules: [MODULES.GULA_FILA],
    variants: [
      {
        tier: 'promo',
        label: 'Avulso',
        prices: [
          { cycle: 'mensal',    label: 'Mensal',    price:  49.99, stripe_price_id: 'price_1TxU1ERNhmPZU507Ev3MmGbz' },
          { cycle: 'semestral', label: 'Semestral', price:  44.99, stripe_price_id: 'price_1UAZACRNhmPZU507qmwmBOWT' },
          { cycle: 'anual',     label: 'Anual',     price:  39.99, stripe_price_id: 'price_1UAZAyRNhmPZU507jloLrvru' },
        ],
      },
    ],
  },
  {
    id: 'gula_feedback_standalone',
    name: 'Gula Feedback',
    tagline: 'Pesquisa de Satisfação + Roleta de Prêmios',
    features: [
      'Pesquisa de satisfação customizável com perguntas múltiplas',
      'Roleta de prêmios com vouchers automáticos e QR Code',
      'Captura de leads (nome, telefone, e-mail, aniversário)',
      'Métricas e relatórios em tempo real',
      'Integração com WhatsApp para resgate de vouchers',
      'QR Code da pesquisa para imprimir nas mesas',
    ],
    modules: [MODULES.GULA_FEEDBACK],
    variants: [
      {
        tier: 'promo',
        label: 'Avulso',
        prices: [
          { cycle: 'mensal',    label: 'Mensal',    price:  29.99, stripe_price_id: 'price_1U55mzRNhmPZU5073LPQtsDa' },
          { cycle: 'semestral', label: 'Semestral', price:  26.99, stripe_price_id: 'price_1UAYXbRNhmPZU507Qyitws9F' },
          { cycle: 'anual',     label: 'Anual',     price:  23.99, stripe_price_id: 'price_1UAYUNRNhmPZU507lcGxypJM' },
        ],
      },
    ],
  },
];

export const PLAN_BY_STRIPE_PRICE: Record<string, RestaurantPlan> = PLANS.reduce(
  (acc, plan) => {
    for (const variant of plan.variants) {
      for (const p of variant.prices) acc[p.stripe_price_id] = plan.id;
    }
    return acc;
  },
  {} as Record<string, RestaurantPlan>,
);

export interface DeliveryKmZone {
  from: number;
  to: number;
  rate: number;
  minutes: number;
}

export type DeliveryOrderMode = 'pickup' | 'delivery';
export type DeliveryPaymentMethod = 'counter' | 'card_delivery' | 'pix_delivery' | 'cash_delivery';
export type DeliveryOrderStatus = 'pending' | 'preparing' | 'dispatched' | 'delivered';

export interface RestaurantSettings {
  id: string;
  restaurant_id: string | null;
  name: string;
  logo_url: string | null;
  service_mode: 'table' | 'counter';
  cnpj: string | null;
  address: string | null;
  receipt_footer: string | null;
  table_count: number | null;
  kitchen_enabled: boolean | null;
  alert_sound_url: string | null;
  delivery_enabled: boolean | null;
  delivery_origin_lat: number | null;
  delivery_origin_lng: number | null;
  delivery_origin_address: string | null;
  delivery_max_radius_km: number | null;
  delivery_km_zones: DeliveryKmZone[] | null;
  etiqueta_size: '60x40' | '50x40' | null;
  silent_print: boolean | null;
  show_virtual_assistant: boolean | null;
  paused_until: string | null;
  business_hours: BusinessHoursMap | null;
  feedback_enabled: boolean | null;
  feedback_voucher_validity_days: number | null;
  updated_at: string;
}

export interface BusinessShift {
  open: string;
  close: string;
}

export interface BusinessDay {
  active: boolean;
  shifts: BusinessShift[];
}

export type BusinessHoursMap = Record<string, BusinessDay>;

export interface Category {
  id: string;
  restaurant_id: string | null;
  name: string;
  icon: string | null;
  sort_order: number;
  active: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  restaurant_id: string | null;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  active: boolean;
  is_combo: boolean;
  is_meio_a_meio: boolean;
  meio_a_meio_cat_1_id: string | null;
  meio_a_meio_cat_2_id: string | null;
  meio_a_meio_price_rule: 'highest' | 'average' | 'sum';
  sort_order: number;
  created_at: string;
  category?: Category;
  combo_groups?: ComboGroup[];
  product_extras?: ProductExtra[];
}

export interface ComboGroup {
  id: string;
  product_id: string;
  name: string;
  min_qty: number;
  max_qty: number;
  is_required: boolean;
  sort_order: number;
  combo_group_items?: ComboGroupItem[];
}

export interface ComboItemExtra {
  id: string;
  combo_group_item_id: string;
  name: string;
  price: number;
  sort_order: number;
}

export interface ComboGroupItem {
  id: string;
  combo_group_id: string;
  name: string;
  price_delta: number;
  observations: string | null;
  sort_order: number;
  combo_item_extras?: ComboItemExtra[];
}

export interface ProductExtra {
  id: string;
  product_id: string;
  name: string;
  price: number;
  sort_order: number;
}

export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'closed';

export interface Order {
  id: string;
  restaurant_id: string | null;
  table_number: string;
  status: OrderStatus;
  service_mode: string;
  total: number;
  notes: string | null;
  loyalty_customer_phone: string | null;
  loyalty_customer_name: string | null;
  loyalty_reward_id: string | null;
  loyalty_discount: number;
  loyalty_benefit_action: 'applied' | 'accumulated' | 'pending' | 'none';
  loyalty_points_earned: number;
  loyalty_cashback_earned: number;
  loyalty_points_total: number;
  loyalty_cashback_total: number;
  delivery_mode: DeliveryOrderMode;
  delivery_name: string | null;
  delivery_whatsapp: string | null;
  delivery_cep: string | null;
  delivery_street: string | null;
  delivery_number: string | null;
  delivery_bairro: string | null;
  delivery_complement: string | null;
  delivery_reference: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  delivery_distance_km: number | null;
  delivery_fee: number;
  delivery_payment_method: DeliveryPaymentMethod;
  delivery_change_for: number | null;
  delivery_estimated_minutes: number | null;
  delivery_motoboy_id: string | null;
  delivery_status: DeliveryOrderStatus;
  cancel_reason: string | null;
  payment_method: string | null;
  created_at: string;
  updated_at: string;
  order_items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  restaurant_id: string | null;
  order_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  customizations: {
    combos?: { groupName: string; items: { name: string; qty: number; extras?: { name: string; price: number; qty: number }[] }[] }[];
    extras?: { name: string; price: number; qty: number }[];
    meio_a_meio?: { half1: MeioAMeioHalf | null; half2: MeioAMeioHalf | null };
    observations?: string | null;
  };
  created_at: string;
}

export type WaiterCallType = 'attention' | 'request' | 'bill';

export interface WaiterCall {
  id: string;
  restaurant_id: string | null;
  table_number: string;
  call_type: WaiterCallType;
  message: string | null;
  status: 'pending' | 'resolved';
  created_at: string;
}

// Loyalty types
export type LoyaltyPromoType = 'pontos_por_real' | 'cashback';
export type LoyaltyRewardType = 'desconto_fixo' | 'desconto_percentual' | 'produto_gratis';

export interface LoyaltyConfig {
  id: string;
  restaurant_id: string | null;
  tipo_promocao: LoyaltyPromoType;
  valor_conversao: number;
  visitas_para_premio: number;
  validade_dias: number;
  valor_minimo_pedido: number;
  ativo: boolean;
  termos: string | null;
  campanha_ativa: boolean;
  campanha_dia_semana: number;
  campanha_horario: string;
  campanha_mensagem: string;
  created_at: string;
  updated_at: string;
}

export interface LoyaltyReward {
  id: string;
  restaurant_id: string | null;
  nome_recompensa: string;
  tipo_recompensa: LoyaltyRewardType;
  valor_recompensa: number;
  pontos_necessarios: number;
  ativo: boolean;
  created_at: string;
}

export interface LoyaltyCustomer {
  id: string;
  restaurant_id: string | null;
  phone: string | null;
  email: string | null;
  auth_user_id: string | null;
  nome: string | null;
  saldo_pontos: number;
  saldo_cashback: number;
  carimbos_atuais: number;
  total_visitas: number;
  historico_transacoes: LoyaltyTransaction[];
  created_at: string;
  updated_at: string;
}

export interface LoyaltyTransaction {
  tipo: 'ganho' | 'resgate';
  descricao: string;
  pontos?: number;
  cashback?: number;
  carimbos?: number;
  data: string;
  order_total?: number;
}

// Cart types (client-side only)
export interface MeioAMeioHalf {
  productId: string;
  productName: string;
  price: number;
  extras?: { name: string; price: number; qty: number }[];
}

export interface CartMeioAMeioSelection {
  half1: MeioAMeioHalf | null;
  half2: MeioAMeioHalf | null;
}

export interface CartComboItem {
  id: string;
  name: string;
  qty: number;
  priceDelta: number;
  observations: string | null;
  extras?: { id: string; name: string; price: number; qty: number }[];
}

export interface CartComboSelection {
  groupId: string;
  groupName: string;
  items: CartComboItem[];
}

export interface CartExtraSelection {
  extraId: string;
  name: string;
  price: number;
  qty: number;
}

export interface CartItem {
  cartId: string;
  product: Product;
  quantity: number;
  comboSelections: CartComboSelection[];
  extraSelections: CartExtraSelection[];
  meioAMeioSelection?: CartMeioAMeioSelection;
  itemTotal: number;
  observations?: string;
}

// ── Gula Etiquetas types ────────────────────────────────────────────────────
export type EtiquetaCategoria = 'manipulado' | 'industrializado';

export interface EtiquetaSubcategoria {
  id: string;
  restaurant_id: string;
  nome: string;
  categoria: EtiquetaCategoria;
  created_at: string;
}

export interface EtiquetaProduto {
  id: string;
  restaurant_id: string;
  nome: string;
  categoria: EtiquetaCategoria;
  subcategoria_id: string | null;
  validade_dias: number;
  armazenamento: string | null;
  ingredientes_criticos: string | null;
  modo_preparo: string | null;
  embalagem: string | null;
  observacao: string | null;
  created_at: string;
}

export interface EtiquetaColaborador {
  id: string;
  restaurant_id: string;
  nome: string;
  ativo: boolean;
  created_at: string;
}

export type EtiquetaRegistroStatus = 'ativo' | 'consumido' | 'descartado';

export interface EtiquetaRegistro {
  id: string;
  restaurant_id: string;
  produto: string;
  produto_id: string | null;
  data_fabricacao: string;
  data_validade: string;
  responsavel: string;
  status: EtiquetaRegistroStatus;
  observacao: string | null;
  created_at: string;
}

// ── Gula Entregas types ───────────────────────────────────────────────────────
export interface KmZone {
  from: number;
  to: number;
  rate: number;
}

export interface DeliveryMotoboy {
  id: string;
  restaurant_id: string;
  name: string;
  phone: string | null;
  active: boolean;
  queue_position: number | null; // null = off-road or not yet in queue; lower = front of queue
  last_lat: number | null;
  last_lng: number | null;
  last_seen_at: string | null;
  created_at: string;
}

export interface DeliverySettings {
  id: string;
  restaurant_id: string;
  restaurant_address: string | null;
  latitude: number | null;
  longitude: number | null;
  channel_phone: boolean;
  channel_ifood: boolean;
  ifood_client_id: string | null;
  ifood_client_secret: string | null;
  ifood_merchant_id: string | null;
  ifood_own_logistics: boolean;
  channel_99food: boolean;
  food99_app_key: string | null;
  food99_app_secret: string | null;
  food99_own_logistics: boolean;
  daily_rate: number;
  km_zones: KmZone[];
  max_deliveries_per_round: number; // 0 = sem limite
  updated_at: string;
}

export interface DeliveryCustomer {
  id: string;
  restaurant_id: string;
  phone: string;
  name: string | null;
  address: string | null;
  created_at: string;
}

export interface SavedAddress {
  id: string;
  restaurant_id: string | null;
  phone: string;
  nickname: string;
  cep: string | null;
  street: string | null;
  number: string | null;
  bairro: string | null;
  complement: string | null;
  reference: string | null;
  lat: number | null;
  lng: number | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export type DeliveryChannel = 'phone' | 'ifood' | '99food';
export type DeliveryPayment = 'cash' | 'card' | 'pix';
export type DeliveryStatus = 'pending' | 'dispatched' | 'delivered' | 'third_party';

export interface DeliveryItem {
  name: string;
  qty: number;
  price: number;
}

export interface DeliveryOrder {
  id: string;
  restaurant_id: string;
  channel: DeliveryChannel;
  external_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: string;
  items: DeliveryItem[];
  total: number;
  payment_method: DeliveryPayment;
  status: DeliveryStatus;
  motoboy_id: string | null;
  distance_km: number | null;
  delivery_fee: number;
  tip: number;
  customer_lat: number | null;
  customer_lng: number | null;
  dispatched_at: string | null;
  delivered_at: string | null;
  created_at: string;
}

export interface IfoodOrderIntegration {
  id: string;
  ifood_order_id: string;
  restaurant_id: string;
  customer_name: string | null;
  display_id: string | null;
  status: 'PLACED' | 'CONFIRMED' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED';
  street: string | null;
  number: string | null;
  neighborhood: string | null;
  complement: string | null;
  postal_code: string | null;
  city: string | null;
  reference: string | null;
  formatted_address: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  updated_at: string;
}

export interface DeliveryClosing {
  id: string;
  restaurant_id: string;
  motoboy_id: string;
  period_start: string | null;
  period_end: string | null;
  daily_rate: number;
  total_delivery_fees: number;
  total_tips: number;
  total_payout: number;
  order_details: DeliveryOrder[];
  created_at: string;
}

// ── Gula Feedback types ───────────────────────────────────────────────────
export type FeedbackQuestionType = 'single' | 'multiple' | 'text';

export interface FeedbackQuestion {
  id: string;
  restaurant_id: string | null;
  question_text: string;
  question_type: FeedbackQuestionType;
  options: string[];
  is_required: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface FeedbackPrize {
  id: string;
  restaurant_id: string | null;
  name: string;
  description: string | null;
  weight: number;
  stock_limit: number | null;
  stock_used: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FeedbackResponse {
  id: string;
  restaurant_id: string | null;
  session_id: string;
  question_id: string;
  answer: Record<string, unknown>;
  created_at: string;
}

export interface FeedbackLead {
  id: string;
  restaurant_id: string | null;
  session_id: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  birthday: string | null;
  opt_in: boolean;
  created_at: string;
}

export interface FeedbackVoucher {
  id: string;
  restaurant_id: string | null;
  lead_id: string | null;
  prize_id: string | null;
  code: string;
  customer_name: string | null;
  prize_name: string;
  expires_at: string;
  redeemed_at: string | null;
  created_at: string;
}
