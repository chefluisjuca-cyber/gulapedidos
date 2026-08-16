import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Tag, Printer, Plus, Trash2, Pencil, X, Check, ChefHat,
  PackageOpen, User, Users, Save, Search, FolderOpen, FolderPlus, Minus,
  Zap, AlertCircle, Settings, CalendarClock, AlertTriangle, CheckCircle2, PackageCheck,
  Sparkles, ChevronRight,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../lib/tenant-context';
import { printEtiqueta, printEtiquetaLivre } from '../../lib/print';
import type { EtiquetaSize } from '../../lib/print';
import {
  requestNotificationPermission, checkValidadeAlerts,
  loadAlertConfig, saveAlertConfig, startValidadeScheduler,
  type ValidadeAlertConfig,
} from '../../lib/notifications';
import GulaEspecialistaWidget from '../GulaEspecialistaWidget';
import type {
  EtiquetaProduto, EtiquetaColaborador, EtiquetaSubcategoria, EtiquetaCategoria,
  EtiquetaRegistro, EtiquetaRegistroStatus,
} from '../../types';

type View = 'operacao' | 'controle' | 'produtos' | 'subcategorias' | 'colaboradores' | 'configuracoes';

export default function EtiquetasTab() {
  const { restaurant } = useTenant();
  const restaurantId = restaurant?.id ?? null;
  const [view, setView] = useState<View>('operacao');

  const [alertConfig, setAlertConfig] = useState<ValidadeAlertConfig | null>(null);

  useEffect(() => {
    requestNotificationPermission();
    checkValidadeAlerts(restaurantId);
    loadAlertConfig(restaurantId).then(setAlertConfig);
  }, [restaurantId]);

  useEffect(() => {
    if (!alertConfig) return;
    const stop = startValidadeScheduler(restaurantId, () => alertConfigRef.current);
    return stop;
  }, [alertConfig, restaurantId]);

  const alertConfigRef = useRef(alertConfig);
  useEffect(() => { alertConfigRef.current = alertConfig; }, [alertConfig]);

  useEffect(() => {
    const onHash = () => {
      if (sessionStorage.getItem('gula-etiquetas-goto-controle') === '1') {
        sessionStorage.removeItem('gula-etiquetas-goto-controle');
        setView('controle');
      }
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  return (
    <div className="p-3 sm:p-6 max-w-6xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
          <Tag className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Gula Etiquetas</h2>
          <p className="text-xs text-slate-400">Etiquetas de validade para segurança alimentar</p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {([
          { id: 'operacao' as View,       label: 'Impressão',     icon: Printer },
          { id: 'controle' as View,       label: 'Controle de Validade', icon: CalendarClock },
          { id: 'produtos' as View,       label: 'Produtos',      icon: PackageOpen },
          { id: 'subcategorias' as View, label: 'Subcategorias', icon: FolderOpen },
          { id: 'colaboradores' as View,  label: 'Colaboradores',  icon: Users },
          { id: 'configuracoes' as View,  label: 'Configurações',  icon: Settings },
        ]).map(t => (
          <button
            key={t.id}
            onClick={() => setView(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
              view === t.id
                ? 'bg-emerald-500 text-white'
                : 'bg-[#1a3260] text-slate-400 hover:bg-[#2a4d9a] hover:text-white'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div>
        {view === 'operacao'      && <OperacaoView restaurantId={restaurantId} restaurantName={restaurant?.name ?? ''} />}
        {view === 'controle'      && <ControleView restaurantId={restaurantId} />}
        {view === 'produtos'     && <ProdutosView restaurantId={restaurantId} />}
        {view === 'subcategorias' && <SubcategoriasView restaurantId={restaurantId} />}
        {view === 'colaboradores' && <ColaboradoresView restaurantId={restaurantId} />}
        {view === 'configuracoes' && <ConfiguracoesView restaurantId={restaurantId} />}
      </div>

      <GulaEspecialistaWidget restaurantId={restaurantId ?? undefined} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// OPERAÇÃO
// ═══════════════════════════════════════════════════════════════════════════

function OperacaoView({ restaurantId, restaurantName }: { restaurantId: string | null; restaurantName: string }) {
  const [colaboradores, setColaboradores] = useState<EtiquetaColaborador[]>([]);
  const [produtos, setProdutos] = useState<EtiquetaProduto[]>([]);
  const [subcategorias, setSubcategorias] = useState<EtiquetaSubcategoria[]>([]);
  const [selectedColaborador, setSelectedColaborador] = useState('');
  const [categoria, setCategoria] = useState<EtiquetaCategoria>('manipulado');
  const [selectedSubcategoria, setSelectedSubcategoria] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduto, setSelectedProduto] = useState('');
  const [quantidade, setQuantidade] = useState(1);
  const [loading, setLoading] = useState(true);
  const [etiquetaSize, setEtiquetaSize] = useState<EtiquetaSize>('60x40');

  useEffect(() => {
    if (!restaurantId) return;
    setLoading(true);
    Promise.all([
      supabase.from('etiqueta_colaboradores').select('*').eq('restaurant_id', restaurantId).eq('ativo', true).order('nome'),
      supabase.from('etiqueta_produtos').select('*').eq('restaurant_id', restaurantId).order('nome'),
      supabase.from('etiqueta_subcategorias').select('*').eq('restaurant_id', restaurantId).order('nome'),
      supabase.from('restaurant_settings').select('etiqueta_size').eq('restaurant_id', restaurantId).maybeSingle(),
    ]).then(([colabRes, prodRes, subRes, settingsRes]) => {
      setColaboradores(colabRes.data ?? []);
      setProdutos(prodRes.data ?? []);
      setSubcategorias(subRes.data ?? []);
      const settings = settingsRes.data as { etiqueta_size?: string | null } | null;
      setEtiquetaSize((settings?.etiqueta_size as EtiquetaSize) ?? '60x40');
      setLoading(false);
    });
  }, [restaurantId]);

  const filteredProdutos = useMemo(() => {
    let list = produtos.filter(p => p.categoria === categoria);
    if (selectedSubcategoria) {
      list = list.filter(p => p.subcategoria_id === selectedSubcategoria);
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(p => p.nome.toLowerCase().includes(q));
    }
    return list;
  }, [produtos, categoria, selectedSubcategoria, searchTerm]);

  const selectedProdutoObj = useMemo(
    () => produtos.find(p => p.id === selectedProduto),
    [produtos, selectedProduto],
  );

  const { dataImpressao, dataVencimento } = useMemo(() => {
    const now = new Date();
    const venc = new Date(now);
    if (selectedProdutoObj) {
      venc.setDate(venc.getDate() + selectedProdutoObj.validade_dias);
    }
    return { dataImpressao: now, dataVencimento: venc };
  }, [selectedProdutoObj]);

  const fmtDate = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const fmtTime = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const fmtDateTime = (d: Date) => `${fmtDate(d)} às ${fmtTime(d)}`;

  const colaboradorNome = colaboradores.find(c => c.id === selectedColaborador)?.nome ?? '';
  const canPrint = selectedColaborador && selectedProdutoObj;

  const [printing, setPrinting] = useState(false);
  const [showPersonalizada, setShowPersonalizada] = useState(false);

  async function handlePrint() {
    if (!canPrint || printing || !restaurantId) return;
    setPrinting(true);
    try {
      await printEtiqueta({
        estabelecimento: restaurantName,
        produto: selectedProdutoObj?.nome ?? '',
        colaborador: colaboradorNome,
        categoria,
        dataImpressao: `${fmtDate(dataImpressao)}`,
        dataVencimento: `${fmtDate(dataVencimento)}`,
        copies: quantidade,
        size: etiquetaSize,
      });
      const fabDate = dataImpressao.toISOString().slice(0, 10);
      const valDate = dataVencimento.toISOString().slice(0, 10);
      await supabase.from('etiqueta_registros').insert({
        restaurant_id: restaurantId,
        produto: selectedProdutoObj?.nome ?? '',
        produto_id: selectedProdutoObj?.id ?? null,
        data_fabricacao: fabDate,
        data_validade: valDate,
        responsavel: colaboradorNome,
        status: 'ativo',
      });
    } finally {
      setPrinting(false);
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="print:max-w-none print:p-0">
      {/* Etiqueta Personalizada — quick access card */}
      <button
        onClick={() => setShowPersonalizada(true)}
        className="w-full mb-5 flex items-center gap-4 p-4 rounded-2xl border-2 border-dashed border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10 hover:border-emerald-500/60 transition-all group print:hidden"
      >
        <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
          <Sparkles className="w-6 h-6 text-emerald-400" />
        </div>
        <div className="text-left">
          <p className="text-sm font-bold text-white">Etiqueta Personalizada</p>
          <p className="text-xs text-slate-400">Escreva livremente o que quiser na etiqueta</p>
        </div>
        <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-emerald-400 ml-auto transition-colors" />
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:hidden">
        {/* Left: form */}
        <div className="space-y-5">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
              <User className="w-4 h-4 text-emerald-400" />
              Colaborador / Operador
            </label>
            <select
              value={selectedColaborador}
              onChange={e => setSelectedColaborador(e.target.value)}
              className="w-full bg-[#0f2040] border border-[#1e3868] rounded-xl px-4 py-3 text-sm text-white focus:border-emerald-500 focus:outline-none transition-colors"
            >
              <option value="">Selecione um colaborador…</option>
              {colaboradores.map(c => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
            {colaboradores.length === 0 && (
              <p className="text-xs text-amber-400 mt-2">Nenhum colaborador cadastrado. Cadastre na aba "Colaboradores".</p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-slate-300 mb-2 block">Categoria do Produto</label>
            <div className="grid grid-cols-2 gap-3">
              <CategoriaButton categoria={categoria} setCategoria={(c) => { setCategoria(c); setSelectedSubcategoria(''); }} value="manipulado" icon={ChefHat} label="Manipulado" sub="Produzido no local" />
              <CategoriaButton categoria={categoria} setCategoria={(c) => { setCategoria(c); setSelectedSubcategoria(''); }} value="industrializado" icon={PackageOpen} label="Industrializado" sub="Aberto / Fornecedor" />
            </div>
          </div>

          {/* Subcategoria filter */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
              <FolderOpen className="w-4 h-4 text-emerald-400" />
              Subcategoria
            </label>
            <select
              value={selectedSubcategoria}
              onChange={e => setSelectedSubcategoria(e.target.value)}
              className="w-full bg-[#0f2040] border border-[#1e3868] rounded-xl px-4 py-3 text-sm text-white focus:border-emerald-500 focus:outline-none transition-colors"
            >
              <option value="">Todas as subcategorias</option>
              {subcategorias.filter(s => s.categoria === categoria).map(s => (
                <option key={s.id} value={s.id}>{s.nome}</option>
              ))}
            </select>
          </div>

          {/* Search + product selector */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
              <PackageOpen className="w-4 h-4 text-emerald-400" />
              Produto
            </label>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar produto por nome…"
                className="w-full bg-[#0f2040] border border-[#1e3868] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none transition-colors"
              />
            </div>
            <select
              value={selectedProduto}
              onChange={e => setSelectedProduto(e.target.value)}
              className="w-full bg-[#0f2040] border border-[#1e3868] rounded-xl px-4 py-3 text-sm text-white focus:border-emerald-500 focus:outline-none transition-colors"
            >
              <option value="">Selecione um produto…</option>
              {filteredProdutos.map(p => (
                <option key={p.id} value={p.id}>
                  {p.nome} — {p.validade_dias} dia{p.validade_dias !== 1 ? 's' : ''}
                </option>
              ))}
            </select>
            {filteredProdutos.length === 0 && (
              <p className="text-xs text-amber-400 mt-2">
                {searchTerm.trim() ? 'Nenhum produto encontrado para esta busca.' : 'Nenhum produto nesta categoria/subcategoria.'}
              </p>
            )}
          </div>

          {selectedProdutoObj && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
                <Check className="w-4 h-4" />
                Cálculo Automático de Vencimento
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-slate-500 text-xs">Data de Impressão</p>
                  <p className="text-white font-medium">{fmtDateTime(dataImpressao)}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Validade do Produto</p>
                  <p className="text-white font-medium">{selectedProdutoObj.validade_dias} dia{selectedProdutoObj.validade_dias !== 1 ? 's' : ''}</p>
                </div>
                <div className="col-span-2 pt-2 border-t border-emerald-500/20">
                  <p className="text-slate-500 text-xs">Vence em</p>
                  <p className="text-emerald-300 font-bold text-lg">{fmtDateTime(dataVencimento)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Quantity selector */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
              <Printer className="w-4 h-4 text-emerald-400" />
              Quantidade de Etiquetas
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQuantidade(q => Math.max(1, q - 1))}
                disabled={quantidade <= 1}
                className="w-11 h-11 flex items-center justify-center rounded-xl bg-[#1a3260] border border-[#1e3868] text-slate-300 hover:bg-[#2a4d9a] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
              >
                <Minus className="w-4 h-4" />
              </button>
              <input
                type="number"
                min={1}
                max={50}
                value={quantidade}
                onChange={e => setQuantidade(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                className="w-16 text-center bg-[#0f2040] border border-[#1e3868] rounded-xl px-2 py-2.5 text-base font-bold text-white focus:border-emerald-500 focus:outline-none transition-colors"
              />
              <button
                type="button"
                onClick={() => setQuantidade(q => Math.min(50, q + 1))}
                disabled={quantidade >= 50}
                className="w-11 h-11 flex items-center justify-center rounded-xl bg-[#1a3260] border border-[#1e3868] text-slate-300 hover:bg-[#2a4d9a] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
              >
                <Plus className="w-4 h-4" />
              </button>
              <span className="text-xs text-slate-500 ml-1">cópia{quantidade !== 1 ? 's' : ''} idêntica{quantidade !== 1 ? 's' : ''}</span>
            </div>
          </div>

          <button
            onClick={handlePrint}
            disabled={!canPrint || printing}
            className={`w-full flex items-center justify-center gap-2.5 px-6 py-4 rounded-xl text-base font-bold transition-all ${
              canPrint && !printing
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/30 hover:-translate-y-0.5'
                : 'bg-[#1a3260] text-slate-500 cursor-not-allowed'
            }`}
          >
            <Printer className="w-5 h-5" />
            {printing ? 'Gerando etiqueta...' : `Gerar / Imprimir ${quantidade > 1 ? `${quantidade} Etiquetas` : 'Etiqueta'}`}
          </button>
        </div>

        {/* Right: preview */}
        <div className="lg:sticky lg:top-4 self-start">
          <p className="text-sm font-medium text-slate-400 mb-3 text-center">Pré-visualização da Etiqueta</p>
          <div className="flex justify-center">
            <LabelPreview
              estabelecimento={restaurantName}
              produto={selectedProdutoObj?.nome ?? ''}
              colaborador={colaboradorNome}
              categoria={categoria}
              validadeDias={selectedProdutoObj?.validade_dias ?? 0}
              dataImpressao={dataImpressao}
              dataVencimento={dataVencimento}
              fmtDate={fmtDate}
              fmtTime={fmtTime}
              size={etiquetaSize}
            />
          </div>
          <p className="text-center text-xs text-slate-500 mt-3">
            Tamanho: {etiquetaSize === '50x40' ? '50 × 40 mm' : '60 × 40 mm'} · Margem de segurança: 0,7 mm
          </p>
        </div>
      </div>

      {showPersonalizada && (
        <PersonalizadaModal
          etiquetaSize={etiquetaSize}
          onClose={() => setShowPersonalizada(false)}
        />
      )}
    </div>
  );
}

function CategoriaButton({
  categoria, setCategoria, value, icon: Icon, label, sub,
}: {
  categoria: EtiquetaCategoria;
  setCategoria: (c: EtiquetaCategoria) => void;
  value: EtiquetaCategoria;
  icon: typeof ChefHat;
  label: string;
  sub: string;
}) {
  return (
    <button
      onClick={() => setCategoria(value)}
      className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
        categoria === value
          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
          : 'border-[#1e3868] bg-[#0f2040] text-slate-400 hover:border-slate-600'
      }`}
    >
      <Icon className="w-5 h-5 shrink-0" />
      <span className="text-left leading-tight">
        {label}<br /><span className="text-[10px] opacity-70">{sub}</span>
      </span>
    </button>
  );
}

// ── Label preview (on-screen) ───────────────────────────────────────────────

function LabelPreview({
  estabelecimento, produto, colaborador, categoria, validadeDias, dataImpressao, dataVencimento, fmtDate, fmtTime, size,
}: {
  estabelecimento: string;
  produto: string;
  colaborador: string;
  categoria: EtiquetaCategoria;
  validadeDias: number;
  dataImpressao: Date;
  dataVencimento: Date;
  fmtDate: (d: Date) => string;
  fmtTime: (d: Date) => string;
  size: EtiquetaSize;
}) {
  const isSmall = size === '50x40';
  const w = isSmall ? '200px' : '240px';
  const h = isSmall ? '160px' : '160px';
  const pad = '4px';
  const headerFs = isSmall ? '11.5px' : '12.5px';
  const produtoFs = isSmall ? '11.5px' : '12.5px';
  const fabFs = isSmall ? '14px' : '16px';
  const valFs = isSmall ? '16px' : '18px';
  const rodapeFs = isSmall ? '8px' : '9px';

  return (
    <div
      className="bg-white text-black rounded-lg shadow-2xl shadow-emerald-500/10 flex flex-col"
      style={{ width: w, height: h, padding: pad, fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}
    >
      {/* CABEÇALHO — nome do estabelecimento */}
      <div className="border-b-2 border-black pb-2 mb-3">
        <p className="font-black leading-tight uppercase truncate" style={{ fontSize: headerFs }}>{estabelecimento || 'ESTABELECIMENTO'}</p>
      </div>

      {/* INSUMO — nome do produto */}
      <p className="font-black leading-tight uppercase mb-2 line-clamp-2" style={{ fontSize: produtoFs }}>{produto || 'NOME DO INSUMO'}</p>

      {/* FABRICAÇÃO / ABERTURA */}
      <p className="font-black leading-tight uppercase" style={{ fontSize: fabFs }}>{categoria === 'industrializado' ? 'ABERTO EM:' : 'FABRICADO:'} {fmtDate(dataImpressao)}</p>

      {/* VALIDADE — mesma fonte de FABRICADO */}
      <p className="font-black leading-tight uppercase mt-1" style={{ fontSize: valFs }}>VAL: {fmtDate(dataVencimento)}</p>

      {/* RODAPÉ — responsável */}
      <div className="border-t border-black pt-1 mt-auto">
        <p className="font-bold leading-tight uppercase" style={{ fontSize: rodapeFs }}>RESPONSAVEL: {colaborador || '—'}</p>
      </div>
    </div>
  );
}



// ═══════════════════════════════════════════════════════════════════════════
// PRODUTOS
// ═══════════════════════════════════════════════════════════════════════════

function ProdutosView({ restaurantId }: { restaurantId: string | null }) {
  const [produtos, setProdutos] = useState<EtiquetaProduto[]>([]);
  const [subcategorias, setSubcategorias] = useState<EtiquetaSubcategoria[]>([]);
  const [filter, setFilter] = useState<EtiquetaCategoria | 'todos'>('todos');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EtiquetaProduto | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!restaurantId) return;
    Promise.all([
      supabase.from('etiqueta_produtos').select('*').eq('restaurant_id', restaurantId).order('categoria').order('nome'),
      supabase.from('etiqueta_subcategorias').select('*').eq('restaurant_id', restaurantId).order('nome'),
    ]).then(([prodRes, subRes]) => {
      setProdutos(prodRes.data ?? []);
      setSubcategorias(subRes.data ?? []);
      setLoading(false);
    });
  }, [restaurantId]);

  const filtered = filter === 'todos' ? produtos : produtos.filter(p => p.categoria === filter);

  async function handleDelete(id: string) {
    if (!confirm('Excluir este produto?')) return;
    await supabase.from('etiqueta_produtos').delete().eq('id', id);
    refresh();
  }

  async function refresh() {
    if (!restaurantId) return;
    const { data } = await supabase.from('etiqueta_produtos').select('*').eq('restaurant_id', restaurantId).order('categoria').order('nome');
    setProdutos(data ?? []);
  }

  if (loading) return <Spinner />;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className="flex gap-2">
          {(['todos', 'manipulado', 'industrializado'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                filter === f ? 'bg-emerald-500 text-white' : 'bg-[#1a3260] text-slate-400 hover:bg-[#2a4d9a]'
              }`}
            >
              {f === 'todos' ? 'Todos' : f === 'manipulado' ? 'Manipulados' : 'Industrializados'}
            </button>
          ))}
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo Produto
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={PackageOpen} text="Nenhum produto cadastrado." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(p => {
            const sub = subcategorias.find(s => s.id === p.subcategoria_id);
            return (
              <div key={p.id} className="bg-[#0f2040] border border-[#1e3868] rounded-2xl p-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{p.nome}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {p.categoria === 'manipulado' ? 'Manipulado' : 'Industrializado'} · {p.validade_dias} dia{p.validade_dias !== 1 ? 's' : ''}
                  </p>
                  {sub && <p className="text-xs text-emerald-400 mt-0.5">{sub.nome}</p>}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => { setEditing(p); setShowForm(true); }} className="p-2 rounded-lg bg-[#1a3260] hover:bg-[#2a4d9a] text-slate-400 hover:text-white transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="p-2 rounded-lg bg-[#1a3260] hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <ProdutoForm
          restaurantId={restaurantId}
          produto={editing}
          subcategorias={subcategorias}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); refresh(); }}
        />
      )}
    </div>
  );
}

function ProdutoForm({
  restaurantId, produto, subcategorias, onClose, onSaved,
}: {
  restaurantId: string | null;
  produto: EtiquetaProduto | null;
  subcategorias: EtiquetaSubcategoria[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState(produto?.nome ?? '');
  const [categoria, setCategoria] = useState<EtiquetaCategoria>(produto?.categoria ?? 'manipulado');
  const [subcategoriaId, setSubcategoriaId] = useState<string>(produto?.subcategoria_id ?? '');
  const [validadeDias, setValidadeDias] = useState(produto?.validade_dias ?? 1);
  const [saving, setSaving] = useState(false);

  const availableSubs = subcategorias.filter(s => s.categoria === categoria);

  async function handleSave() {
    if (!restaurantId || !nome.trim() || validadeDias < 1) return;
    setSaving(true);
    const payload = {
      nome: nome.trim(),
      categoria,
      subcategoria_id: subcategoriaId || null,
      validade_dias: validadeDias,
    };
    if (produto) {
      await supabase.from('etiqueta_produtos').update(payload).eq('id', produto.id);
    } else {
      await supabase.from('etiqueta_produtos').insert({ restaurant_id: restaurantId, ...payload });
    }
    setSaving(false);
    onSaved();
  }

  return (
    <Modal onClose={onClose} title={produto ? 'Editar Produto' : 'Novo Produto'}>
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-slate-300 mb-2 block">Nome do Produto</label>
          <input
            type="text"
            value={nome}
            onChange={e => setNome(e.target.value)}
            placeholder="Ex: Maionese da casa"
            className="w-full bg-[#0f2040] border border-[#1e3868] rounded-xl px-4 py-3 text-sm text-white focus:border-emerald-500 focus:outline-none transition-colors"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-300 mb-2 block">Categoria</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => { setCategoria('manipulado'); setSubcategoriaId(''); }}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                categoria === 'manipulado' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300' : 'border-[#1e3868] bg-[#0f2040] text-slate-400'
              }`}
            >
              <ChefHat className="w-4 h-4" />
              Manipulado
            </button>
            <button
              onClick={() => { setCategoria('industrializado'); setSubcategoriaId(''); }}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                categoria === 'industrializado' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300' : 'border-[#1e3868] bg-[#0f2040] text-slate-400'
              }`}
            >
              <PackageOpen className="w-4 h-4" />
              Industrializado
            </button>
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-slate-300 mb-2 block">Subcategoria (opcional)</label>
          <select
            value={subcategoriaId}
            onChange={e => setSubcategoriaId(e.target.value)}
            className="w-full bg-[#0f2040] border border-[#1e3868] rounded-xl px-4 py-3 text-sm text-white focus:border-emerald-500 focus:outline-none transition-colors"
          >
            <option value="">Nenhuma subcategoria</option>
            {availableSubs.map(s => (
              <option key={s.id} value={s.id}>{s.nome}</option>
            ))}
          </select>
          {availableSubs.length === 0 && (
            <p className="text-xs text-slate-500 mt-1.5">Cadastre subcategorias na aba "Subcategorias".</p>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-slate-300 mb-2 block">
            Validade (dias) {categoria === 'industrializado' && <span className="text-slate-500">— após aberto</span>}
          </label>
          <input
            type="number"
            min={1}
            max={365}
            value={validadeDias}
            onChange={e => setValidadeDias(parseInt(e.target.value) || 1)}
            className="w-full bg-[#0f2040] border border-[#1e3868] rounded-xl px-4 py-3 text-sm text-white focus:border-emerald-500 focus:outline-none transition-colors"
          />
        </div>
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saving || !nome.trim() || validadeDias < 1}
            className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-[#1a3260] disabled:text-slate-500 text-white px-4 py-3 rounded-xl text-sm font-semibold transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
          <button onClick={onClose} className="px-4 py-3 rounded-xl bg-[#1a3260] text-slate-400 hover:text-white text-sm font-medium transition-colors">
            Cancelar
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SUBCATEGORIAS
// ═══════════════════════════════════════════════════════════════════════════

function SubcategoriasView({ restaurantId }: { restaurantId: string | null }) {
  const [subcategorias, setSubcategorias] = useState<EtiquetaSubcategoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<EtiquetaSubcategoria | null>(null);

  useEffect(() => {
    if (!restaurantId) return;
    fetchSubcategorias();
  }, [restaurantId]);

  async function fetchSubcategorias() {
    if (!restaurantId) return;
    setLoading(true);
    const { data } = await supabase.from('etiqueta_subcategorias').select('*').eq('restaurant_id', restaurantId).order('categoria').order('nome');
    setSubcategorias(data ?? []);
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta subcategoria? Os produtos vinculificados ficarão sem subcategoria.')) return;
    await supabase.from('etiqueta_subcategorias').delete().eq('id', id);
    fetchSubcategorias();
  }

  if (loading) return <Spinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-semibold text-slate-300">Subcategorias de Produtos</h3>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova Subcategoria
        </button>
      </div>

      {subcategorias.length === 0 ? (
        <EmptyState icon={FolderOpen} text="Nenhuma subcategoria cadastrada. Crie para organizar seus produtos (ex: Carnes, Molhos, Laticínios)." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {subcategorias.map(s => (
            <div key={s.id} className="bg-[#0f2040] border border-[#1e3868] rounded-2xl p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <FolderOpen className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{s.nome}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {s.categoria === 'manipulado' ? 'Manipulados' : 'Industrializados'}
                  </p>
                </div>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button onClick={() => { setEditing(s); setShowForm(true); }} className="p-2 rounded-lg bg-[#1a3260] hover:bg-[#2a4d9a] text-slate-400 hover:text-white transition-colors">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDelete(s.id)} className="p-2 rounded-lg bg-[#1a3260] hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <SubcategoriaForm
          restaurantId={restaurantId}
          subcategoria={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fetchSubcategorias(); }}
        />
      )}
    </div>
  );
}

function SubcategoriaForm({
  restaurantId, subcategoria, onClose, onSaved,
}: {
  restaurantId: string | null;
  subcategoria: EtiquetaSubcategoria | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState(subcategoria?.nome ?? '');
  const [categoria, setCategoria] = useState<EtiquetaCategoria>(subcategoria?.categoria ?? 'manipulado');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!restaurantId || !nome.trim()) return;
    setSaving(true);
    const payload = { nome: nome.trim(), categoria };
    if (subcategoria) {
      await supabase.from('etiqueta_subcategorias').update(payload).eq('id', subcategoria.id);
    } else {
      await supabase.from('etiqueta_subcategorias').insert({ restaurant_id: restaurantId, ...payload });
    }
    setSaving(false);
    onSaved();
  }

  return (
    <Modal onClose={onClose} title={subcategoria ? 'Editar Subcategoria' : 'Nova Subcategoria'}>
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-slate-300 mb-2 block">Nome da Subcategoria</label>
          <input
            type="text"
            value={nome}
            onChange={e => setNome(e.target.value)}
            placeholder="Ex: Carnes, Molhos, Laticínios"
            className="w-full bg-[#0f2040] border border-[#1e3868] rounded-xl px-4 py-3 text-sm text-white focus:border-emerald-500 focus:outline-none transition-colors"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-300 mb-2 block">Categoria</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setCategoria('manipulado')}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                categoria === 'manipulado' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300' : 'border-[#1e3868] bg-[#0f2040] text-slate-400'
              }`}
            >
              <ChefHat className="w-4 h-4" />
              Manipulado
            </button>
            <button
              onClick={() => setCategoria('industrializado')}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                categoria === 'industrializado' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300' : 'border-[#1e3868] bg-[#0f2040] text-slate-400'
              }`}
            >
              <PackageOpen className="w-4 h-4" />
              Industrializado
            </button>
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saving || !nome.trim()}
            className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-[#1a3260] disabled:text-slate-500 text-white px-4 py-3 rounded-xl text-sm font-semibold transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
          <button onClick={onClose} className="px-4 py-3 rounded-xl bg-[#1a3260] text-slate-400 hover:text-white text-sm font-medium transition-colors">
            Cancelar
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COLABORADORES
// ═══════════════════════════════════════════════════════════════════════════

function ColaboradoresView({ restaurantId }: { restaurantId: string | null }) {
  const [colaboradores, setColaboradores] = useState<EtiquetaColaborador[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<EtiquetaColaborador | null>(null);

  useEffect(() => {
    if (!restaurantId) return;
    fetchColaboradores();
  }, [restaurantId]);

  async function fetchColaboradores() {
    if (!restaurantId) return;
    setLoading(true);
    const { data } = await supabase.from('etiqueta_colaboradores').select('*').eq('restaurant_id', restaurantId).order('nome');
    setColaboradores(data ?? []);
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este colaborador?')) return;
    await supabase.from('etiqueta_colaboradores').delete().eq('id', id);
    fetchColaboradores();
  }

  async function toggleAtivo(c: EtiquetaColaborador) {
    await supabase.from('etiqueta_colaboradores').update({ ativo: !c.ativo }).eq('id', c.id);
    fetchColaboradores();
  }

  if (loading) return <Spinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-semibold text-slate-300">Operadores da Cozinha</h3>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo Colaborador
        </button>
      </div>

      {colaboradores.length === 0 ? (
        <EmptyState icon={Users} text="Nenhum colaborador cadastrado." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {colaboradores.map(c => (
            <div key={c.id} className="bg-[#0f2040] border border-[#1e3868] rounded-2xl p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${c.ativo ? 'bg-emerald-500/20 text-emerald-400' : 'bg-[#1e3868] text-slate-500'}`}>
                  <User className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{c.nome}</p>
                  <button onClick={() => toggleAtivo(c)} className={`text-xs ${c.ativo ? 'text-emerald-400' : 'text-slate-500'} hover:underline`}>
                    {c.ativo ? 'Ativo' : 'Inativo'} — clicar p/ {c.ativo ? 'desativar' : 'ativar'}
                  </button>
                </div>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button onClick={() => { setEditing(c); setShowForm(true); }} className="p-2 rounded-lg bg-[#1a3260] hover:bg-[#2a4d9a] text-slate-400 hover:text-white transition-colors">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDelete(c.id)} className="p-2 rounded-lg bg-[#1a3260] hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <ColaboradorForm
          restaurantId={restaurantId}
          colaborador={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fetchColaboradores(); }}
        />
      )}
    </div>
  );
}

function ColaboradorForm({
  restaurantId, colaborador, onClose, onSaved,
}: {
  restaurantId: string | null;
  colaborador: EtiquetaColaborador | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState(colaborador?.nome ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!restaurantId || !nome.trim()) return;
    setSaving(true);
    if (colaborador) {
      await supabase.from('etiqueta_colaboradores').update({ nome: nome.trim() }).eq('id', colaborador.id);
    } else {
      await supabase.from('etiqueta_colaboradores').insert({ restaurant_id: restaurantId, nome: nome.trim() });
    }
    setSaving(false);
    onSaved();
  }

  return (
    <Modal onClose={onClose} title={colaborador ? 'Editar Colaborador' : 'Novo Colaborador'}>
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-slate-300 mb-2 block">Nome do Colaborador</label>
          <input
            type="text"
            value={nome}
            onChange={e => setNome(e.target.value)}
            placeholder="Ex: João Silva"
            className="w-full bg-[#0f2040] border border-[#1e3868] rounded-xl px-4 py-3 text-sm text-white focus:border-emerald-500 focus:outline-none transition-colors"
          />
        </div>
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saving || !nome.trim()}
            className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-[#1a3260] disabled:text-slate-500 text-white px-4 py-3 rounded-xl text-sm font-semibold transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
          <button onClick={onClose} className="px-4 py-3 rounded-xl bg-[#1a3260] text-slate-400 hover:text-white text-sm font-medium transition-colors">
            Cancelar
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTROLE DE VALIDADE
// ═══════════════════════════════════════════════════════════════════════════

function ControleView({ restaurantId }: { restaurantId: string | null }) {
  const [registros, setRegistros] = useState<EtiquetaRegistro[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'ativo' | 'consumido' | 'descartado'>('ativo');
  const [showConfig, setShowConfig] = useState(false);

  const fetchRegistros = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    let q = supabase.from('etiqueta_registros').select('*').eq('restaurant_id', restaurantId).order('data_validade', { ascending: true });
    if (filter !== 'all') q = q.eq('status', filter);
    const { data } = await q;
    setRegistros((data as EtiquetaRegistro[] | null) ?? []);
    setLoading(false);
  }, [restaurantId, filter]);

  useEffect(() => { fetchRegistros(); }, [fetchRegistros]);

  async function darSaida(id: string, status: EtiquetaRegistroStatus) {
    await supabase.from('etiqueta_registros').update({ status }).eq('id', id);
    fetchRegistros();
  }

  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  const venceHoje = registros.filter(r => r.status === 'ativo' && r.data_validade === today);
  const venceAmanha = registros.filter(r => r.status === 'ativo' && r.data_validade === tomorrow);
  const noPrazo = registros.filter(r => r.status === 'ativo' && r.data_validade !== today && r.data_validade !== tomorrow);

  if (loading) return <Spinner />;

  const fmtDateBR = (iso: string) => {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-emerald-400" /> Controle de Validades
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowConfig(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1a3260] text-slate-300 hover:bg-[#2a4d9a] hover:text-white transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
            Configurar Alerta
          </button>
          <div className="flex gap-1.5 bg-[#0f2040] rounded-xl p-1 border border-[#1e3868]">
            {(['ativo', 'consumido', 'descartado', 'all'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filter === f ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {f === 'all' ? 'Todos' : f === 'ativo' ? 'Ativos' : f === 'consumido' ? 'Consumidos' : 'Descartados'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {showConfig && <ValidadeConfigPanel restaurantId={restaurantId} />}

      {registros.length === 0 ? (
        <EmptyState icon={CalendarClock} text="Nenhuma etiqueta registrada ainda. Imprima etiquetas para acompanhar as validades aqui." />
      ) : filter === 'ativo' ? (
        <>
          {venceHoje.length > 0 && (
            <ValidadeSection title="Vence Hoje" icon={AlertTriangle} color="red" items={venceHoje} fmtDateBR={fmtDateBR} onSaida={darSaida} />
          )}
          {venceAmanha.length > 0 && (
            <ValidadeSection title="Vence Amanhã" icon={AlertCircle} color="amber" items={venceAmanha} fmtDateBR={fmtDateBR} onSaida={darSaida} />
          )}
          {noPrazo.length > 0 && (
            <ValidadeSection title="No Prazo" icon={CheckCircle2} color="emerald" items={noPrazo} fmtDateBR={fmtDateBR} onSaida={darSaida} />
          )}
          {venceHoje.length === 0 && venceAmanha.length === 0 && noPrazo.length === 0 && (
            <EmptyState icon={CheckCircle2} text="Nenhum produto ativo no momento." />
          )}
        </>
      ) : (
        <div className="space-y-2">
          {registros.map(r => (
            <RegistroCard key={r.id} registro={r} fmtDateBR={fmtDateBR} onSaida={darSaida} compact />
          ))}
        </div>
      )}
    </div>
  );
}

function ValidadeSection({
  title, icon: Icon, color, items, fmtDateBR, onSaida,
}: {
  title: string;
  icon: typeof AlertTriangle;
  color: 'red' | 'amber' | 'emerald';
  items: EtiquetaRegistro[];
  fmtDateBR: (iso: string) => string;
  onSaida: (id: string, status: EtiquetaRegistroStatus) => void;
}) {
  const colorMap = {
    red: { wrap: 'border-red-500/30 bg-red-500/10', text: 'text-red-400' },
    amber: { wrap: 'border-amber-500/30 bg-amber-500/10', text: 'text-amber-400' },
    emerald: { wrap: 'border-emerald-500/30 bg-emerald-500/10', text: 'text-emerald-400' },
  };
  const c = colorMap[color];

  return (
    <div className={`rounded-2xl border ${c.wrap} p-4 space-y-2`}>
      <div className={`flex items-center gap-2 ${c.text} font-semibold text-sm`}>
        <Icon className="w-4 h-4" />
        {title} ({items.length})
      </div>
      {items.map(r => (
        <RegistroCard key={r.id} registro={r} fmtDateBR={fmtDateBR} onSaida={onSaida} />
      ))}
    </div>
  );
}

function RegistroCard({
  registro, fmtDateBR, onSaida, compact,
}: {
  registro: EtiquetaRegistro;
  fmtDateBR: (iso: string) => string;
  onSaida: (id: string, status: EtiquetaRegistroStatus) => void;
  compact?: boolean;
}) {
  const statusColor = registro.status === 'ativo' ? 'text-emerald-400' : registro.status === 'consumido' ? 'text-blue-400' : 'text-red-400';
  const statusLabel = registro.status === 'ativo' ? 'Ativo' : registro.status === 'consumido' ? 'Consumido' : 'Descartado';

  return (
    <div className="bg-[#0f2040] border border-[#1e3868] rounded-xl p-3 flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white truncate">{registro.produto}</p>
        <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 flex-wrap">
          <span>Fab: {fmtDateBR(registro.data_fabricacao)}</span>
          <span>Val: {fmtDateBR(registro.data_validade)}</span>
          <span>Resp: {registro.responsavel}</span>
          {compact && <span className={statusColor}>● {statusLabel}</span>}
        </div>
      </div>
      {registro.status === 'ativo' && (
        <div className="flex gap-1.5 shrink-0">
          <button
            onClick={() => onSaida(registro.id, 'consumido')}
            className="flex items-center gap-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
          >
            <PackageCheck className="w-3.5 h-3.5" />
            Consumir
          </button>
          <button
            onClick={() => onSaida(registro.id, 'descartado')}
            className="flex items-center gap-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Descartar
          </button>
        </div>
      )}
    </div>
  );
}

// ── Shared UI helpers ──────────────────────────────────────────────────────

function PersonalizadaModal({
  etiquetaSize, onClose,
}: {
  etiquetaSize: EtiquetaSize;
  onClose: () => void;
}) {
  const [texto, setTexto] = useState('');
  const [printing, setPrinting] = useState(false);
  const [done, setDone] = useState(false);

  const canPrint = texto.trim().length > 0 && !printing;

  async function handlePrint() {
    if (!canPrint) return;
    setPrinting(true);
    try {
      await printEtiquetaLivre({
        texto: texto.trim(),
        copies: 1,
        size: etiquetaSize,
      });
      setDone(true);
      setTimeout(() => { onClose(); }, 1200);
    } finally {
      setPrinting(false);
    }
  }

  const isSmall = etiquetaSize === '50x40';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm print:hidden">
      <div className="bg-[#0f2040] border border-[#1e3868] rounded-2xl w-full max-w-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            Etiqueta Personalizada
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1a3260] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: free text */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-medium">Texto da Etiqueta</label>
              <textarea
                value={texto}
                onChange={e => setTexto(e.target.value)}
                placeholder="Escreva livremente o que quiser imprimir na etiqueta..."
                rows={10}
                autoFocus
                className="w-full bg-[#0a1830] border border-[#1e3868] rounded-xl px-3 py-3 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none transition-colors resize-none leading-relaxed"
              />
            </div>
            <p className="text-xs text-slate-500">O texto será impresso exatamente como digitado, respeitando quebras de linha.</p>
          </div>

          {/* Right: preview */}
          <div className="space-y-3">
            <p className="text-xs text-slate-400 font-medium">Pré-visualização ({etiquetaSize}mm)</p>
            <div className="bg-white rounded-xl p-4 flex items-center justify-center">
              <div
                className="bg-white text-black flex flex-col"
                style={{
                  width: isSmall ? '175px' : '210px',
                  height: '140px',
                  fontFamily: 'sans-serif',
                  padding: '10px',
                  overflow: 'hidden',
                }}
              >
                <div style={{ fontSize: '15px', fontWeight: 700, lineHeight: 1.3, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {texto || 'Texto da etiqueta aparecerá aqui...'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer buttons */}
        <div className="flex items-center gap-3 mt-6 pt-4 border-t border-[#1e3868]">
          <button
            onClick={handlePrint}
            disabled={!canPrint}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {printing ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : done ? (
              <Check className="w-4 h-4" />
            ) : (
              <Printer className="w-4 h-4" />
            )}
            {printing ? 'Imprimindo...' : done ? 'Concluído!' : 'Imprimir Etiqueta'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-[#1a3260] transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Shared UI helpers ──────────────────────────────────────────────────────

function ValidadeConfigPanel({ restaurantId }: { restaurantId: string | null }) {
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [horario, setHorario] = useState('08:00');
  const [ativas, setAtivas] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadAlertConfig(restaurantId).then(cfg => {
      setNome(cfg.responsavelNome);
      setTelefone(cfg.responsavelTelefone);
      setHorario(cfg.horarioNotificacao);
      setAtivas(cfg.notificacoesAtivas);
    });
  }, [restaurantId]);

  async function handleSave() {
    setSaving(true);
    try {
      await saveAlertConfig(restaurantId, {
        responsavelNome: nome,
        responsavelTelefone: telefone,
        horarioNotificacao: horario,
        notificacoesAtivas: ativas,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[#1e3868] bg-[#0f2040] p-5 space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
        <Settings className="w-4 h-4 text-emerald-400" />
        Configuração do Responsável
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs text-slate-400 font-medium">Nome do Responsável</label>
          <input
            type="text"
            value={nome}
            onChange={e => setNome(e.target.value)}
            placeholder="Ex: João Silva"
            className="w-full bg-[#0a1830] border border-[#1e3868] rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none transition-colors"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-slate-400 font-medium">Telefone de Contato</label>
          <input
            type="tel"
            value={telefone}
            onChange={e => setTelefone(e.target.value)}
            placeholder="Ex: (11) 99999-9999"
            className="w-full bg-[#0a1830] border border-[#1e3868] rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none transition-colors"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs text-slate-400 font-medium">Horário de Notificação Diária</label>
          <input
            type="time"
            value={horario}
            onChange={e => setHorario(e.target.value)}
            className="w-full bg-[#0a1830] border border-[#1e3868] rounded-xl px-3 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none transition-colors"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-slate-400 font-medium">Notificações Push</label>
          <button
            onClick={() => setAtivas(v => !v)}
            className={`relative w-14 h-7 rounded-full transition-colors ${ativas ? 'bg-emerald-500' : 'bg-slate-600'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white transition-transform ${ativas ? 'translate-x-7' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
        >
          {saving ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : saved ? (
            <Check className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar Configurações'}
        </button>
        {ativas && (
          <span className="text-xs text-emerald-400 flex items-center gap-1">
            <Zap className="w-3 h-3" />
            Alertas ativos{horario ? ` às ${horario}` : ''}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Shared UI helpers ──────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
    </div>
  );
}

function EmptyState({ icon: Icon, text }: { icon: typeof PackageOpen; text: string }) {
  return (
    <div className="text-center py-16 text-slate-500">
      <Icon className="w-12 h-12 mx-auto mb-3 opacity-40" />
      <p className="text-sm">{text}</p>
    </div>
  );
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm print:hidden">
      <div className="bg-[#0f2040] border border-[#1e3868] rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-white">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1a3260] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Configurações de impressão ──────────────────────────────────────────────
function ConfiguracoesView({ restaurantId }: { restaurantId: string | null }) {
  const [etiquetaSize, setEtiquetaSize] = useState<EtiquetaSize>('60x40');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!restaurantId) return;
    supabase
      .from('restaurant_settings')
      .select('etiqueta_size')
      .eq('restaurant_id', restaurantId)
      .maybeSingle()
      .then(({ data }) => {
        const s = data as { etiqueta_size?: string | null } | null;
        setEtiquetaSize((s?.etiqueta_size as EtiquetaSize) ?? '60x40');
        setLoading(false);
      });
  }, [restaurantId]);

  const save = async () => {
    if (!restaurantId) return;
    setSaving(true);
    setSaved(false);
    await supabase
      .from('restaurant_settings')
      .update({ etiqueta_size: etiquetaSize, updated_at: new Date().toISOString() })
      .eq('restaurant_id', restaurantId);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-slate-400 text-sm">Carregando configurações…</div>;
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Tamanho da bobina */}
      <section className="bg-[#0f2040] rounded-2xl p-6 border border-[#1e3868] space-y-4">
        <div>
          <h3 className="font-semibold text-white text-sm uppercase tracking-wider flex items-center gap-2">
            <Tag className="w-4 h-4 text-emerald-400" /> Tamanho da Bobina
          </h3>
          <p className="text-xs text-slate-500 mt-1">Selecione o modelo de bobina da sua impressora de etiquetas.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => setEtiquetaSize('60x40')}
            className={`flex items-start gap-3 p-4 rounded-xl border-2 transition-all text-left ${etiquetaSize === '60x40' ? 'border-emerald-500 bg-emerald-500/10' : 'border-[#1e3868] bg-[#1a3260] hover:border-[#2a4d9a]'}`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${etiquetaSize === '60x40' ? 'bg-emerald-500' : 'bg-[#1e3868]'}`}>
              <Tag className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-semibold text-white text-sm">Modelo A — 60 × 40 mm</p>
              <p className="text-xs text-slate-400 mt-0.5">Padrão para impressoras de mesa de maior porte.</p>
            </div>
          </button>
          <button
            onClick={() => setEtiquetaSize('50x40')}
            className={`flex items-start gap-3 p-4 rounded-xl border-2 transition-all text-left ${etiquetaSize === '50x40' ? 'border-emerald-500 bg-emerald-500/10' : 'border-[#1e3868] bg-[#1a3260] hover:border-[#2a4d9a]'}`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${etiquetaSize === '50x40' ? 'bg-emerald-500' : 'bg-[#1e3868]'}`}>
              <Tag className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-semibold text-white text-sm">Modelo B — 50 × 40 mm</p>
              <p className="text-xs text-slate-400 mt-0.5">Compacto para impressoras térmicas de 58 mm.</p>
            </div>
          </button>
        </div>
        <p className="text-xs text-slate-500">
          Margem de segurança de 7 mm aplicada em todos os lados para evitar corte de textos e códigos.
        </p>
      </section>

      {/* Botão salvar */}
      <button
        onClick={save}
        disabled={saving}
        className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
      >
        {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
        {saved ? 'Salvo!' : saving ? 'Salvando…' : 'Salvar Configurações'}
      </button>
    </div>
  );
}
