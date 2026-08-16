import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck, Clock, Printer, Bot, Smartphone, ArrowRight, CheckCircle2,
  XCircle, Tag, AlertTriangle, QrCode, Bell, Sparkles, ChevronDown, ChevronUp,
} from 'lucide-react';

const FAQ_ITEMS = [
  { q: 'Preciso de algum equipamento especial?', a: 'Apenas uma impressora térmica de etiquetas (Epson, Elgin, Zebra ou similar). O sistema funciona no navegador do celular ou computador, sem instalação.' },
  { q: 'Como funciona o cálculo de validade automático?', a: 'Você informa o produto (ex: arroz cozido) e a IA consulta as normas da ANVISA e Resolução RDC 216/2004 para calcular o prazo exato de validade, preenchendo a etiqueta automaticamente.' },
  { q: 'Posso usar sem o sistema de pedidos?', a: 'Sim! O Gula Etiquetas é um módulo independente. Você não precisa contratar o cardápio digital nem nenhum outro módulo.' },
  { q: 'O que acontece após os 7 dias de teste?', a: 'Você escolhe um plano (mensal, semestral ou anual) e continua usando. Sem multa, sem fidelidade — cancele quando quiser.' },
  { q: 'A IA realmente conhece as normas sanitárias?', a: 'Sim. A IA foi treinada com base na legislação sanitária brasileira (ANVISA, RDC 216, portarias estaduais) e calcula prazos conforme o tipo de alimento manipulado.' },
];

export default function EtiquetasLanding() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    document.title = 'Gula Etiquetas — Validade Automática e Etiquetas Térmicas';
  }, []);

  function startTrial() {
    navigate('/cadastrar?plan=gula_etiquetas_standalone');
  }

  function scrollToFeatures() {
    document.getElementById('recursos')?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <div className="min-h-screen bg-white">
      {/* ── Minimal header ── */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md shadow-emerald-500/20">
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
            <button onClick={startTrial} className="text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 px-4 py-2 rounded-xl transition-all shadow-md shadow-emerald-500/20">
              Testar Grátis
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-teal-50">
        <div className="pointer-events-none absolute -top-40 -right-40 w-96 h-96 bg-emerald-200/30 rounded-full blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-40 w-96 h-96 bg-teal-200/30 rounded-full blur-3xl" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
          <div className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-full px-4 py-1.5 text-xs font-semibold mb-6">
            <ShieldCheck className="w-3.5 h-3.5" /> Conformidade com ANVISA e Vigilância Sanitária
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
            Sua cozinha 100% livre de multas da Vigilância Sanitária e sem desperdício de insumos.
          </h1>
          <p className="mt-6 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            O sistema inteligente que calcula a validade automática de alimentos manipulados, imprime etiquetas térmicas em segundos e controla seu estoque na palma da mão.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={startTrial}
              className="group inline-flex items-center gap-2 text-base font-semibold px-7 py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white transition-all shadow-xl shadow-emerald-500/30 hover:-translate-y-0.5"
            >
              Testar 7 Dias Grátis
              <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
            </button>
            <button
              onClick={scrollToFeatures}
              className="inline-flex items-center gap-2 text-base font-semibold px-7 py-4 rounded-2xl bg-white border-2 border-slate-200 hover:border-emerald-300 text-slate-700 hover:text-emerald-700 transition-all"
            >
              Ver Como Funciona
            </button>
          </div>
          <p className="mt-4 text-xs text-slate-400">Sem cartão de crédito · Cancele quando quiser · Setup em 5 minutos</p>
        </div>
      </section>

      {/* ── Antes vs Depois ── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">A diferença que protege seu negócio</h2>
          <p className="mt-3 text-slate-500">Veja como o Gula Etiquetas transforma a rotina da sua cozinha.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {/* ANTES */}
          <div className="relative rounded-3xl border-2 border-red-200 bg-gradient-to-br from-red-50 via-white to-orange-50 p-6 sm:p-8">
            <div className="absolute -top-3.5 left-6">
              <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-red-500 text-white text-xs font-bold shadow-md">
                <XCircle className="w-3.5 h-3.5" /> Sem Gula Etiquetas
              </span>
            </div>
            <ul className="mt-4 space-y-4">
              {[
                { icon: AlertTriangle, text: 'Caneta borrada e ilegível nas embalagens' },
                { icon: AlertTriangle, text: 'Fita crepe soltando e caindo no balcão' },
                { icon: AlertTriangle, text: 'Dúvida constante sobre o prazo correto da ANVISA' },
                { icon: AlertTriangle, text: 'Risco real de autuação e multa da Vigilância' },
                { icon: AlertTriangle, text: 'Alimentos jogados no lixo por incerteza da validade' },
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-slate-700">
                  <item.icon className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <span>{item.text}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* DEPOIS */}
          <div className="relative rounded-3xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-6 sm:p-8 shadow-lg shadow-emerald-200/40">
            <div className="absolute -top-3.5 left-6">
              <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-bold shadow-md">
                <CheckCircle2 className="w-3.5 h-3.5" /> Com Gula Etiquetas
              </span>
            </div>
            <ul className="mt-4 space-y-4">
              {[
                { icon: CheckCircle2, text: 'Etiquetas térmicas padronizadas e sempre legíveis' },
                { icon: CheckCircle2, text: 'Cálculo automático de validade por IA em segundos' },
                { icon: CheckCircle2, text: 'Histórico completo acessível via QR Code' },
                { icon: CheckCircle2, text: 'Alerta de vencimento no celular antes de perder' },
                { icon: CheckCircle2, text: 'Cozinha em conformidade, sem multas e sem desperdício' },
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-slate-700">
                  <item.icon className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <span>{item.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Recursos ── */}
      <section id="recursos" className="bg-gradient-to-br from-slate-50 to-emerald-50/50 scroll-mt-20">
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
                desc: 'Diferenciação instantânea entre produtos manipulados e industrializados abertos. A IA calcula o prazo correto conforme a legislação.',
                color: 'emerald',
              },
              {
                icon: Printer,
                title: 'Conexão Térmica',
                desc: 'Suporte a impressoras de etiquetas térmicas: Epson, Elgin, Zebra e modelos genéricos. Imprima em segundos direto do navegador.',
                color: 'blue',
              },
              {
                icon: Bot,
                title: 'IA Especialista ANVISA',
                desc: 'Tira dúvidas sobre prazos sanitários e normas de manipulação direto no app. Não fica mais na incerteza na hora de etiquetar.',
                color: 'amber',
              },
              {
                icon: Smartphone,
                title: 'Gestão de Estoque no Celular',
                desc: 'Veja o que vence hoje e amanhã para priorizar o uso no salão e cozinha. Alertas no celular antes do vencimento.',
                color: 'teal',
              },
            ].map((feat) => (
              <div
                key={feat.title}
                className="group rounded-2xl border border-slate-200 bg-white p-6 sm:p-7 hover:shadow-xl hover:border-emerald-200 transition-all hover:-translate-y-1"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 ${
                  feat.color === 'emerald' ? 'bg-emerald-100 text-emerald-600' :
                  feat.color === 'blue' ? 'bg-blue-100 text-blue-600' :
                  feat.color === 'amber' ? 'bg-amber-100 text-amber-600' :
                  'bg-teal-100 text-teal-600'
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
              { icon: Bell, text: 'Alerta de vencimento no celular' },
              { icon: Sparkles, text: 'IA com 10 consultas diárias grátis' },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-3 rounded-xl bg-white border border-slate-200 px-4 py-3.5">
                <item.icon className="w-5 h-5 text-emerald-500 shrink-0" />
                <span className="text-sm font-medium text-slate-700">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing CTA ── */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 p-8 sm:p-12 text-center text-white shadow-2xl shadow-emerald-600/30">
          <div className="pointer-events-none absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-20 w-64 h-64 bg-teal-400/20 rounded-full blur-3xl" />
          <div className="relative">
            <ShieldCheck className="w-10 h-10 text-emerald-200 mx-auto mb-4" />
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">Pronto para ficar em dia com a Vigilância?</h2>
            <p className="text-emerald-50 max-w-md mx-auto mb-7">
              Comece hoje com 7 dias grátis. Sem cartão de crédito, sem compromisso.
            </p>
            <button
              onClick={startTrial}
              className="group inline-flex items-center gap-2 text-base font-semibold px-8 py-4 rounded-2xl bg-white hover:bg-slate-50 text-emerald-700 transition-all shadow-xl hover:-translate-y-0.5"
            >
              Testar 7 Dias Grátis
              <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
            </button>
            <p className="mt-4 text-xs text-emerald-200">Acesso imediato · Setup em 5 minutos · Cancele quando quiser</p>
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
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
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
