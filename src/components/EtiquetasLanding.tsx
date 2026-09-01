import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ShieldCheck, Clock, Printer, Bot, Smartphone, ArrowRight, CheckCircle2,
  XCircle, Tag, AlertTriangle, QrCode, Bell, Sparkles, ChevronDown, ChevronUp,
  ChevronLeft, ChevronRight, Calendar, Newspaper,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { BlogPost } from '../types/blog';

const FAQ_ITEMS = [
  { q: 'Preciso de algum equipamento especial?', a: 'Apenas uma impressora térmica de etiquetas (Epson, Elgin, Zebra ou similar). O sistema funciona no navegador do celular ou computador, sem instalação.' },
  { q: 'Como funciona o cálculo de validade automático?', a: 'Você informa o produto (ex: arroz cozido) e a IA consulta as normas da ANVISA e Resolução RDC 216/2004 para calcular o prazo exato de validade, preenchendo a etiqueta automaticamente.' },
  { q: 'Posso usar sem o sistema de pedidos?', a: 'Sim! O Gula Etiquetas é um módulo independente. Você não precisa contratar o cardápio digital nem nenhum outro módulo.' },
  { q: 'O que acontece após os 7 dias de teste?', a: 'Você escolhe um plano (mensal, semestral ou anual) e continua usando. Sem multa, sem fidelidade — cancele quando quiser.' },
  { q: 'A IA realmente conhece as normas sanitárias?', a: 'Sim. A IA foi treinada com base na legislação sanitária brasileira (ANVISA, RDC 216, portarias estaduais) e calcula prazos conforme o tipo de alimento manipulado.' },
];

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function EtiquetasLanding() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = 'Gula Etiquetas — Validade Automática e Etiquetas Térmicas com IA';
  }, []);

  useEffect(() => {
    supabase
      .from('blog_posts')
      .select('*')
      .eq('status', 'published')
      .in('slug', [
        'impressora-comanda-80mm-vs-impressora-etiqueta',
        'como-evitar-multas-anvisa-manipulacao-alimentos',
        'regras-etiquetagem-produtos-abertos-manipulados-cozinha',
      ])
      .order('published_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setPosts(data as BlogPost[]);
        setLoadingPosts(false);
      });
  }, []);

  function startTrial() {
    navigate('/cadastrar?plan=gula_etiquetas_standalone');
  }

  function scrollToFeatures() {
    document.getElementById('recursos')?.scrollIntoView({ behavior: 'smooth' });
  }

  function scrollBy(direction: number) {
    scrollRef.current?.scrollBy({ left: direction * 380, behavior: 'smooth' });
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FF5D22] to-orange-600 flex items-center justify-center shadow-md shadow-orange-500/20">
              <Tag className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-sm font-bold text-slate-900 block leading-tight">Gula Etiquetas</span>
              <span className="text-[10px] text-slate-400 leading-tight">Segurança alimentar inteligente</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="text-sm text-slate-500 hover:text-slate-900 transition-colors hidden sm:block">
              Ver todos os produtos
            </button>
            <button onClick={startTrial} className="text-sm font-semibold text-white bg-gradient-to-r from-[#FF5D22] to-orange-600 hover:from-[#FF5D22] hover:to-orange-700 px-4 py-2 rounded-xl transition-all shadow-md shadow-orange-500/20">
              Testar Grátis
            </button>
          </div>
        </div>
      </header>

      {/* ── 1. Hero Section ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-orange-50 via-white to-emerald-50/30">
        <div className="pointer-events-none absolute -top-40 -right-40 w-96 h-96 bg-orange-200/30 rounded-full blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-40 w-96 h-96 bg-emerald-200/20 rounded-full blur-3xl" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Texto */}
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-full px-4 py-1.5 text-xs font-semibold mb-6">
                <ShieldCheck className="w-3.5 h-3.5" /> Conformidade com ANVISA e Vigilância Sanitária
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 leading-[1.15]">
                Adeus Multas da ANVISA:{' '}
                <span className="bg-gradient-to-r from-[#FF5D22] to-orange-600 bg-clip-text text-transparent">
                  Etiquetas de Validade com IA em Segundos
                </span>
              </h1>
              <p className="mt-6 text-base sm:text-lg text-slate-600 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                O sistema inteligente para cozinhas que calcula a validade automática pela legislação, conecta com sua impressora térmica e zera o desperdício no estoque.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row items-center lg:items-start lg:justify-start justify-center gap-3">
                <button
                  onClick={startTrial}
                  className="group inline-flex items-center gap-2 text-base font-semibold px-7 py-4 rounded-2xl bg-gradient-to-r from-[#FF5D22] to-orange-600 hover:from-[#FF5D22] hover:to-orange-700 text-white transition-all shadow-xl shadow-orange-500/30 hover:-translate-y-0.5"
                >
                  Testar 7 Dias Grátis
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
                </button>
                <button
                  onClick={scrollToFeatures}
                  className="inline-flex items-center gap-2 text-base font-semibold px-7 py-4 rounded-2xl bg-white border-2 border-slate-200 hover:border-orange-300 text-slate-700 hover:text-orange-600 transition-all"
                >
                  Ver Como Funciona
                </button>
              </div>
              <p className="mt-4 text-xs text-slate-400">Sem cartão de crédito • Configuração em 2 minutos • Apenas R$ 49,99/mês</p>
            </div>

            {/* Mockup visual */}
            <div className="relative flex items-center justify-center">
              <div className="relative w-full max-w-sm">
                {/* Smartphone mockup */}
                <div className="relative mx-auto w-64 h-[480px] bg-slate-900 rounded-[2.5rem] shadow-2xl p-3 z-10">
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 w-20 h-5 bg-slate-900 rounded-b-2xl z-20" />
                  <div className="w-full h-full bg-white rounded-[2rem] overflow-hidden flex flex-col">
                    {/* App header */}
                    <div className="bg-gradient-to-r from-[#FF5D22] to-orange-600 px-4 py-3 flex items-center gap-2">
                      <Tag className="w-5 h-5 text-white" />
                      <span className="text-white font-bold text-sm">Gula Etiquetas</span>
                    </div>
                    {/* App body */}
                    <div className="flex-1 p-4 space-y-3">
                      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Nova Etiqueta</div>
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                        <div className="text-xs text-slate-500 mb-1">Produto</div>
                        <div className="text-sm font-semibold text-slate-900">Arroz Branco Cozido</div>
                      </div>
                      <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                        <div className="flex items-center gap-1.5 text-xs text-emerald-600 mb-1">
                          <Bot className="w-3.5 h-3.5" /> IA calculou
                        </div>
                        <div className="text-sm font-semibold text-emerald-700">Validade: 3 dias refrigerado</div>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-1.5">
                        <div className="flex justify-between text-xs"><span className="text-slate-400">Abertura</span><span className="font-medium text-slate-700">25/08 14:30</span></div>
                        <div className="flex justify-between text-xs"><span className="text-slate-400">Validade</span><span className="font-medium text-slate-700">28/08 14:30</span></div>
                        <div className="flex justify-between text-xs"><span className="text-slate-400">Resp.</span><span className="font-medium text-slate-700">Maria S.</span></div>
                      </div>
                      <div className="bg-gradient-to-r from-[#FF5D22] to-orange-600 rounded-xl py-2.5 text-center text-white text-sm font-semibold flex items-center justify-center gap-1.5">
                        <Printer className="w-4 h-4" /> Imprimir Etiqueta
                      </div>
                    </div>
                  </div>
                </div>

                {/* Printer mockup */}
                <div className="absolute -bottom-4 -left-4 sm:-left-8 w-40 h-32 bg-slate-100 rounded-2xl shadow-xl border border-slate-200 z-0 hidden sm:block">
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                    <Printer className="w-10 h-10 text-slate-400" />
                    <div className="w-24 h-6 bg-white border border-slate-200 rounded-sm flex items-center justify-center">
                      <div className="w-20 h-4 bg-gradient-to-r from-emerald-100 to-emerald-50 rounded-sm flex items-center justify-center text-[8px] font-bold text-emerald-600">
                        60x40mm
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">Impressora Térmica</span>
                  </div>
                </div>

                {/* Floating badge */}
                <div className="absolute -top-2 -right-2 bg-emerald-500 text-white rounded-full px-3 py-1.5 text-xs font-bold shadow-lg flex items-center gap-1 z-20">
                  <CheckCircle2 className="w-3.5 h-3.5" /> ANVISA OK
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. Recursos Principais (Grid de Funcionalidades) ── */}
      <section id="recursos" className="bg-white scroll-mt-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Tudo que você precisa em um só lugar</h2>
            <p className="mt-3 text-slate-500">Recursos pensados para o dia a dia da cozinha profissional.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[
              {
                icon: Clock,
                title: 'Cálculo Automático de Validade',
                desc: 'Diferenciação instantânea entre produtos manipulados e industrializados abertos. A IA calcula o prazo correto conforme as normas vigentes da legislação sanitária.',
                color: 'orange',
              },
              {
                icon: Printer,
                title: 'Conexão Térmica Direta',
                desc: 'Suporte nativo a impressoras de etiquetas térmicas (Epson, Elgin, Zebra e modelos genéricos). Imprima em segundos direto do navegador do celular, tablet ou PC.',
                color: 'blue',
              },
              {
                icon: Bot,
                title: 'IA Especialista ANVISA',
                desc: 'Tire dúvidas sobre prazos sanitários e normas de manipulação direto no app. Nunca mais fique na incerteza na hora de etiquetar o estoque.',
                color: 'amber',
              },
              {
                icon: Bell,
                title: 'Gestão e Alerta de Estoque',
                desc: 'Veja o que vence hoje e amanhã para priorizar o uso na cozinha. Receba alertas no celular antes dos insumos vencerem e reduza o desperdício.',
                color: 'emerald',
              },
            ].map((feat) => (
              <div
                key={feat.title}
                className="group rounded-2xl border border-slate-200 bg-white p-6 sm:p-7 hover:shadow-xl hover:border-orange-200 transition-all hover:-translate-y-1"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 ${
                  feat.color === 'orange' ? 'bg-orange-100 text-orange-600' :
                  feat.color === 'blue' ? 'bg-blue-100 text-blue-600' :
                  feat.color === 'amber' ? 'bg-amber-100 text-amber-600' :
                  'bg-emerald-100 text-emerald-600'
                }`}>
                  <feat.icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{feat.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>

          {/* Extra feature highlights */}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: QrCode, text: 'Histórico em QR Code' },
              { icon: Smartphone, text: 'Funciona no celular, tablet e PC' },
              { icon: Sparkles, text: 'IA com 10 consultas diárias grátis' },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-3 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3.5">
                <item.icon className="w-5 h-5 text-orange-500 shrink-0" />
                <span className="text-sm font-medium text-slate-700">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 3. Especificações Técnicas de Impressão ── */}
      <section className="bg-gradient-to-br from-slate-50 to-orange-50/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Compatibilidade total com sua impressora</h2>
            <p className="mt-3 text-slate-500">Funciona com as principais marcas do mercado e tamanhos padrão.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Tamanhos de etiquetas */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Tag className="w-5 h-5 text-orange-500" /> Tamanhos de Etiquetas
              </h3>
              <div className="flex flex-wrap gap-3">
                <div className="flex flex-col items-center gap-2 rounded-2xl bg-orange-50 border border-orange-200 px-6 py-4">
                  <div className="w-20 h-12 bg-white border-2 border-orange-300 rounded flex items-center justify-center text-xs font-bold text-orange-600">
                    60×40
                  </div>
                  <span className="text-sm font-semibold text-slate-700">60×40 mm</span>
                  <span className="text-xs text-slate-400">Padrão de mercado</span>
                </div>
                <div className="flex flex-col items-center gap-2 rounded-2xl bg-emerald-50 border border-emerald-200 px-6 py-4">
                  <div className="w-16 h-12 bg-white border-2 border-emerald-300 rounded flex items-center justify-center text-xs font-bold text-emerald-600">
                    50×40
                  </div>
                  <span className="text-sm font-semibold text-slate-700">50×40 mm</span>
                  <span className="text-xs text-slate-400">Compatível</span>
                </div>
              </div>
            </div>

            {/* Impressoras homologadas */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Printer className="w-5 h-5 text-orange-500" /> Impressoras Homologadas
              </h3>
              <div className="flex flex-wrap gap-2">
                {['Elgin', 'Epson', 'Zebra', 'Argox', 'Genéricas USB', 'Bluetooth', 'Rede'].map((brand) => (
                  <span key={brand} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-50 border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" /> {brand}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. Prova Social e Comparativo de Risco ── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Por que deixar a caneta e a fita crepe?</h2>
          <p className="mt-3 text-slate-500">Veja como o Gula Etiquetas transforma a rotina da sua cozinha.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {/* Modo Antigo */}
          <div className="relative rounded-3xl border-2 border-red-200 bg-gradient-to-br from-red-50 via-white to-orange-50 p-6 sm:p-8">
            <div className="absolute -top-3.5 left-6">
              <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-red-500 text-white text-xs font-bold shadow-md">
                <XCircle className="w-3.5 h-3.5" /> Modo Antigo: Caneta e Fita Crepe
              </span>
            </div>
            <ul className="mt-4 space-y-4">
              {[
                'Letra ilegível após um dia no freezer',
                'Fita crepe descolando e caindo no balcão',
                'Erro no cálculo manual de validade',
                'Risco de multas pesadas da vigilância sanitária',
                'Alimentos jogados no lixo por incerteza da validade',
                'Sem nome do responsável pela manipulação',
              ].map((text, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-slate-700">
                  <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Com Gula Etiquetas */}
          <div className="relative rounded-3xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-6 sm:p-8 shadow-lg shadow-emerald-200/40">
            <div className="absolute -top-3.5 left-6">
              <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-bold shadow-md">
                <CheckCircle2 className="w-3.5 h-3.5" /> Com Gula Etiquetas
              </span>
            </div>
            <ul className="mt-4 space-y-4">
              {[
                'Etiquetas padronizadas e sempre legíveis',
                'Cálculo cravado por IA conforme a legislação',
                'Dados completos: Lote, Responsável, Abertura, Validade',
                '100% de conformidade fiscal e sanitária',
                'Alerta de vencimento no celular antes de perder',
                'Cozinha organizada, sem multas e sem desperdício',
              ].map((text, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-slate-700">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── 5. Seção de Preço e Oferta ── */}
      <section className="bg-gradient-to-br from-slate-50 to-orange-50/30">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Plano Profissional</h2>
            <p className="mt-3 text-slate-500">Tudo incluso, sem taxa de adesão e sem burocracia.</p>
          </div>

          <div className="relative overflow-hidden rounded-3xl bg-white border-2 border-orange-200 shadow-2xl shadow-orange-200/40 p-8 sm:p-10">
            <div className="pointer-events-none absolute -top-20 -right-20 w-64 h-64 bg-orange-100/40 rounded-full blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-20 w-64 h-64 bg-emerald-100/30 rounded-full blur-3xl" />
            <div className="relative">
              <div className="flex flex-col items-center text-center">
                <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-orange-100 border border-orange-200 text-orange-700 text-xs font-bold mb-5">
                  <Sparkles className="w-3.5 h-3.5" /> Tudo incluso
                </div>

                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-5xl font-extrabold text-slate-900">R$ 49,99</span>
                  <span className="text-lg text-slate-500 font-medium">/mês</span>
                </div>
                <p className="text-sm text-slate-500 mb-6">Sem taxa de adesão • Cancele a qualquer momento</p>

                <ul className="space-y-3 text-left w-full max-w-sm mb-8">
                  {[
                    'Impressões ilimitadas',
                    'IA ANVISA para cálculo de validade',
                    'Suporte a múltiplos tamanhos (60×40 e 50×40)',
                    'Alertas de vencimento no celular',
                    'Cadastro de produtos e colaboradores',
                    'Histórico completo via QR Code',
                  ].map((feat, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={startTrial}
                  className="group inline-flex items-center gap-2 text-base font-semibold px-8 py-4 rounded-2xl bg-gradient-to-r from-[#FF5D22] to-orange-600 hover:from-[#FF5D22] hover:to-orange-700 text-white transition-all shadow-xl shadow-orange-500/30 hover:-translate-y-0.5 w-full max-w-xs justify-center"
                >
                  Começar Teste Grátis de 7 Dias
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
                </button>
                <p className="mt-4 text-xs text-slate-400">Sem cartão de crédito • Acesso imediato • Cancele quando quiser</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. Carrossel de Artigos Relacionados ── */}
      <section className="bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Artigos relacionados</h2>
            <p className="mt-3 text-slate-500">Conteúdos práticos sobre etiquetagem e vigilância sanitária.</p>
          </div>

          {loadingPosts ? (
            <div className="grid md:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white rounded-2xl border border-slate-200 overflow-hidden animate-pulse">
                  <div className="aspect-[16/9] bg-slate-200" />
                  <div className="p-5 space-y-3">
                    <div className="h-4 bg-slate-200 rounded w-1/3" />
                    <div className="h-6 bg-slate-200 rounded w-full" />
                    <div className="h-4 bg-slate-200 rounded w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : posts.length > 0 ? (
            <div className="relative">
              {/* Navigation arrows — desktop */}
              <div className="hidden md:flex absolute -left-6 top-1/2 -translate-y-1/2 z-10">
                <button
                  onClick={() => scrollBy(-1)}
                  className="w-10 h-10 rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center text-slate-600 hover:text-orange-600 hover:border-orange-300 transition-colors"
                  aria-label="Anterior"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              </div>
              <div className="hidden md:flex absolute -right-6 top-1/2 -translate-y-1/2 z-10">
                <button
                  onClick={() => scrollBy(1)}
                  className="w-10 h-10 rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center text-slate-600 hover:text-orange-600 hover:border-orange-300 transition-colors"
                  aria-label="Próximo"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              <div
                ref={scrollRef}
                className="flex gap-6 overflow-x-auto md:overflow-hidden scroll-smooth snap-x snap-mandatory pb-2 md:pb-0 md:grid md:grid-cols-3"
                style={{ scrollbarWidth: 'none' }}
              >
                {posts.map(post => (
                  <div key={post.id} className="snap-center shrink-0 w-[85vw] sm:w-[360px] md:w-auto">
                    <article className="group flex flex-col bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-lg hover:border-orange-200 transition-all duration-300 h-full">
                      <Link to={`/blog/${post.slug}`} className="block relative aspect-[16/9] overflow-hidden bg-slate-100">
                        {post.cover_image_url ? (
                          <img src={post.cover_image_url} alt={post.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
                            <Newspaper className="w-12 h-12 text-orange-300" />
                          </div>
                        )}
                        <span className="absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-semibold bg-white/95 text-orange-600 shadow-sm">
                          {post.category}
                        </span>
                      </Link>
                      <div className="flex flex-col flex-1 p-5">
                        <div className="flex items-center gap-3 text-xs text-slate-400 mb-3">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {formatDate(post.published_at)}
                          </span>
                          {post.read_time && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {post.read_time}
                            </span>
                          )}
                        </div>
                        <Link to={`/blog/${post.slug}`}>
                          <h3 className="text-lg font-bold text-slate-900 leading-snug mb-2 group-hover:text-orange-600 transition-colors line-clamp-2">
                            {post.title}
                          </h3>
                        </Link>
                        {post.excerpt && (
                          <p className="text-sm text-slate-500 leading-relaxed line-clamp-2 mb-4">
                            {post.excerpt}
                          </p>
                        )}
                        <Link
                          to={`/blog/${post.slug}`}
                          className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-orange-600 hover:text-orange-700 transition-colors"
                        >
                          Ler artigo completo
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </Link>
                      </div>
                    </article>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="text-center mt-10">
            <Link
              to="/blog"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-orange-600 text-white font-semibold text-sm hover:bg-orange-700 transition-colors shadow-lg shadow-orange-600/20"
            >
              Acessar Blog Completo
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-16 sm:pb-20">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Perguntas Frequentes</h2>
          <p className="mt-3 text-slate-500">Tudo que você precisa saber antes de começar.</p>
        </div>
        <div className="space-y-3">
          {FAQ_ITEMS.map((item, i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
              >
                <span className="text-sm font-semibold text-slate-900">{item.q}</span>
                {openFaq === i ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
              </button>
              {openFaq === i && (
                <div className="px-5 pb-4 text-sm text-slate-600 leading-relaxed">{item.a}</div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-100 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#FF5D22] to-orange-600 flex items-center justify-center">
              <Tag className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-slate-700">Gula Etiquetas</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <button onClick={() => navigate('/')} className="hover:text-slate-600 transition-colors">Gula Pedidos Digital</button>
            <span>© {new Date().getFullYear()} Gula. Todos os direitos reservados.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
