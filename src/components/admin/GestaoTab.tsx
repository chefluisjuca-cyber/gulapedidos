import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  DollarSign, ShoppingBag, TrendingUp, XCircle, Search, Download, Truck, MapPin,
  CreditCard, Banknote, Smartphone, Trophy, Bike, ChevronDown, X, Calendar,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Order } from '../../types';
import { useTenant } from '../../lib/tenant-context';
import TutorialHelpButton from './TutorialHelpButton';

type PeriodFilter = 'today' | 'yesterday' | '7d' | 'month' | 'custom';
type ModalityFilter = 'all' | 'delivery' | 'qr';
type StatusFilter = 'all' | 'closed' | 'cancelled';
type PaymentFilter = 'all' | 'pix' | 'card' | 'cash';

interface MotoboyStats {
  id: string;
  name: string;
  deliveries: number;
  totalFees: number;
}

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function endOfDay(d: Date) { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }

function normalizePayment(method: string | null | undefined): 'pix' | 'card' | 'cash' | 'other' {
  if (!method) return 'other';
  const m = method.toLowerCase();
  if (m.includes('pix')) return 'pix';
  if (m.includes('card') || m.includes('cartao') || m.includes('cartão')) return 'card';
  if (m.includes('cash') || m.includes('dinheiro')) return 'cash';
  return 'other';
}

function paymentLabel(p: 'pix' | 'card' | 'cash' | 'other'): string {
  return { pix: 'Pix', card: 'Cartão', cash: 'Dinheiro', other: 'Outros' }[p];
}

function paymentIcon(p: 'pix' | 'card' | 'cash' | 'other') {
  if (p === 'pix') return <Smartphone className="w-3.5 h-3.5" />;
  if (p === 'card') return <CreditCard className="w-3.5 h-3.5" />;
  if (p === 'cash') return <Banknote className="w-3.5 h-3.5" />;
  return <DollarSign className="w-3.5 h-3.5" />;
}

function deliveryFullAddress(order: Order): string {
  return [order.delivery_street, order.delivery_number, order.delivery_bairro, order.delivery_complement]
    .filter(Boolean).join(', ');
}

const inputCls = 'w-full bg-[#1a3260] border border-[#1e3868] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors placeholder-slate-500';

export default function GestaoTab() {
  const { restaurant } = useTenant();
  const restaurantId = restaurant?.id ?? null;

  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [motoboys, setMotoboys] = useState<MotoboyStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);

  const [period, setPeriod] = useState<PeriodFilter>('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [modality, setModality] = useState<ModalityFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
  const [search, setSearch] = useState('');

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    const q = supabase
      .from('orders')
      .select('*, order_items(*)')
      .order('created_at', { ascending: false })
      .limit(2000);
    const res = restaurantId ? await q.eq('restaurant_id', restaurantId) : await q.is('restaurant_id', null);
    if (res.data) setAllOrders(res.data as Order[]);
    setLoading(false);
  }, [restaurantId]);

  const fetchMotoboys = useCallback(async () => {
    if (!restaurantId) return;
    const { data } = await supabase
      .from('delivery_motoboys')
      .select('id, name')
      .eq('restaurant_id', restaurantId)
      .eq('active', true);
    if (!data) return;
    setMotoboys(data.map((m: { id: string; name: string }) => ({ id: m.id, name: m.name, deliveries: 0, totalFees: 0 })));
  }, [restaurantId]);

  useEffect(() => { fetchHistory(); fetchMotoboys(); }, [fetchHistory, fetchMotoboys]);

  // Date range based on period filter
  const dateRange = useMemo(() => {
    const now = new Date();
    let start: Date, end: Date = endOfDay(now);
    if (period === 'today') { start = startOfDay(now); }
    else if (period === 'yesterday') { start = startOfDay(new Date(now.getTime() - 86400000)); end = endOfDay(new Date(now.getTime() - 86400000)); }
    else if (period === '7d') { start = startOfDay(new Date(now.getTime() - 6 * 86400000)); }
    else if (period === 'month') { start = new Date(now.getFullYear(), now.getMonth(), 1); }
    else { // custom
      start = customStart ? startOfDay(new Date(customStart)) : new Date(0);
      end = customEnd ? endOfDay(new Date(customEnd)) : endOfDay(now);
    }
    return { start, end };
  }, [period, customStart, customEnd]);

  // Filtered orders
  const filtered = useMemo(() => {
    return allOrders.filter(o => {
      const d = new Date(o.created_at);
      if (d < dateRange.start || d > dateRange.end) return false;
      if (modality === 'delivery' && o.delivery_mode !== 'delivery') return false;
      if (modality === 'qr' && o.delivery_mode === 'delivery') return false;
      if (statusFilter === 'closed' && o.status !== 'closed') return false;
      if (statusFilter === 'cancelled' && !o.cancel_reason) return false;
      if (statusFilter === 'all' && o.status !== 'closed' && !o.cancel_reason) return false; // only show closed or cancelled
      if (paymentFilter !== 'all' && normalizePayment(o.delivery_payment_method || o.payment_method) !== paymentFilter) return false;
      if (search.trim()) {
        const s = search.trim().toLowerCase();
        const name = (o.delivery_name || '').toLowerCase();
        const phone = (o.delivery_whatsapp || '').toLowerCase();
        const id = o.id.toLowerCase();
        if (!name.includes(s) && !phone.includes(s) && !id.includes(s) && !`mesa ${o.table_number}`.includes(s)) return false;
      }
      return true;
    });
  }, [allOrders, dateRange, modality, statusFilter, paymentFilter, search]);

  // KPIs
  const kpis = useMemo(() => {
    const completed = filtered.filter(o => o.status === 'closed' && !o.cancel_reason);
    const cancelled = filtered.filter(o => o.cancel_reason);
    const revenue = completed.reduce((s, o) => s + o.total, 0);
    const total = completed.length + cancelled.length;
    const avgTicket = completed.length > 0 ? revenue / completed.length : 0;
    const cancelRate = total > 0 ? (cancelled.length / total) * 100 : 0;
    return { revenue, totalOrders: total, completed: completed.length, avgTicket, cancelRate, cancelledCount: cancelled.length };
  }, [filtered]);

  // Origin comparison
  const originStats = useMemo(() => {
    const completed = filtered.filter(o => o.status === 'closed' && !o.cancel_reason);
    const delivery = completed.filter(o => o.delivery_mode === 'delivery');
    const qr = completed.filter(o => o.delivery_mode !== 'delivery');
    const deliveryRev = delivery.reduce((s, o) => s + o.total, 0);
    const qrRev = qr.reduce((s, o) => s + o.total, 0);
    const total = deliveryRev + qrRev || 1;
    return { deliveryRev, qrRev, deliveryPct: (deliveryRev / total) * 100, qrPct: (qrRev / total) * 100, deliveryCount: delivery.length, qrCount: qr.length };
  }, [filtered]);

  // Payment distribution
  const paymentStats = useMemo(() => {
    const completed = filtered.filter(o => o.status === 'closed' && !o.cancel_reason);
    const dist: Record<string, { count: number; total: number }> = { pix: { count: 0, total: 0 }, card: { count: 0, total: 0 }, cash: { count: 0, total: 0 }, other: { count: 0, total: 0 } };
    for (const o of completed) {
      const p = normalizePayment(o.delivery_payment_method || o.payment_method);
      dist[p].count++;
      dist[p].total += o.total;
    }
    const grand = Object.values(dist).reduce((s, d) => s + d.total, 0) || 1;
    return { dist, grand };
  }, [filtered]);

  // Top products
  const topProducts = useMemo(() => {
    const completed = filtered.filter(o => o.status === 'closed' && !o.cancel_reason);
    const map: Record<string, { name: string; qty: number; revenue: number }> = {};
    for (const o of completed) {
      for (const item of o.order_items ?? []) {
        const key = item.product_name;
        if (!map[key]) map[key] = { name: item.product_name, qty: 0, revenue: 0 };
        map[key].qty += item.quantity;
        map[key].revenue += item.unit_price * item.quantity;
      }
    }
    return Object.values(map).sort((a, b) => b.qty - a.qty).slice(0, 5);
  }, [filtered]);

  // Motoboy report
  const motoboyStats = useMemo(() => {
    const completed = filtered.filter(o => o.status === 'closed' && !o.cancel_reason && o.delivery_mode === 'delivery');
    const stats: Record<string, { name: string; deliveries: number; totalFees: number }> = {};
    for (const m of motoboys) stats[m.id] = { name: m.name, deliveries: 0, totalFees: 0 };
    for (const o of completed) {
      const mid = o.delivery_motoboy_id;
      if (!mid) continue;
      if (!stats[mid]) stats[mid] = { name: 'Motoboy #' + mid.slice(0, 6), deliveries: 0, totalFees: 0 };
      stats[mid].deliveries++;
      stats[mid].totalFees += o.delivery_fee ?? 0;
    }
    return Object.values(stats).filter(s => s.deliveries > 0).sort((a, b) => b.deliveries - a.deliveries);
  }, [filtered, motoboys]);

  function exportCSV() {
    const headers = ['ID', 'Data/Hora', 'Cliente/Mesa', 'Modalidade', 'Itens', 'Total', 'Taxa Entrega', 'Forma Pagamento', 'Status', 'Cancelamento'];
    const rows = filtered.map(o => [
      o.id,
      new Date(o.created_at).toLocaleString('pt-BR'),
      o.delivery_mode === 'delivery' ? (o.delivery_name || 'Delivery') : `Mesa ${o.table_number}`,
      o.delivery_mode === 'delivery' ? 'Delivery' : 'QR/Mesa',
      (o.order_items ?? []).map(i => `${i.quantity}x ${i.product_name}`).join('; '),
      o.total.toFixed(2),
      (o.delivery_fee ?? 0).toFixed(2),
      o.delivery_payment_method || o.payment_method || '',
      o.cancel_reason ? 'Cancelado' : o.status,
      o.cancel_reason || '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historico_pedidos_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const periodOptions: { id: PeriodFilter; label: string }[] = [
    { id: 'today', label: 'Hoje' },
    { id: 'yesterday', label: 'Ontem' },
    { id: '7d', label: 'Últimos 7 dias' },
    { id: 'month', label: 'Este Mês' },
    { id: 'custom', label: 'Personalizado' },
  ];

  return (
    <div className="p-3 sm:p-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-amber-400" /> Gestão & Analytics
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Histórico completo e indicadores financeiros.</p>
          <TutorialHelpButton videoId="UBceIK2xaKI" title="Gestão e Indicadores" />
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 text-xs px-3 py-2 rounded-xl border transition-colors bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20"
        >
          <Download className="w-3.5 h-3.5" /> Exportar CSV
        </button>
      </div>

      {/* Filters */}
      <section className="bg-[#0f2040] rounded-2xl border border-[#1e3868] p-4 space-y-4">
        {/* Period */}
        <div className="flex flex-wrap items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
          {periodOptions.map(opt => (
            <button
              key={opt.id}
              onClick={() => setPeriod(opt.id)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${period === opt.id ? 'bg-amber-500 text-black' : 'bg-[#1a3260] text-slate-400 hover:text-white'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className={inputCls + ' max-w-[160px]'} />
            <span className="text-slate-500 text-xs">até</span>
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className={inputCls + ' max-w-[160px]'} />
          </div>
        )}
        {/* Other filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-[11px] text-slate-500 uppercase tracking-wider">Modalidade</label>
            <select value={modality} onChange={e => setModality(e.target.value as ModalityFilter)} className={inputCls + ' mt-1'}>
              <option value="all">Todos</option>
              <option value="delivery">Apenas Delivery</option>
              <option value="qr">Apenas QR/Mesa</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] text-slate-500 uppercase tracking-wider">Forma de Pagamento</label>
            <select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value as PaymentFilter)} className={inputCls + ' mt-1'}>
              <option value="all">Todas</option>
              <option value="pix">Pix</option>
              <option value="card">Cartão</option>
              <option value="cash">Dinheiro</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] text-slate-500 uppercase tracking-wider">Status</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)} className={inputCls + ' mt-1'}>
              <option value="all">Todos (Concluídos + Cancelados)</option>
              <option value="closed">Concluídos</option>
              <option value="cancelled">Cancelados</option>
            </select>
          </div>
        </div>
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome, telefone, ID do pedido ou mesa..."
            className={inputCls + ' pl-10'}
          />
        </div>
      </section>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={<DollarSign className="w-5 h-5" />} label="Faturamento" value={`R$ ${kpis.revenue.toFixed(2).replace('.', ',')}`} color="text-emerald-400" bg="bg-emerald-500/10" border="border-emerald-500/30" />
        <KpiCard icon={<ShoppingBag className="w-5 h-5" />} label="Total Pedidos" value={String(kpis.totalOrders)} color="text-amber-400" bg="bg-amber-500/10" border="border-amber-500/30" />
        <KpiCard icon={<TrendingUp className="w-5 h-5" />} label="Ticket Médio" value={`R$ ${kpis.avgTicket.toFixed(2).replace('.', ',')}`} color="text-sky-400" bg="bg-sky-500/10" border="border-sky-500/30" />
        <KpiCard icon={<XCircle className="w-5 h-5" />} label="Taxa Cancelamento" value={`${kpis.cancelRate.toFixed(1)}%`} color="text-red-400" bg="bg-red-500/10" border="border-red-500/30" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Origin comparison */}
        <section className="bg-[#0f2040] rounded-2xl border border-[#1e3868] p-5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Truck className="w-4 h-4 text-blue-400" /> Origem dos Pedidos
          </h3>
          <div className="space-y-3">
            <OriginBar icon={<Truck className="w-4 h-4 text-blue-400" />} label="Delivery" pct={originStats.deliveryPct} revenue={originStats.deliveryRev} count={originStats.deliveryCount} color="bg-blue-500" />
            <OriginBar icon={<MapPin className="w-4 h-4 text-amber-400" />} label="QR/Mesa" pct={originStats.qrPct} revenue={originStats.qrRev} count={originStats.qrCount} color="bg-amber-500" />
          </div>
        </section>

        {/* Payment distribution */}
        <section className="bg-[#0f2040] rounded-2xl border border-[#1e3868] p-5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-emerald-400" /> Formas de Pagamento
          </h3>
          <div className="space-y-3">
            {(['pix', 'card', 'cash', 'other'] as const).map(p => {
              const data = paymentStats.dist[p];
              const pct = (data.total / paymentStats.grand) * 100;
              if (data.count === 0) return null;
              return (
                <div key={p}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="flex items-center gap-1.5 text-slate-300">{paymentIcon(p)} {paymentLabel(p)} <span className="text-slate-500">({data.count})</span></span>
                    <span className="text-slate-400">R$ {data.total.toFixed(2).replace('.', ',')} · {pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-2.5 bg-[#1a3260] rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {paymentStats.grand === 1 && <p className="text-slate-500 text-xs">Sem dados no período.</p>}
          </div>
        </section>
      </div>

      {/* Top products + Motoboy report */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top products */}
        <section className="bg-[#0f2040] rounded-2xl border border-[#1e3868] p-5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" /> Top 5 Produtos
          </h3>
          {topProducts.length === 0 ? (
            <p className="text-slate-500 text-xs">Sem vendas no período.</p>
          ) : (
            <div className="space-y-2">
              {topProducts.map((p, i) => (
                <div key={p.name} className="flex items-center gap-3 bg-[#1a3260]/50 rounded-xl px-3 py-2.5">
                  <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${i === 0 ? 'bg-amber-500 text-black' : 'bg-[#1e3868] text-slate-400'}`}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{p.name}</p>
                    <p className="text-[11px] text-slate-500">{p.qty} vendidos</p>
                  </div>
                  <span className="text-sm font-semibold text-emerald-400 shrink-0">R$ {p.revenue.toFixed(2).replace('.', ',')}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Motoboy report */}
        <section className="bg-[#0f2040] rounded-2xl border border-[#1e3868] p-5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Bike className="w-4 h-4 text-orange-400" /> Relatório de Entregadores
          </h3>
          {motoboyStats.length === 0 ? (
            <p className="text-slate-500 text-xs">Sem entregas no período.</p>
          ) : (
            <div className="space-y-2">
              {motoboyStats.map(m => (
                <div key={m.name} className="flex items-center justify-between bg-[#1a3260]/50 rounded-xl px-3 py-2.5">
                  <div>
                    <p className="text-sm text-white">{m.name}</p>
                    <p className="text-[11px] text-slate-500">{m.deliveries} entregas</p>
                  </div>
                  <span className="text-sm font-semibold text-orange-400">R$ {m.totalFees.toFixed(2).replace('.', ',')}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* History table */}
      <section className="bg-[#0f2040] rounded-2xl border border-[#1e3868] overflow-hidden">
        <div className="px-5 py-3 border-b border-[#1e3868] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Histórico de Pedidos</h3>
          <span className="text-xs text-slate-500">{filtered.length} registro(s)</span>
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-500 text-sm">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">Nenhum pedido encontrado no período.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] text-slate-500 uppercase tracking-wider border-b border-[#1e3868]">
                  <th className="px-4 py-2.5 font-medium">ID</th>
                  <th className="px-4 py-2.5 font-medium">Data/Hora</th>
                  <th className="px-4 py-2.5 font-medium">Cliente/Mesa</th>
                  <th className="px-4 py-2.5 font-medium">Modal.</th>
                  <th className="px-4 py-2.5 font-medium text-right">Total</th>
                  <th className="px-4 py-2.5 font-medium">Pagamento</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(o => (
                  <tr
                    key={o.id}
                    onClick={() => setDetailOrder(o)}
                    className="border-b border-[#1e3868] hover:bg-[#1a3260]/40 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 text-slate-400 text-xs font-mono">{o.id.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-slate-300 text-xs whitespace-nowrap">{new Date(o.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="px-4 py-3 text-white text-xs">
                      {o.delivery_mode === 'delivery' ? (o.delivery_name || 'Delivery') : `Mesa ${o.table_number}`}
                    </td>
                    <td className="px-4 py-3">
                      {o.delivery_mode === 'delivery'
                        ? <Truck className="w-3.5 h-3.5 text-blue-400" />
                        : <MapPin className="w-3.5 h-3.5 text-amber-400" />}
                    </td>
                    <td className="px-4 py-3 text-right text-white font-semibold text-xs">R$ {o.total.toFixed(2).replace('.', ',')}</td>
                    <td className="px-4 py-3 text-slate-300 text-xs">{o.delivery_payment_method || o.payment_method || '—'}</td>
                    <td className="px-4 py-3">
                      {o.cancel_reason ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full border bg-red-500/20 text-red-300 border-red-500/30">Cancelado</span>
                      ) : o.status === 'closed' ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full border bg-emerald-500/20 text-emerald-300 border-emerald-500/30">Concluído</span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full border bg-yellow-500/20 text-yellow-300 border-yellow-500/30">{o.status}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Detail modal */}
      {detailOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setDetailOrder(null)}>
          <div className="bg-[#0f2040] border border-[#1e3868] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-[#1e3868]">
              <div>
                <h3 className="text-base font-bold text-white">Pedido #{detailOrder.id.slice(0, 8)}</h3>
                <p className="text-xs text-slate-500">{new Date(detailOrder.created_at).toLocaleString('pt-BR')}</p>
              </div>
              <button onClick={() => setDetailOrder(null)} className="text-slate-400 hover:text-white p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <InfoRow label="Modalidade" value={detailOrder.delivery_mode === 'delivery' ? 'Delivery' : 'QR/Mesa'} />
                <InfoRow label="Cliente/Mesa" value={detailOrder.delivery_mode === 'delivery' ? (detailOrder.delivery_name || '—') : `Mesa ${detailOrder.table_number}`} />
                {detailOrder.delivery_whatsapp && <InfoRow label="Telefone" value={detailOrder.delivery_whatsapp} />}
                <InfoRow label="Pagamento" value={detailOrder.delivery_payment_method || detailOrder.payment_method || '—'} />
                <InfoRow label="Status" value={detailOrder.cancel_reason ? 'Cancelado' : detailOrder.status} />
                {detailOrder.cancel_reason && <InfoRow label="Motivo Cancel." value={detailOrder.cancel_reason} />}
              </div>

              {detailOrder.delivery_mode === 'delivery' && (
                <div className="bg-[#1a3260]/50 rounded-xl p-3 text-sm">
                  <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">Endereço de Entrega</p>
                  <p className="text-slate-300">{deliveryFullAddress(detailOrder) || '—'}</p>
                </div>
              )}

              <div>
                <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-2">Itens</p>
                <div className="space-y-2">
                  {(detailOrder.order_items ?? []).map((item, i) => (
                    <div key={i} className="flex items-center justify-between bg-[#1a3260]/50 rounded-xl px-3 py-2 text-sm">
                      <div>
                        <span className="text-white font-medium">{item.quantity}× {item.product_name}</span>
                        {item.observations && <p className="text-[11px] text-slate-500 mt-0.5">{item.observations}</p>}
                      </div>
                      <span className="text-slate-300">R$ {(item.unit_price * item.quantity).toFixed(2).replace('.', ',')}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-[#1e3868] pt-3 space-y-1.5 text-sm">
                <div className="flex justify-between text-slate-400"><span>Subtotal</span><span>R$ {(detailOrder.total - (detailOrder.delivery_fee ?? 0)).toFixed(2).replace('.', ',')}</span></div>
                {detailOrder.delivery_fee != null && detailOrder.delivery_fee > 0 && (
                  <div className="flex justify-between text-slate-400"><span>Taxa de Entrega</span><span>R$ {detailOrder.delivery_fee.toFixed(2).replace('.', ',')}</span></div>
                )}
                <div className="flex justify-between text-white font-bold text-base"><span>Total</span><span>R$ {detailOrder.total.toFixed(2).replace('.', ',')}</span></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, color, bg, border }: { icon: React.ReactNode; label: string; value: string; color: string; bg: string; border: string }) {
  return (
    <div className={`rounded-2xl border p-4 ${bg} ${border}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={color}>{icon}</span>
        <span className="text-[11px] text-slate-400 uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
    </div>
  );
}

function OriginBar({ icon, label, pct, revenue, count, color }: { icon: React.ReactNode; label: string; pct: number; revenue: number; count: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="flex items-center gap-1.5 text-slate-300">{icon} {label} <span className="text-slate-500">({count})</span></span>
        <span className="text-slate-400">R$ {revenue.toFixed(2).replace('.', ',')} · {pct.toFixed(0)}%</span>
      </div>
      <div className="h-2.5 bg-[#1a3260] rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="text-white">{value}</p>
    </div>
  );
}
