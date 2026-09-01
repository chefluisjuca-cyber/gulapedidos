import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Zap, QrCode, UtensilsCrossed, ChefHat, Ticket, Tag, ArrowRight,
  Store, ClipboardList, Rocket, CheckCircle2, ShieldCheck, Smartphone,
  ChevronDown, PlayCircle, Send, Mail, LogIn, Crown, Sparkles, Star,
  ArrowUpRight, Check, Bot, Clock, MessageSquare, Gift, Instagram, Music2,
} from 'lucide-react';
import { PLANS, RestaurantPlan, BillingCycle } from '../types';
import { supabase } from '../lib/supabase';
import GulaAssistenteWidget from './GulaAssistenteWidget';
import SoroBlogEmbed from './blog/SoroBlogEmbed';

const FAQ_ITEMS = [
  {
    q: 'Preciso de cabos ou telas especiais na cozinha?',
    a: 'Não. O Monitor de Cozinha (KDS) do Gula é 100% web — funciona em qualquer dispositivo com navegador: tablet, TV com Chromecast, monitor com PC ou até um smartphone velho que você tenha guardado. Basta uma conexão com a internet (ou Wi-Fi local) e está pronto para usar. Nenhum hardware proprietário, nenhum cabeamento especial.',
  },
  {
    q: 'Como funciona o acesso do cliente ao cardápio digital?',
    a: 'O cliente acessa o cardápio via QR Code impresso na mesa ou no balcão. Ao escanear, abre uma página web otimizada para celular — sem precisar baixar nenhum aplicativo. O pedido é registrado no caixa e aparece instantaneamente no Monitor da Cozinha.',
  },
  {
    q: 'Posso assinar apenas o módulo de pedidos?',
    a: 'Sim! O Plano Essencial inclui exatamente isso: o Cardápio Digital + Monitor de Cozinha. Os módulos de Fidelidade (Plano Profissional) e Etiquetas de Validade (Plano Premium) são add-ons que você pode adicionar a qualquer momento, sem migrar de plataforma.',
  },
  {
    q: 'Posso contratar apenas o módulo de etiquetas, sem o sistema de pedidos?',
    a: 'Sim! O Gula Etiquetas está disponível de forma avulsa (stand-alone). Perfeito para quem já tem um sistema de PDV e quer apenas gerar etiquetas de validade térmicas para segurança alimentar.',
  },
  {
    q: 'O sistema funciona sem internet?',
    a: 'Não. O Gula foi projetado para ser usado com conexão ativa, pois sincroniza pedidos em tempo real. Recomendamos uma rede Wi-Fi estável no estabelecimento.',
  },
  {
    q: 'Quanto tempo leva para configurar o sistema?',
    a: 'Ao clicar em "Testar por 7 dias" você irá preencher o formulário com os dados do seu restaurante e já terá acesso imediato a todas as funcionalidades do sistema gratuitamente por 7 dias.',
  },
  {
    q: 'O módulo Gula Fidelidade funciona no próprio checkout?',
    a: 'Sim. A acumulação e o resgate de pontos e cashback acontecem diretamente na finalização do pedido, sem precisar de um app separado para o cliente. O programa é gerenciado pelo restaurante via painel administrativo, com relatórios de retenção em tempo real.',
  },
  {
    q: 'Posso contratar o plano básico e depois solicitar um upgrade?',
    a: 'Sim, a qualquer momento você pode solicitar o upgrade de plano, e após o pagamento o sistema libera o acesso de acordo com o plano escolhido.',
  },
];

const PRICING_CARDS = [
  {
    planId: 'essencial' as RestaurantPlan,
    name: 'Essencial',
    badge: null,
    priceOld: 99,
    priceNew: 69.99,
    description: 'Ideal para organizar a produção, gerenciar o salão e receber pedidos de delivery no seu próprio web app sem comissões.',
    features: [
      'Módulo de Delivery com Web App Próprio (Sem comissões)',
      'Cardápio Digital (mesas, balcão, garçons e delivery)',
      'Monitor de Cozinha KDS Web em tempo real',
      'Alertas sonoros de novos pedidos',
      'Atalhos de teclado no caixa',
    ],
    cta: 'Começar com Essencial',
    highlighted: false,
    standalone: false,
  },
  {
    planId: 'pedidos_fidelidade' as RestaurantPlan,
    name: 'Profissional',
    badge: 'Melhor Custo-Benefício',
    priceOld: 99,
    priceNew: 99.99,
    description: 'Organize a cozinha e crie seu clube de recompensas para faturar mais.',
    features: [
      'Tudo do Essencial, mais:',
      'Módulo Gula Fidelidade ativo',
      'Campanha de pontos e cashback',
      'Dashboard de retenção',
    ],
    cta: 'Começar com Profissional',
    highlighted: true,
    standalone: false,
  },
  {
    planId: 'pedidos_fidelidade_etiquetas' as RestaurantPlan,
    name: 'Premium',
    badge: null,
    priceOld: 129,
    priceNew: 139.99,
    description: 'A solução definitiva de ponta a ponta para restaurantes que valorizam segurança alimentar.',
    features: [
      'Tudo do Profissional, mais:',
      'Módulo Gula Etiquetas ativo',
      'Assistente de IA para cálculo de validades (10 consultas/dia)',
      'Etiquetas térmicas 57×40mm',
      'Cálculo automático de validade',
      'Cadastro de produtos e colaboradores',
    ],
    cta: 'Começar com Premium',
    highlighted: false,
    standalone: false,
  },
];

const STANDALONE_ETIQUETAS_CARD = {
  planId: 'gula_etiquetas_standalone' as RestaurantPlan,
  name: 'Gula Etiquetas',
  badge: 'Apenas Etiquetas de Validade',
  description: 'Ideal para quem já possui PDV/Cardápio e precisa apenas de etiquetas de validade para segurança alimentar.',
  priceNew: 39.99,
  features: [
    'Etiquetas térmicas 57×40mm para segurança alimentar',
    'Cálculo automático de validade por produto',
    'Assistente de IA para cálculo de validades (10 consultas/dia)',
    'Produtos Manipulados e Industrializados',
    'Cadastro de colaboradores e produtos',
    'Impressão direta via impressora térmica genérica',
  ],
  cta: 'Testar Gula Etiquetas 7 Dias Grátis',
};

const STANDALONE_FILA_CARD = {
  planId: 'gula_fila_standalone' as RestaurantPlan,
  name: 'Gula Fila',
  badge: 'Gestão de Filas de Espera',
  description: 'Gestão inteligente de filas de espera e atendimento. Permita que os clientes entrem na fila via QR Code, acompanhem a posição em tempo real no celular e recebam notificações quando a mesa estiver pronta.',
  priceNew: 49.99,
  features: [
    'Fila virtual via QR Code no celular do cliente',
    'Painel de controle e chamada de mesas em tempo real',
    'Notificações automáticas via WhatsApp',
    'Possibilidade de entrada na fila de onde o cliente estiver',
    'Gestão de atendimento preferencial conforme Lei nº 14.626',
  ],
  cta: 'Testar Gula Fila 7 Dias Grátis',
};

const STANDALONE_FEEDBACK_CARD = {
  planId: 'gula_feedback_standalone' as RestaurantPlan,
  name: 'Gula Feedback',
  badge: 'Pesquisa + Roleta de Prêmios',
  description: 'Pesquisa de satisfação com roleta de prêmios para gerar leads, aumentar o retorno dos clientes e coletar avaliações reais do seu restaurante.',
  features: [
    'Pesquisa de satisfação customizável com perguntas múltiplas',
    'Roleta de prêmios com vouchers automáticos e QR Code',
    'Captura de leads (nome, telefone, e-mail, aniversário)',
    'Métricas e relatórios em tempo real',
    'Integração com WhatsApp para resgate de vouchers',
    'QR Code da pesquisa para imprimir nas mesas',
  ],
  cta: 'Testar Gula Feedback 7 Dias Grátis',
};

function fmtBRL(n: number) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`border rounded-2xl overflow-hidden transition-colors ${open ? 'border-amber-400 bg-amber-50/60' : 'border-slate-200 bg-white'}`}>
      <button
        className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="font-medium text-slate-900 text-sm sm:text-base leading-snug">{q}</span>
        <ChevronDown
          className={`w-5 h-5 shrink-0 text-amber-500 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <div
        className={`grid transition-all duration-300 ease-in-out ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
      >
        <div className="overflow-hidden">
          <p className="px-6 pb-5 text-sm text-slate-600 leading-relaxed">{a}</p>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMsg, setContactMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  async function handleContact(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    const body = `mailto:contato@vertexapps.com.br?subject=${encodeURIComponent('Contato via site — ' + contactName)}&body=${encodeURIComponent(contactMsg + '\n\nDe: ' + contactName + ' <' + contactEmail + '>')}`;
    window.location.href = body;
    setSent(true);
    setSending(false);
  }

  const [cycle, setCycle] = useState<BillingCycle>('mensal');
  const [standaloneCycle, setStandaloneCycle] = useState<BillingCycle>('mensal');

  function handlePlanClick(planId: RestaurantPlan, priceId?: string) {
    const params = new URLSearchParams({ plan: planId });
    if (priceId) params.set('price_id', priceId);
    navigate(`/cadastrar?${params.toString()}`);
  }

  const features = [
    { icon: QrCode, title: 'Cardápio Digital via QR Code', desc: 'Seus clientes escaneiam o QR Code da mesa e fazem o pedido direto do celular, sem app para instalar.' },
    { icon: ChefHat, title: 'Painel da Cozinha (KDS)', desc: 'Comandas em tempo real na tela da cozinha, com controle de status e priorização dos pedidos.' },
    { icon: Ticket, title: 'Sistema de Fidelidade', desc: 'Pontos, cashback, carimbos e recompensas personalizadas para fidelizar seus clientes.' },
    { icon: Tag, title: 'Gula Etiquetas', desc: 'Etiquetas de validade térmicas para segurança alimentar, com cálculo automático de vencimento.' },
    { icon: UtensilsCrossed, title: 'Impressão de Comandas', desc: 'Imprima comandas e recibos direto na impressora térmica via USB, sem complicação.' },
    { icon: Smartphone, title: 'Tudo em uma plataforma', desc: 'Pedidos, cozinha, fidelidade e etiquetas integrados em um só lugar. Simples, rápido e sem comissões.' },
  ];

  const steps = [
    { icon: Store, title: 'Cadastre sua loja', desc: 'Preencha os dados básicos em menos de 1 minuto.' },
    { icon: ClipboardList, title: 'Monte seu cardápio', desc: 'Adicione seus produtos, categorias e fotos.' },
    { icon: Rocket, title: 'Comece a vender', desc: 'Divulgue seu QR Code em cada mesa e desfrute de todos os benefícios oferecidos pelo sistema.' },
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Nav */}
      <nav className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/gula-pedidos-digial.png" alt="Gula" className="w-8 h-8 object-contain" />
            <span className="font-bold text-lg tracking-tight text-slate-900">Gula Pedidos</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <a href="#planos" className="hidden sm:inline-flex text-sm font-medium text-slate-600 hover:text-slate-900 px-3 py-2 transition-colors">Planos</a>
            <button
              onClick={() => navigate('/entrar')}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 px-3 py-2 transition-colors"
            >
              <LogIn className="w-4 h-4" /> Entrar
            </button>
            <button
              onClick={() => navigate('/cadastrar')}
              className="text-sm font-semibold px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white transition-all shadow-lg shadow-amber-500/20"
            >
              Teste grátis
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-white">
        <div className="pointer-events-none absolute -top-40 -left-40 w-[28rem] h-[28rem] bg-amber-200/40 rounded-full blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -right-40 w-[28rem] h-[28rem] bg-orange-200/40 rounded-full blur-3xl" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-12 sm:pb-20 text-center">
          <div className="flex justify-center mb-8">
            <img src="/gula-pedidos-digial.png" alt="Gula Pedidos Digital" className="w-32 h-32 sm:w-44 sm:h-44 object-contain drop-shadow-[0_0_30px_rgba(245,158,11,0.25)]" />
          </div>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-100 border border-amber-300 text-amber-700 text-sm font-medium mb-6">
            <Zap className="w-4 h-4" />
            Teste grátis por 7 dias — Sem necessidade de cartão de crédito!
          </div>
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold leading-[1.1] tracking-tight max-w-4xl mx-auto text-slate-900">
            Acelere as vendas do seu restaurante com um{' '}
            <span className="bg-gradient-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent">
              Cardápio Digital
            </span>{' '}
            completo e sem comissões.
          </h1>
          <p className="mt-6 text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto">
            Gestão de pedidos via QR Code, painel da cozinha, impressão de comandas,
            Sistema de Fidelidade completo e integrado e etiquetas de validade térmicas
            em uma única plataforma simples e rápida.
          </p>
          <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => navigate('/cadastrar')}
              className="group inline-flex items-center gap-2 text-base font-semibold px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white transition-all shadow-xl shadow-amber-500/25 hover:shadow-amber-500/40 hover:-translate-y-0.5"
            >
              Comece Agora — 7 Dias Grátis
              <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
            </button>
            <button
              onClick={() => navigate('/entrar')}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 px-5 py-4 transition-colors"
            >
              <LogIn className="w-4 h-4" /> Já tenho conta — acessar painel
            </button>
          </div>
          <div className="mt-8 flex items-center justify-center gap-5 text-xs text-slate-500 flex-wrap">
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Sem cartão de crédito</span>
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Configuração em minutos</span>
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Cancele quando quiser</span>
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16 bg-white">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {steps.map((s, i) => (
            <div key={s.title} className="relative bg-white border border-slate-200 rounded-2xl p-6 hover:border-amber-400 hover:shadow-lg transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                  <s.icon className="w-5 h-5 text-amber-600" />
                </div>
                <span className="text-xs font-bold text-slate-400">Passo {i + 1}</span>
              </div>
              <h3 className="font-semibold text-slate-900 mb-1.5">{s.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 bg-white">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Tudo que seu restaurante precisa</h2>
          <p className="mt-3 text-slate-600 max-w-xl mx-auto">Uma plataforma completa, sem comissões por venda e sem burocracia.</p>
        </div>
        {/* Delivery promo banner — above feature cards */}
        <div className="mb-10">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0f2040] via-[#13284f] to-[#0f2040] p-6 sm:p-10 shadow-xl">
            <div className="pointer-events-none absolute -top-16 -right-16 w-56 h-56 bg-amber-500/15 rounded-full blur-3xl" />
            <div className="relative flex flex-col sm:flex-row items-center gap-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/30">
                <Send className="w-8 h-8 text-black" />
              </div>
              <div className="flex-1 text-center sm:text-left">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-semibold mb-3">
                  <Sparkles className="w-3.5 h-3.5" /> Incluso a partir do Plano Essencial
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">Seu Canal de Delivery Próprio e Sem Taxas</h3>
                <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
                  Diga adeus às altas comissões das plataformas tradicionais. Tenha seu próprio aplicativo web de delivery integrado ao sistema, receba pedidos direto na cozinha e aumente suas margens de lucro.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f) => (
            <div key={f.title} className="group bg-white border border-slate-200 rounded-2xl p-6 hover:border-amber-400 hover:shadow-lg transition-all">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <f.icon className="w-5 h-5 text-amber-600" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-1.5">{f.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Video tutorial banner */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-6 bg-white">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
              <PlayCircle className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">Acesse nossa central de tutoriais completa!</p>
              <p className="text-sm text-slate-600 mt-0.5">7 vídeos passo a passo para dominar todo o sistema.</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/tutoriais')}
            className="shrink-0 inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white transition-all"
          >
            <PlayCircle className="w-4 h-4" /> Ver Tutoriais
          </button>
        </div>
      </section>

      {/* Pricing */}
      <section id="planos" className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 bg-white scroll-mt-20">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-100 border border-amber-300 text-amber-700 text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5" /> Planos e Preços
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">Escolha o plano ideal para o seu negócio</h2>
          <p className="mt-3 text-slate-600 max-w-2xl mx-auto">
            Comece com 7 dias grátis em qualquer plano. Sem cartão de crédito, sem fidelidade.
          </p>
        </div>

        {/* Billing cycle toggle */}
        <div className="flex flex-col items-center justify-center mb-10">
          <div className="inline-flex bg-slate-100 rounded-2xl p-1 gap-1">
            {(['mensal', 'semestral', 'anual'] as BillingCycle[]).map((c) => {
              const labels: Record<BillingCycle, string> = { mensal: 'Mensal', semestral: 'Semestral', anual: 'Anual' };
              const savings: Record<BillingCycle, string | null> = { mensal: null, semestral: 'economize ~10%', anual: 'economize ~25%' };
              return (
                <button
                  key={c}
                  onClick={() => setCycle(c)}
                  className={`relative flex flex-col items-center px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    cycle === c ? 'bg-white text-slate-900 shadow-md' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {labels[c]}
                  {savings[c] && (
                    <span className={`text-[10px] font-bold mt-0.5 ${cycle === c ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {savings[c]}
                    </span>
                  )}
                  {c === 'anual' && (
                    <span className="absolute -top-2.5 -right-2 flex items-center gap-0.5 text-[9px] font-bold text-white bg-gradient-to-r from-emerald-500 to-amber-500 rounded-full px-2 py-0.5 shadow-md whitespace-nowrap">
                      <Gift className="w-2.5 h-2.5" /> Bônus
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {cycle === 'anual' && (
            <p className="mt-3 text-center text-sm font-semibold text-emerald-700 flex items-center justify-center gap-1.5">
              <Gift className="w-4 h-4" /> Ganhe o Gula Feedback Grátis no plano anual
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
          {PRICING_CARDS.map((card) => {
            const plan = PLANS.find(p => p.id === card.planId);
            const variant = plan?.variants.find(v => v.tier === 'promo') ?? plan?.variants[0];
            const priceEntry = variant?.prices.find(p => p.cycle === cycle) ?? variant?.prices[0];
            const displayPrice = priceEntry?.price ?? card.priceNew;
            const priceId = priceEntry?.stripe_price_id;
            const mensalPrice = variant?.prices.find(p => p.cycle === 'mensal')?.price;
            const months = cycle === 'semestral' ? 6 : cycle === 'anual' ? 12 : 1;
            const savings = cycle !== 'mensal' && mensalPrice ? (mensalPrice - displayPrice) * months : 0;
            const prefix = cycle === 'semestral' ? '6x de ' : cycle === 'anual' ? '12x de ' : '';
            return (
            <div
              key={card.planId}
              className={`relative flex flex-col rounded-3xl border-2 p-6 sm:p-8 transition-all ${
                card.highlighted
                  ? 'border-amber-500 bg-gradient-to-b from-amber-50 to-white shadow-2xl shadow-amber-500/20 md:-translate-y-3'
                  : 'border-slate-200 bg-white hover:border-amber-300 hover:shadow-lg'
              }`}
            >
              {card.badge ? (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 text-white text-xs font-bold shadow-lg">
                    <Star className="w-3.5 h-3.5 fill-white" /> {card.badge}
                  </span>
                </div>
              ) : null}

              <div className="flex items-center gap-2 mb-1">
                {card.highlighted ? (
                  <Crown className="w-5 h-5 text-amber-500" />
                ) : null}
                <h3 className={`text-xl font-bold ${card.highlighted ? 'text-amber-700' : 'text-slate-900'}`}>{card.name}</h3>
              </div>
              <p className="text-sm text-slate-500 mb-5 min-h-[40px]">{card.description}</p>

              <div className="mb-5">
                <div className="flex items-baseline gap-1">
                  {prefix && <span className="text-base font-semibold text-slate-500">{prefix}</span>}
                  <span className={`text-4xl font-extrabold ${card.highlighted ? 'text-amber-600' : 'text-slate-900'}`}>R$ {fmtBRL(displayPrice)}</span>
                  <span className="text-sm text-slate-500">/mês</span>
                </div>
                {savings > 0 && (
                  <span className="text-xs text-emerald-600 font-medium">
                    Economize R$ {fmtBRL(savings)}
                  </span>
                )}
              </div>

              {cycle === 'anual' && (
                <div className="mb-5 flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-50 to-amber-50 border border-emerald-300 px-3 py-2.5">
                  <Gift className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-xs font-bold text-emerald-700">BÔNUS EXCLUSIVO: Gula Feedback INCLUSO (Economia de R$ 479/ano)</span>
                </div>
              )}

              <ul className="space-y-2.5 mb-7 flex-1">
                {[...card.features, ...(cycle === 'anual' ? ['Módulo Gula Feedback 100% Grátis (Pesquisa de Satisfação + Roleta de Prêmios)'] : [])].map((feat, i) => {
                  const isHeader = feat.endsWith('mais:');
                  return (
                    <li key={i} className={`flex items-start gap-2.5 text-sm ${isHeader ? 'font-semibold text-slate-900' : 'text-slate-600'}`}>
                      {!isHeader && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />}
                      {isHeader && <span className="w-4 h-4 shrink-0 mt-0.5" />}
                      <span>{feat}</span>
                    </li>
                  );
                })}
              </ul>

              <button
                onClick={() => handlePlanClick(card.planId, priceId)}
                className={`w-full inline-flex items-center justify-center gap-2 text-sm font-semibold px-5 py-3.5 rounded-xl transition-all ${
                  card.highlighted
                    ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-lg shadow-amber-500/30 hover:-translate-y-0.5'
                    : 'bg-slate-900 hover:bg-slate-800 text-white'
                }`}
              >
                {card.cta}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            );
          })}
        </div>

        <div className="mt-10 text-center">
          <p className="inline-flex items-center gap-2 text-sm font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-5 py-2.5">
            <ShieldCheck className="w-4 h-4" />
            Todos os planos incluem 7 dias grátis. Sem cartão de crédito necessário.
          </p>
        </div>

        {/* ── Standalone modules (Etiquetas + Fila + Feedback) — same size as main cards ─ */}
        <div id="precos" className="mt-16 scroll-mt-20">
          <div className="text-center mb-6">
            <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wide">
              <Zap className="w-3.5 h-3.5" /> Módulos Avulsos
            </span>
            <p className="text-slate-500 text-sm mt-2">Já tem um sistema? Contrate apenas o módulo que precisa.</p>
          </div>

          {/* Standalone billing cycle toggle */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex bg-slate-100 rounded-2xl p-1 gap-1">
              {(['mensal', 'semestral', 'anual'] as BillingCycle[]).map((c) => {
                const labels: Record<BillingCycle, string> = { mensal: 'Mensal', semestral: 'Semestral', anual: 'Anual' };
                const discounts: Record<BillingCycle, string | null> = { mensal: null, semestral: '10% OFF', anual: '20% OFF' };
                return (
                  <button
                    key={c}
                    onClick={() => setStandaloneCycle(c)}
                    className={`relative flex flex-col items-center px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                      standaloneCycle === c ? 'bg-white text-slate-900 shadow-md' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {labels[c]}
                    {discounts[c] && (
                      <span className={`text-[10px] font-bold mt-0.5 ${standaloneCycle === c ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {discounts[c]}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
            {/* Gula Etiquetas card */}
            <div className="relative flex flex-col rounded-3xl border-2 border-emerald-400 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-6 sm:p-8 shadow-xl shadow-emerald-200/50">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-bold shadow-lg">
                  <Tag className="w-3.5 h-3.5" />
                  {STANDALONE_ETIQUETAS_CARD.badge}
                </span>
              </div>

              <div className="mt-2 mb-6 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Tag className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-xl font-bold text-slate-900">{STANDALONE_ETIQUETAS_CARD.name}</h3>
                </div>
                <p className="text-sm text-slate-500 mb-4">{STANDALONE_ETIQUETAS_CARD.description}</p>

                <ul className="space-y-2.5">
                  {STANDALONE_ETIQUETAS_CARD.features.map((feat, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-5 border-t border-emerald-100">
                {(() => {
                  const etiqPlan = PLANS.find(p => p.id === STANDALONE_ETIQUETAS_CARD.planId);
                  const etiqVariant = etiqPlan?.variants[0];
                  const etiqEntry = etiqVariant?.prices.find(p => p.cycle === standaloneCycle) ?? etiqVariant?.prices[0];
                  const etiqPrice = etiqEntry?.price ?? STANDALONE_ETIQUETAS_CARD.priceNew;
                  const etiqMensalPrice = etiqVariant?.prices.find(p => p.cycle === 'mensal')?.price;
                  const etiqMonths = standaloneCycle === 'semestral' ? 6 : standaloneCycle === 'anual' ? 12 : 1;
                  const etiqSavings = standaloneCycle !== 'mensal' && etiqMensalPrice ? (etiqMensalPrice - etiqPrice) * etiqMonths : 0;
                  const etiqPrefix = standaloneCycle === 'semestral' ? '6x de ' : standaloneCycle === 'anual' ? '12x de ' : '';
                  const etiqPriceId = etiqEntry?.stripe_price_id;
                  return (
                    <>
                      <div className="mb-4">
                        <div className="flex items-baseline gap-1">
                          {etiqPrefix && <span className="text-base font-semibold text-slate-500">{etiqPrefix}</span>}
                          <span className="text-3xl font-extrabold text-emerald-700">R$ {fmtBRL(etiqPrice)}</span>
                          <span className="text-sm text-slate-500">/mês</span>
                        </div>
                        {etiqSavings > 0 && (
                          <p className="text-xs text-emerald-600 font-medium">
                            Economize R$ {fmtBRL(etiqSavings)}
                          </p>
                        )}
                        <span className="text-xs text-emerald-600 font-medium block mt-1">7 dias grátis para testar</span>
                      </div>
                      <button
                        onClick={() => handlePlanClick(STANDALONE_ETIQUETAS_CARD.planId, etiqPriceId)}
                        className="w-full inline-flex items-center justify-center gap-2 text-sm font-semibold px-5 py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/30 hover:-translate-y-0.5 transition-all"
                      >
                        {STANDALONE_ETIQUETAS_CARD.cta}
                        <ArrowRight className="w-4 h-4" />
                      </button>
                      <p className="mt-3 text-xs text-slate-400 text-center">Sem cartão de crédito · Cancele quando quiser</p>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Gula Fila card */}
            <div className="relative flex flex-col rounded-3xl border-2 border-blue-400 bg-gradient-to-br from-blue-50 via-white to-sky-50 p-6 sm:p-8 shadow-xl shadow-blue-200/50">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-blue-600 to-sky-600 text-white text-xs font-bold shadow-lg">
                  <Clock className="w-3.5 h-3.5" />
                  {STANDALONE_FILA_CARD.badge}
                </span>
              </div>

              <div className="mt-2 mb-6 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <h3 className="text-xl font-bold text-slate-900">{STANDALONE_FILA_CARD.name}</h3>
                </div>
                <p className="text-sm text-slate-500 mb-4">{STANDALONE_FILA_CARD.description}</p>

                <ul className="space-y-2.5">
                  {STANDALONE_FILA_CARD.features.map((feat, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
                      <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-5 border-t border-blue-100">
                {(() => {
                  const filaPlan = PLANS.find(p => p.id === STANDALONE_FILA_CARD.planId);
                  const filaVariant = filaPlan?.variants[0];
                  const filaEntry = filaVariant?.prices.find(p => p.cycle === standaloneCycle) ?? filaVariant?.prices[0];
                  const filaPrice = filaEntry?.price ?? STANDALONE_FILA_CARD.priceNew;
                  const filaMensalPrice = filaVariant?.prices.find(p => p.cycle === 'mensal')?.price;
                  const filaMonths = standaloneCycle === 'semestral' ? 6 : standaloneCycle === 'anual' ? 12 : 1;
                  const filaSavings = standaloneCycle !== 'mensal' && filaMensalPrice ? (filaMensalPrice - filaPrice) * filaMonths : 0;
                  const filaPrefix = standaloneCycle === 'semestral' ? '6x de ' : standaloneCycle === 'anual' ? '12x de ' : '';
                  const filaPriceId = filaEntry?.stripe_price_id;
                  return (
                    <>
                      <div className="mb-4">
                        <div className="flex items-baseline gap-1">
                          {filaPrefix && <span className="text-base font-semibold text-slate-500">{filaPrefix}</span>}
                          <span className="text-3xl font-extrabold text-blue-700">R$ {fmtBRL(filaPrice)}</span>
                          <span className="text-sm text-slate-500">/mês</span>
                        </div>
                        {filaSavings > 0 && (
                          <p className="text-xs text-blue-600 font-medium">
                            Economize R$ {fmtBRL(filaSavings)}
                          </p>
                        )}
                        <span className="text-xs text-blue-600 font-medium block mt-1">7 dias grátis para testar</span>
                      </div>
                      <button
                        onClick={() => handlePlanClick(STANDALONE_FILA_CARD.planId, filaPriceId)}
                        className="w-full inline-flex items-center justify-center gap-2 text-sm font-semibold px-5 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-700 hover:to-sky-700 text-white shadow-lg shadow-blue-500/30 hover:-translate-y-0.5 transition-all"
                      >
                        {STANDALONE_FILA_CARD.cta}
                        <ArrowRight className="w-4 h-4" />
                      </button>
                      <p className="mt-3 text-xs text-slate-400 text-center">Sem cartão de crédito · Cancele quando quiser</p>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Gula Feedback card */}
            <div className="relative flex flex-col rounded-3xl border-2 border-amber-400 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-6 sm:p-8 shadow-xl shadow-amber-200/50">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 text-white text-xs font-bold shadow-lg">
                  <MessageSquare className="w-3.5 h-3.5" />
                  {STANDALONE_FEEDBACK_CARD.badge}
                </span>
              </div>

              <div className="mt-2 mb-6 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <MessageSquare className="w-5 h-5 text-amber-600" />
                  <h3 className="text-xl font-bold text-slate-900">{STANDALONE_FEEDBACK_CARD.name}</h3>
                </div>
                <p className="text-sm text-slate-500 mb-4">{STANDALONE_FEEDBACK_CARD.description}</p>

                <ul className="space-y-2.5">
                  {STANDALONE_FEEDBACK_CARD.features.map((feat, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
                      <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-5 border-t border-amber-100">
                {(() => {
                  const fbPlan = PLANS.find(p => p.id === STANDALONE_FEEDBACK_CARD.planId);
                  const fbVariant = fbPlan?.variants[0];
                  const fbEntry = fbVariant?.prices.find(p => p.cycle === standaloneCycle) ?? fbVariant?.prices[0];
                  const fbPrice = fbEntry?.price ?? 29.99;
                  const fbMensalPrice = fbVariant?.prices.find(p => p.cycle === 'mensal')?.price;
                  const fbMonths = standaloneCycle === 'semestral' ? 6 : standaloneCycle === 'anual' ? 12 : 1;
                  const fbSavings = standaloneCycle !== 'mensal' && fbMensalPrice ? (fbMensalPrice - fbPrice) * fbMonths : 0;
                  const fbPrefix = standaloneCycle === 'semestral' ? '6x de ' : standaloneCycle === 'anual' ? '12x de ' : '';
                  const fbPriceId = fbEntry?.stripe_price_id;
                  return (
                    <>
                      <div className="mb-4">
                        <div className="flex items-baseline gap-1">
                          {fbPrefix && <span className="text-base font-semibold text-slate-500">{fbPrefix}</span>}
                          <span className="text-3xl font-extrabold text-amber-600">R$ {fmtBRL(fbPrice)}</span>
                          <span className="text-sm text-slate-500">/mês</span>
                        </div>
                        {fbSavings > 0 && (
                          <p className="text-xs text-emerald-600 font-medium">
                            Economize R$ {fmtBRL(fbSavings)}
                          </p>
                        )}
                        {standaloneCycle === 'mensal' && (
                          <p className="text-xs text-slate-500 font-medium">Sem fidelidade • Cancele quando quiser</p>
                        )}
                        <span className="text-xs text-amber-600 font-medium block mt-1">7 dias grátis para testar</span>
                      </div>
                      <button
                        onClick={() => handlePlanClick(STANDALONE_FEEDBACK_CARD.planId, fbPriceId)}
                        className="w-full inline-flex items-center justify-center gap-2 text-sm font-semibold px-5 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-lg shadow-amber-500/30 hover:-translate-y-0.5 transition-all"
                      >
                        {STANDALONE_FEEDBACK_CARD.cta}
                        <ArrowRight className="w-4 h-4" />
                      </button>
                      <p className="mt-3 text-xs text-slate-400 text-center">Sem cartão de crédito · Cancele quando quiser</p>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>

        {/* AI Validade promo banner — dark green background, white text */}
        <div className="mt-8 max-w-5xl mx-auto">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-800 via-emerald-900 to-teal-900 border-2 border-emerald-700 p-6 sm:p-10 shadow-xl shadow-emerald-900/50">
            <div className="pointer-events-none absolute -bottom-16 -left-16 w-56 h-56 bg-emerald-500/20 rounded-full blur-3xl" />
            <div className="relative flex flex-col sm:flex-row items-center gap-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/30">
                <Bot className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1 text-center sm:text-left">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-semibold mb-3">
                  <Sparkles className="w-3.5 h-3.5" /> Incluído no Gula Etiquetas (10 consultas diárias por conta)
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">Cálculo Inteligente de Validades com IA</h3>
                <p className="text-sm sm:text-base text-emerald-100 leading-relaxed max-w-2xl">
                  Em dúvida sobre a validade do alimento manipulado? Pergunte à nossa IA integrada. Ela calcula a validade exata de acordo com as normas sanitárias e preenche sua etiqueta em segundos.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16 bg-white">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Perguntas Frequentes</h2>
          <p className="mt-3 text-slate-600">Tudo que você precisa saber antes de começar.</p>
        </div>
        <div className="space-y-3">
          {FAQ_ITEMS.map((item) => (
            <FaqItem key={item.q} q={item.q} a={item.a} />
          ))}
        </div>
      </section>

      {/* Contact form */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16 bg-white">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-10 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center">
              <Mail className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Fale com a gente</h2>
              <p className="text-sm text-slate-600">Respondemos em até 24 horas.</p>
            </div>
          </div>

          {sent ? (
            <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-4 text-emerald-700 text-sm">
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              <span>Seu cliente de e-mail foi aberto com a mensagem. Envie para <strong>contato@vertexapps.com.br</strong> e em breve retornamos!</span>
            </div>
          ) : (
            <form onSubmit={handleContact} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Seu nome</label>
                  <input
                    required
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all"
                    placeholder="João da Silva"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">E-mail</label>
                  <input
                    type="email"
                    required
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all"
                    placeholder="joao@restaurante.com"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Mensagem</label>
                <textarea
                  required
                  rows={4}
                  value={contactMsg}
                  onChange={(e) => setContactMsg(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all resize-none"
                  placeholder="Como podemos ajudar?"
                />
              </div>
              <button
                type="submit"
                disabled={sending}
                className="inline-flex items-center gap-2 text-sm font-semibold px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white transition-all shadow-lg shadow-amber-500/20 disabled:opacity-60"
              >
                <Send className="w-4 h-4" /> Enviar mensagem
              </button>
            </form>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-20 bg-white">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500 via-orange-500 to-orange-600 p-8 sm:p-12 text-center text-white shadow-2xl shadow-amber-500/30">
          <div className="pointer-events-none absolute -top-20 -right-20 w-64 h-64 bg-white/20 rounded-full blur-3xl" />
          <div className="relative">
            <ShieldCheck className="w-10 h-10 text-white mx-auto mb-4" />
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">Pronto para começar?</h2>
            <p className="text-white/90 max-w-md mx-auto mb-7">
              Cadastre seu restaurante agora e tenha 7 dias de acesso completo, sem pagar nada.
            </p>
            <button
              onClick={() => navigate('/cadastrar')}
              className="group inline-flex items-center gap-2 text-base font-semibold px-8 py-4 rounded-2xl bg-white hover:bg-slate-50 text-amber-600 transition-all shadow-xl hover:-translate-y-0.5"
            >
              Comece Agora — 7 Dias Grátis
              <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </section>

      {/* Blog — powered by Soro */}
      <section className="py-16 sm:py-20 bg-[#FAFAFA]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">
              Dicas de Gestão para Restaurantes
            </h2>
            <p className="text-slate-500 text-lg max-w-2xl mx-auto">
              Conteúdos práticos escritos por quem entende a rotina real de um restaurante.
            </p>
          </div>
          <SoroBlogEmbed />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img src="/gula-pedidos-digial.png" alt="Gula" className="w-7 h-7 object-contain" />
            <span className="text-sm font-semibold text-slate-700">Gula Pedidos Digital</span>
          </div>
          <div className="flex items-center gap-5 text-xs text-slate-500">
            <span>contato@vertexapps.com.br</span>
            <span>© {new Date().getFullYear()} Gula Pedidos. Todos os direitos reservados.</span>
          </div>
          {/* Social media */}
          <div className="flex items-center gap-3">
            <a
              href="https://instagram.com/gula_pedidos"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-pink-600 transition-colors"
              aria-label="Instagram @gula_pedidos"
            >
              <Instagram className="w-4 h-4" />
              <span>@gula_pedidos</span>
            </a>
            <a
              href="https://tiktok.com/@gulapedidos"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors"
              aria-label="TikTok @gulapedidos"
            >
              <Music2 className="w-4 h-4" />
              <span>@gulapedidos</span>
            </a>
          </div>
        </div>
      </footer>

      <GulaAssistenteWidget />
    </div>
  );
}
