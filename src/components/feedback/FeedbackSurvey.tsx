import { useState, useEffect, useRef } from 'react';
import { Star, Check, Gift, Sparkles, User, Phone, Mail, Cake, ArrowRight, Award, Download } from 'lucide-react';
import QRCode from 'qrcode';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../lib/tenant-context';
import { FeedbackQuestion, FeedbackPrize, FeedbackVoucher } from '../../types';

type Phase = 'survey' | 'lead' | 'roulette' | 'voucher';

export default function FeedbackSurvey() {
  const { restaurant } = useTenant();
  const restaurantId = restaurant?.id ?? null;
  const [phase, setPhase] = useState<Phase>('survey');
  const [questions, setQuestions] = useState<FeedbackQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [sessionId] = useState(() => crypto.randomUUID());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Lead form
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [birthday, setBirthday] = useState('');
  const [optIn, setOptIn] = useState(false);
  const [leadId, setLeadId] = useState<string | null>(null);

  // Roulette
  const [prizes, setPrizes] = useState<FeedbackPrize[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [selectedPrize, setSelectedPrize] = useState<FeedbackPrize | null>(null);
  const [rotation, setRotation] = useState(0);
  const wheelRef = useRef<SVGSVGElement>(null);

  // Voucher
  const [voucher, setVoucher] = useState<FeedbackVoucher | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');

  useEffect(() => {
    fetchQuestions();
  }, [restaurantId]);

  async function fetchQuestions() {
    if (!restaurantId) return;
    setLoading(true);
    const { data } = await supabase
      .from('feedback_questions')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true)
      .order('sort_order');
    setQuestions((data ?? []) as FeedbackQuestion[]);
    setLoading(false);
  }

  function maskPhone(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  function handleAnswer(qId: string, value: string | string[]) {
    setAnswers(prev => ({ ...prev, [qId]: value }));
  }

  function validateSurvey(): boolean {
    for (const q of questions) {
      if (!q.is_required) continue;
      const ans = answers[q.id];
      if (!ans || (Array.isArray(ans) ? ans.length === 0 : !ans.trim())) {
        setError('Por favor, responda todas as perguntas obrigatórias.');
        return false;
      }
    }
    setError('');
    return true;
  }

  async function submitSurvey() {
    if (!validateSurvey()) return;
    setLoading(true);
    const rows = questions.map(q => ({
      restaurant_id: restaurantId,
      session_id: sessionId,
      question_id: q.id,
      answer: { value: answers[q.id] },
    }));
    await supabase.from('feedback_responses').insert(rows);
    setLoading(false);
    setPhase('lead');
  }

  async function submitLead() {
    if (!name.trim()) { setError('Informe seu nome.'); return; }
    if (!optIn) { setError('E necessario aceitar os termos para participar.'); return; }
    setError('');
    setLoading(true);
    const { data, error: err } = await supabase
      .from('feedback_leads')
      .insert({
        restaurant_id: restaurantId,
        session_id: sessionId,
        name: name.trim(),
        phone: phone || null,
        email: email || null,
        birthday: birthday || null,
        opt_in: optIn,
      })
      .select()
      .maybeSingle();
    setLoading(false);
    if (err || !data) { setError('Erro ao cadastrar. Tente novamente.'); return; }
    setLeadId(data.id);
    await fetchPrizes();
    setPhase('roulette');
  }

  async function fetchPrizes() {
    const { data } = await supabase
      .from('feedback_prizes')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true)
      .order('created_at');
    const available = (data ?? []).filter((p: FeedbackPrize) =>
      p.stock_limit === null || p.stock_used < p.stock_limit
    );
    setPrizes(available as FeedbackPrize[]);
  }

  function weightedRandom(items: FeedbackPrize[]): FeedbackPrize | null {
    if (items.length === 0) return null;
    const total = items.reduce((s, p) => s + Math.max(p.weight, 0), 0);
    if (total === 0) return items[Math.floor(Math.random() * items.length)];
    let r = Math.random() * total;
    for (const p of items) {
      r -= Math.max(p.weight, 0);
      if (r <= 0) return p;
    }
    return items[items.length - 1];
  }

  async function spinWheel() {
    if (spinning || prizes.length === 0) return;
    const winner = weightedRandom(prizes);
    if (!winner) return;

    setSpinning(true);
    const winnerIdx = prizes.indexOf(winner);
    const segmentAngle = 360 / prizes.length;
    const targetAngle = 360 * 5 + (360 - (winnerIdx * segmentAngle + segmentAngle / 2));
    setRotation(targetAngle);

    setTimeout(async () => {
      setSpinning(false);
      setSelectedPrize(winner);
      await generateVoucher(winner);
      setPhase('voucher');
    }, 4500);
  }

  async function generateVoucher(prize: FeedbackPrize) {
    const { data: settingsData } = await supabase
      .from('restaurant_settings')
      .select('feedback_voucher_validity_days')
      .eq('restaurant_id', restaurantId)
      .maybeSingle();
    const validityDays = settingsData?.feedback_voucher_validity_days ?? 30;

    const { data: codeData } = await supabase.rpc('generate_voucher_code');
    const code = (codeData as string) || Math.random().toString(36).slice(2, 8).toUpperCase();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + validityDays);

    const { data: voucherData, error: vErr } = await supabase
      .from('feedback_vouchers')
      .insert({
        restaurant_id: restaurantId,
        lead_id: leadId,
        prize_id: prize.id,
        code,
        customer_name: name,
        prize_name: prize.name,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .maybeSingle();

    if (vErr || !voucherData) { setError('Erro ao gerar voucher.'); return; }
    setVoucher(voucherData as FeedbackVoucher);

    // Increment stock_used
    await supabase
      .from('feedback_prizes')
      .update({ stock_used: prize.stock_used + 1, updated_at: new Date().toISOString() })
      .eq('id', prize.id);

    // Generate QR
    const qrUrl = await QRCode.toDataURL(code, { width: 200, margin: 1, color: { dark: '#1e293b', light: '#ffffff' } });
    setQrDataUrl(qrUrl);
  }

  async function saveVoucherJpg() {
    if (!voucher || !qrDataUrl) return;
    const canvas = document.createElement('canvas');
    const w = 400, h = 560;
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#0f2040');
    grad.addColorStop(1, '#1a3260');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Border
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.strokeRect(20, 20, w - 40, h - 40);

    // Title
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Gula Feedback', w / 2, 60);

    // Trophy emoji substitute - draw star shape
    ctx.font = '40px sans-serif';
    ctx.fillText('\u2B50', w / 2, 105);

    // Prize name
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 18px sans-serif';
    const prizeLines = wrapText(ctx, voucher.prize_name, w - 80);
    prizeLines.forEach((line, i) => ctx.fillText(line, w / 2, 145 + i * 24));

    // QR code
    const img = new Image();
    img.src = qrDataUrl;
    await new Promise(res => { img.onload = res; });
    const qrSize = 180;
    ctx.drawImage(img, (w - qrSize) / 2, 160 + prizeLines.length * 24 + 10, qrSize, qrSize);

    const infoY = 160 + prizeLines.length * 24 + 10 + qrSize + 25;

    // Code
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('Codigo do Voucher', w / 2, infoY);
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 28px monospace';
    ctx.fillText(voucher.code, w / 2, infoY + 32);

    // Customer
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '14px sans-serif';
    ctx.fillText(`Cliente: ${voucher.customer_name ?? ''}`, w / 2, infoY + 65);

    // Expiry
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText(`Valido ate: ${new Date(voucher.expires_at).toLocaleDateString('pt-BR')}`, w / 2, infoY + 90);

    // Footer
    ctx.fillStyle = '#64748b';
    ctx.font = '11px sans-serif';
    ctx.fillText('Apresente este voucher no balcao para retirar seu brinde', w / 2, h - 35);

    const link = document.createElement('a');
    link.download = `voucher-${voucher.code}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.95);
    link.click();
  }

  function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word; }
      else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }

  // ── Loading ─────────────────────────────────────────────────────────
  if (loading && phase === 'survey' && questions.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  // ── No questions ────────────────────────────────────────────────────
  if (phase === 'survey' && questions.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-6 text-center">
        <Star className="w-12 h-12 text-slate-700 mb-4" />
        <p className="text-slate-400 text-sm">A pesquisa de satisfacao ainda nao esta configurada.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col max-w-lg mx-auto">
      {/* Header */}
      <header className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-5 text-center">
        <h1 className="text-white font-black text-xl flex items-center justify-center gap-2">
          <Sparkles className="w-5 h-5" /> Gula Feedback
        </h1>
        <p className="text-white/80 text-xs mt-1">Pesquisa de Satisfacao + Roleta da Sorte</p>
      </header>

      {/* Progress bar */}
      <div className="flex items-center gap-1 px-6 pt-4">
        {(['survey', 'lead', 'roulette', 'voucher'] as Phase[]).map((p, i) => (
          <div key={p} className={`h-1.5 flex-1 rounded-full transition-colors ${
            (['survey', 'lead', 'roulette', 'voucher'] as Phase[]).indexOf(phase) >= i ? 'bg-amber-500' : 'bg-slate-800'
          }`} />
        ))}
      </div>

      <main className="flex-1 px-6 py-6 pb-32">
        {error && (
          <div className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2.5">
            {error}
          </div>
        )}

        {/* ── Phase: Survey ─────────────────────────────────────────── */}
        {phase === 'survey' && (
          <div className="space-y-5">
            <div className="text-center mb-2">
              <h2 className="text-white font-bold text-lg">Conte-nos sobre sua experiencia</h2>
              <p className="text-slate-500 text-xs mt-1">Sua opiniao e muito importante para nós</p>
            </div>
            {questions.map((q, qi) => (
              <div key={q.id} className="bg-slate-900 rounded-2xl border border-slate-800 p-4">
                <p className="text-white text-sm font-semibold mb-3">
                  {qi + 1}. {q.question_text}
                  {q.is_required && <span className="text-amber-400 ml-1">*</span>}
                </p>
                {q.question_type === 'text' && (
                  <textarea
                    value={(answers[q.id] as string) ?? ''}
                    onChange={e => handleAnswer(q.id, e.target.value)}
                    placeholder="Digite sua resposta..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors resize-none"
                    rows={3}
                  />
                )}
                {q.question_type === 'single' && (
                  <div className="space-y-2">
                    {q.options.map((opt, oi) => (
                      <button
                        key={oi}
                        onClick={() => handleAnswer(q.id, opt)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm transition-all ${
                          answers[q.id] === opt
                            ? 'border-amber-500 bg-amber-500/10 text-amber-300'
                            : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full border-2 shrink-0 ${
                          answers[q.id] === opt ? 'border-amber-500 bg-amber-500' : 'border-slate-600'
                        }`}>
                          {answers[q.id] === opt && <div className="w-full h-full rounded-full bg-white scale-50" />}
                        </div>
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
                {q.question_type === 'multiple' && (
                  <div className="space-y-2">
                    {q.options.map((opt, oi) => {
                      const selected = ((answers[q.id] as string[]) ?? []).includes(opt);
                      return (
                        <button
                          key={oi}
                          onClick={() => {
                            const prev = (answers[q.id] as string[]) ?? [];
                            handleAnswer(q.id, selected ? prev.filter(o => o !== opt) : [...prev, opt]);
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm transition-all ${
                            selected
                              ? 'border-amber-500 bg-amber-500/10 text-amber-300'
                              : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center ${
                            selected ? 'border-amber-500 bg-amber-500' : 'border-slate-600'
                          }`}>
                            {selected && <Check className="w-3 h-3 text-black" />}
                          </div>
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
            <button
              onClick={submitSurvey}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black font-bold py-3.5 rounded-xl transition-colors"
            >
              Continuar <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── Phase: Lead ───────────────────────────────────────────── */}
        {phase === 'lead' && (
          <div className="space-y-5">
            <div className="text-center mb-2">
              <User className="w-10 h-10 text-amber-400 mx-auto mb-2" />
              <h2 className="text-white font-bold text-lg">Cadastre-se para ganhar</h2>
              <p className="text-slate-500 text-xs mt-1">Preencha seus dados e concorra aos brindes</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Nome completo *</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors" placeholder="Seu nome" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Telefone (WhatsApp)</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input value={phone} onChange={e => setPhone(maskPhone(e.target.value))} className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors" placeholder="(11) 99999-9999" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">E-mail</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors" placeholder="seu@email.com" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Data de Aniversario</label>
                <div className="relative">
                  <Cake className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input type="date" value={birthday} onChange={e => setBirthday(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors" />
                </div>
              </div>
              <button
                onClick={() => setOptIn(!optIn)}
                className={`w-full flex items-start gap-3 px-3 py-3 rounded-xl border text-xs transition-all text-left ${
                  optIn ? 'border-amber-500 bg-amber-500/10 text-amber-300' : 'border-slate-700 bg-slate-800 text-slate-400'
                }`}
              >
                <div className={`w-4 h-4 rounded border-2 shrink-0 mt-0.5 flex items-center justify-center ${optIn ? 'border-amber-500 bg-amber-500' : 'border-slate-600'}`}>
                  {optIn && <Check className="w-3 h-3 text-black" />}
                </div>
                <span>Aceito receber mensagens, ofertas e notificacoes do restaurante por WhatsApp, e-mail e notificacoes push. *</span>
              </button>
            </div>
            <button
              onClick={submitLead}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black font-bold py-3.5 rounded-xl transition-colors"
            >
              {loading ? 'Salvando...' : 'Ir para a Roleta'} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── Phase: Roulette ───────────────────────────────────────── */}
        {phase === 'roulette' && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="text-center mb-6">
              <Gift className="w-12 h-12 text-amber-400 mx-auto mb-3" />
              <h2 className="text-white font-bold text-lg">Roleta da Sorte!</h2>
              <p className="text-slate-500 text-xs mt-1">Gire a roleta e descubra seu brinde</p>
            </div>

            {prizes.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-8">Nenhum brinde disponivel no momento.</p>
            ) : (
              <>
                {/* SVG Wheel */}
                <div className="relative w-72 h-72 mb-6">
                  <svg
                    ref={wheelRef}
                    viewBox="0 0 200 200"
                    className="w-full h-full"
                    style={{ transform: `rotate(${rotation}deg)`, transition: spinning ? 'transform 4.5s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none' }}
                  >
                    {prizes.map((prize, i) => {
                      const segmentAngle = 360 / prizes.length;
                      const startAngle = i * segmentAngle - 90;
                      const endAngle = startAngle + segmentAngle;
                      const startRad = (startAngle * Math.PI) / 180;
                      const endRad = (endAngle * Math.PI) / 180;
                      const x1 = 100 + 95 * Math.cos(startRad);
                      const y1 = 100 + 95 * Math.sin(startRad);
                      const x2 = 100 + 95 * Math.cos(endRad);
                      const y2 = 100 + 95 * Math.sin(endRad);
                      const largeArc = segmentAngle > 180 ? 1 : 0;
                      const colors = ['#f59e0b', '#fb923c', '#f97316', '#ea580c', '#f59e0b', '#fb923c', '#f97316', '#ea580c'];
                      const midAngle = startAngle + segmentAngle / 2;
                      const midRad = (midAngle * Math.PI) / 180;
                      const tx = 100 + 55 * Math.cos(midRad);
                      const ty = 100 + 55 * Math.sin(midRad);
                      return (
                        <g key={prize.id}>
                          <path
                            d={`M 100 100 L ${x1} ${y1} A 95 95 0 ${largeArc} 1 ${x2} ${y2} Z`}
                            fill={colors[i % colors.length]}
                            stroke="#1e293b"
                            strokeWidth="1"
                          />
                          <text
                            x={tx} y={ty}
                            fill="#1e293b"
                            fontSize="7"
                            fontWeight="bold"
                            textAnchor="middle"
                            transform={`rotate(${midAngle + 90}, ${tx}, ${ty})`}
                          >
                            {prize.name.length > 18 ? prize.name.slice(0, 16) + '...' : prize.name}
                          </text>
                        </g>
                      );
                    })}
                    <circle cx="100" cy="100" r="95" fill="none" stroke="#1e293b" strokeWidth="3" />
                    <circle cx="100" cy="100" r="12" fill="#1e293b" stroke="#f59e0b" strokeWidth="2" />
                  </svg>
                  {/* Pointer */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-10">
                    <div className="w-0 h-0 border-l-[10px] border-r-[10px] border-t-[18px] border-l-transparent border-r-transparent border-t-amber-400 drop-shadow-lg" />
                  </div>
                </div>

                <button
                  onClick={spinWheel}
                  disabled={spinning}
                  className="px-8 py-3.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black font-bold rounded-xl transition-colors text-sm"
                >
                  {spinning ? 'Girando...' : 'GIRAR A ROLETA'}
                </button>
              </>
            )}
          </div>
        )}

        {/* ── Phase: Voucher ────────────────────────────────────────── */}
        {phase === 'voucher' && voucher && (
          <div className="flex flex-col items-center py-4">
            <Award className="w-14 h-14 text-amber-400 mx-auto mb-3" />
            <h2 className="text-white font-bold text-lg mb-1">Parabens, {name.split(' ')[0]}!</h2>
            <p className="text-slate-400 text-sm mb-5">Voce ganhou:</p>

            <div className="w-full bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-2 border-amber-500/40 rounded-2xl p-6 text-center">
              <p className="text-amber-300 font-black text-lg mb-1">{voucher.prize_name}</p>
              <div className="bg-white rounded-xl p-3 inline-block my-4">
                {qrDataUrl && <img src={qrDataUrl} alt="QR Voucher" className="w-32 h-32" />}
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-xs text-slate-400">Codigo:</span>
                  <span className="text-amber-400 font-mono font-bold text-lg tracking-wider">{voucher.code}</span>
                </div>
                <p className="text-xs text-slate-400">Cliente: {voucher.customer_name}</p>
                <p className="text-xs text-slate-400">
                  Valido ate: {new Date(voucher.expires_at).toLocaleDateString('pt-BR')}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-500 mt-5 text-center max-w-xs">
              Apresente este voucher no balcao para retirar seu brinde. Guarde o codigo!
            </p>

            <button
              onClick={saveVoucherJpg}
              className="mt-6 flex items-center gap-2 px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold rounded-xl transition-colors"
            >
              <Download className="w-4 h-4" /> Salvar Voucher (JPG)
            </button>
            <button
              onClick={() => window.location.reload()}
              className="mt-3 px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-xl transition-colors"
            >
              Fazer nova pesquisa
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
