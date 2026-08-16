import { useState, useEffect, useCallback, useRef } from 'react';
import {
  BookOpen, Plus, Trash2, Edit3, X, Check, Send, Bot,
  AlertTriangle, Search, FlaskConical, Loader2, UploadCloud,
  Tag, LayoutGrid,
} from 'lucide-react';

type AgentType = 'etiquetas' | 'geral';

const AGENT_LABELS: Record<AgentType, string> = {
  etiquetas: 'Especialista em Etiquetas',
  geral: 'Assistente Geral',
};
import { supabase } from '../../lib/supabase';

interface KnowledgeItem {
  id: string;
  restaurant_id: string | null;
  category: string;
  question: string;
  answer: string;
  keywords: string[];
  agent: AgentType;
  sort_order: number;
  active: boolean;
  created_at: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const inputCls = 'w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-500 transition-colors placeholder-slate-500';

export default function KnowledgeBaseTab() {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<KnowledgeItem | null>(null);

  // Form state
  const [category, setCategory] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [keywords, setKeywords] = useState('');
  const [formAgent, setFormAgent] = useState<AgentType>('geral');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Agent filter for list
  const [filterAgent, setFilterAgent] = useState<AgentType | 'all'>('all');

  // Test IA agent selector
  const [testAgent, setTestAgent] = useState<AgentType>('geral');

  // Bulk import state
  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkFormat, setBulkFormat] = useState<'json' | 'csv' | 'text'>('text');
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkPreview, setBulkPreview] = useState<{ category: string; question: string; answer: string; keywords: string[] }[] | null>(null);
  const [bulkAgent, setBulkAgent] = useState<AgentType>('geral');

  // Test IA state
  const [testMessages, setTestMessages] = useState<ChatMessage[]>([]);
  const [testInput, setTestInput] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [testMatched, setTestMatched] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('knowledge_base')
      .select('*')
      .order('sort_order', { ascending: true });
    if (!error && data) setItems(data as KnowledgeItem[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [testMessages, testLoading]);

  function resetForm() {
    setCategory('');
    setQuestion('');
    setAnswer('');
    setKeywords('');
    setFormAgent('geral');
    setEditingItem(null);
    setFormError(null);
  }

  function openEdit(item: KnowledgeItem) {
    setEditingItem(item);
    setCategory(item.category);
    setQuestion(item.question);
    setAnswer(item.answer);
    setKeywords(item.keywords?.join(', ') ?? '');
    setFormAgent(item.agent ?? 'geral');
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!category.trim() || !question.trim() || !answer.trim()) {
      setFormError('Preencha categoria, pergunta e resposta.');
      return;
    }
    setSaving(true);
    setFormError(null);

    const kwArr = keywords.split(',').map(k => k.trim()).filter(Boolean);
    const payload = {
      category: category.trim(),
      question: question.trim(),
      answer: answer.trim(),
      keywords: kwArr,
      agent: formAgent,
      sort_order: editingItem?.sort_order ?? items.length,
      active: true,
    };

    if (editingItem) {
      await supabase.from('knowledge_base').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingItem.id);
    } else {
      await supabase.from('knowledge_base').insert(payload);
    }

    setSaving(false);
    setShowForm(false);
    resetForm();
    fetchItems();
  }

  async function deleteItem(id: string) {
    if (!confirm('Remover este tópico da base de conhecimento?')) return;
    await supabase.from('knowledge_base').delete().eq('id', id);
    setItems(prev => prev.filter(i => i.id !== id));
  }

  async function toggleActive(item: KnowledgeItem) {
    const next = !item.active;
    await supabase.from('knowledge_base').update({ active: next, updated_at: new Date().toISOString() }).eq('id', item.id);
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, active: next } : i));
  }

  async function handleTestSend() {
    const trimmed = testInput.trim();
    if (!trimmed || testLoading) return;

    const userMsg: ChatMessage = { role: 'user', content: trimmed };
    const newMessages = [...testMessages, userMsg];
    setTestMessages(newMessages);
    setTestInput('');
    setTestLoading(true);
    setTestMatched(null);

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/knowledge-base-chat`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          message: trimmed,
          agent: testAgent,
          history: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error ?? `Erro ${res.status}`);
      }

      const data = await res.json();
      if (data.matched_topics !== undefined) setTestMatched(data.matched_topics);
      setTestMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao consultar a IA';
      setTestMessages(prev => [...prev, { role: 'assistant', content: `Erro: ${msg}` }]);
    } finally {
      setTestLoading(false);
    }
  }

  // ── Bulk import parsing ───────────────────────────────────────────────────
  function parseBulkInput(): { category: string; question: string; answer: string; keywords: string[] }[] {
    const raw = bulkText.trim();
    if (!raw) return [];

    if (bulkFormat === 'json') {
      try {
        const parsed = JSON.parse(raw);
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        return arr
          .filter((o: any) => o && (o.question || o.pergunta) && (o.answer || o.resposta))
          .map((o: any) => ({
            category: String(o.category || o.categoria || 'Geral').trim(),
            question: String(o.question || o.pergunta).trim(),
            answer: String(o.answer || o.resposta).trim(),
            keywords: Array.isArray(o.keywords || o.palavras_chave)
              ? (o.keywords || o.palavras_chave).map((k: string) => String(k).trim()).filter(Boolean)
              : String(o.keywords || o.palavras_chave || '').split(',').map((k: string) => k.trim()).filter(Boolean),
          }));
      } catch {
        throw new Error('JSON inválido. Verifique a formatação.');
      }
    }

    if (bulkFormat === 'csv') {
      const lines = raw.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) throw new Error('CSV precisa de cabeçalho + pelo menos 1 linha.');
      const header = lines[0].split(',').map(h => h.trim().toLowerCase());
      const catIdx = header.findIndex(h => h.includes('cat') || h.includes('categoria'));
      const qIdx = header.findIndex(h => h.includes('perg') || h.includes('quest') || h === 'q');
      const aIdx = header.findIndex(h => h.includes('resp') || h.includes('answer') || h === 'a' || h === 'r');
      const kwIdx = header.findIndex(h => h.includes('key') || h.includes('palavra'));
      if (qIdx === -1 || aIdx === -1) throw new Error('CSV precisa de colunas "pergunta" e "resposta".');
      return lines.slice(1).map(line => {
        const cols = line.split(',').map(c => c.trim());
        return {
          category: (catIdx >= 0 ? cols[catIdx] : 'Geral') || 'Geral',
          question: cols[qIdx] ?? '',
          answer: cols[aIdx] ?? '',
          keywords: kwIdx >= 0 && cols[kwIdx] ? cols[kwIdx].split(';').map(k => k.trim()).filter(Boolean) : [],
        };
      }).filter(t => t.question && t.answer);
    }

    // Plain text format:
    // [Categoria] Pergunta?
    // Resposta completa...
    //
    // [Categoria] Outra pergunta?
    // Outra resposta...
    const blocks = raw.split(/\n\s*\n/).filter(b => b.trim());
    const topics: { category: string; question: string; answer: string; keywords: string[] }[] = [];
    for (const block of blocks) {
      const lines = block.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) continue;
      let category = 'Geral';
      let question = '';
      let answer = '';
      let keywords: string[] = [];
      let lineIdx = 0;

      // Check if first line has [Category]
      const catMatch = lines[0].match(/^\[([^\]]+)\]\s*(.*)/);
      if (catMatch) {
        category = catMatch[1].trim();
        question = catMatch[2].trim();
        lineIdx = 1;
      } else {
        question = lines[0].trim();
        lineIdx = 1;
      }

      // Collect answer lines, detect #keywords line
      const answerLines: string[] = [];
      for (let i = lineIdx; i < lines.length; i++) {
        const kwMatch = lines[i].match(/^#keywords:\s*(.*)/i);
        if (kwMatch) {
          keywords = kwMatch[1].split(',').map(k => k.trim()).filter(Boolean);
        } else {
          answerLines.push(lines[i]);
        }
      }
      answer = answerLines.join('\n').trim();
      if (question && answer) topics.push({ category, question, answer, keywords });
    }
    return topics;
  }

  function handleBulkPreview() {
    setBulkError(null);
    try {
      const parsed = parseBulkInput();
      if (parsed.length === 0) {
        setBulkError('Nenhum tópico válido encontrado no texto.');
        setBulkPreview(null);
        return;
      }
      setBulkPreview(parsed);
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : 'Erro ao processar.');
      setBulkPreview(null);
    }
  }

  async function handleBulkSave() {
    if (!bulkPreview || bulkPreview.length === 0) return;
    setBulkSaving(true);
    setBulkError(null);
    try {
      const payload = bulkPreview.map((t, i) => ({
        category: t.category,
        question: t.question,
        answer: t.answer,
        keywords: t.keywords,
        agent: bulkAgent,
        sort_order: items.length + i,
        active: true,
      }));
      const { error } = await supabase.from('knowledge_base').insert(payload);
      if (error) throw new Error(error.message);
      setBulkSaving(false);
      setShowBulk(false);
      setBulkText('');
      setBulkPreview(null);
      fetchItems();
    } catch (err) {
      setBulkSaving(false);
      setBulkError(err instanceof Error ? err.message : 'Erro ao salvar.');
    }
  }

  function closeBulk() {
    setShowBulk(false);
    setBulkText('');
    setBulkPreview(null);
    setBulkError(null);
    setBulkAgent('geral');
  }

  const BULK_EXAMPLE = `[Validade] Qual a validade da maionese caseira?
24 horas após o preparo, refrigerada entre 2°C e 4°C.
#keywords: maionese, caseira, validade

[Armazenamento] Como armazenar arroz cozido?
3 dias em refrigeração (2-4°C) ou 30 dias congelado a -18°C.`;

  function handleTestKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTestSend();
    }
  }

  const filtered = (filterAgent === 'all' ? items : items.filter(i => i.agent === filterAgent)).filter(i =>
    !search ||
    i.question.toLowerCase().includes(search.toLowerCase()) ||
    i.category.toLowerCase().includes(search.toLowerCase()) ||
    i.answer.toLowerCase().includes(search.toLowerCase()));

  const agentBadgeCls = (a: AgentType) => a === 'etiquetas'
    ? 'text-orange-400 bg-orange-500/10'
    : 'text-sky-400 bg-sky-500/10';

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-400" /> Base de Conhecimento
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Cadastre tópicos que a IA usará para responder perguntas. {items.length} tópico(s) cadastrado(s).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBulk(true)}
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white transition-colors"
          >
            <UploadCloud className="w-4 h-4" /> Importar em Massa
          </button>
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black transition-colors"
          >
            <Plus className="w-4 h-4" /> Novo Tópico
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">
        {/* ── Left: Knowledge Base List ── */}
        <div className="space-y-4">
          {/* Search + Agent filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar tópicos..."
                className="w-full bg-slate-900 border border-slate-800 text-white text-sm rounded-xl pl-9 pr-4 py-2.5 focus:outline-none focus:border-amber-500 transition-colors placeholder-slate-500"
              />
            </div>
            <div className="flex gap-1.5">
              {(['all', 'geral', 'etiquetas'] as const).map(a => (
                <button
                  key={a}
                  onClick={() => setFilterAgent(a)}
                  className={`text-xs font-semibold px-3 py-2.5 rounded-xl transition-colors whitespace-nowrap ${
                    filterAgent === a
                      ? 'bg-amber-500 text-black'
                      : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >{a === 'all' ? 'Todos' : a === 'geral' ? 'Geral' : 'Etiquetas'}</button>
              ))}
            </div>
          </div>

          {/* Form Modal */}
          {showForm && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="px-4 sm:px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">
                  {editingItem ? 'Editar Tópico' : 'Novo Tópico da Base de Conhecimento'}
                </h3>
                <button onClick={() => { setShowForm(false); resetForm(); }} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleSave} className="p-4 sm:p-6 space-y-4">
                {formError && (
                  <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
                    <AlertTriangle className="w-4 h-4 shrink-0" /> {formError}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Agente de IA *</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormAgent('geral')}
                      className={`flex items-center gap-2 text-xs font-semibold px-3 py-2.5 rounded-xl border transition-colors ${
                        formAgent === 'geral'
                          ? 'bg-sky-500/15 border-sky-500/40 text-sky-300'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <LayoutGrid className="w-4 h-4" /> Assistente Geral
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormAgent('etiquetas')}
                      className={`flex items-center gap-2 text-xs font-semibold px-3 py-2.5 rounded-xl border transition-colors ${
                        formAgent === 'etiquetas'
                          ? 'bg-orange-500/15 border-orange-500/40 text-orange-300'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Tag className="w-4 h-4" /> Especialista Etiquetas
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Categoria *</label>
                  <input value={category} onChange={e => setCategory(e.target.value)} className={inputCls} placeholder="Ex: Validade, Armazenamento, Higiene" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Pergunta / Tópico *</label>
                  <input value={question} onChange={e => setQuestion(e.target.value)} className={inputCls} placeholder="Ex: Qual a validade da maionese caseira?" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Resposta *</label>
                  <textarea value={answer} onChange={e => setAnswer(e.target.value)} rows={4} className={inputCls} placeholder="Ex: 24 horas após o preparo, refrigerada entre 2°C e 4°C..." required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Palavras-chave (separadas por vírgula)</label>
                  <input value={keywords} onChange={e => setKeywords(e.target.value)} className={inputCls} placeholder="maionese, caseira, validade" />
                </div>
                <div className="flex gap-3 pt-1">
                  <button type="submit" disabled={saving} className="flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black transition-colors disabled:opacity-60">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {saving ? 'Salvando...' : editingItem ? 'Salvar' : 'Criar Tópico'}
                  </button>
                  <button type="button" onClick={() => { setShowForm(false); resetForm(); }} className="text-sm text-slate-400 hover:text-white px-4 py-2 transition-colors">
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Items List */}
          {loading ? (
            <div className="py-12 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl py-16 text-center text-slate-500">
              <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{search ? 'Nenhum resultado encontrado.' : 'Nenhum tópico cadastrado ainda.'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(item => (
                <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${agentBadgeCls(item.agent)}`}>
                          {item.agent === 'etiquetas' ? 'Etiquetas' : 'Geral'}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                          {item.category}
                        </span>
                        {!item.active && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
                            Inativo
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-white truncate">{item.question}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => openEdit(item)} className="p-1.5 text-slate-400 hover:text-amber-400 transition-colors rounded-lg hover:bg-amber-500/10" title="Editar">
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button onClick={() => toggleActive(item)} className={`p-1.5 transition-colors rounded-lg ${item.active ? 'text-green-400 hover:bg-green-500/10' : 'text-slate-500 hover:bg-slate-800'}`} title={item.active ? 'Desativar' : 'Ativar'}>
                        {item.active ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                      </button>
                      <button onClick={() => deleteItem(item.id)} className="p-1.5 text-slate-500 hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/10" title="Remover">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">{item.answer}</p>
                  {item.keywords?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {item.keywords.map((kw, i) => (
                        <span key={i} className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">{kw}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Bulk Import Modal ── */}
        {showBulk && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={closeBulk}>
            <div
              className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center">
                    <UploadCloud className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Importar Tópicos em Massa</h3>
                    <p className="text-[11px] text-slate-500">Cole múltiplos tópicos de uma só vez</p>
                  </div>
                </div>
                <button onClick={closeBulk} className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {/* Agent selector */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Agente de IA para os tópicos *</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => { setBulkAgent('geral'); setBulkPreview(null); }}
                      className={`flex items-center gap-2 text-xs font-semibold px-3 py-2.5 rounded-xl border transition-colors ${
                        bulkAgent === 'geral'
                          ? 'bg-sky-500/15 border-sky-500/40 text-sky-300'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <LayoutGrid className="w-4 h-4" /> Assistente Geral
                    </button>
                    <button
                      type="button"
                      onClick={() => { setBulkAgent('etiquetas'); setBulkPreview(null); }}
                      className={`flex items-center gap-2 text-xs font-semibold px-3 py-2.5 rounded-xl border transition-colors ${
                        bulkAgent === 'etiquetas'
                          ? 'bg-orange-500/15 border-orange-500/40 text-orange-300'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Tag className="w-4 h-4" /> Especialista Etiquetas
                    </button>
                  </div>
                </div>

                {/* Format selector */}
                <div className="flex gap-2">
                  {(['text', 'json', 'csv'] as const).map(fmt => (
                    <button
                      key={fmt}
                      onClick={() => { setBulkFormat(fmt); setBulkPreview(null); setBulkError(null); }}
                      className={`text-xs font-semibold px-3.5 py-2 rounded-xl transition-colors ${
                        bulkFormat === fmt
                          ? 'bg-amber-500 text-black'
                          : 'bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700'
                      }`}
                    >{fmt === 'text' ? 'Texto' : fmt === 'json' ? 'JSON' : 'CSV'}</button>
                  ))}
                </div>

                {/* Format hint */}
                {bulkFormat === 'text' && (
                  <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 text-[11px] text-slate-400 leading-relaxed">
                    <p className="font-semibold text-slate-300 mb-1">Formato:</p>
                    <p className="mb-1">Separe cada tópico por uma linha em branco. Use <code className="text-amber-400">[Categoria]</code> no início da pergunta (opcional — padrão: "Geral"). Adicione <code className="text-amber-400">#keywords:</code> em uma linha separada para palavras-chave.</p>
                    <pre className="bg-slate-900 rounded-lg p-2 mt-1 overflow-x-auto text-[10px] text-slate-500">{BULK_EXAMPLE}</pre>
                  </div>
                )}
                {bulkFormat === 'json' && (
                  <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 text-[11px] text-slate-400 leading-relaxed">
                    <p className="font-semibold text-slate-300 mb-1">Formato JSON:</p>
                    <pre className="bg-slate-900 rounded-lg p-2 mt-1 overflow-x-auto text-[10px] text-slate-500">{`[
  { "category": "Validade", "question": "...", "answer": "...", "keywords": ["..."] },
  { "category": "Higiene", "question": "...", "answer": "..." }
]`}</pre>
                  </div>
                )}
                {bulkFormat === 'csv' && (
                  <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 text-[11px] text-slate-400 leading-relaxed">
                    <p className="font-semibold text-slate-300 mb-1">Formato CSV:</p>
                    <pre className="bg-slate-900 rounded-lg p-2 mt-1 overflow-x-auto text-[10px] text-slate-500">{`categoria,pergunta,resposta,keywords
Validade,Qual a validade...?,24 horas...,maionese;caseira`}</pre>
                    <p className="mt-1">Coluna "keywords" usa ponto-e-vírgula (;) como separador.</p>
                  </div>
                )}

                {/* Textarea */}
                <textarea
                  value={bulkText}
                  onChange={e => { setBulkText(e.target.value); setBulkPreview(null); setBulkError(null); }}
                  rows={10}
                  className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 transition-colors placeholder-slate-500 font-mono"
                  placeholder={bulkFormat === 'json' ? '[{ "question": "...", "answer": "..." }]' : bulkFormat === 'csv' ? 'categoria,pergunta,resposta,keywords\n...' : BULK_EXAMPLE}
                />

                {/* Error */}
                {bulkError && (
                  <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
                    <AlertTriangle className="w-4 h-4 shrink-0" /> {bulkError}
                  </div>
                )}

                {/* Preview */}
                {bulkPreview && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-slate-300">Pré-visualização ({bulkPreview.length} tópico{bulkPreview.length !== 1 ? 's' : ''})</p>
                      <button onClick={() => setBulkPreview(null)} className="text-[11px] text-slate-500 hover:text-slate-300">limpar</button>
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-2 bg-slate-950/50 rounded-xl p-3 border border-slate-800">
                      {bulkPreview.map((t, i) => (
                        <div key={i} className="text-xs border-b border-slate-800 pb-2 last:border-0 last:pb-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[9px] font-bold uppercase text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">{t.category}</span>
                            <span className="text-slate-200 font-medium truncate">{t.question}</span>
                          </div>
                          <p className="text-slate-500 line-clamp-2">{t.answer}</p>
                          {t.keywords.length > 0 && (
                            <p className="text-[10px] text-slate-600 mt-0.5">Keywords: {t.keywords.join(', ')}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-slate-800 sticky bottom-0 bg-slate-900">
                <button onClick={closeBulk} className="text-sm text-slate-400 hover:text-white px-4 py-2.5 transition-colors">
                  Cancelar
                </button>
                <div className="flex gap-2">
                  {!bulkPreview ? (
                    <button
                      onClick={handleBulkPreview}
                      disabled={!bulkText.trim()}
                      className="flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 transition-colors disabled:opacity-50"
                    >
                      <Search className="w-4 h-4" /> Pré-visualizar
                    </button>
                  ) : (
                    <button
                      onClick={handleBulkSave}
                      disabled={bulkSaving || bulkPreview.length === 0}
                      className="flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black transition-colors disabled:opacity-50"
                    >
                      {bulkSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      {bulkSaving ? 'Salvando...' : `Salvar Todos (${bulkPreview.length})`}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Right: Testar IA Panel ── */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col h-[600px]">
            {/* Header */}
            <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-slate-800 bg-slate-900">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shrink-0">
                <FlaskConical className="w-5 h-5 text-black" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-white">Testar IA</h3>
                <p className="text-[11px] text-slate-500">Valide as respostas da IA com base nos tópicos cadastrados</p>
              </div>
            </div>

            {/* Agent selector */}
            <div className="px-3 py-2.5 border-b border-slate-800 bg-slate-900/50">
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => { setTestAgent('geral'); setTestMessages([]); setTestMatched(null); }}
                  className={`flex items-center justify-center gap-1.5 text-[11px] font-semibold px-2 py-2 rounded-lg border transition-colors ${
                    testAgent === 'geral'
                      ? 'bg-sky-500/15 border-sky-500/40 text-sky-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" /> Geral
                </button>
                <button
                  onClick={() => { setTestAgent('etiquetas'); setTestMessages([]); setTestMatched(null); }}
                  className={`flex items-center justify-center gap-1.5 text-[11px] font-semibold px-2 py-2 rounded-lg border transition-colors ${
                    testAgent === 'etiquetas'
                      ? 'bg-orange-500/15 border-orange-500/40 text-orange-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Tag className="w-3.5 h-3.5" /> Etiquetas
                </button>
              </div>
            </div>

            {/* Chat body */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 p-4">
              {testMessages.length === 0 && !testLoading && (
                <div className="flex flex-col items-center justify-center h-full text-center text-slate-500">
                  <Bot className="w-10 h-10 mb-3 opacity-30" />
                  <p className="text-sm">Faça uma pergunta para testar se a IA está consultando corretamente a base de conhecimento.</p>
                </div>
              )}
              {testMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'assistant' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`flex gap-2 max-w-[85%] ${msg.role === 'assistant' ? 'flex-row' : 'flex-row-reverse'}`}>
                    {msg.role === 'assistant' && (
                      <div className="shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                        <Bot className="w-4 h-4 text-black" />
                      </div>
                    )}
                    <div className={`px-3.5 py-2.5 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed ${
                      msg.role === 'assistant'
                        ? 'bg-slate-800 border border-slate-700 text-slate-200 rounded-tl-sm'
                        : 'bg-amber-500/15 border border-amber-500/30 text-amber-100 rounded-tr-sm'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                </div>
              ))}
              {testLoading && (
                <div className="flex justify-start">
                  <div className="flex gap-2">
                    <div className="shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                      <Bot className="w-4 h-4 text-black" />
                    </div>
                    <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-slate-800 border border-slate-700 flex items-center gap-1.5">
                      <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Match indicator */}
            {testMatched !== null && !testLoading && (
              <div className="px-4 py-1.5 border-t border-slate-800 flex items-center justify-center">
                <span className={`text-[11px] font-medium ${testMatched > 0 ? 'text-green-400' : 'text-slate-500'}`}>
                  {testMatched > 0 ? `${testMatched} tópico(s) relevante(s) encontrado(s)` : 'Nenhum tópico relevante na base'}
                </span>
              </div>
            )}

            {/* Input */}
            <div className="p-3 border-t border-slate-800">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={testInput}
                  onChange={e => setTestInput(e.target.value)}
                  onKeyDown={handleTestKeyDown}
                  placeholder="Digite uma pergunta de teste..."
                  disabled={testLoading}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none transition-colors disabled:opacity-50"
                />
                <button
                  onClick={handleTestSend}
                  disabled={!testInput.trim() || testLoading}
                  className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-black transition-colors shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
