import { useState, useEffect, useCallback } from 'react';
import {
  Trophy, Star, Percent, Gift, Plus, Trash2, Check, Save,
  Users, TrendingUp, Coins, ToggleLeft, ToggleRight, Phone, Award,
  ChevronDown, ChevronUp, Edit3, X, Megaphone, Clock, CalendarDays, MessageSquare, Info,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { LoyaltyConfig, LoyaltyReward, LoyaltyCustomer, LoyaltyPromoType, LoyaltyRewardType } from '../../types';
import { useTenant } from '../../lib/tenant-context';

const PROMO_TYPES: { id: LoyaltyPromoType; label: string; desc: string; icon: React.ElementType; color: string }[] = [
  {
    id: 'pontos_por_real',
    label: 'Acúmulo de Pontos',
    desc: 'Ex: R$ 1,00 = 1 ponto. Cliente acumula e resgata.',
    icon: Coins,
    color: 'amber',
  },
  {
    id: 'cashback',
    label: 'Cashback Direto',
    desc: 'Ex: 5% do valor volta como saldo para a próxima visita.',
    icon: Percent,
    color: 'green',
  },
];

const REWARD_TYPES: { id: LoyaltyRewardType; label: string }[] = [
  { id: 'desconto_fixo', label: 'Desconto Fixo (R$)' },
  { id: 'desconto_percentual', label: 'Desconto Percentual (%)' },
  { id: 'produto_gratis', label: 'Produto Grátis' },
];

function colorCls(color: string, variant: 'bg' | 'border' | 'text' | 'ring') {
  const map: Record<string, Record<string, string>> = {
    amber: { bg: 'bg-amber-500/10', border: 'border-amber-500', text: 'text-amber-400', ring: 'ring-amber-500' },
    blue:  { bg: 'bg-blue-500/10',  border: 'border-blue-500',  text: 'text-blue-400',  ring: 'ring-blue-500' },
    green: { bg: 'bg-green-500/10', border: 'border-green-500', text: 'text-green-400', ring: 'ring-green-500' },
  };
  return map[color]?.[variant] ?? '';
}

function inputCls(extra = '') {
  return `w-full bg-[#1a3260] border border-[#1e3868] text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-500 transition-colors placeholder-slate-500 ${extra}`;
}

export default function LoyaltyTab() {
  const { restaurant } = useTenant();
  const restaurantId = restaurant?.id ?? null;
  const [config, setConfig] = useState<LoyaltyConfig | null>(null);
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [customers, setCustomers] = useState<LoyaltyCustomer[]>([]);

  // config form state
  const [tipoPromo, setTipoPromo] = useState<LoyaltyPromoType>('pontos_por_real');
  const [valorConversao, setValorConversao] = useState('1');
  const [validadeDias, setValidadeDias] = useState('365');
  const [valorMinimoPedido, setValorMinimoPedido] = useState('0');
  const [termos, setTermos] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [savedConfig, setSavedConfig] = useState(false);

  // campaign state
  const [campanhaAtiva, setCampanhaAtiva] = useState(false);
  const [campanhaDia, setCampanhaDia] = useState(1);
  const [campanhaHorario, setCampanhaHorario] = useState('18:00');
  const [campanhaMensagem, setCampanhaMensagem] = useState('');

  // reward form
  const [showRewardForm, setShowRewardForm] = useState(false);
  const [editingReward, setEditingReward] = useState<LoyaltyReward | null>(null);
  const [rewardNome, setRewardNome] = useState('');
  const [rewardTipo, setRewardTipo] = useState<LoyaltyRewardType>('desconto_fixo');
  const [rewardValor, setRewardValor] = useState('');
  const [rewardPontos, setRewardPontos] = useState('');
  const [savingReward, setSavingReward] = useState(false);

  // customers
  const [searchPhone, setSearchPhone] = useState('');
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    const cfgQuery = supabase.from('loyalty_configs').select('*');
    const rwdQuery = supabase.from('loyalty_rewards').select('*').order('pontos_necessarios');
    const cusQuery = supabase.from('loyalty_customers').select('*').order('saldo_pontos', { ascending: false }).limit(100);

    const [cfgRes, rwdRes, cusRes] = await Promise.all([
      restaurantId ? cfgQuery.eq('restaurant_id', restaurantId).maybeSingle() : cfgQuery.is('restaurant_id', null).maybeSingle(),
      restaurantId ? rwdQuery.eq('restaurant_id', restaurantId) : rwdQuery.is('restaurant_id', null),
      restaurantId ? cusQuery.eq('restaurant_id', restaurantId) : cusQuery.is('restaurant_id', null),
    ]);

    if (cfgRes.data) {
      const c = cfgRes.data as LoyaltyConfig;
      setConfig(c);
      setTipoPromo(c.tipo_promocao);
      setValorConversao(String(c.valor_conversao));
      setValidadeDias(String(c.validade_dias));
      setValorMinimoPedido(String(c.valor_minimo_pedido));
      setTermos(c.termos ?? '');
      setAtivo(c.ativo);
      setCampanhaAtiva(c.campanha_ativa ?? false);
      setCampanhaDia(c.campanha_dia_semana ?? 1);
      setCampanhaHorario(c.campanha_horario ?? '18:00');
      setCampanhaMensagem(c.campanha_mensagem ?? '');
    }
    setRewards((rwdRes.data ?? []) as LoyaltyReward[]);
    setCustomers((cusRes.data ?? []) as LoyaltyCustomer[]);
  }, [restaurantId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function saveConfig() {
    setSavingConfig(true);
    const payload = {
      tipo_promocao: tipoPromo,
      valor_conversao: parseFloat(valorConversao) || 1,
      validade_dias: parseInt(validadeDias) || 365,
      valor_minimo_pedido: parseFloat(valorMinimoPedido) || 0,
      ativo,
      termos: termos || null,
      campanha_ativa: campanhaAtiva,
      campanha_dia_semana: campanhaDia,
      campanha_horario: campanhaHorario,
      campanha_mensagem: campanhaMensagem,
      updated_at: new Date().toISOString(),
    };

    if (config?.id) {
      await supabase.from('loyalty_configs').update(payload).eq('id', config.id);
    } else {
      const { data } = await supabase.from('loyalty_configs').insert({ ...payload, ...(restaurantId ? { restaurant_id: restaurantId } : {}) }).select().maybeSingle();
      if (data) setConfig(data as LoyaltyConfig);
    }

    setSavingConfig(false);
    setSavedConfig(true);
    setTimeout(() => setSavedConfig(false), 2000);
  }

  function openRewardForm(r?: LoyaltyReward) {
    if (r) {
      setEditingReward(r);
      setRewardNome(r.nome_recompensa);
      setRewardTipo(r.tipo_recompensa);
      setRewardValor(String(r.valor_recompensa));
      setRewardPontos(String(r.pontos_necessarios));
    } else {
      setEditingReward(null);
      setRewardNome('');
      setRewardTipo('desconto_fixo');
      setRewardValor('');
      setRewardPontos('');
    }
    setShowRewardForm(true);
  }

  async function saveReward() {
    if (!rewardNome.trim() || !rewardValor || !rewardPontos) return;
    setSavingReward(true);
    const payload = {
      nome_recompensa: rewardNome.trim(),
      tipo_recompensa: rewardTipo,
      valor_recompensa: parseFloat(rewardValor),
      pontos_necessarios: parseInt(rewardPontos),
    };
    if (editingReward) {
      await supabase.from('loyalty_rewards').update(payload).eq('id', editingReward.id);
    } else {
      await supabase.from('loyalty_rewards').insert({ ...payload, ativo: true, ...(restaurantId ? { restaurant_id: restaurantId } : {}) });
    }
    setSavingReward(false);
    setShowRewardForm(false);
    fetchAll();
  }

  async function toggleReward(id: string, current: boolean) {
    await supabase.from('loyalty_rewards').update({ ativo: !current }).eq('id', id);
    setRewards(prev => prev.map(r => r.id === id ? { ...r, ativo: !current } : r));
  }

  async function deleteReward(id: string) {
    if (!confirm('Remover esta recompensa?')) return;
    await supabase.from('loyalty_rewards').delete().eq('id', id);
    setRewards(prev => prev.filter(r => r.id !== id));
  }

  async function deleteCustomer(id: string) {
    if (!confirm('Remover este cliente do programa de fidelidade?')) return;
    await supabase.from('loyalty_customers').delete().eq('id', id);
    setCustomers(prev => prev.filter(c => c.id !== id));
  }

  const totalPoints = customers.reduce((s, c) => s + c.saldo_pontos, 0);
  const totalCashback = customers.reduce((s, c) => s + Number(c.saldo_cashback), 0);
  const topCustomers = [...customers].slice(0, 5);
  const maxPoints = topCustomers[0]?.saldo_pontos ?? 1;

  const filteredCustomers = searchPhone
    ? customers.filter(c => c.phone.includes(searchPhone) || (c.nome ?? '').toLowerCase().includes(searchPhone.toLowerCase()))
    : customers;

  const selectedPromoType = PROMO_TYPES.find(p => p.id === tipoPromo)!;

  return (
    <div className="p-3 sm:p-6 max-w-6xl mx-auto space-y-6 sm:space-y-8 pb-16">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Gula Fidelidade</h2>
            <p className="text-xs text-slate-400">Programe recompensas e fidelize seus clientes</p>
          </div>
        </div>
        <button
          onClick={() => { setAtivo(v => !v); }}
          className={`flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl border transition-colors ${
            ativo
              ? 'bg-green-500/10 text-green-400 border-green-500/30 hover:bg-green-500/20'
              : 'bg-[#1a3260] text-slate-400 border-[#1e3868] hover:text-white'
          }`}
        >
          {ativo ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
          {ativo ? 'Programa Ativo' : 'Programa Pausado'}
        </button>
      </div>

      {/* ── CAMPAIGN TYPE ── */}
      <section className="bg-[#0f2040] rounded-2xl border border-[#1e3868] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#1e3868]">
          <h3 className="text-sm font-semibold text-white">Tipo de Campanha</h3>
          <p className="text-xs text-slate-500 mt-0.5">Escolha como os clientes acumulam benefícios</p>
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {PROMO_TYPES.map(pt => {
            const Icon = pt.icon;
            const active = tipoPromo === pt.id;
            return (
              <button
                key={pt.id}
                onClick={() => setTipoPromo(pt.id)}
                className={`relative flex flex-col gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                  active
                    ? `${colorCls(pt.color, 'border')} ${colorCls(pt.color, 'bg')}`
                    : 'border-[#1e3868] bg-[#1a3260]/40 hover:border-[#2a4d9a]'
                }`}
              >
                {active && (
                  <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
                    <Check className="w-3 h-3 text-black" strokeWidth={3} />
                  </span>
                )}
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${active ? colorCls(pt.color, 'bg') : 'bg-[#1e3868]'}`}>
                  <Icon className={`w-5 h-5 ${active ? colorCls(pt.color, 'text') : 'text-slate-400'}`} />
                </div>
                <div>
                  <p className={`text-sm font-semibold ${active ? 'text-white' : 'text-slate-300'}`}>{pt.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{pt.desc}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Config Inputs */}
        <div className="px-6 pb-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {tipoPromo === 'pontos_por_real' && (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">R$ 1,00 equivale a quantos pontos?</label>
                <input type="number" min="0.1" step="0.1" value={valorConversao} onChange={e => setValorConversao(e.target.value)} className={inputCls()} placeholder="1" />
              </div>
            )}
            {tipoPromo === 'cashback' && (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Percentual de cashback (%)</label>
                <input type="number" min="0.1" max="100" step="0.1" value={valorConversao} onChange={e => setValorConversao(e.target.value)} className={inputCls()} placeholder="5" />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Valor mínimo do pedido para pontuar (R$)</label>
              <input type="number" min="0" step="0.50" value={valorMinimoPedido} onChange={e => setValorMinimoPedido(e.target.value)} className={inputCls()} placeholder="0" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Validade dos pontos / cashback (dias)</label>
              <input type="number" min="1" value={validadeDias} onChange={e => setValidadeDias(e.target.value)} className={inputCls()} placeholder="365" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Termos e condições (opcional)</label>
            <textarea rows={3} value={termos} onChange={e => setTermos(e.target.value)} className={inputCls('resize-none')} placeholder="Ex: Promoção válida somente para consumo no local..." />
          </div>
          <button
            onClick={saveConfig}
            disabled={savingConfig}
            className="flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black transition-colors disabled:opacity-60"
          >
            {savedConfig ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {savedConfig ? 'Configurações salvas!' : savingConfig ? 'Salvando...' : 'Salvar Configurações'}
          </button>
        </div>
      </section>

      {/* ── REWARDS ── */}
      <section className="bg-[#0f2040] rounded-2xl border border-[#1e3868] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#1e3868] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Gift className="w-4 h-4 text-amber-400" /> Recompensas
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Defina o que o cliente pode resgatar com seus pontos</p>
          </div>
          <button
            onClick={() => openRewardForm()}
            className="flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Nova Recompensa
          </button>
        </div>

        {/* Add/Edit Form */}
        {showRewardForm && (
          <div className="px-6 py-5 border-b border-[#1e3868] bg-slate-800/40">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-white">{editingReward ? 'Editar Recompensa' : 'Nova Recompensa'}</p>
              <button onClick={() => setShowRewardForm(false)} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Nome da Recompensa</label>
                <input value={rewardNome} onChange={e => setRewardNome(e.target.value)} className={inputCls()} placeholder="Ex: R$ 10 de desconto" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Tipo de Recompensa</label>
                <select value={rewardTipo} onChange={e => setRewardTipo(e.target.value as LoyaltyRewardType)} className={inputCls()}>
                  {REWARD_TYPES.map(rt => <option key={rt.id} value={rt.id}>{rt.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  {rewardTipo === 'desconto_fixo' ? 'Valor do desconto (R$)' : rewardTipo === 'desconto_percentual' ? 'Percentual de desconto (%)' : 'Valor do produto (R$)'}
                </label>
                <input type="number" min="0" step="0.01" value={rewardValor} onChange={e => setRewardValor(e.target.value)} className={inputCls()} placeholder="10" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
            {tipoPromo === 'cashback' ? 'Cashback mínimo (R$)' : 'Pontos necessários'}
                </label>
                <input type="number" min="1" value={rewardPontos} onChange={e => setRewardPontos(e.target.value)} className={inputCls()} placeholder="100" />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={saveReward}
                disabled={savingReward || !rewardNome.trim() || !rewardValor || !rewardPontos}
                className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black transition-colors disabled:opacity-50"
              >
                <Check className="w-4 h-4" /> Salvar
              </button>
              <button onClick={() => setShowRewardForm(false)} className="text-sm text-slate-400 hover:text-white px-4 py-2">Cancelar</button>
            </div>
          </div>
        )}

        <div className="p-6">
          {rewards.length === 0 ? (
            <div className="py-10 text-center text-slate-500">
              <Gift className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhuma recompensa cadastrada ainda.</p>
              <p className="text-xs mt-1">Crie recompensas para incentivar seus clientes.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {rewards.map(r => (
                <div key={r.id} className={`relative bg-[#1a3260]/60 border rounded-xl p-4 transition-all ${r.ativo ? 'border-[#1e3868]' : 'border-[#1e3868] opacity-50'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{r.nome_recompensa}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-medium">
                          {REWARD_TYPES.find(t => t.id === r.tipo_recompensa)?.label}
                        </span>
                        <span className="text-xs text-slate-400">
                          {r.tipo_recompensa === 'desconto_fixo' ? `R$ ${Number(r.valor_recompensa).toFixed(2)}` :
                           r.tipo_recompensa === 'desconto_percentual' ? `${r.valor_recompensa}%` :
                           `R$ ${Number(r.valor_recompensa).toFixed(2)}`}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1">
                        <Star className="w-3 h-3" />
                        {r.pontos_necessarios} {tipoPromo === 'cashback' ? 'de cashback (R$)' : 'pontos'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => openRewardForm(r)} className="p-1.5 text-slate-400 hover:text-amber-400 transition-colors" title="Editar">
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => toggleReward(r.id, r.ativo)} className={`p-1.5 transition-colors ${r.ativo ? 'text-green-400 hover:text-slate-400' : 'text-slate-500 hover:text-green-400'}`} title={r.ativo ? 'Pausar' : 'Ativar'}>
                        {r.ativo ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                      </button>
                      <button onClick={() => deleteReward(r.id)} className="p-1.5 text-slate-500 hover:text-red-400 transition-colors" title="Remover">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-amber-400" /> Visão Geral
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-[#0f2040] border border-[#1e3868] rounded-2xl p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{customers.length}</p>
              <p className="text-xs text-slate-500">Clientes cadastrados</p>
            </div>
          </div>
          <div className="bg-[#0f2040] border border-[#1e3868] rounded-2xl p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
              <Coins className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{totalPoints.toLocaleString('pt-BR')}</p>
              <p className="text-xs text-slate-500">Pontos distribuídos</p>
            </div>
          </div>
          <div className="bg-[#0f2040] border border-[#1e3868] rounded-2xl p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-green-500/15 flex items-center justify-center shrink-0">
              <Percent className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">R$ {totalCashback.toFixed(2).replace('.', ',')}</p>
              <p className="text-xs text-slate-500">Cashback acumulado</p>
            </div>
          </div>
        </div>

        {/* Top Customers Chart */}
        {topCustomers.length > 0 && (
          <div className="bg-[#0f2040] border border-[#1e3868] rounded-2xl p-5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Top clientes por pontos</p>
            <div className="space-y-3">
              {topCustomers.map((c, i) => (
                <div key={c.id} className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 w-4 text-right font-mono">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-300 truncate">{c.nome || c.phone}</span>
                      <span className="text-xs font-bold text-amber-400 ml-2 shrink-0">{c.saldo_pontos.toLocaleString('pt-BR')} pts</span>
                    </div>
                    <div className="h-1.5 bg-[#1a3260] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full transition-all"
                        style={{ width: `${Math.max(4, (c.saldo_pontos / maxPoints) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── RETENTION CAMPAIGN ── */}
      <section className="bg-[#0f2040] rounded-2xl border border-[#1e3868] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#1e3868] flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/15 flex items-center justify-center shrink-0">
              <Megaphone className="w-4 h-4 text-sky-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Campanha de Retenção Semanal</h3>
              <p className="text-xs text-slate-500 mt-0.5">Mensagem automática para trazer clientes de volta</p>
            </div>
          </div>
          {/* Toggle switch */}
          <button
            onClick={() => setCampanhaAtiva(v => !v)}
            className={`flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl border transition-colors ${
              campanhaAtiva
                ? 'bg-sky-500/10 text-sky-400 border-sky-500/30 hover:bg-sky-500/20'
                : 'bg-[#1a3260] text-slate-400 border-[#1e3868] hover:text-white'
            }`}
          >
            {campanhaAtiva ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
            {campanhaAtiva ? 'Campanha Ativa' : 'Campanha Inativa'}
          </button>
        </div>

        <div className={`p-6 space-y-5 transition-opacity ${campanhaAtiva ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Day of week */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5" /> Dia da semana do disparo
              </label>
              <select
                value={campanhaDia}
                onChange={e => setCampanhaDia(Number(e.target.value))}
                className={inputCls()}
              >
                <option value={0}>Domingo</option>
                <option value={1}>Segunda-feira</option>
                <option value={2}>Terça-feira</option>
                <option value={3}>Quarta-feira</option>
                <option value={4}>Quinta-feira</option>
                <option value={5}>Sexta-feira</option>
                <option value={6}>Sábado</option>
              </select>
            </div>

            {/* Time */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Horário do disparo
              </label>
              <input
                type="time"
                value={campanhaHorario}
                onChange={e => setCampanhaHorario(e.target.value)}
                className={inputCls('[color-scheme:dark]')}
              />
            </div>
          </div>

          {/* Message */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" /> Mensagem personalizada
            </label>
            <textarea
              rows={4}
              value={campanhaMensagem}
              onChange={e => setCampanhaMensagem(e.target.value)}
              placeholder={`Fala {nome}! Que tal um burger hoje? Você tem {saldo} de cashback guardado, aproveita! 🍔`}
              className={inputCls('resize-none')}
            />
            {/* Variable hints */}
            <div className="mt-2 flex items-start gap-2 bg-[#1a3260]/60 border border-[#1e3868]/50 rounded-xl px-3.5 py-3">
              <Info className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-400 space-y-1 leading-relaxed">
                <p className="font-medium text-slate-300">Variáveis disponíveis na mensagem:</p>
                <p>
                  <code className="bg-[#1e3868] text-sky-300 px-1.5 py-0.5 rounded font-mono text-[11px]">{'{nome}'}</code>
                  {' '}— será substituído pelo nome do cliente
                </p>
                <p>
                  <code className="bg-[#1e3868] text-sky-300 px-1.5 py-0.5 rounded font-mono text-[11px]">{'{saldo}'}</code>
                  {' '}— será substituído pelo saldo de cashback ou pontos acumulados
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Save footer */}
        <div className="px-6 pb-6">
          <button
            onClick={saveConfig}
            disabled={savingConfig}
            className="flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black transition-colors disabled:opacity-60"
          >
            {savedConfig ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {savedConfig ? 'Configurações salvas!' : savingConfig ? 'Salvando...' : 'Salvar Campanha'}
          </button>
        </div>
      </section>

      {/* ── CUSTOMERS LIST ── */}
      <section className="bg-[#0f2040] rounded-2xl border border-[#1e3868] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#1e3868] flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-400" /> Clientes Fidelidade
          </h3>
          <div className="relative">
            <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              value={searchPhone}
              onChange={e => setSearchPhone(e.target.value)}
              placeholder="Buscar por telefone ou nome..."
              className="bg-[#1a3260] border border-[#1e3868] text-white text-xs rounded-xl pl-8 pr-3 py-2 focus:outline-none focus:border-amber-500 w-56 placeholder-slate-500"
            />
          </div>
        </div>

        {filteredCustomers.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhum cliente cadastrado ainda.</p>
            <p className="text-xs mt-1">Clientes se cadastram ao informar o telefone no checkout.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {filteredCustomers.map(c => (
              <div key={c.id} className="px-6 py-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-amber-400">{(c.nome || c.phone || '?').charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="min-w-0">
                      {c.nome && <p className="text-sm font-medium text-white truncate">{c.nome}</p>}
                      <p className="text-xs text-slate-400">{c.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-bold text-amber-400">{c.saldo_pontos.toLocaleString('pt-BR')} pts</p>
                      {Number(c.saldo_cashback) > 0 && (
                        <p className="text-xs text-green-400">R$ {Number(c.saldo_cashback).toFixed(2)} cashback</p>
                      )}
                    </div>
                    <button
                      onClick={() => setExpandedCustomer(prev => prev === c.id ? null : c.id)}
                      className="text-slate-400 hover:text-white transition-colors p-1"
                    >
                      {expandedCustomer === c.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <button onClick={() => deleteCustomer(c.id)} className="text-slate-600 hover:text-red-400 transition-colors p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {expandedCustomer === c.id && (
                  <div className="mt-4 pl-11 space-y-3">
                    <div className="flex gap-4 flex-wrap text-xs">
                      <span className="text-slate-400">Visitas totais: <strong className="text-white">{c.total_visitas}</strong></span>
                      <span className="text-slate-400">Pontos: <strong className="text-amber-400">{c.saldo_pontos.toLocaleString('pt-BR')}</strong></span>
                      <span className="text-slate-400">Cashback: <strong className="text-green-400">R$ {Number(c.saldo_cashback).toFixed(2)}</strong></span>
                    </div>
                    {(c.historico_transacoes ?? []).length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-slate-500 mb-2">Últimas transações</p>
                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                          {[...(c.historico_transacoes ?? [])].reverse().slice(0, 8).map((t, i) => (
                            <div key={i} className="flex items-center justify-between text-xs">
                              <span className={`${t.tipo === 'ganho' ? 'text-green-400' : 'text-red-400'}`}>
                                {t.tipo === 'ganho' ? '▲' : '▼'} {t.descricao}
                              </span>
                              <span className="text-slate-500">{new Date(t.data).toLocaleDateString('pt-BR')}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
