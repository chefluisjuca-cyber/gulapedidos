import { useState } from 'react';
import { BarChart3, FileText, Save, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { DeliveryMotoboy, DeliveryOrder, DeliverySettings } from '../../types';

interface Props {
  restaurantId: string | null;
  motoboys: DeliveryMotoboy[];
}

function fmtCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDatetime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

const CHANNEL_LABELS: Record<string, string> = {
  phone: 'Tel',
  ifood: 'iFood',
  '99food': '99Food',
};

export default function FechamentoTab({ restaurantId, motoboys }: Props) {
  const [motoboyId, setMotoboyId] = useState('');
  const [dateFrom, setDateFrom] = useState(() => new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [dsettings, setDsettings] = useState<DeliverySettings | null>(null);
  const [searched, setSearched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  async function search() {
    if (!restaurantId || !motoboyId) return;
    setLoading(true);
    setSearched(false);
    setSavedId(null);

    const [{ data: orderData }, { data: settingsData }] = await Promise.all([
      supabase
        .from('delivery_orders')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('motoboy_id', motoboyId)
        .eq('status', 'delivered')
        .gte('delivered_at', `${dateFrom}T00:00:00`)
        .lte('delivered_at', `${dateTo}T23:59:59`)
        .order('delivered_at', { ascending: true }),
      supabase
        .from('delivery_settings')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .maybeSingle(),
    ]);

    setOrders((orderData ?? []) as DeliveryOrder[]);
    setDsettings(settingsData as DeliverySettings | null);
    setSearched(true);
    setLoading(false);
  }

  const totalFees = orders.reduce((s, o) => s + o.delivery_fee, 0);
  const totalTips = orders.reduce((s, o) => s + o.tip, 0);
  const dailyRate = dsettings?.daily_rate ?? 0;
  const totalPayout = dailyRate + totalFees + totalTips;
  const motoboy = motoboys.find(m => m.id === motoboyId);

  async function saveClosing() {
    if (!restaurantId || !motoboyId || !orders.length) return;
    setSaving(true);
    const { data, error } = await supabase.from('delivery_closings').insert({
      restaurant_id: restaurantId,
      motoboy_id: motoboyId,
      period_start: `${dateFrom}T00:00:00`,
      period_end: `${dateTo}T23:59:59`,
      daily_rate: dailyRate,
      total_delivery_fees: totalFees,
      total_tips: totalTips,
      total_payout: totalPayout,
      order_details: orders,
    }).select('id').single();
    if (!error && data) setSavedId(data.id);
    setSaving(false);
  }

  function exportPDF() {
    const fmt = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');
    const fmtDt = (iso: string) => fmtDatetime(iso);
    const cur = (v: number) => fmtCurrency(v);
    const now = new Date().toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

    const rows = orders.map((o, i) => `
      <tr>
        <td class="center">${i + 1}</td>
        <td class="center">${o.delivered_at ? fmtDt(o.delivered_at) : '—'}</td>
        <td>${o.customer_name || '—'}</td>
        <td>${o.customer_address}</td>
        <td class="center">${CHANNEL_LABELS[o.channel] ?? o.channel}</td>
        <td class="center">${o.distance_km != null ? o.distance_km + ' km' : '—'}</td>
        <td class="right">${cur(o.delivery_fee)}</td>
        <td class="right">${o.tip > 0 ? cur(o.tip) : '—'}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Extrato — ${motoboy?.name ?? 'Motoboy'}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 10pt;
    color: #000;
    background: #fff;
    padding: 20mm 15mm;
  }
  h1 { font-size: 14pt; font-weight: bold; margin-bottom: 2px; }
  h2 { font-size: 10pt; font-weight: normal; color: #555; margin-bottom: 12px; }
  .header-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-bottom: 14px; font-size: 9pt; }
  .header-grid strong { font-weight: bold; }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 14px;
    font-size: 9pt;
  }
  thead th {
    background: #f0f0f0;
    border: 1px solid #999;
    padding: 5px 6px;
    text-align: left;
    font-weight: bold;
    white-space: nowrap;
  }
  tbody td {
    border: 1px solid #ccc;
    padding: 4px 6px;
    vertical-align: top;
  }
  tbody tr:nth-child(even) td { background: #fafafa; }
  .center { text-align: center; }
  .right  { text-align: right;  }
  .summary {
    border: 1px solid #999;
    padding: 8px 12px;
    margin-bottom: 14px;
    font-size: 9pt;
    page-break-inside: avoid;
  }
  .summary table { margin: 0; font-size: 9pt; }
  .summary table td { border: none; padding: 2px 8px 2px 0; }
  .total-row td { font-weight: bold; font-size: 11pt; border-top: 1px solid #999 !important; padding-top: 5px !important; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 20px; page-break-inside: avoid; }
  .sig-line { border-bottom: 1px solid #000; height: 30px; margin-bottom: 4px; }
  .sig-label { font-size: 8pt; color: #555; }
  .legend {
    margin-top: 16px;
    border-top: 1px solid #ccc;
    padding-top: 8px;
    font-size: 8pt;
    color: #555;
    page-break-inside: avoid;
  }
  .legend strong { font-size: 8pt; display: block; margin-bottom: 4px; color: #000; }
  .legend-items { display: flex; gap: 16px; flex-wrap: wrap; }
  .legend-item { display: flex; align-items: center; gap: 4px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
  .dot-green  { background: #16a34a; }
  .dot-blue   { background: #2563eb; }
  .dot-red    { background: #dc2626; }
  .dot-gray   { background: #9ca3af; }
  .dot-amber  { background: #d97706; }
  .footer { margin-top: 10px; text-align: center; font-size: 8pt; color: #999; }
  @media print {
    body { padding: 10mm 12mm; }
    @page { margin: 0; size: A4; }
  }
</style>
</head>
<body>
  <h1>Gula Entregas — Extrato do Motoboy</h1>
  <h2>Folha de Pagamento</h2>

  <div class="header-grid">
    <div><strong>Motoboy:</strong> ${motoboy?.name ?? '—'}</div>
    <div><strong>Emissão:</strong> ${now}</div>
    <div><strong>Telefone:</strong> ${motoboy?.phone ?? '—'}</div>
    <div><strong>Período:</strong> ${fmt(dateFrom)} a ${fmt(dateTo)}</div>
    <div><strong>Total de entregas:</strong> ${orders.length}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="center">#</th>
        <th class="center">Data/Hora</th>
        <th>Cliente</th>
        <th>Endereço</th>
        <th class="center">Canal</th>
        <th class="center">Dist.</th>
        <th class="right">Taxa</th>
        <th class="right">Gorjeta</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <div class="summary">
    <table>
      <tr><td>Diária:</td><td class="right">${cur(dailyRate)}</td></tr>
      <tr><td>Total Taxas de Entrega (${orders.length}x):</td><td class="right">${cur(totalFees)}</td></tr>
      <tr><td>Total Gorjetas:</td><td class="right">${cur(totalTips)}</td></tr>
      <tr class="total-row"><td>TOTAL A PAGAR:</td><td class="right">${cur(totalPayout)}</td></tr>
    </table>
  </div>

  <div class="signatures">
    <div>
      <div class="sig-line"></div>
      <div class="sig-label">Assinatura do Motoboy — ${motoboy?.name ?? ''}</div>
    </div>
    <div>
      <div class="sig-line"></div>
      <div class="sig-label">Assinatura do Responsável / Caixa</div>
    </div>
  </div>

  <div class="legend">
    <strong>Legenda de Status de Entrega</strong>
    <div class="legend-items">
      <div class="legend-item"><span class="dot dot-green"></span> Entregue — Entrega concluída com sucesso</div>
      <div class="legend-item"><span class="dot dot-amber"></span> Em Rota — Saiu para entrega</div>
      <div class="legend-item"><span class="dot dot-blue"></span> Aguardando — Aguardando despacho</div>
      <div class="legend-item"><span class="dot dot-red"></span> Cancelado — Entrega cancelada</div>
      <div class="legend-item"><span class="dot dot-gray"></span> Sem dados — Informação não disponível</div>
    </div>
  </div>

  <div class="footer">Gula Pedidos Digital — Documento gerado em ${now}</div>
</body>
</html>`;

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:420px;height:560px;border:none;opacity:0;pointer-events:none;';
    document.body.appendChild(iframe);
    iframe.onload = () => {
      const w = iframe.contentWindow!;
      w.focus();
      w.print();
      w.addEventListener('afterprint', () => { if (iframe.parentNode) document.body.removeChild(iframe); }, { once: true });
      setTimeout(() => { if (iframe.parentNode) document.body.removeChild(iframe); }, 60000);
    };
    iframe.srcdoc = html;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <h2 className="font-bold text-white text-lg">Fechamento de Caixa</h2>

      {/* Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-1">Motoboy</label>
            <select
              value={motoboyId}
              onChange={e => setMotoboyId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
            >
              <option value="">Selecionar...</option>
              {motoboys.map(mb => (
                <option key={mb.id} value={mb.id}>{mb.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-1">De</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-1">Até</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>
        <button
          onClick={search}
          disabled={!motoboyId || loading}
          className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm transition-colors"
        >
          {loading
            ? <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            : <><Calendar className="w-4 h-4" /> Buscar Período</>
          }
        </button>
      </div>

      {/* Results */}
      {searched && (
        <>
          {orders.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
              <BarChart3 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">Nenhuma entrega encontrada no período</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Entregas', value: orders.length.toString(), color: 'text-white' },
                  { label: 'Diária', value: fmtCurrency(dailyRate), color: 'text-blue-400' },
                  { label: 'Taxas', value: fmtCurrency(totalFees), color: 'text-amber-400' },
                  { label: 'Gorjetas', value: fmtCurrency(totalTips), color: 'text-emerald-400' },
                ].map(stat => (
                  <div key={stat.label} className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
                    <p className={`text-lg font-bold ${stat.color}`}>{stat.value}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{stat.label}</p>
                  </div>
                ))}
              </div>

              <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-amber-400 font-semibold uppercase tracking-wide">Total a Pagar</p>
                  <p className="text-2xl font-bold text-white mt-0.5">{fmtCurrency(totalPayout)}</p>
                </div>
                <div className="text-right text-xs text-slate-400 space-y-0.5">
                  <p>Diária: {fmtCurrency(dailyRate)}</p>
                  <p>Taxas: {fmtCurrency(totalFees)}</p>
                  <p>Gorjetas: {fmtCurrency(totalTips)}</p>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-800">
                  <h3 className="font-semibold text-white text-sm">Detalhamento de Entregas</h3>
                </div>
                <div className="divide-y divide-slate-800">
                  {orders.map((order, idx) => (
                    <div key={order.id} className="px-5 py-3 flex items-start gap-3">
                      <span className="text-xs text-slate-500 w-5 shrink-0 mt-0.5">{idx + 1}.</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-400">{CHANNEL_LABELS[order.channel] ?? order.channel}</span>
                          <span className="text-xs text-slate-500">·</span>
                          <span className="text-xs text-slate-500">{order.delivered_at ? fmtDatetime(order.delivered_at) : '—'}</span>
                        </div>
                        <p className="text-sm text-white font-medium mt-0.5 truncate">{order.customer_name || 'Cliente'}</p>
                        <p className="text-xs text-slate-400 truncate">{order.customer_address}</p>
                        {order.distance_km && <p className="text-xs text-slate-500">{order.distance_km} km</p>}
                      </div>
                      <div className="text-right text-xs shrink-0">
                        <p className="text-amber-400 font-semibold">{fmtCurrency(order.delivery_fee)}</p>
                        {order.tip > 0 && <p className="text-emerald-400">+{fmtCurrency(order.tip)} gorj.</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={exportPDF}
                  className="flex-1 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
                >
                  <FileText className="w-4 h-4" /> Exportar PDF
                </button>
                {!savedId ? (
                  <button
                    onClick={saveClosing}
                    disabled={saving}
                    className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-white font-bold py-2.5 rounded-xl text-sm transition-colors"
                  >
                    {saving
                      ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <><Save className="w-4 h-4" /> Salvar Fechamento</>
                    }
                  </button>
                ) : (
                  <div className="flex-1 flex items-center justify-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold py-2.5 rounded-xl text-sm">
                    Fechamento salvo!
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
