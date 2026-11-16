import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageSquare, QrCode, Bell, Cake, ArrowRight, CheckCircle2,
  ChevronDown, ChevronUp, Sparkles, Smartphone, Gift, Zap, PlayCircle,
  Star, Fingerprint, Users,
} from 'lucide-react';

const FAQ_ITEMS = [
  {
    q: 'Preciso ter o sistema de cardápio do Gula Pedidos para usar o Gula Feedback?',
    a: 'Não! O Gula Feedback é um módulo avulso e pode ser contratado de forma independente para qualquer restaurante. Você não precisa de nenhum outro produto Gula para começar a capturar leads e disparar notificações push.',
  },
  {
    q: 'Como funciona o envio das notificações push?',
    a: 'As notificações são enviadas nativamente para o celular ou computador do cliente que autorizar o opt-in na roleta de prêmios, sem custo por mensagem. O cliente recebe a notificação no navegador do dispositivo dele, como uma mensagem comum.',
  },
  {
    q: 'Preciso de cartão de crédito para testar?',
    a: 'Não, você testa por 7 dias grátis sem burocracia. Sem cartão, sem compromisso. Ao final do teste, você decide se quer continuar por apenas R$ 29,99/mês.',
  },
];

export default function FeedbackLanding() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [showDemo, setShowDemo] = useState(false);

  useEffect(() => {
    document.title = 'Gula Feedback — Pesquisa de Satisfação + Roleta de Prêmios + Push em Massa';
  }, []);

  function startTrial() {
    navigate('/cadastrar?plan=gula_feedback_standalone');
  }

  function scrollToFeatures() {
    document.getElementById('recursos')?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md shadow-amber-500/20">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-sm font-bold text-slate-900 block leading-tight">Gula Feedback</span>
              <span className="text-[10px] text-slate-400 leading-tight">Pesquisa + Roleta + Push</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="text-sm text-slate-500 hover:text-slate-900 transition-colors hidden sm:block">
              Ver todos os produtos
            </button>
            <button onClick={startTrial} className="text-sm font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 px-4 py-2 rounded-xl transition-all shadow-md shadow-amber-500/20">
              Testar Grátis
            </button>
          </div>
        </div>
      </header>

      {/* ── 1. Hero Section ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-amber-50 via-white to-orange-50/30">
        <div className="pointer-events-none absolute -top-40 -right-40 w-96 h-96 bg-amber-200/30 rounded-full blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-40 w-96 h-96 bg-orange-200/20 rounded-full blur-3xl" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Texto */}
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-4 py-1.5 text-xs font-semibold mb-6">
                <Zap className="w-3.5 h-3.5" /> 7 Dias Grátis • Sem Cartão de Crédito • R$ 29,99/mês
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 leading-[1.15]">
                Transforme a opinião dos seus clientes em{' '}
                <span className="bg-gradient-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent">
                  vendas recorrentes
                </span>{' '}
                com o Gula Feedback
              </h1>
              <p className="mt-6 text-base sm:text-lg text-slate-600 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                Pesquisa de satisfação inteligente com Roleta de Prêmios automatizada. Capture nome, e-mail, telefone, data de aniversário e envie Notificações Push em Massa diretamente para o celular dos seus clientes.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row items-center lg:items-start lg:justify-start justify-center gap-3">
                <button
                  onClick={startTrial}
                  className="group inline-flex items-center gap-2 text-base font-semibold px-7 py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white transition-all shadow-xl shadow-amber-500/30 hover:-translate-y-0.5"
                >
                  Testar Gula Feedback Grátis por 7 Dias
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
                </button>
                <button
                  onClick={() => setShowDemo(true)}
                  className="inline-flex items-center gap-2 text-base font-semibold px-7 py-4 rounded-2xl bg-white border-2 border-slate-200 hover:border-amber-300 text-slate-700 hover:text-amber-600 transition-all"
                >
                  <PlayCircle className="w-5 h-5" /> Ver Demonstração da Roleta
                </button>
              </div>
              <p className="mt-4 text-xs text-slate-400">Sem cartão de crédito • Configuração em 2 minutos • Cancele quando quiser</p>
            </div>

            {/* Mockup visual — Roleta no celular */}
            <div className="relative flex items-center justify-center">
              <div className="relative w-full max-w-sm">
                {/* Smartphone mockup */}
                <div className="relative mx-auto w-64 h-[480px] bg-slate-900 rounded-[2.5rem] shadow-2xl p-3 z-10">
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 w-20 h-5 bg-slate-900 rounded-b-2xl z-20" />
                  <div className="w-full h-full bg-white rounded-[2rem] overflow-hidden flex flex-col">
                    {/* App header */}
                    <div className="bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-3 flex items-center gap-2">
                      <MessageSquare className="w-5 h-5 text-white" />
                      <span className="text-white font-bold text-sm">Gula Feedback</span>
                    </div>
                    {/* App body */}
                    <div className="flex-1 p-4 space-y-3 flex flex-col items-center justify-center">
                      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide text-center">Pesquisa Concluída!</div>
                      {/* Roleta visual */}
                      <div className="relative w-36 h-36 my-2">
                        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-500 via-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
                          <div className="w-28 h-28 rounded-full bg-white flex items-center justify-center border-4 border-amber-400/30">
                            <Gift className="w-10 h-10 text-amber-500" />
                          </div>
                        </div>
                        {/* Pointer */}
                        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-8 border-l-transparent border-r-transparent border-t-amber-500" />
                      </div>
                      <div className="bg-amber-50 rounded-xl p-3 border border-amber-200 text-center w-full">
                        <div className="text-xs text-amber-600 mb-1">Você ganhou!</div>
                        <div className="text-sm font-bold text-slate-900">Voucher 10% OFF</div>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-2 border border-slate-200 w-full">
                        <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
                          <Fingerprint className="w-3.5 h-3.5 text-emerald-500" /> Opt-in ativado
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Floating badge — Push notification */}
                <div className="absolute -top-2 -right-2 bg-amber-500 text-white rounded-2xl px-3 py-2 text-xs font-bold shadow-lg flex items-center gap-1.5 z-20 animate-bounce" style={{ animationDuration: '2s' }}>
                  <Bell className="w-4 h-4" /> Push enviado!
                </div>

                {/* Floating badge — Lead capturado */}
                <div className="absolute -bottom-4 -left-4 bg-emerald-500 text-white rounded-2xl px-3 py-2 text-xs font-bold shadow-lg flex items-center gap-1.5 z-20">
                  <CheckCircle2 className="w-4 h-4" /> Lead capturado
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. Recursos Principais (Grid 2x2) ── */}
      <section id="recursos" className="bg-white scroll-mt-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Tudo que você precisa para fidelizar clientes</h2>
            <p className="mt-3 text-slate-500">Recursos pensados para transformar pesquisa em vendas.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[
              {
                icon: Gift,
                title: 'Pesquisa & Roleta de Prêmios Interativa',
                desc: 'O cliente escaneia o QR Code na mesa ou balcão, responde a pesquisa e roda a roleta para ganhar vouchers automáticos.',
                color: 'amber',
              },
              {
                icon: Users,
                title: 'Captura Inteligente de Leads & Opt-in',
                desc: 'Colete nome, telefone, e-mail e data de aniversário de forma 100% consentida antes do cliente girar a roleta.',
                color: 'blue',
              },
              {
                icon: Bell,
                title: 'Disparo de Notificações Push em Massa',
                desc: 'Envie ofertas e avisos com 1 clique diretamente no navegador do celular dos clientes cadastrados e com opt-in ativo.',
                color: 'orange',
              },
              {
                icon: Cake,
                title: 'Campanha Automática para Aniversariantes',
                desc: 'Filtre a base de aniversariantes do mês e envie notificações exclusivas com vouchers para atrair comemorações no seu restaurante.',
                color: 'pink',
              },
            ].map((feat) => (
              <div
                key={feat.title}
                className="group rounded-2xl border border-slate-200 bg-white p-6 sm:p-7 hover:shadow-xl hover:border-amber-200 transition-all hover:-translate-y-1"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 ${
                  feat.color === 'amber' ? 'bg-amber-100 text-amber-600' :
                  feat.color === 'blue' ? 'bg-blue-100 text-blue-600' :
                  feat.color === 'orange' ? 'bg-orange-100 text-orange-600' :
                  'bg-pink-100 text-pink-600'
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
              { icon: QrCode, text: 'QR Code exclusivo para as mesas' },
              { icon: Smartphone, text: 'Funciona no celular, tablet e PC' },
              { icon: Sparkles, text: 'Vouchers automáticos sem trabalho' },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-3 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3.5">
                <item.icon className="w-5 h-5 text-amber-500 shrink-0" />
                <span className="text-sm font-medium text-slate-700">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 3. Como Funciona (Passo a Passo) ── */}
      <section className="bg-gradient-to-br from-slate-50 to-amber-50/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Como funciona</h2>
            <p className="mt-3 text-slate-500">Do QR Code à notificação push em 4 passos simples.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: QrCode,
                step: 1,
                title: 'Imprima o QR Code',
                desc: 'Imprima o QR Code do Gula Feedback na mesa, comanda ou balcão do seu restaurante.',
              },
              {
                icon: Smartphone,
                step: 2,
                title: 'Cliente responde a pesquisa',
                desc: 'O cliente responde à pesquisa rápida de satisfação e insere os dados para rodar a roleta.',
              },
              {
                icon: Gift,
                step: 3,
                title: 'Cupom automático gerado',
                desc: 'O sistema gera o cupom/voucher automático via QR Code ou WhatsApp para resgate no seu cardápio.',
              },
              {
                icon: Bell,
                step: 4,
                title: 'Base de dados para Push',
                desc: 'Você ganha uma base de dados valiosa para disparar Notificações Push promocionais a qualquer momento.',
              },
            ].map((s) => (
              <div key={s.step} className="relative group">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 hover:shadow-lg hover:border-amber-200 transition-all">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
                      <s.icon className="w-5 h-5" />
                    </div>
                    <span className="text-3xl font-extrabold text-slate-200">{s.step}</span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 mb-2">{s.title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{s.desc}</p>
                </div>
                {s.step < 4 && (
                  <div className="hidden lg:flex absolute top-1/2 -right-3 -translate-y-1/2 z-10">
                    <ArrowRight className="w-5 h-5 text-amber-400" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4. Seção de Preço & Oferta ── */}
      <section className="bg-gradient-to-br from-slate-50 to-amber-50/30">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Plano Gula Feedback</h2>
            <p className="mt-3 text-slate-500">Tudo incluso, sem fidelidade, cancele quando quiser.</p>
          </div>

          <div className="relative overflow-hidden rounded-3xl bg-white border-2 border-amber-200 shadow-2xl shadow-amber-200/40 p-8 sm:p-10">
            <div className="pointer-events-none absolute -top-20 -right-20 w-64 h-64 bg-amber-100/40 rounded-full blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-20 w-64 h-64 bg-orange-100/30 rounded-full blur-3xl" />
            <div className="relative">
              <div className="flex flex-col items-center text-center">
                <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-amber-100 border border-amber-200 text-amber-700 text-xs font-bold mb-5">
                  <Sparkles className="w-3.5 h-3.5" /> Tudo incluso
                </div>

                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-5xl font-extrabold text-slate-900">R$ 29,99</span>
                  <span className="text-lg text-slate-500 font-medium">/mês</span>
                </div>
                <p className="text-sm text-slate-500 mb-6">Sem fidelidade • Cancele a qualquer momento</p>

                <ul className="space-y-3 text-left w-full max-w-sm mb-8">
                  {[
                    'Pesquisa de satisfação customizável (perguntas múltiplas)',
                    'Roleta de prêmios com vouchers automáticos',
                    'Captura completa de leads (nome, telefone, e-mail, aniversário)',
                    'Disparo de Notificações Push em Massa (Geral + Aniversariantes do Mês)',
                    'QR Code exclusivo para impressão nas mesas',
                    'Dashboard de métricas e relatórios em tempo real',
                  ].map((feat, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
                      <CheckCircle2 className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={startTrial}
                  className="group inline-flex items-center gap-2 text-base font-semibold px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white transition-all shadow-xl shadow-amber-500/30 hover:-translate-y-0.5 w-full max-w-xs justify-center"
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

      {/* ── 5. FAQ ── */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-16 sm:pb-20 bg-white">
        <div className="text-center mb-10 pt-16 sm:pt-20">
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

      {/* ── CTA Final ── */}
      <section className="bg-gradient-to-br from-amber-50 via-white to-orange-50/30 border-t border-slate-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center">
          <div className="inline-flex items-center gap-1.5 mb-4">
            {[1, 2, 3, 4, 5].map(i => (
              <Star key={i} className="w-5 h-5 text-amber-500 fill-amber-500" />
            ))}
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-4">
            Comece a capturar leads e fidelizar clientes hoje mesmo
          </h2>
          <p className="text-slate-500 mb-8 max-w-lg mx-auto">
            Junte-se a restaurantes que já usam o Gula Feedback para transformar opinião em vendas recorrentes.
          </p>
          <button
            onClick={startTrial}
            className="group inline-flex items-center gap-2 text-base font-semibold px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white transition-all shadow-xl shadow-amber-500/30 hover:-translate-y-0.5"
          >
            Testar Gula Feedback Grátis por 7 Dias
            <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-100 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-slate-700">Gula Feedback</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <button onClick={() => navigate('/')} className="hover:text-slate-600 transition-colors">Gula Pedidos Digital</button>
            <span>© {new Date().getFullYear()} Gula. Todos os direitos reservados.</span>
          </div>
        </div>
      </footer>

      {/* ── Roleta Demo Modal ── */}
      {showDemo && <RoletaDemo onClose={() => setShowDemo(false)} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Roleta Demo Modal
// ═══════════════════════════════════════════════════════════════════════════

const ROleta_PRIZES = [
  { label: '10% OFF', color: '#f59e0b' },
  { label: 'Coca Grátis', color: '#f97316' },
  { label: 'Brinde', color: '#ec4899' },
  { label: '5% OFF', color: '#8b5cf6' },
  { label: 'Sobremesa', color: '#10b981' },
  { label: 'Tente de novo', color: '#64748b' },
  { label: '15% OFF', color: '#f59e0b' },
  { label: 'Vale R$10', color: '#f97316' },
];

function RoletaDemo({ onClose }: { onClose: () => void }) {
  const [spinning, setSpinning] = useState(false);
  const [angle, setAngle] = useState(0);
  const [result, setResult] = useState<string | null>(null);

  function spin() {
    if (spinning) return;
    setSpinning(true);
    setResult(null);
    const fullSpins = 5 + Math.floor(Math.random() * 3);
    const prizeIndex = Math.floor(Math.random() * ROleta_PRIZES.length);
    const sliceAngle = 360 / ROleta_PRIZES.length;
    const targetAngle = fullSpins * 360 + (360 - prizeIndex * sliceAngle - sliceAngle / 2);
    setAngle(prev => prev + targetAngle - (prev % 360));
    setTimeout(() => {
      setSpinning(false);
      setResult(ROleta_PRIZES[prizeIndex].label);
    }, 4000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white border border-amber-200 rounded-3xl w-full max-w-md p-6 sm:p-8 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Gift className="w-5 h-5 text-amber-500" /> Demonstração da Roleta
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors">
            <ChevronUp className="w-5 h-5 rotate-90" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-6">
          {/* Roleta */}
          <div className="relative w-56 h-56">
            {/* Pointer */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-20 w-0 h-0 border-l-6 border-r-6 border-t-8 border-l-transparent border-r-transparent border-t-amber-500 drop-shadow-lg" />
            {/* Wheel */}
            <div
              className="w-full h-full rounded-full border-4 border-amber-300 overflow-hidden relative transition-transform"
              style={{ transform: `rotate(${angle}deg)`, transitionDuration: spinning ? '4s' : '0s', transitionTimingFunction: 'cubic-bezier(0.17, 0.67, 0.12, 0.99)' }}
            >
              {ROleta_PRIZES.map((prize, i) => {
                const sliceAngle = 360 / ROleta_PRIZES.length;
                const rotation = i * sliceAngle;
                return (
                  <div
                    key={i}
                    className="absolute top-0 left-1/2 w-1/2 h-1/2 origin-bottom-left"
                    style={{ transform: `rotate(${rotation}deg)`, background: prize.color, clipPath: 'polygon(0 0, 100% 0, 0 100%)', opacity: 0.85 }}
                  >
                    <span
                      className="absolute top-3 left-6 text-xs font-bold text-white whitespace-nowrap"
                      style={{ transform: `rotate(${sliceAngle / 2 - 90}deg)`, transformOrigin: 'left center' }}
                    >
                      {prize.label}
                    </span>
                  </div>
                );
              })}
            </div>
            {/* Center */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white border-4 border-amber-400 flex items-center justify-center z-10">
              <Sparkles className="w-5 h-5 text-amber-500" />
            </div>
          </div>

          {/* Result */}
          {result && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-6 py-4 text-center animate-in fade-in zoom-in duration-500">
              <p className="text-xs text-amber-600 mb-1">Você ganhou!</p>
              <p className="text-xl font-bold text-slate-900">{result}</p>
            </div>
          )}

          {/* Spin button */}
          <button
            onClick={spin}
            disabled={spinning}
            className="group inline-flex items-center gap-2 text-base font-semibold px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white transition-all shadow-xl shadow-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {spinning ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Girando...
              </>
            ) : (
              <>
                <Zap className="w-5 h-5" />
                Girar a Roleta
              </>
            )}
          </button>
          <p className="text-xs text-slate-400 text-center max-w-xs">
            Esta é uma demonstração interativa. No sistema real, o cliente precisa responder à pesquisa e preencher os dados antes de girar.
          </p>
        </div>
      </div>
    </div>
  );
}
