import { useState } from 'react';
import {
  Plus, Send, CheckSquare, Square, MapPin, Clock,
  Bike, RotateCcw, X, ChevronRight, Truck, Activity,
  Search, QrCode, MessageCircle, ChevronUp, ChevronDown,
  Smartphone, Phone, Pencil, Trash2
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../lib/tenant-context';
import {
  DeliveryOrder, DeliveryMotoboy, DeliverySettings,
  DeliveryChannel, DeliveryPayment, KmZone, IfoodOrderIntegration
} from '../../types';
import DeliveryMap from './DeliveryMap';

interface Props {
  restaurantId: string | null;
  orders: DeliveryOrder[];
  motoboys: DeliveryMotoboy[];
  dsettings: DeliverySettings | null;
  ifoodOrders?: IfoodOrderIntegration[];
  onRefresh: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calcFee(distKm: number, zones: KmZone[]): number {
  if (!zones.length) return 0;
  const sorted = [...zones].sort((a, b) => b.from - a.from);
  const zone = sorted.find(z => distKm >= z.from);
  if (zone) return zone.rate;
  // Fallback: distance is below the smallest zone — use the smallest zone rate
  const minZone = [...zones].sort((a, b) => a.from - b.from)[0];
  return minZone.rate;
}

function fmtCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

const CHANNEL_LABELS: Record<DeliveryChannel, string> = { phone: 'Telefone', ifood: 'iFood', '99food': '99Food' };
const CHANNEL_COLORS: Record<DeliveryChannel, string> = {
  phone: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  ifood: 'bg-red-500/20 text-red-400 border-red-500/30',
  '99food': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
};
const PAYMENT_LABELS: Record<DeliveryPayment, string> = { cash: 'Dinheiro', card: 'Cartão', pix: 'Pix' };

// ── CEP lookup — BrasilAPI (coords), ViaCEP fallback, Nominatim geocoding ─────
interface CepResult {
  street: string; neighborhood: string; city: string; state: string;
  lat: number | null; lng: number | null;
}

async function lookupCep(cep: string): Promise<CepResult | null> {
  const clean = cep.replace(/\D/g, '');
  if (clean.length !== 8) return null;

  let result: Partial<CepResult> = {};

  // 1. BrasilAPI v2 — returns coordinates for most CEPs
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${clean}`);
    if (res.ok) {
      const d = await res.json();
      if (d.city && !d.errors) {
        result = {
          street: d.street || '',
          neighborhood: d.neighborhood || '',
          city: d.city || '',
          state: d.state || '',
          lat: d.location?.coordinates?.latitude ? parseFloat(d.location.coordinates.latitude) : null,
          lng: d.location?.coordinates?.longitude ? parseFloat(d.location.coordinates.longitude) : null,
        };
      }
    }
  } catch { /* fallthrough */ }

  // 2. ViaCEP fallback if BrasilAPI didn't return address
  if (!result.city) {
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      if (res.ok) {
        const d = await res.json();
        if (!d.erro && d.localidade) {
          result = {
            street: d.logradouro || '',
            neighborhood: d.bairro || '',
            city: d.localidade || '',
            state: d.uf || '',
            lat: null,
            lng: null,
          };
        }
      }
    } catch { /* nothing */ }
  }

  if (!result.city) return null;

  // 3. If still no coordinates, geocode the address with Nominatim
  if (result.lat == null || result.lng == null) {
    const q = [result.street, result.neighborhood, result.city, result.state, 'Brasil']
      .filter(Boolean).join(', ');
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1&countrycodes=br`,
        { headers: { Accept: 'application/json' } }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.length) {
          result.lat = parseFloat(data[0].lat);
          result.lng = parseFloat(data[0].lon);
        }
      }
    } catch { /* no coords — proceed without */ }
  }

  return result as CepResult;
}

function openWhatsApp(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

// ── Cluster entry (returned per order) ───────────────────────────────────────
interface ClusterEntry {
  colorIdx: number;    // index into CLUSTER_PALETTE (cycles)
  label: string;       // "Rota A", "Rota A G1", "Rota A G2", etc.
  isPriority: boolean; // true for first (oldest-FIFO) subgroup when sliced
}

// ── Route clustering — unlimited routes, FIFO slicing, every order colored ────
const CLUSTER_PALETTE = [
  { border: 'border-blue-500',    bg: 'bg-blue-500/10',    text: 'text-blue-400',    dot: 'bg-blue-400',    badge: 'bg-blue-600' },
  { border: 'border-amber-500',   bg: 'bg-amber-500/10',   text: 'text-amber-400',   dot: 'bg-amber-400',   badge: 'bg-amber-600' },
  { border: 'border-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400', badge: 'bg-emerald-600' },
  { border: 'border-rose-500',    bg: 'bg-rose-500/10',    text: 'text-rose-400',    dot: 'bg-rose-400',    badge: 'bg-rose-600' },
  { border: 'border-cyan-500',    bg: 'bg-cyan-500/10',    text: 'text-cyan-400',    dot: 'bg-cyan-400',    badge: 'bg-cyan-600' },
  { border: 'border-orange-500',  bg: 'bg-orange-500/10',  text: 'text-orange-400',  dot: 'bg-orange-400',  badge: 'bg-orange-600' },
  { border: 'border-pink-500',    bg: 'bg-pink-500/10',    text: 'text-pink-400',    dot: 'bg-pink-400',    badge: 'bg-pink-600' },
  { border: 'border-teal-500',    bg: 'bg-teal-500/10',    text: 'text-teal-400',    dot: 'bg-teal-400',    badge: 'bg-teal-600' },
  { border: 'border-lime-500',    bg: 'bg-lime-500/10',    text: 'text-lime-400',    dot: 'bg-lime-400',    badge: 'bg-lime-600' },
  { border: 'border-sky-500',     bg: 'bg-sky-500/10',     text: 'text-sky-400',     dot: 'bg-sky-400',     badge: 'bg-sky-600' },
  { border: 'border-yellow-500',  bg: 'bg-yellow-500/10',  text: 'text-yellow-400',  dot: 'bg-yellow-400',  badge: 'bg-yellow-600' },
  { border: 'border-red-500',     bg: 'bg-red-500/10',     text: 'text-red-400',     dot: 'bg-red-400',     badge: 'bg-red-600' },
];

const ROUTE_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
function routeParentLabel(parentIdx: number): string {
  const letter = ROUTE_LETTERS[parentIdx % ROUTE_LETTERS.length];
  const repeat = Math.floor(parentIdx / ROUTE_LETTERS.length);
  return repeat === 0 ? `Rota ${letter}` : `Rota ${letter}${repeat + 1}`;
}

// 45° sectors from Ponto Zero (0=N … 7=NW)
function bearingSector(oLat: number, oLng: number, lat: number, lng: number): number {
  const angle = Math.atan2(lng - oLng, lat - oLat) * (180 / Math.PI);
  return Math.floor(((angle + 360) % 360 + 22.5) / 45) % 8;
}

function canGroup(oLat: number | null | undefined, oLng: number | null | undefined, a: DeliveryOrder, b: DeliveryOrder): boolean {
  if (a.customer_lat == null || b.customer_lat == null) return false;
  const dist = haversineKm(a.customer_lat, a.customer_lng!, b.customer_lat!, b.customer_lng!);
  if (dist > 2) return false;
  if (oLat != null && oLng != null) {
    return bearingSector(oLat, oLng, a.customer_lat, a.customer_lng!) ===
           bearingSector(oLat, oLng, b.customer_lat!, b.customer_lng!);
  }
  return true;
}

/**
 * Returns a ClusterEntry for EVERY order with coordinates.
 * Groups via BFS. Each group is sorted FIFO (oldest first = priority).
 * If maxPerGroup > 0, oversized groups are sliced into subgroups of that size.
 */
function clusterPendingOrders(
  orders: DeliveryOrder[],
  originLat?: number | null,
  originLng?: number | null,
  maxPerGroup = 0,
): Map<string, ClusterEntry> {
  const result = new Map<string, ClusterEntry>();
  const withCoords = orders.filter(o => o.customer_lat != null && o.customer_lng != null);
  if (!withCoords.length) return result;

  const adj = new Map<string, Set<string>>();
  for (const o of withCoords) adj.set(o.id, new Set());
  for (let i = 0; i < withCoords.length; i++) {
    for (let j = i + 1; j < withCoords.length; j++) {
      if (canGroup(originLat, originLng, withCoords[i], withCoords[j])) {
        adj.get(withCoords[i].id)!.add(withCoords[j].id);
        adj.get(withCoords[j].id)!.add(withCoords[i].id);
      }
    }
  }

  const orderById = new Map(withCoords.map(o => [o.id, o]));
  const visited = new Set<string>();
  let parentIdx = 0;
  let slotIdx = 0;

  for (const root of withCoords) {
    if (visited.has(root.id)) continue;
    const component: string[] = [];
    const queue = [root.id];
    visited.add(root.id);
    while (queue.length) {
      const curr = queue.shift()!;
      component.push(curr);
      for (const nb of adj.get(curr) ?? []) {
        if (!visited.has(nb)) { visited.add(nb); queue.push(nb); }
      }
    }

    // FIFO — oldest orders first = G1 priority
    component.sort((a, b) =>
      (orderById.get(a)?.created_at ?? '').localeCompare(orderById.get(b)?.created_at ?? '')
    );

    const parentLabel = routeParentLabel(parentIdx);
    const needsSlice = maxPerGroup > 0 && component.length > maxPerGroup;

    if (needsSlice) {
      let sg = 0;
      for (let start = 0; start < component.length; start += maxPerGroup) {
        const chunk = component.slice(start, start + maxPerGroup);
        const entry: ClusterEntry = { colorIdx: slotIdx, label: `${parentLabel} G${sg + 1}`, isPriority: sg === 0 };
        for (const id of chunk) result.set(id, entry);
        slotIdx++;
        sg++;
      }
    } else {
      const entry: ClusterEntry = { colorIdx: slotIdx, label: parentLabel, isPriority: false };
      for (const id of component) result.set(id, entry);
      slotIdx++;
    }

    parentIdx++;
  }
  return result;
}

// ── Connect Motoboy Modal (QR + WhatsApp) ─────────────────────────────────────
function ConnectMotoboyModal({ motoboy, restaurantSlug, onClose }: {
  motoboy: DeliveryMotoboy;
  restaurantSlug: string;
  onClose: () => void;
}) {
  const deepLink = `${window.location.origin}/${restaurantSlug}/motoboy/${motoboy.id}`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(deepLink)}&bgcolor=1e293b&color=f59e0b&margin=10`;
  const phone = motoboy.phone?.replace(/\D/g, '');
  const waText = encodeURIComponent(`Olá ${motoboy.name}! Aqui está seu link de acesso ao Gula Entregas 🛵\n\n${deepLink}`);
  const waUrl = `https://api.whatsapp.com/send?${phone ? `phone=55${phone}&` : ''}text=${waText}`;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center">
              <Smartphone className="w-3.5 h-3.5 text-black" />
            </div>
            <h2 className="font-bold text-white">Conectar {motoboy.name}</h2>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-400 text-center">Mostre o QR Code para o motoboy escanear com a câmera.</p>
          <div className="flex justify-center">
            <div className="bg-slate-800 rounded-2xl p-3 border border-slate-700">
              <img src={qrSrc} alt="QR Code" className="w-[220px] h-[220px] rounded-xl" />
            </div>
          </div>
          <div className="bg-slate-800 rounded-xl px-3 py-2.5">
            <p className="text-[10px] text-slate-500 mb-0.5 uppercase tracking-wide">Link de acesso</p>
            <p className="text-xs text-amber-400 font-mono break-all">{deepLink}</p>
          </div>
          <button
            onClick={() => openWhatsApp(waUrl)}
            className="flex items-center justify-center gap-2 w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-sm transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            Enviar via WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}


// ── Motoboy Presence / Arrival Panel ─────────────────────────────────────────
function MotoboysPresenca({ motoboys, orders, restaurantId, onRefresh }: {
  motoboys: DeliveryMotoboy[];
  orders: DeliveryOrder[];
  restaurantId: string | null;
  onRefresh: () => void;
}) {
  const [loading, setLoading] = useState<string | null>(null);

  if (!motoboys.length || !restaurantId) return null;

  // Sorted: in-queue first (by position), then on-road, then not arrived
  const sorted = [...motoboys].sort((a, b) => {
    const aPos = a.queue_position ?? Infinity;
    const bPos = b.queue_position ?? Infinity;
    return aPos - bPos;
  });

  async function handleChegou(mb: DeliveryMotoboy) {
    setLoading(mb.id);
    const { data } = await supabase
      .from('delivery_motoboys')
      .select('queue_position')
      .eq('restaurant_id', restaurantId)
      .not('queue_position', 'is', null)
      .order('queue_position', { ascending: false })
      .limit(1);
    const nextPos = ((data?.[0]?.queue_position as number | null | undefined) ?? 0) + 1;
    await supabase.from('delivery_motoboys').update({ active: true, queue_position: nextPos }).eq('id', mb.id);
    setLoading(null);
    onRefresh();
  }

  async function handleSaiu(mb: DeliveryMotoboy) {
    setLoading(mb.id);
    await supabase.from('delivery_motoboys').update({ queue_position: null }).eq('id', mb.id);
    setLoading(null);
    onRefresh();
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-2">
        <Truck className="w-4 h-4 text-amber-400" />
        <h3 className="font-semibold text-white text-sm">Presença de Entregadores</h3>
        <span className="ml-auto text-xs text-slate-500">
          {motoboys.filter(m => m.queue_position != null).length} na fila
        </span>
      </div>
      <div className="p-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map(mb => {
          const isEnRoute = orders.some(o => o.motoboy_id === mb.id && o.status === 'dispatched');
          const inQueue = mb.queue_position != null && !isEnRoute;
          const queuedList = sorted.filter(m => m.queue_position != null && !orders.some(o => o.motoboy_id === m.id && o.status === 'dispatched'));
          const queuePos = inQueue ? queuedList.findIndex(m => m.id === mb.id) + 1 : null;
          const isLoading = loading === mb.id;

          return (
            <div key={mb.id} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
              isEnRoute ? 'border-emerald-500/30 bg-emerald-500/5'
              : inQueue ? 'border-amber-500/30 bg-amber-500/5'
              : 'border-slate-700/60 bg-slate-800/30'
            }`}>
              {/* Status dot */}
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isEnRoute ? 'bg-emerald-400 animate-pulse' : inQueue ? 'bg-amber-400' : 'bg-slate-600'}`} />

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{mb.name}</p>
                <p className={`text-[11px] ${isEnRoute ? 'text-emerald-400' : inQueue ? 'text-amber-400' : 'text-slate-500'}`}>
                  {isEnRoute ? 'Em rota' : inQueue ? `Fila #${queuePos} — próximo para despacho` : 'Não chegou'}
                </p>
              </div>

              {isEnRoute ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shrink-0">
                  EM ROTA
                </span>
              ) : inQueue ? (
                <button
                  onClick={() => handleSaiu(mb)}
                  disabled={!!isLoading}
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-slate-600 text-slate-400 hover:text-red-400 hover:border-red-500/40 transition-colors shrink-0 disabled:opacity-50"
                >
                  {isLoading ? '...' : 'Saiu'}
                </button>
              ) : (
                <button
                  onClick={() => handleChegou(mb)}
                  disabled={!!isLoading}
                  className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black transition-colors shrink-0 disabled:opacity-50"
                >
                  {isLoading ? '...' : 'Chegou!'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


function MotoboyMonitor({ motoboys, orders, dsettings, restaurantSlug, ifoodOrders, onRefresh }: {
  motoboys: DeliveryMotoboy[];
  orders: DeliveryOrder[];
  dsettings: DeliverySettings | null;
  restaurantSlug: string;
  ifoodOrders: IfoodOrderIntegration[];
  onRefresh: () => void;
}) {
  const [connectMb, setConnectMb] = useState<DeliveryMotoboy | null>(null);

  if (!motoboys.length) return null;

  // Sorted queue of available (not dispatched) motoboys with a position
  const queuedMbs = [...motoboys]
    .filter(mb => mb.active && mb.queue_position != null && !orders.some(o => o.motoboy_id === mb.id && o.status === 'dispatched'))
    .sort((a, b) => (a.queue_position ?? 0) - (b.queue_position ?? 0));

  async function moveInQueue(mb: DeliveryMotoboy, direction: 'up' | 'down') {
    const idx = queuedMbs.findIndex(m => m.id === mb.id);
    if (idx < 0) return;
    const swapWith = direction === 'up' ? queuedMbs[idx - 1] : queuedMbs[idx + 1];
    if (!swapWith) return;
    await supabase.from('delivery_motoboys').update({ queue_position: swapWith.queue_position }).eq('id', mb.id);
    await supabase.from('delivery_motoboys').update({ queue_position: mb.queue_position }).eq('id', swapWith.id);
    onRefresh();
  }

  return (
    <>
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-2">
          <Activity className="w-4 h-4 text-amber-400" />
          <h3 className="font-semibold text-white text-sm">Monitoramento de Entregadores</h3>
          <span className="ml-auto text-xs text-slate-500">Tempo real</span>
        </div>
        <div className="p-4">
          <DeliveryMap dsettings={dsettings} motoboys={motoboys} ifoodOrders={ifoodOrders} />
        </div>

        {/* Queue of available motoboys */}
        {queuedMbs.length > 0 && (
          <div className="px-4 pb-3">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Fila de Espera (Ordem de Despacho)</p>
            <div className="space-y-1.5">
              {queuedMbs.map((mb, idx) => (
                <div key={mb.id} className="flex items-center gap-2 bg-slate-800/60 border border-slate-700/50 rounded-xl px-3 py-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-black text-xs ${idx === 0 ? 'bg-amber-500 text-black' : 'bg-slate-700 text-slate-300'}`}>
                    {idx + 1}
                  </div>
                  <span className="text-sm font-semibold text-white flex-1 truncate">{mb.name}</span>
                  {idx === 0 && (
                    <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded px-1.5 font-bold shrink-0">PRÓXIMO</span>
                  )}
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => moveInQueue(mb, 'up')}
                      disabled={idx === 0}
                      className="w-5 h-5 flex items-center justify-center rounded text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => moveInQueue(mb, 'down')}
                      disabled={idx === queuedMbs.length - 1}
                      className="w-5 h-5 flex items-center justify-center rounded text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="px-4 pb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {motoboys.map(mb => {
            const active = orders.filter(o => o.motoboy_id === mb.id && o.status === 'dispatched');
            const accumulated = active.reduce((s, o) => o.payment_method === 'pix' ? s : s + o.total + o.delivery_fee, 0);
            const lastAct = active.reduce((latest: string | null, o) => {
              if (!o.dispatched_at) return latest;
              return !latest || o.dispatched_at > latest ? o.dispatched_at : latest;
            }, null);
            const isEnRoute = active.length > 0;

            return (
              <div key={mb.id} className={`rounded-xl border p-3.5 ${isEnRoute ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-slate-700/60 bg-slate-800/30'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${isEnRoute ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                  <span className="text-sm font-semibold text-white truncate flex-1">{mb.name}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${isEnRoute ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-slate-500/20 text-slate-400 border-slate-500/30'}`}>
                    {isEnRoute ? 'EM ROTA' : 'LIVRE'}
                  </span>
                </div>
                {isEnRoute ? (
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">{active.length} pedido(s) na rua</span>
                      <span className="text-amber-400 font-bold">{fmtCurrency(accumulated)}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>A prestar contas</span>
                      {lastAct && <span>Saiu: {fmtTime(lastAct)}</span>}
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {active.map(o => (
                        <div key={o.id} className="flex items-center gap-1.5 text-[11px] text-slate-400">
                          <MapPin className="w-3 h-3 text-slate-600 shrink-0" />
                          <span className="truncate flex-1">{o.customer_name || 'Cliente'}</span>
                          <span className="text-slate-500 shrink-0">{PAYMENT_LABELS[o.payment_method]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    {mb.queue_position != null ? `Fila #${queuedMbs.findIndex(m => m.id === mb.id) + 1 || '?'}` : 'Aguardando pedidos'}
                  </p>
                )}
                <button
                  onClick={() => setConnectMb(mb)}
                  className="mt-3 w-full flex items-center justify-center gap-1.5 text-[11px] text-slate-400 hover:text-amber-400 border border-slate-700 hover:border-amber-500/40 rounded-lg py-1.5 transition-colors"
                >
                  <QrCode className="w-3.5 h-3.5" /> Conectar Celular
                </button>
              </div>
            );
          })}
        </div>
      </div>
      {connectMb && (
        <ConnectMotoboyModal motoboy={connectMb} restaurantSlug={restaurantSlug} onClose={() => setConnectMb(null)} />
      )}
    </>
  );
}

// ── Order Form Modal (create + edit) ─────────────────────────────────────────
function OrderFormModal({ restaurantId, dsettings, editing, onClose, onSaved }: {
  restaurantId: string;
  dsettings: DeliverySettings | null;
  editing?: DeliveryOrder | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(editing?.customer_name ?? '');
  const [phone, setPhone] = useState(editing?.customer_phone ?? '');

  // Address — pre-fill from editing order (stored as full address string; user can re-search CEP)
  const [cep, setCep] = useState('');
  const [street, setStreet] = useState(editing?.customer_address ?? '');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [addrState, setAddrState] = useState('');
  const [cepLoading, setCepLoading] = useState(false);
  const [cepErr, setCepErr] = useState('');

  // Auto-calculated distance and fee
  const [distKm, setDistKm] = useState<number | null>(null);
  const [autoFee, setAutoFee] = useState<number | null>(null);
  const [coordsFound, setCoordsFound] = useState(false);
  const [customerLat, setCustomerLat] = useState<number | null>(null);
  const [customerLng, setCustomerLng] = useState<number | null>(null);

  const zones = dsettings?.km_zones ?? [];
  const hasRestaurantCoords = !!(dsettings?.latitude && dsettings?.longitude);

  // Order
  const [totalStr, setTotalStr] = useState(editing?.total?.toString() ?? '');
  const [feeStr, setFeeStr] = useState(editing?.delivery_fee?.toString() ?? '');
  const [payment, setPayment] = useState<DeliveryPayment>('cash');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const fee = parseFloat(feeStr) || 0;
  const total = parseFloat(totalStr) || 0;

  const fullAddress = [
    street,
    number ? `, ${number}` : '',
    complement ? ` (${complement})` : '',
    neighborhood ? ` - ${neighborhood}` : '',
    city ? `, ${city}` : '',
    addrState ? `/${addrState}` : '',
  ].join('').replace(/^,\s*/, '').trim();

  async function handleCepSearch() {
    const clean = cep.replace(/\D/g, '');
    if (clean.length !== 8) return;
    setCepLoading(true);
    setCepErr('');
    setDistKm(null);
    setAutoFee(null);
    setCoordsFound(false);
    setCustomerLat(null);
    setCustomerLng(null);

    const data = await lookupCep(clean);
    if (data) {
      setStreet(data.street);
      setNeighborhood(data.neighborhood);
      setCity(data.city);
      setAddrState(data.state);

      if (data.lat !== null && data.lng !== null) {
        setCustomerLat(data.lat);
        setCustomerLng(data.lng);
        if (hasRestaurantCoords) {
          const km = haversineKm(
            dsettings!.latitude!, dsettings!.longitude!,
            data.lat, data.lng
          );
          const calcedFee = calcFee(km, zones);
          setDistKm(parseFloat(km.toFixed(2)));
          setAutoFee(calcedFee);
          setFeeStr(calcedFee.toFixed(2));
          setCoordsFound(true);
        } else {
          setCepErr('Configure as coordenadas do Ponto Zero em Configurações para cálculo automático de taxa.');
        }
      } else if (!hasRestaurantCoords) {
        setCepErr('Configure as coordenadas do Ponto Zero em Configurações para cálculo automático de taxa.');
      }
    } else {
      setCepErr('CEP não encontrado. Preencha o endereço manualmente.');
    }
    setCepLoading(false);
  }

  async function lookupPhone() {
    if (!phone.trim()) return;
    const { data } = await supabase
      .from('delivery_customers')
      .select('name, address')
      .eq('restaurant_id', restaurantId)
      .eq('phone', phone.trim())
      .maybeSingle();
    if (data?.name) setName(data.name);
    if (data?.address) setStreet(data.address);
  }

  async function save() {
    if (!fullAddress.trim()) { setErr('Endereço obrigatório.'); return; }
    if (!total) { setErr('Informe o valor total do pedido.'); return; }
    setSaving(true);
    setErr('');
    try {
      if (phone.trim()) {
        await supabase.from('delivery_customers').upsert(
          { restaurant_id: restaurantId, phone: phone.trim(), name: name.trim() || null, address: fullAddress },
          { onConflict: 'restaurant_id,phone' }
        );
      }

      const payload = {
        customer_name: name.trim() || null,
        customer_phone: phone || null,
        customer_address: fullAddress,
        total,
        payment_method: payment,
        delivery_fee: fee,
        distance_km: distKm,
        customer_lat: customerLat,
        customer_lng: customerLng,
      };

      let error;
      if (editing) {
        ({ error } = await supabase.from('delivery_orders').update(payload).eq('id', editing.id));
      } else {
        ({ error } = await supabase.from('delivery_orders').insert({
          ...payload,
          restaurant_id: restaurantId,
          channel: 'phone' as DeliveryChannel,
          items: [],
          status: 'pending',
          tip: 0,
        }));
      }
      if (error) throw error;
      onSaved();
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erro ao salvar pedido.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/75 overflow-y-auto p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl my-4 shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h2 className="font-bold text-white">{editing ? 'Editar Pedido' : '+ Lançar Pedido Manual'}</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">

          {/* Nome */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">Nome do Cliente *</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="Ex: João Silva"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500" />
          </div>

          {/* Telefone */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">Telefone</label>
            <div className="flex gap-2">
              <input value={phone} onChange={e => setPhone(e.target.value)} onBlur={lookupPhone}
                placeholder="(00) 00000-0000"
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500" />
              <button onClick={lookupPhone} title="Buscar histórico" className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-400 hover:text-amber-400 transition-colors">
                <Phone className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* CEP */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">CEP</label>
            <div className="flex gap-2">
              <input
                value={cep}
                onChange={e => setCep(e.target.value.replace(/\D/g, '').slice(0, 8))}
                onKeyDown={e => e.key === 'Enter' && handleCepSearch()}
                placeholder="00000000" maxLength={8}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
              <button onClick={handleCepSearch} disabled={cepLoading}
                className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-bold px-4 py-2 rounded-xl text-sm transition-colors">
                {cepLoading
                  ? <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  : <Search className="w-4 h-4" />}
                <span className="hidden sm:inline">Buscar</span>
              </button>
            </div>
            {cepErr && <p className="text-xs text-yellow-400 mt-1.5">{cepErr}</p>}
          </div>

          {/* Street + Number */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="text-[11px] text-slate-500 block mb-1">Rua / Logradouro</label>
              <input value={street} onChange={e => setStreet(e.target.value)} placeholder="Av. Paulista"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500" />
            </div>
            <div>
              <label className="text-[11px] text-slate-500 block mb-1">Número</label>
              <input value={number} onChange={e => setNumber(e.target.value)} placeholder="123"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500" />
            </div>
          </div>

          {/* Complement */}
          <div>
            <label className="text-[11px] text-slate-500 block mb-1">Complemento (Apto, Bloco, Casa)</label>
            <input value={complement} onChange={e => setComplement(e.target.value)} placeholder="Ex: Apto 42, Bloco B, Casa 3"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500" />
          </div>

          {/* Neighborhood + City + State */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[11px] text-slate-500 block mb-1">Bairro</label>
              <input value={neighborhood} onChange={e => setNeighborhood(e.target.value)} placeholder="Centro"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500" />
            </div>
            <div>
              <label className="text-[11px] text-slate-500 block mb-1">Cidade</label>
              <input value={city} onChange={e => setCity(e.target.value)} placeholder="São Paulo"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500" />
            </div>
            <div>
              <label className="text-[11px] text-slate-500 block mb-1">Estado</label>
              <input value={addrState} onChange={e => setAddrState(e.target.value.slice(0, 2).toUpperCase())} placeholder="SP" maxLength={2}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 text-center uppercase" />
            </div>
          </div>

          {/* Full address preview */}
          {fullAddress && (
            <div className="flex items-start gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2">
              <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{fullAddress}</span>
            </div>
          )}

          {/* Fee result — auto-calculated + always editable */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">
              Taxa de Entrega *
              {coordsFound && distKm !== null && (
                <span className="ml-2 text-amber-400 font-normal normal-case">
                  {distKm.toFixed(2)} km calculado — editável
                </span>
              )}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold">R$</span>
              <input
                value={feeStr}
                onChange={e => setFeeStr(e.target.value)}
                type="number" step="0.50" min="0" placeholder="0,00"
                className={`w-full bg-slate-800 border rounded-xl pl-10 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none transition-colors ${
                  fee === 0 && fullAddress ? 'border-yellow-500 focus:border-yellow-400' : 'border-slate-700 focus:border-amber-500'
                }`}
              />
            </div>
            {fee === 0 && fullAddress && (
              <p className="text-xs text-yellow-400 mt-1">
                Taxa zerada — confirme ou ajuste manualmente antes de salvar.
              </p>
            )}
          </div>

          {/* Total + Payment */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">Valor Total do Pedido *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold">R$</span>
                <input value={totalStr} onChange={e => setTotalStr(e.target.value)} type="number" step="0.01" min="0" placeholder="0,00"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500" />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">Pagamento</label>
              <div className="flex gap-1.5">
                {(['cash', 'card', 'pix'] as DeliveryPayment[]).map(pm => (
                  <button key={pm} onClick={() => setPayment(pm)}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-colors ${payment === pm ? 'bg-amber-500 text-black border-amber-500' : 'border-slate-700 text-slate-400 hover:text-white'}`}
                  >{PAYMENT_LABELS[pm]}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Summary */}
          {total > 0 && (
            <div className="bg-slate-800/60 rounded-xl p-3 grid grid-cols-3 gap-3 text-sm">
              <div className="text-center"><p className="text-slate-400 text-xs mb-0.5">Pedido</p><p className="text-white font-bold">{fmtCurrency(total)}</p></div>
              <div className="text-center"><p className="text-slate-400 text-xs mb-0.5">Taxa</p><p className="text-amber-400 font-bold">{fmtCurrency(fee)}</p></div>
              <div className="text-center"><p className="text-slate-400 text-xs mb-0.5">Total</p><p className="text-white font-bold">{fmtCurrency(total + fee)}</p></div>
            </div>
          )}

          {err && <p className="text-xs text-red-400">{err}</p>}

          <button onClick={save} disabled={saving}
            className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors">
            {saving ? <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : <><Plus className="w-4 h-4" /> {editing ? 'Salvar Alterações' : 'Registrar Pedido'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Return Modal ──────────────────────────────────────────────────────────────
function ReturnModal({ order, onClose, onConfirm }: {
  order: DeliveryOrder;
  onClose: () => void;
  onConfirm: (orderId: string, tip: number) => void;
}) {
  const [tip, setTip] = useState('');
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h2 className="font-bold text-white">Confirmar Retorno</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-slate-800/60 rounded-xl p-3 text-sm space-y-1">
            <p className="text-white font-semibold">{order.customer_name || 'Cliente'}</p>
            <p className="text-slate-400 text-xs">{order.customer_address}</p>
            <div className="flex gap-4 pt-1">
              <span className="text-slate-400">Taxa: <span className="text-amber-400 font-semibold">{fmtCurrency(order.delivery_fee)}</span></span>
              <span className="text-slate-400">Pedido: <span className="text-white font-semibold">{fmtCurrency(order.total)}</span></span>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">Caixinha / Gorjeta (opcional)</label>
            <input value={tip} onChange={e => setTip(e.target.value)} type="number" step="0.50" min="0" placeholder="R$ 0,00"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500" />
            <p className="text-xs text-slate-500 mt-1">A caixinha acumula como crédito do motoboy sem alterar o faturamento bruto.</p>
          </div>
          <button onClick={() => onConfirm(order.id, parseFloat(tip) || 0)}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors">
            <RotateCcw className="w-4 h-4" /> Confirmar Entrega
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ExpedicaoTab({ restaurantId, orders, motoboys, dsettings, ifoodOrders = [], onRefresh }: Props) {
  const { restaurant } = useTenant();
  const restaurantSlug = restaurant?.slug ?? '';

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dispatchMotoboy, setDispatchMotoboy] = useState('');
  const [dispatching, setDispatching] = useState(false);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [editOrder, setEditOrder] = useState<DeliveryOrder | null>(null);
  const [returnOrder, setReturnOrder] = useState<DeliveryOrder | null>(null);

  const pending = orders.filter(o => o.status === 'pending');
  const enRoute = orders.filter(o => o.status === 'dispatched');
  const maxPerRound = dsettings?.max_deliveries_per_round ?? 0;
  const clusters = clusterPendingOrders(pending, dsettings?.latitude, dsettings?.longitude, maxPerRound);
  const thirdParty = orders.filter(o => o.status === 'third_party');
  const delivered = orders.filter(o => o.status === 'delivered');

  function toggleSelect(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function toggleAll() {
    setSelected(selected.size === pending.length ? new Set() : new Set(pending.map(o => o.id)));
  }

  async function dispatchRound() {
    if (!selected.size || !dispatchMotoboy) return;
    const ids = [...selected];
    const mb = motoboys.find(m => m.id === dispatchMotoboy);
    const dispatchedOrders = pending.filter(o => ids.includes(o.id));

    // Build and open WhatsApp synchronously inside the user gesture (before any await)
    if (mb?.phone) {
      const phone = mb.phone.replace(/\D/g, '');
      const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const lines = [
        `🛵 *GULA ENTREGAS — Nova Rodada*`,
        `Motoboy: ${mb.name}`,
        `Horário: ${now}`,
        ``,
        ...dispatchedOrders.map((o, i) =>
          `${i + 1}. ${o.customer_name || 'Cliente'}\n📍 ${o.customer_address}\n💳 ${PAYMENT_LABELS[o.payment_method]} — ${fmtCurrency(o.total)}\n🏍 Taxa: ${fmtCurrency(o.delivery_fee)}`
        ),
        ``,
        `✅ Boa entrega!`,
      ];
      const waUrl = `https://api.whatsapp.com/send?phone=55${phone}&text=${encodeURIComponent(lines.join('\n'))}`;
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    }

    setDispatching(true);
    const { error } = await supabase
      .from('delivery_orders')
      .update({ status: 'dispatched', motoboy_id: dispatchMotoboy, dispatched_at: new Date().toISOString() })
      .in('id', ids);
    if (!error) {
      // Remove dispatched motoboy from queue — they're now on the road
      await supabase.from('delivery_motoboys').update({ queue_position: null }).eq('id', dispatchMotoboy);
      setSelected(new Set());
      setDispatchMotoboy('');
      onRefresh();
    }
    setDispatching(false);
  }

  async function confirmReturn(orderId: string, tip: number) {
    const order = orders.find(o => o.id === orderId);
    await supabase.from('delivery_orders').update({ status: 'delivered', tip, delivered_at: new Date().toISOString() }).eq('id', orderId);
    // Returning motoboy joins end of queue
    if (order?.motoboy_id && restaurantId) {
      const { data } = await supabase
        .from('delivery_motoboys')
        .select('queue_position')
        .eq('restaurant_id', restaurantId)
        .not('queue_position', 'is', null)
        .order('queue_position', { ascending: false })
        .limit(1);
      const nextPos = ((data?.[0]?.queue_position as number | null | undefined) ?? 0) + 1;
      await supabase.from('delivery_motoboys').update({ queue_position: nextPos }).eq('id', order.motoboy_id);
    }
    setReturnOrder(null);
    onRefresh();
  }

  async function deleteOrder(orderId: string) {
    if (!confirm('Deseja cancelar esta entrega?')) return;
    await supabase.from('delivery_orders').delete().eq('id', orderId);
    setSelected(prev => { const n = new Set(prev); n.delete(orderId); return n; });
    onRefresh();
  }

  // Compute priority numbers per label (P1 = group with oldest pending order)
  const labelOldestAt = new Map<string, string>();
  for (const [orderId, entry] of clusters) {
    const order = pending.find(o => o.id === orderId);
    if (!order) continue;
    const cur = labelOldestAt.get(entry.label);
    if (!cur || order.created_at < cur) labelOldestAt.set(entry.label, order.created_at);
  }
  const labelPriority = new Map<string, number>();
  [...labelOldestAt.entries()]
    .sort(([, a], [, b]) => a.localeCompare(b))
    .forEach(([label], idx) => labelPriority.set(label, idx + 1));

  return (
    <div className="space-y-6">

      <MotoboysPresenca motoboys={motoboys} orders={orders} restaurantId={restaurantId} onRefresh={onRefresh} />

      <MotoboyMonitor motoboys={motoboys} orders={orders} dsettings={dsettings} restaurantSlug={restaurantSlug} ifoodOrders={ifoodOrders} onRefresh={onRefresh} />

      <div className="flex items-center justify-between">
        <h2 className="font-bold text-white text-lg">Mesa de Expedição</h2>
        <button onClick={() => setShowNewOrder(true)}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-bold px-4 py-2 rounded-xl text-sm transition-colors">
          <Plus className="w-4 h-4" /> Novo Pedido
        </button>
      </div>

      {/* Pending */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <h3 className="font-semibold text-white text-sm">Aguardando Despacho</h3>
            <span className="text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded-full font-semibold">{pending.length}</span>
          </div>
          {pending.length > 0 && (
            <button onClick={toggleAll} className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1">
              {selected.size === pending.length ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
              {selected.size === pending.length ? 'Desmarcar' : 'Selecionar tudo'}
            </button>
          )}
        </div>

        {/* Cluster legend + fair-share suggestion */}
        {clusters.size > 0 && (() => {
          // Deduplicate by label
          const seen = new Map<string, { entry: ClusterEntry; count: number; oldestAt: string }>();
          for (const [orderId, entry] of clusters) {
            const order = pending.find(o => o.id === orderId);
            if (!order) continue;
            const existing = seen.get(entry.label);
            if (existing) {
              existing.count++;
              if (order.created_at < existing.oldestAt) existing.oldestAt = order.created_at;
            } else {
              seen.set(entry.label, { entry, count: 1, oldestAt: order.created_at });
            }
          }
          // Sort by oldest order time → P1 = most urgent
          const legend = [...seen.values()].sort((a, b) => a.oldestAt.localeCompare(b.oldestAt));
          // Available motoboys sorted by queue position (front = longest waiting)
          const availableMbs = [...motoboys]
            .filter(mb => mb.active && mb.queue_position != null && !orders.some(o => o.motoboy_id === mb.id && o.status === 'dispatched'))
            .sort((a, b) => (a.queue_position ?? 0) - (b.queue_position ?? 0));
          return (
            <div className="space-y-2 mb-3">
              <div className="flex flex-wrap gap-2">
                {legend.map(({ entry, count }) => {
                  const p = CLUSTER_PALETTE[entry.colorIdx % CLUSTER_PALETTE.length];
                  const pNum = labelPriority.get(entry.label) ?? 0;
                  return (
                    <div key={entry.label} className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${p.border} ${p.bg} ${p.text}`}>
                      <span className={`w-2 h-2 rounded-full ${p.dot}`} />
                      <span className="bg-white/15 rounded-full px-1.5 text-[10px] font-black">P{pNum}</span>
                      {entry.label}
                      <span className="opacity-60">· {count}</span>
                    </div>
                  );
                })}
              </div>
              {/* Fair-share suggestion when limit is active and there are available motoboys */}
              {maxPerRound > 0 && availableMbs.length > 0 && (
                <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                  <span className="text-slate-500 self-center">Sugestão de distribuição:</span>
                  {legend.slice(0, availableMbs.length).map(({ entry }, i) => {
                    const p = CLUSTER_PALETTE[entry.colorIdx % CLUSTER_PALETTE.length];
                    const mb = availableMbs[i % availableMbs.length];
                    const pNum = labelPriority.get(entry.label) ?? i + 1;
                    return (
                      <span key={entry.label} className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border ${p.border} ${p.bg} ${p.text}`}>
                        <span className="text-[9px] font-black">P{pNum}</span>
                        <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />
                        {entry.label} → {mb.name}
                      </span>
                    );
                  })}
                </div>
              )}
              <p className="text-[11px] text-slate-600">Despache pedidos da mesma cor para o mesmo motoboy · P1 = mais urgente</p>
            </div>
          );
        })()}

        {pending.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
            <Bike className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">Nenhum pedido aguardando despacho</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {pending.map(order => {
              const isSel = selected.has(order.id);
              const entry = clusters.get(order.id);
              const palette = entry ? CLUSTER_PALETTE[entry.colorIdx % CLUSTER_PALETTE.length] : null;
              const pNum = entry ? (labelPriority.get(entry.label) ?? null) : null;
              return (
                <div key={order.id} onClick={() => toggleSelect(order.id)}
                  className={`border-4 rounded-2xl overflow-hidden cursor-pointer transition-all select-none
                    ${isSel
                      ? 'border-amber-500 bg-amber-500/5'
                      : palette
                        ? `${palette.border} bg-slate-900`
                        : 'border-slate-700 bg-slate-900 hover:border-slate-600'
                    }`}>

                  {/* Route badge header */}
                  {entry && palette && (
                    <div className={`px-4 py-1.5 flex items-center justify-between ${palette.badge}`}>
                      <div className="flex items-center gap-2">
                        {isSel ? <CheckSquare className="w-3.5 h-3.5 text-white" /> : <Square className="w-3.5 h-3.5 text-white/70" />}
                        <span className="text-white text-xs font-black uppercase tracking-widest">{entry.label}</span>
                      </div>
                      {pNum != null && (
                        <span className="text-[10px] bg-white/25 text-white border border-white/30 rounded-full px-2 py-0.5 font-black">P{pNum}</span>
                      )}
                    </div>
                  )}

                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      {!entry && (
                        <div className="mt-0.5">
                          {isSel ? <CheckSquare className="w-4 h-4 text-amber-400" /> : <Square className="w-4 h-4 text-slate-600" />}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded border ${CHANNEL_COLORS[order.channel]}`}>{CHANNEL_LABELS[order.channel]}</span>
                          <span className="text-xs text-slate-500">{fmtTime(order.created_at)}</span>
                          {!entry && isSel && <CheckSquare className="w-4 h-4 text-amber-400 ml-auto" />}
                        </div>
                      <p className="text-white font-bold text-base leading-tight truncate">
                        {order.customer_name || <span className="text-slate-400 font-semibold">{order.customer_phone || 'Cliente'}</span>}
                      </p>
                      {order.customer_name && order.customer_phone && (
                        <p className="text-slate-500 text-[11px]">{order.customer_phone}</p>
                      )}
                      <div className="flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                        <p className="text-slate-400 text-xs truncate">{order.customer_address}</p>
                      </div>
                      <div className="flex items-center gap-2 mt-2 text-xs flex-wrap">
                        <span className="text-slate-300 font-semibold">{fmtCurrency(order.total)}</span>
                        <span className={`font-semibold ${order.delivery_fee > 0 ? 'text-amber-400' : 'text-red-400'}`}>
                          {order.delivery_fee > 0 ? `+${fmtCurrency(order.delivery_fee)} taxa` : 'SEM TAXA'}
                        </span>
                        {order.distance_km && <span className="text-slate-400">{order.distance_km}km</span>}
                        <span className="text-slate-500">{PAYMENT_LABELS[order.payment_method]}</span>
                      </div>
                      {/* Edit / Delete actions */}
                      <div className="flex gap-1.5 mt-2.5 pt-2 border-t border-slate-700/50">
                        <button
                          onClick={e => { e.stopPropagation(); setEditOrder(order); }}
                          className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-amber-400 border border-slate-700 hover:border-amber-500/50 rounded-lg px-2 py-1 transition-colors"
                        >
                          <Pencil className="w-3 h-3" /> Editar
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); deleteOrder(order.id); }}
                          className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-500/50 rounded-lg px-2 py-1 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" /> Cancelar
                        </button>
                      </div>
                    </div>
                  </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Dispatch floating bar */}
        {selected.size > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-full max-w-lg px-4">
            <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-4 shadow-2xl shadow-black/60">
              <p className="text-xs text-amber-400 font-semibold mb-3">{selected.size} pedido(s) selecionado(s)</p>
              <div className="flex gap-3">
                <select value={dispatchMotoboy} onChange={e => setDispatchMotoboy(e.target.value)}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500">
                  <option value="">Selecionar motoboy...</option>
                  {motoboys.map(mb => <option key={mb.id} value={mb.id}>{mb.name}</option>)}
                </select>
                <button onClick={dispatchRound} disabled={!dispatchMotoboy || dispatching}
                  className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-bold px-4 py-2 rounded-xl text-sm transition-colors">
                  {dispatching
                    ? <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    : <><Send className="w-4 h-4" /> Despachar Rodada</>
                  }
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* En route */}
      {enRoute.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Bike className="w-4 h-4 text-emerald-400" />
            <h3 className="font-semibold text-white text-sm">Em Rota</h3>
            <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-full font-semibold">{enRoute.length}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {enRoute.map(order => {
              const mb = motoboys.find(m => m.id === order.motoboy_id);
              return (
                <div key={order.id} className="bg-slate-900 border border-emerald-500/20 rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded border ${CHANNEL_COLORS[order.channel]}`}>{CHANNEL_LABELS[order.channel]}</span>
                        {mb && <span className="text-xs text-emerald-400 font-semibold">{mb.name}</span>}
                      </div>
                      <p className="text-white font-bold text-base leading-tight truncate">
                        {order.customer_name || <span className="text-slate-400 font-semibold">{order.customer_phone || 'Cliente'}</span>}
                      </p>
                      {order.customer_name && order.customer_phone && (
                        <p className="text-slate-500 text-[11px]">{order.customer_phone}</p>
                      )}
                      <div className="flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                        <p className="text-slate-400 text-xs truncate">{order.customer_address}</p>
                      </div>
                      <div className="flex items-center gap-2 mt-2 text-xs">
                        <span className="text-slate-300 font-semibold">{fmtCurrency(order.total)}</span>
                        <span className="text-amber-400">+{fmtCurrency(order.delivery_fee)} taxa</span>
                      </div>
                      {order.dispatched_at && <p className="text-xs text-slate-500 mt-1">Saiu às {fmtTime(order.dispatched_at)}</p>}
                    </div>
                    <button onClick={() => setReturnOrder(order)}
                      className="shrink-0 flex items-center gap-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-400 font-semibold px-3 py-1.5 rounded-xl text-xs transition-colors">
                      <RotateCcw className="w-3.5 h-3.5" /> Retornou
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Third party */}
      {thirdParty.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Truck className="w-4 h-4 text-slate-400" />
            <h3 className="font-semibold text-white text-sm">Entregues por Terceiros</h3>
            <span className="text-xs bg-slate-500/20 text-slate-400 border border-slate-500/30 px-1.5 py-0.5 rounded-full font-semibold">{thirdParty.length}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {thirdParty.map(order => (
              <div key={order.id} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 opacity-70">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded border ${CHANNEL_COLORS[order.channel]}`}>{CHANNEL_LABELS[order.channel]}</span>
                  <span className="text-xs text-slate-500">{fmtTime(order.created_at)}</span>
                </div>
                <p className="text-slate-300 font-semibold text-sm truncate">{order.customer_name || order.customer_phone || 'Cliente'}</p>
                <p className="text-slate-500 text-xs mt-0.5 truncate">{order.customer_address}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Delivered stats */}
      {delivered.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <ChevronRight className="w-4 h-4 text-slate-400" />
            <h3 className="font-semibold text-white text-sm">Realizadas Hoje</h3>
            <span className="text-xs bg-slate-500/20 text-slate-400 border border-slate-500/30 px-1.5 py-0.5 rounded-full font-semibold">{delivered.length}</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Entregas', value: delivered.length.toString(), color: 'text-white' },
              { label: 'Taxas', value: fmtCurrency(delivered.reduce((s, o) => s + o.delivery_fee, 0)), color: 'text-amber-400' },
              { label: 'Gorjetas', value: fmtCurrency(delivered.reduce((s, o) => s + o.tip, 0)), color: 'text-emerald-400' },
            ].map(stat => (
              <div key={stat.label} className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
                <p className={`text-lg font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-xs text-slate-400 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {showNewOrder && restaurantId && (
        <OrderFormModal restaurantId={restaurantId} dsettings={dsettings} onClose={() => setShowNewOrder(false)} onSaved={onRefresh} />
      )}
      {editOrder && restaurantId && (
        <OrderFormModal restaurantId={restaurantId} dsettings={dsettings} editing={editOrder} onClose={() => setEditOrder(null)} onSaved={onRefresh} />
      )}
      {returnOrder && (
        <ReturnModal order={returnOrder} onClose={() => setReturnOrder(null)} onConfirm={confirmReturn} />
      )}
    </div>
  );
}
