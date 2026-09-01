import { useState, useEffect } from 'react';
import { MessageSquare, Gift, Ticket, Users, BarChart3, Plus, Trash2, Edit2, Check, X, Search, Award, TrendingUp, Send, QrCode, Download } from 'lucide-react';
import QRCode from 'qrcode';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../lib/tenant-context';
import { FeedbackQuestion, FeedbackPrize, FeedbackVoucher, FeedbackLead, FeedbackQuestionType } from '../../types';

type SubTab = 'questions' | 'prizes' | 'validator' | 'metrics' | 'leads';

const inputCls = 'w-full bg-[#1a3260] border border-[#1e3868] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors';

export default function FeedbackTab() {
  const { restaurant } = useTenant();
  const restaurantId = restaurant?.id ?? null;
  const [subTab, setSubTab] = useState<SubTab>('questions');

  return (
    <div className="p-3 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Gula Feedback</h2>
        <p className="text-slate-400 text-sm mt-1">Pesquisa de satisfacao, roleta de premios e captacao de leads.</p>
      </div>

      {/* Sub-tab navigation */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {([
          { id: 'questions' as SubTab, label: 'Perguntas', icon: MessageSquare },
          { id: 'prizes' as SubTab, label: 'Brindes & Roleta', icon: Gift },
          { id: 'validator' as SubTab, label: 'Validar Vouchers', icon: Ticket },
          { id: 'metrics' as SubTab, label: 'Metricas', icon: BarChart3 },
          { id: 'leads' as SubTab, label: 'Leads', icon: Users },
        ]).map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
              subTab === t.id ? 'bg-amber-500 text-black' : 'bg-[#1a3260] text-slate-400 hover:text-white hover:bg-[#2a4d9a]'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {subTab === 'questions' && <QuestionsManager restaurantId={restaurantId} />}
      {subTab === 'prizes' && <PrizesManager restaurantId={restaurantId} />}
      {subTab === 'validator' && <VoucherValidator restaurantId={restaurantId} />}
      {subTab === 'metrics' && <MetricsView restaurantId={restaurantId} />}
      {subTab === 'leads' && <LeadsManager restaurantId={restaurantId} />}
    </div>
  );
}

// ── Questions Manager ───────────────────────────────────────────────────
function QuestionsManager({ restaurantId }: { restaurantId: string | null }) {
  const [questions, setQuestions] = useState<FeedbackQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<FeedbackQuestion | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { fetchQuestions(); }, [restaurantId]);

  async function fetchQuestions() {
    if (!restaurantId) return;
    setLoading(true);
    const { data } = await supabase
      .from('feedback_questions')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('sort_order');
    setQuestions((data ?? []) as FeedbackQuestion[]);
    setLoading(false);
  }

  async function toggleActive(q: FeedbackQuestion) {
    await supabase.from('feedback_questions').update({ is_active: !q.is_active, updated_at: new Date().toISOString() }).eq('id', q.id);
    fetchQuestions();
  }

  async function deleteQuestion(id: string) {
    await supabase.from('feedback_questions').delete().eq('id', id);
    fetchQuestions();
  }

  async function reorder(q: FeedbackQuestion, dir: -1 | 1) {
    const idx = questions.indexOf(q);
    const swap = questions[idx + dir];
    if (!swap) return;
    await Promise.all([
      supabase.from('feedback_questions').update({ sort_order: swap.sort_order, updated_at: new Date().toISOString() }).eq('id', q.id),
      supabase.from('feedback_questions').update({ sort_order: q.sort_order, updated_at: new Date().toISOString() }).eq('id', swap.id),
    ]);
    fetchQuestions();
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold text-sm">Perguntas da Pesquisa</h3>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-1.5 text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 px-3 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Nova Pergunta
        </button>
      </div>

      {showForm && (
        <QuestionForm
          restaurantId={restaurantId}
          question={editing}
          sortOrder={questions.length}
          onSave={() => { setShowForm(false); fetchQuestions(); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {questions.length === 0 && !showForm && (
        <EmptyState icon={MessageSquare} text="Nenhuma pergunta cadastrada. Crie a primeira pergunta da pesquisa." />
      )}

      <div className="space-y-2">
        {questions.map((q, i) => (
          <div key={q.id} className={`bg-[#0f2040] border border-[#1e3868] rounded-xl p-4 ${!q.is_active ? 'opacity-50' : ''}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-slate-500 font-mono">#{i + 1}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[#1a3260] text-slate-400">
                    {q.question_type === 'single' ? 'Unica escolha' : q.question_type === 'multiple' ? 'Multipla escolha' : 'Dissertativa'}
                  </span>
                  {q.is_required && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">Obrigatoria</span>}
                </div>
                <p className="text-white text-sm font-medium">{q.question_text}</p>
                {q.options.length > 0 && (
                  <p className="text-xs text-slate-500 mt-1">Opcoes: {q.options.join(' / ')}</p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => reorder(q, -1)} disabled={i === 0} className="p-1.5 text-slate-500 hover:text-white disabled:opacity-30 transition-colors">
                  <span className="text-xs font-bold">↑</span>
                </button>
                <button onClick={() => reorder(q, 1)} disabled={i === questions.length - 1} className="p-1.5 text-slate-500 hover:text-white disabled:opacity-30 transition-colors">
                  <span className="text-xs font-bold">↓</span>
                </button>
                <button onClick={() => toggleActive(q)} className="p-1.5 text-slate-500 hover:text-amber-400 transition-colors" title={q.is_active ? 'Desativar' : 'Ativar'}>
                  {q.is_active ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => { setEditing(q); setShowForm(true); }} className="p-1.5 text-slate-500 hover:text-amber-400 transition-colors">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => deleteQuestion(q.id)} className="p-1.5 text-slate-500 hover:text-red-400 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuestionForm({ restaurantId, question, sortOrder, onSave, onCancel }: {
  restaurantId: string | null;
  question: FeedbackQuestion | null;
  sortOrder: number;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(question?.question_text ?? '');
  const [type, setType] = useState<FeedbackQuestionType>(question?.question_type ?? 'single');
  const [options, setOptions] = useState<string[]>(question?.options ?? ['', '']);
  const [required, setRequired] = useState(question?.is_required ?? true);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!text.trim()) return;
    setSaving(true);
    const payload = {
      restaurant_id: restaurantId,
      question_text: text.trim(),
      question_type: type,
      options: type === 'text' ? [] : options.filter(o => o.trim()),
      is_required: required,
      is_active: true,
      sort_order: question?.sort_order ?? sortOrder,
      updated_at: new Date().toISOString(),
    };
    if (question?.id) {
      await supabase.from('feedback_questions').update(payload).eq('id', question.id);
    } else {
      await supabase.from('feedback_questions').insert(payload);
    }
    setSaving(false);
    onSave();
  }

  return (
    <div className="bg-[#0f2040] border border-amber-500/30 rounded-2xl p-5 space-y-4">
      <div>
        <label className="block text-xs text-slate-400 mb-1.5">Texto da Pergunta *</label>
        <input value={text} onChange={e => setText(e.target.value)} className={inputCls} placeholder="Ex: Como voce avalia o atendimento?" />
      </div>
      <div>
        <label className="block text-xs text-slate-400 mb-1.5">Tipo de Resposta</label>
        <div className="flex gap-2">
          {([
            { v: 'single' as const, l: 'Unica escolha' },
            { v: 'multiple' as const, l: 'Multipla escolha' },
            { v: 'text' as const, l: 'Dissertativa' },
          ]).map(t => (
            <button key={t.v} onClick={() => setType(t.v)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-medium border-2 transition-all ${
                type === t.v ? 'border-amber-500 bg-amber-500/10 text-amber-300' : 'border-[#1e3868] bg-[#1a3260] text-slate-400'
              }`}>
              {t.l}
            </button>
          ))}
        </div>
      </div>
      {(type === 'single' || type === 'multiple') && (
        <div className="space-y-2">
          <label className="block text-xs text-slate-400 mb-1.5">Opcoes de Resposta</label>
          {options.map((opt, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={opt}
                onChange={e => setOptions(prev => prev.map((o, idx) => idx === i ? e.target.value : o))}
                className={inputCls}
                placeholder={`Opcao ${i + 1}`}
              />
              {options.length > 2 && (
                <button onClick={() => setOptions(prev => prev.filter((_, idx) => idx !== i))} className="w-9 h-9 flex items-center justify-center text-slate-500 hover:text-red-400 bg-[#1a3260] border border-[#1e3868] rounded-xl transition-colors shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
          <button onClick={() => setOptions(prev => [...prev, ''])} className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Adicionar opcao
          </button>
        </div>
      )}
      <button onClick={() => setRequired(!required)}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs transition-all ${
          required ? 'border-amber-500 bg-amber-500/10 text-amber-300' : 'border-[#1e3868] bg-[#1a3260] text-slate-400'
        }`}>
        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${required ? 'border-amber-500 bg-amber-500' : 'border-slate-600'}`}>
          {required && <Check className="w-3 h-3 text-black" />}
        </div>
        Pergunta obrigatoria
      </button>
      <div className="flex gap-3 pt-2">
        <button onClick={onCancel} className="flex-1 bg-[#1a3260] hover:bg-[#2a4d9a] text-white py-2.5 rounded-xl text-sm font-medium transition-colors">Cancelar</button>
        <button onClick={save} disabled={saving || !text.trim()} className="flex-1 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black py-2.5 rounded-xl text-sm font-semibold transition-colors">
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}

// ── Prizes Manager ──────────────────────────────────────────────────────
function PrizesManager({ restaurantId }: { restaurantId: string | null }) {
  const { restaurant } = useTenant();
  const [prizes, setPrizes] = useState<FeedbackPrize[]>([]);
  const [loading, setLoading] = useState(true);
  const [validityDays, setValidityDays] = useState(30);
  const [enabled, setEnabled] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<FeedbackPrize | null>(null);
  const [surveyQrUrl, setSurveyQrUrl] = useState('');

  useEffect(() => { fetchPrizes(); fetchSettings(); }, [restaurantId]);

  async function fetchPrizes() {
    if (!restaurantId) return;
    setLoading(true);
    const { data } = await supabase.from('feedback_prizes').select('*').eq('restaurant_id', restaurantId).order('created_at');
    setPrizes((data ?? []) as FeedbackPrize[]);
    setLoading(false);
  }

  async function fetchSettings() {
    if (!restaurantId) return;
    const { data } = await supabase
      .from('restaurant_settings')
      .select('feedback_enabled, feedback_voucher_validity_days')
      .eq('restaurant_id', restaurantId)
      .maybeSingle();
    if (data) {
      setEnabled(data.feedback_enabled ?? false);
      setValidityDays(data.feedback_voucher_validity_days ?? 30);
    }
  }

  async function saveSettings() {
    await supabase
      .from('restaurant_settings')
      .update({ feedback_enabled: enabled, feedback_voucher_validity_days: validityDays, updated_at: new Date().toISOString() })
      .eq('restaurant_id', restaurantId);
  }

  async function generateSurveyQR() {
    const url = `${window.location.origin}/${restaurant?.slug ?? ''}/feedback`;
    const dataUrl = await QRCode.toDataURL(url, { width: 300, margin: 2, color: { dark: '#1e293b', light: '#ffffff' } });
    setSurveyQrUrl(dataUrl);
  }

  async function downloadSurveyQR() {
    if (!surveyQrUrl) return;
    const canvas = document.createElement('canvas');
    const size = 400;
    canvas.width = size; canvas.height = size + 120;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const img = new Image();
    img.src = surveyQrUrl;
    await new Promise(res => { img.onload = res; });
    const qrSize = size - 40;
    ctx.drawImage(img, 20, 20, qrSize, qrSize);
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Pesquisa de Satisfacao', canvas.width / 2, size + 72);
    ctx.fillStyle = '#64748b';
    ctx.font = '16px sans-serif';
    ctx.fillText('Escaneie e participe da Roleta da Sorte!', canvas.width / 2, size + 100);
    const link = document.createElement('a');
    link.download = 'qr-pesquisa-feedback.jpg';
    link.href = canvas.toDataURL('image/jpeg', 0.95);
    link.click();
  }

  async function toggleActive(p: FeedbackPrize) {
    await supabase.from('feedback_prizes').update({ is_active: !p.is_active, updated_at: new Date().toISOString() }).eq('id', p.id);
    fetchPrizes();
  }

  async function deletePrize(id: string) {
    await supabase.from('feedback_prizes').delete().eq('id', id);
    fetchPrizes();
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-5">
      {/* Module toggle */}
      <div className="bg-[#0f2040] rounded-2xl p-5 border border-[#1e3868] space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-semibold text-sm">Modulo Feedback Ativo</h3>
            <p className="text-xs text-slate-500 mt-0.5">{enabled ? 'Pesquisa disponivel para clientes' : 'Pesquisa desativada'}</p>
          </div>
          <button onClick={() => { setEnabled(!enabled); setTimeout(saveSettings, 100); }}
            className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${enabled ? 'bg-amber-500' : 'bg-[#1e3868]'}`}>
            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
          </button>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-400">Validade padrao dos vouchers (dias):</label>
          <input type="number" min={1} max={365} value={validityDays} onChange={e => setValidityDays(parseInt(e.target.value) || 30)}
            className={`${inputCls} w-24`} onBlur={saveSettings} />
        </div>
        <div className="bg-[#1a3260]/60 border border-[#1e3868] rounded-xl p-3">
          <p className="text-xs text-slate-400 mb-1">URL da Pesquisa (QR Code):</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-amber-400 text-sm bg-[#0f2040] border border-[#1e3868] rounded-lg px-3 py-2 truncate select-all">
              {window.location.origin}/{restaurant?.slug ?? ''}/feedback
            </code>
            <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/${restaurant?.slug ?? ''}/feedback`)}
              title="Copiar"
              className="shrink-0 p-2.5 bg-[#1e3868] hover:bg-slate-600 text-slate-300 hover:text-white rounded-lg transition-colors text-xs">
              Copiar
            </button>
            <button onClick={generateSurveyQR}
              title="Gerar QR Code"
              className="shrink-0 p-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-lg transition-colors">
              <QrCode className="w-4 h-4" />
            </button>
          </div>
          {surveyQrUrl && (
            <div className="mt-3 flex flex-col items-center gap-2 bg-[#0f2040] rounded-xl p-4">
              <img src={surveyQrUrl} alt="QR Code Pesquisa" className="w-40 h-40" />
              <button onClick={downloadSurveyQR}
                className="flex items-center gap-1.5 text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 px-3 py-1.5 rounded-lg transition-colors">
                <Download className="w-3.5 h-3.5" /> Baixar JPG
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Prizes list */}
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold text-sm">Brindes da Roleta</h3>
        <button onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-1.5 text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 px-3 py-2 rounded-lg transition-colors">
          <Plus className="w-3.5 h-3.5" /> Novo Brinde
        </button>
      </div>

      {showForm && (
        <PrizeForm restaurantId={restaurantId} prize={editing}
          onSave={() => { setShowForm(false); fetchPrizes(); }}
          onCancel={() => setShowForm(false)} />
      )}

      {prizes.length === 0 && !showForm && (
        <EmptyState icon={Gift} text="Nenhum brinde cadastrado. Adicione brindes para a roleta da sorte." />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {prizes.map(p => {
          const totalWeight = prizes.reduce((s, pr) => s + Math.max(pr.weight, 0), 0);
          const prob = totalWeight > 0 ? (Math.max(p.weight, 0) / totalWeight * 100).toFixed(1) : '0';
          const stockRemaining = p.stock_limit !== null ? Math.max(0, p.stock_limit - p.stock_used) : null;
          return (
            <div key={p.id} className={`bg-[#0f2040] border border-[#1e3868] rounded-xl p-4 ${!p.is_active ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Gift className="w-4 h-4 text-amber-400 shrink-0" />
                    <p className="text-white text-sm font-semibold truncate">{p.name}</p>
                  </div>
                  {p.description && <p className="text-xs text-slate-500 mt-0.5">{p.description}</p>}
                  <div className="flex items-center gap-3 mt-2 text-xs">
                    <span className="text-slate-400">Prob: <span className="text-amber-400 font-medium">{prob}%</span></span>
                    <span className="text-slate-400">Peso: {p.weight}</span>
                    {p.stock_limit !== null ? (
                      <span className={stockRemaining === 0 ? 'text-red-400' : 'text-slate-400'}>
                        Estoque: {stockRemaining}/{p.stock_limit}
                      </span>
                    ) : (
                      <span className="text-slate-400">Estoque: ilimitado</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => toggleActive(p)} className="p-1.5 text-slate-500 hover:text-amber-400 transition-colors">
                    {p.is_active ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={() => { setEditing(p); setShowForm(true); }} className="p-1.5 text-slate-500 hover:text-amber-400 transition-colors">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => deletePrize(p.id)} className="p-1.5 text-slate-500 hover:text-red-400 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PrizeForm({ restaurantId, prize, onSave, onCancel }: {
  restaurantId: string | null;
  prize: FeedbackPrize | null;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(prize?.name ?? '');
  const [description, setDescription] = useState(prize?.description ?? '');
  const [weight, setWeight] = useState(prize?.weight ?? 1);
  const [stockLimit, setStockLimit] = useState<string>(prize?.stock_limit?.toString() ?? '');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    const payload = {
      restaurant_id: restaurantId,
      name: name.trim(),
      description: description.trim() || null,
      weight: Math.max(0, weight),
      stock_limit: stockLimit ? parseInt(stockLimit) : null,
      is_active: true,
      updated_at: new Date().toISOString(),
    };
    if (prize?.id) {
      await supabase.from('feedback_prizes').update(payload).eq('id', prize.id);
    } else {
      await supabase.from('feedback_prizes').insert(payload);
    }
    setSaving(false);
    onSave();
  }

  return (
    <div className="bg-[#0f2040] border border-amber-500/30 rounded-2xl p-5 space-y-4">
      <div>
        <label className="block text-xs text-slate-400 mb-1.5">Nome do Brinde *</label>
        <input value={name} onChange={e => setName(e.target.value)} className={inputCls} placeholder="Ex: 1 Sobremesa Gratis" />
      </div>
      <div>
        <label className="block text-xs text-slate-400 mb-1.5">Descricao (opcional)</label>
        <input value={description} onChange={e => setDescription(e.target.value)} className={inputCls} placeholder="Ex: Validade apenas para consumo no local" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Peso / Probabilidade</label>
          <input type="number" min={0} value={weight} onChange={e => setWeight(parseInt(e.target.value) || 0)} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Estoque (vazio = ilimitado)</label>
          <input type="number" min={0} value={stockLimit} onChange={e => setStockLimit(e.target.value)} className={inputCls} placeholder="Ilimitado" />
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <button onClick={onCancel} className="flex-1 bg-[#1a3260] hover:bg-[#2a4d9a] text-white py-2.5 rounded-xl text-sm font-medium transition-colors">Cancelar</button>
        <button onClick={save} disabled={saving || !name.trim()} className="flex-1 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black py-2.5 rounded-xl text-sm font-semibold transition-colors">
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}

// ── Voucher Validator ──────────────────────────────────────────────────
function VoucherValidator({ restaurantId }: { restaurantId: string | null }) {
  const [code, setCode] = useState('');
  const [result, setResult] = useState<FeedbackVoucher | null>(null);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState('');

  async function search() {
    if (!code.trim()) return;
    setSearching(true);
    setMessage('');
    setResult(null);
    const { data } = await supabase
      .from('feedback_vouchers')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .ilike('code', code.trim().toUpperCase())
      .maybeSingle();
    setSearching(false);
    if (!data) { setMessage('Voucher nao encontrado.'); return; }
    setResult(data as FeedbackVoucher);
    if (data.redeemed_at) setMessage('Este voucher ja foi utilizado.');
    else if (new Date(data.expires_at) < new Date()) setMessage('Este voucher esta expirado.');
  }

  async function redeem() {
    if (!result || result.redeemed_at) return;
    await supabase.from('feedback_vouchers').update({ redeemed_at: new Date().toISOString() }).eq('id', result.id);
    setResult({ ...result, redeemed_at: new Date().toISOString() });
    setMessage('Voucher marcado como utilizado com sucesso!');
  }

  return (
    <div className="space-y-5">
      <div className="bg-[#0f2040] rounded-2xl p-6 border border-[#1e3868] space-y-4">
        <h3 className="text-white font-semibold text-sm flex items-center gap-2">
          <Ticket className="w-4 h-4 text-amber-400" /> Validador de Vouchers
        </h3>
        <p className="text-xs text-slate-500">Digite ou escaneie o codigo do voucher do cliente para validar e marcar como utilizado.</p>
        <div className="flex gap-2">
          <input
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && search()}
            className={inputCls}
            placeholder="CODIGO DO VOUCHER"
            style={{ fontFamily: 'monospace', letterSpacing: '0.1em' }}
          />
          <button onClick={search} disabled={searching || !code.trim()}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm shrink-0">
            <Search className="w-4 h-4" /> Buscar
          </button>
        </div>
      </div>

      {message && (
        <div className={`text-sm rounded-xl px-4 py-3 border ${
          message.includes('sucesso') ? 'text-green-400 bg-green-500/10 border-green-500/30' :
          message.includes('utilizado') || message.includes('expirado') ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' :
          'text-red-400 bg-red-500/10 border-red-500/30'
        }`}>
          {message}
        </div>
      )}

      {result && (
        <div className="bg-[#0f2040] rounded-2xl p-5 border border-[#1e3868] space-y-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${result.redeemed_at ? 'bg-green-500/20' : 'bg-amber-500/20'}`}>
              <Award className={`w-5 h-5 ${result.redeemed_at ? 'text-green-400' : 'text-amber-400'}`} />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">{result.prize_name}</p>
              <p className="text-xs text-slate-500">Cliente: {result.customer_name}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-[#1a3260]/60 rounded-xl p-3">
              <p className="text-slate-500">Codigo</p>
              <p className="text-amber-400 font-mono font-bold tracking-wider">{result.code}</p>
            </div>
            <div className="bg-[#1a3260]/60 rounded-xl p-3">
              <p className="text-slate-500">Validade</p>
              <p className="text-white">{new Date(result.expires_at).toLocaleDateString('pt-BR')}</p>
            </div>
          </div>
          {result.redeemed_at ? (
            <div className="flex items-center gap-2 text-green-400 text-sm font-medium">
              <Check className="w-4 h-4" /> Utilizado em {new Date(result.redeemed_at).toLocaleDateString('pt-BR')}
            </div>
          ) : new Date(result.expires_at) < new Date() ? (
            <div className="flex items-center gap-2 text-red-400 text-sm font-medium">
              <X className="w-4 h-4" /> Voucher expirado
            </div>
          ) : (
            <button onClick={redeem}
              className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-400 text-black font-bold py-3 rounded-xl transition-colors text-sm">
              <Check className="w-4 h-4" /> Marcar como Utilizado
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Metrics ────────────────────────────────────────────────────────────
function MetricsView({ restaurantId }: { restaurantId: string | null }) {
  const [stats, setStats] = useState({ totalResponses: 0, totalLeads: 0, totalVouchers: 0, redeemedVouchers: 0, pendingVouchers: 0, expiredVouchers: 0 });
  const [questionStats, setQuestionStats] = useState<{ question: string; answers: Record<string, number>; total: number }[]>([]);
  const [dailyData, setDailyData] = useState<{ date: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchMetrics(); }, [restaurantId]);

  async function fetchMetrics() {
    if (!restaurantId) return;
    setLoading(true);

    const [respRes, leadRes, voucherRes] = await Promise.all([
      supabase.from('feedback_responses').select('*, feedback_questions(question_text, question_type, options)').eq('restaurant_id', restaurantId),
      supabase.from('feedback_leads').select('id', { count: 'exact' }).eq('restaurant_id', restaurantId),
      supabase.from('feedback_vouchers').select('id, redeemed_at').eq('restaurant_id', restaurantId),
    ]);

    const responses = respRes.data ?? [];
    const vouchers = voucherRes.data ?? [];
    const totalLeads = leadRes.count ?? 0;
    const redeemed = vouchers.filter(v => v.redeemed_at).length;
    const expired = vouchers.filter(v => !v.redeemed_at && new Date(v.expires_at) < new Date()).length;

    setStats({
      totalResponses: responses.length,
      totalLeads,
      totalVouchers: vouchers.length,
      redeemedVouchers: redeemed,
      pendingVouchers: vouchers.length - redeemed - expired,
      expiredVouchers: expired,
    });

    // Daily responses for last 14 days
    const dayMap = new Map<string, number>();
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dayMap.set(key, 0);
    }
    for (const r of responses) {
      const key = (r.created_at ?? '').slice(0, 10);
      if (dayMap.has(key)) dayMap.set(key, (dayMap.get(key) ?? 0) + 1);
    }
    setDailyData(Array.from(dayMap.entries()).map(([date, count]) => ({ date, count })));

    // Aggregate answers per question
    const byQuestion = new Map<string, { question: string; answers: Record<string, number>; total: number }>();
    for (const r of responses) {
      const q = r.feedback_questions as unknown as { question_text: string; question_type: string; options: string[] } | null;
      if (!q) continue;
      const key = r.question_id;
      if (!byQuestion.has(key)) byQuestion.set(key, { question: q.question_text, answers: {}, total: 0 });
      const entry = byQuestion.get(key)!;
      entry.total++;
      const val = (r.answer as Record<string, unknown>)?.value;
      if (Array.isArray(val)) {
        val.forEach(v => { const s = String(v); entry.answers[s] = (entry.answers[s] ?? 0) + 1; });
      } else if (val) {
        const s = String(val);
        entry.answers[s] = (entry.answers[s] ?? 0) + 1;
      }
    }
    setQuestionStats(Array.from(byQuestion.values()));
    setLoading(false);
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={MessageSquare} label="Pesquisas" value={stats.totalResponses} color="text-amber-400" />
        <StatCard icon={Users} label="Leads" value={stats.totalLeads} color="text-blue-400" />
        <StatCard icon={Ticket} label="Vouchers Gerados" value={stats.totalVouchers} color="text-green-400" />
        <StatCard icon={Award} label="Vouchers Resgatados" value={stats.redeemedVouchers} color="text-purple-400" />
      </div>

      {/* Redemption rate */}
      {stats.totalVouchers > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Donut chart */}
          <div className="bg-[#0f2040] rounded-2xl p-5 border border-[#1e3868]">
            <h3 className="text-white font-semibold text-sm flex items-center gap-2 mb-4">
              <Award className="w-4 h-4 text-amber-400" /> Status dos Vouchers
            </h3>
            <DonutChart
              segments={[
                { label: 'Resgatados', value: stats.redeemedVouchers, color: '#22c55e' },
                { label: 'Pendentes', value: stats.pendingVouchers, color: '#f59e0b' },
                { label: 'Expirados', value: stats.expiredVouchers, color: '#ef4444' },
              ]}
              total={stats.totalVouchers}
            />
          </div>

          {/* Redemption rate bar */}
          <div className="bg-[#0f2040] rounded-2xl p-5 border border-[#1e3868] flex flex-col justify-center">
            <h3 className="text-white font-semibold text-sm flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-amber-400" /> Taxa de Resgate
            </h3>
            <span className="text-amber-400 font-bold text-3xl mb-3">
              {stats.totalVouchers > 0 ? ((stats.redeemedVouchers / stats.totalVouchers) * 100).toFixed(1) : '0'}%
            </span>
            <div className="h-3 bg-slate-800 rounded-full overflow-hidden mb-2">
              <div className="h-full bg-gradient-to-r from-amber-500 to-green-500 rounded-full transition-all"
                style={{ width: `${stats.totalVouchers > 0 ? (stats.redeemedVouchers / stats.totalVouchers) * 100 : 0}%` }} />
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>{stats.redeemedVouchers} resgatados</span>
              <span>{stats.pendingVouchers} pendentes</span>
              {stats.expiredVouchers > 0 && <span>{stats.expiredVouchers} expirados</span>}
            </div>
          </div>
        </div>
      )}

      {/* Daily responses trend */}
      {dailyData.length > 0 && stats.totalResponses > 0 && (
        <div className="bg-[#0f2040] rounded-2xl p-5 border border-[#1e3868]">
          <h3 className="text-white font-semibold text-sm flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-amber-400" /> Respostas nos ultimos 14 dias
          </h3>
          <LineChart data={dailyData} />
        </div>
      )}

      {/* Per-question breakdown */}
      {questionStats.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-white font-semibold text-sm">Respostas por Pergunta</h3>
          {questionStats.map((qs, i) => {
            const sortedAnswers = Object.entries(qs.answers).sort((a, b) => b[1] - a[1]);
            const maxCount = Math.max(...sortedAnswers.map(a => a[1]), 1);
            return (
              <div key={i} className="bg-[#0f2040] rounded-2xl p-4 border border-[#1e3868]">
                <p className="text-white text-sm font-medium mb-3">{i + 1}. {qs.question}</p>
                <p className="text-xs text-slate-500 mb-2">{qs.total} resposta(s)</p>
                <div className="space-y-2">
                  {sortedAnswers.map(([answer, count]) => (
                    <div key={answer} className="flex items-center gap-3">
                      <span className="text-xs text-slate-400 w-32 truncate shrink-0">{answer}</span>
                      <div className="flex-1 h-5 bg-slate-800 rounded-lg overflow-hidden">
                        <div className="h-full bg-amber-500/60 rounded-lg flex items-center justify-end px-2 transition-all"
                          style={{ width: `${(count / maxCount) * 100}%` }}>
                          <span className="text-[10px] text-white font-bold">{count}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {stats.totalResponses === 0 && (
        <EmptyState icon={BarChart3} text="Ainda nao ha dados suficientes para exibir metricas." />
      )}
    </div>
  );
}

// ── Leads Manager ───────────────────────────────────────────────────────
function LeadsManager({ restaurantId }: { restaurantId: string | null }) {
  const [leads, setLeads] = useState<FeedbackLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMonth, setFilterMonth] = useState('');
  const [filterOptIn, setFilterOptIn] = useState(false);

  useEffect(() => { fetchLeads(); }, [restaurantId]);

  async function fetchLeads() {
    if (!restaurantId) return;
    setLoading(true);
    let q = supabase.from('feedback_leads').select('*').eq('restaurant_id', restaurantId).order('created_at', { ascending: false });
    if (filterOptIn) q = q.eq('opt_in', true);
    const { data } = await q;
    setLeads((data ?? []) as FeedbackLead[]);
    setLoading(false);
  }

  useEffect(() => { fetchLeads(); }, [filterOptIn]);

  const filtered = filterMonth
    ? leads.filter(l => l.birthday && l.birthday.slice(5) === filterMonth)
    : leads;

  const optInCount = leads.filter(l => l.opt_in).length;

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400">Aniversariantes do mes:</label>
          <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className={`${inputCls} w-40`}>
            <option value="">Todos</option>
            {['01','02','03','04','05','06','07','08','09','10','11','12'].map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <button onClick={() => setFilterOptIn(!filterOptIn)}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs transition-all ${
            filterOptIn ? 'border-amber-500 bg-amber-500/10 text-amber-300' : 'border-[#1e3868] bg-[#1a3260] text-slate-400'
          }`}>
          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${filterOptIn ? 'border-amber-500 bg-amber-500' : 'border-slate-600'}`}>
            {filterOptIn && <Check className="w-3 h-3 text-black" />}
          </div>
          Apenas Opt-in
        </button>
        <span className="text-xs text-slate-500 ml-auto">
          {filtered.length} lead(s) - {optInCount} com opt-in ativo
        </span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Users} text="Nenhum lead cadastrado ainda." />
      ) : (
        <div className="space-y-2">
          {filtered.map(l => (
            <div key={l.id} className="bg-[#0f2040] border border-[#1e3868] rounded-xl p-4 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-white text-sm font-medium truncate">{l.name}</p>
                  {l.opt_in && <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 shrink-0">Opt-in</span>}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-slate-500">
                  {l.phone && <span>{l.phone}</span>}
                  {l.email && <span className="truncate">{l.email}</span>}
                  {l.birthday && <span>Aniv: {new Date(l.birthday).toLocaleDateString('pt-BR')}</span>}
                  <span>{new Date(l.created_at).toLocaleDateString('pt-BR')}</span>
                </div>
              </div>
              {l.phone && l.opt_in && (
                <a href={`https://wa.me/55${l.phone.replace(/\D/g, '')}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/30 px-3 py-2 rounded-lg transition-colors shrink-0">
                  <Send className="w-3.5 h-3.5" /> WhatsApp
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Chart components ───────────────────────────────────────────────────
function DonutChart({ segments, total }: { segments: { label: string; value: number; color: string }[]; total: number }) {
  const active = segments.filter(s => s.value > 0);
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 160 160" className="w-32 h-32 shrink-0">
        <circle cx="80" cy="80" r={radius} fill="none" stroke="#1e3868" strokeWidth="16" />
        {active.map((seg, i) => {
          const dash = (seg.value / total) * circumference;
          const el = (
            <circle
              key={i}
              cx="80" cy="80" r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth="16"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 80 80)"
              strokeLinecap="butt"
            />
          );
          offset += dash;
          return el;
        })}
        <text x="80" y="75" textAnchor="middle" fill="#fff" fontSize="22" fontWeight="bold">{total}</text>
        <text x="80" y="95" textAnchor="middle" fill="#64748b" fontSize="9">Vouchers</text>
      </svg>
      <div className="space-y-2">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-sm shrink-0" style={{ background: seg.color }} />
            <span className="text-slate-400">{seg.label}</span>
            <span className="text-white font-medium ml-auto">{seg.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LineChart({ data }: { data: { date: string; count: number }[] }) {
  const maxCount = Math.max(...data.map(d => d.count), 1);
  const chartW = 100;
  const chartH = 40;
  const barW = chartW / data.length;
  return (
    <div>
      <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-32" preserveAspectRatio="none">
        <polyline
          fill="none"
          stroke="#f59e0b"
          strokeWidth="0.5"
          points={data.map((d, i) => {
            const x = i * barW + barW / 2;
            const y = chartH - (d.count / maxCount) * (chartH - 4) - 2;
            return `${x},${y}`;
          }).join(' ')}
        />
        {data.map((d, i) => {
          const x = i * barW + barW / 2;
          const y = chartH - (d.count / maxCount) * (chartH - 4) - 2;
          return <circle key={i} cx={x} cy={y} r="0.8" fill="#f59e0b" />;
        })}
      </svg>
      <div className="flex justify-between mt-2 text-[10px] text-slate-500">
        <span>{new Date(data[0].date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
        <span>{new Date(data[Math.floor(data.length / 2)].date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
        <span>{new Date(data[data.length - 1].date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
      </div>
    </div>
  );
}

// ── Shared components ──────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color: string }) {
  return (
    <div className="bg-[#0f2040] border border-[#1e3868] rounded-2xl p-4">
      <Icon className={`w-5 h-5 ${color} mb-2`} />
      <p className="text-white font-bold text-2xl">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
    </div>
  );
}

function EmptyState({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="py-12 text-center">
      <Icon className="w-10 h-10 text-slate-700 mx-auto mb-3" />
      <p className="text-sm text-slate-500">{text}</p>
    </div>
  );
}
