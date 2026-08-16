import { useState, useEffect, useRef, useCallback } from 'react';
import { ChefHat, CheckCircle, Clock, Volume2, VolumeX, Wifi, WifiOff, Bell, Pause } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Order, OrderStatus } from '../../types';
import { useTenant } from '../../lib/tenant-context';
import { PauseRestaurantModal, usePauseState, PauseCountdownBadge } from '../admin/PauseRestaurantModal';

// ─── Audio ────────────────────────────────────────────────────────────────────

function createAudioContext(): AudioContext | null {
  try { return new AudioContext(); } catch { return null; }
}

function playNewOrderSound(ctx: AudioContext) {
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.7, ctx.currentTime);
  master.connect(ctx.destination);

  // Three-tone ascending chime
  const tones = [
    { freq: 880,  start: 0,    dur: 0.15 },
    { freq: 1100, start: 0.18, dur: 0.15 },
    { freq: 1320, start: 0.36, dur: 0.25 },
  ];

  tones.forEach(({ freq, start, dur }) => {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.connect(env);
    env.connect(master);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
    env.gain.setValueAtTime(0, ctx.currentTime + start);
    env.gain.linearRampToValueAtTime(0.9, ctx.currentTime + start + 0.015);
    env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
    osc.start(ctx.currentTime + start);
    osc.stop(ctx.currentTime + start + dur + 0.01);
  });
}

// ─── Elapsed timer ────────────────────────────────────────────────────────────

function ElapsedTimer({ createdAt }: { createdAt: string }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsed = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  const isRed = mins >= 15;
  const isYellow = !isRed && mins >= 8;

  const colorCls = isRed ? 'text-red-400' : isYellow ? 'text-yellow-400' : 'text-slate-400';
  const bgCls    = isRed ? 'bg-red-500/10 border-red-500/30' : isYellow ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-slate-800 border-slate-700';
  const blinkCls = isRed ? 'animate-pulse' : '';

  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${bgCls} ${blinkCls}`}>
      <Clock className={`w-3.5 h-3.5 ${colorCls}`} />
      <span className={`font-mono font-bold text-sm tabular-nums ${colorCls}`}>
        {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </span>
    </div>
  );
}

// ─── Status config ─────────────────────────────────────────────────────────────

const STATUS_NEXT: Partial<Record<OrderStatus, { next: OrderStatus; label: string; btnCls: string }>> = {
  pending: {
    next: 'preparing',
    label: 'Iniciar Preparo',
    btnCls: 'bg-blue-500 hover:bg-blue-400 active:bg-blue-600',
  },
  preparing: {
    next: 'ready',
    label: 'Marcar como Pronto',
    btnCls: 'bg-green-500 hover:bg-green-400 active:bg-green-600',
  },
};

const STATUS_LABEL: Record<OrderStatus, { label: string; dot: string }> = {
  pending:   { label: 'Aguardando', dot: 'bg-yellow-400' },
  preparing: { label: 'Em Preparo', dot: 'bg-blue-400' },
  ready:     { label: 'Pronto',     dot: 'bg-green-400' },
  closed:    { label: 'Finalizado', dot: 'bg-slate-500' },
};

// ─── Order card ───────────────────────────────────────────────────────────────

interface OrderCardProps {
  order: Order;
  shortcutIndex: number | null; // 1–9, or null if no shortcut
  onAdvance: (id: string, next: OrderStatus) => Promise<void>;
  actionRef: React.MutableRefObject<(() => void) | null>;
}

function OrderCard({ order, shortcutIndex, onAdvance, actionRef }: OrderCardProps) {
  const [advancing, setAdvancing] = useState(false);
  const action = STATUS_NEXT[order.status];
  const statusInfo = STATUS_LABEL[order.status];

  const handleAdvance = useCallback(async () => {
    if (!action || advancing) return;
    setAdvancing(true);
    await onAdvance(order.id, action.next);
    setAdvancing(false);
  }, [action, advancing, onAdvance, order.id]);

  // Register the action in the ref so the keyboard handler can call it
  useEffect(() => {
    if (actionRef) actionRef.current = action ? handleAdvance : null;
  });

  const isPending  = order.status === 'pending';
  const isPreparing = order.status === 'preparing';
  const cardBorder = isPending
    ? 'border-yellow-500/50 shadow-yellow-500/10 shadow-lg'
    : isPreparing
    ? 'border-blue-500/30'
    : 'border-slate-700/50';

  return (
    <div className={`relative flex flex-col bg-[#0f1623] border-2 rounded-2xl overflow-hidden transition-all ${cardBorder}`}>

      {/* Keyboard shortcut badge */}
      {shortcutIndex !== null && (
        <div className="absolute top-2 right-2 z-10 w-5 h-5 rounded-md bg-slate-700 border border-slate-600 flex items-center justify-center">
          <span className="text-[10px] font-black text-slate-300 leading-none">{shortcutIndex}</span>
        </div>
      )}

      {/* Header */}
      <div className={`px-4 py-3 flex items-center justify-between ${isPending ? 'bg-yellow-500/5' : isPreparing ? 'bg-blue-500/5' : ''}`}>
        <div className="flex items-center gap-2.5">
          <div className="flex flex-col">
            <span className="text-white font-black text-2xl leading-none tabular-nums">
              {String(order.table_number).padStart(2, '0')}
            </span>
            <span className="text-slate-500 text-[9px] uppercase tracking-widest">mesa</span>
          </div>
          <div className="w-px h-8 bg-slate-700" />
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${statusInfo.dot} ${isPending ? 'animate-pulse' : ''}`} />
            <span className="text-xs text-slate-400 font-medium">{statusInfo.label}</span>
          </div>
        </div>
        <ElapsedTimer createdAt={order.created_at} />
      </div>

      {/* Items */}
      <div className="flex-1 px-4 py-3 space-y-2 border-t border-slate-800">
        {(order.order_items ?? []).map(item => (
          <div key={item.id}>
            <div className="flex items-baseline gap-2">
              <span className={`text-xl font-black tabular-nums leading-none ${isPending ? 'text-yellow-400' : isPreparing ? 'text-blue-400' : 'text-white'}`}>
                {item.quantity}×
              </span>
              <span className="text-white font-semibold text-sm leading-tight">{item.product_name}</span>
            </div>

            {item.customizations?.combos?.map((c, i) => {
              const chosen = c.items.filter(x => x.qty > 0);
              if (!chosen.length) return null;
              return (
                <p key={i} className="text-slate-400 text-xs ml-7 mt-0.5">
                  {c.groupName}: {chosen.map(x => x.name).join(', ')}
                </p>
              );
            })}

            {item.customizations?.extras?.filter(e => e.qty > 0).map((e, i) => (
              <p key={i} className="text-slate-400 text-xs ml-7 mt-0.5">
                +{e.qty}× {e.name}
              </p>
            ))}
          </div>
        ))}

        {order.notes && (
          <div className="mt-2 flex items-start gap-1.5 bg-red-500/10 border border-red-500/30 rounded-lg px-2.5 py-2">
            <span className="text-red-400 text-xs font-bold shrink-0 mt-0.5">OBS:</span>
            <p className="text-red-300 text-xs font-medium leading-snug">{order.notes}</p>
          </div>
        )}
      </div>

      {/* Advance button */}
      {action ? (
        <div className="px-4 pb-4 pt-2">
          <button
            onClick={handleAdvance}
            disabled={advancing}
            className={`w-full flex flex-col items-center justify-center gap-1 py-3.5 rounded-xl text-white font-bold tracking-wide transition-all disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98] ${action.btnCls}`}
          >
            {advancing ? (
              <span className="flex items-center gap-2 text-sm">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Atualizando...
              </span>
            ) : (
              <>
                <span className="flex items-center gap-2 text-base">
                  {action.next === 'ready' ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <ChefHat className="w-4 h-4" />
                  )}
                  {action.label}
                </span>
                {shortcutIndex !== null && (
                  <span className="text-[13px] font-black tracking-widest px-3 py-0.5 rounded-lg bg-black/20 border border-white/15 font-mono">
                    TECLA {shortcutIndex}
                  </span>
                )}
              </>
            )}
          </button>
        </div>
      ) : order.status === 'ready' ? (
        <div className="px-4 pb-4 pt-2">
          <div className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-sm font-semibold">
            <CheckCircle className="w-4 h-4" />
            Pronto para entrega
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ─── Main KDS ─────────────────────────────────────────────────────────────────

export default function KitchenKDS() {
  const { restaurant } = useTenant();
  const restaurantId = restaurant?.id ?? null;
  const { pausedUntil, isPaused, showPauseModal, setShowPauseModal } = usePauseState(restaurantId);

  const [orders, setOrders] = useState<Order[]>([]);
  const [connected, setConnected] = useState(false);
  const [filter, setFilter] = useState<'active' | 'ready'>('active');

  // Audio context lives in a ref — created only after explicit user gesture
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Map from displayed card index (0-based) → callback ref
  const cardActionRefs = useRef<Array<React.MutableRefObject<(() => void) | null>>>([]);

  function ensureRefs(count: number) {
    while (cardActionRefs.current.length < count) {
      cardActionRefs.current.push({ current: null });
    }
  }

  // ── Unlock audio via explicit user gesture ──────────────────────────────────
  function unlockAudio() {
    if (audioCtxRef.current) return;
    const ctx = createAudioContext();
    if (!ctx) return;
    // Resume immediately within the gesture handler
    ctx.resume().then(() => {
      audioCtxRef.current = ctx;
      setAudioUnlocked(true);
      // Play a silent buffer to fully unlock on iOS/Chrome
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
    });
  }

  const triggerAlert = useCallback(() => {
    if (!soundEnabled || !audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume().then(() => playNewOrderSound(ctx));
    else playNewOrderSound(ctx);
  }, [soundEnabled]);

  // ── Fetch + realtime ────────────────────────────────────────────────────────
  const prevOrderIds = useRef<Set<string>>(new Set());

  const fetchOrders = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .in('status', ['pending', 'preparing', 'ready'])
      .order('created_at', { ascending: true });

    if (!data) return;
    const incoming = data as Order[];

    // Detect new INSERTs: IDs that weren't in the previous snapshot
    const incomingIds = new Set(incoming.map(o => o.id));
    const hasNewOrder = incoming.some(o => o.status === 'pending' && !prevOrderIds.current.has(o.id));
    if (hasNewOrder) triggerAlert();
    prevOrderIds.current = incomingIds;

    setOrders(incoming);
  }, [triggerAlert]);

  useEffect(() => {
    fetchOrders();

    const channel = supabase
      .channel('kitchen-kds')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, fetchOrders)
      .subscribe(status => setConnected(status === 'SUBSCRIBED'));

    return () => { supabase.removeChannel(channel); };
  }, [fetchOrders]);

  // ── Keyboard shortcuts 1–9 ──────────────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Skip if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 9) {
        const ref = cardActionRefs.current[num - 1];
        if (ref?.current) ref.current();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // ── Advance ─────────────────────────────────────────────────────────────────
  async function advanceOrder(id: string, next: OrderStatus) {
    await supabase.from('orders').update({ status: next, updated_at: new Date().toISOString() }).eq('id', id);
  }

  const activeOrders = orders.filter(o => o.status === 'pending' || o.status === 'preparing');
  const readyOrders  = orders.filter(o => o.status === 'ready');
  const displayOrders = filter === 'active' ? activeOrders : readyOrders;

  ensureRefs(displayOrders.length);

  const pendingCount  = orders.filter(o => o.status === 'pending').length;
  const preparingCount = orders.filter(o => o.status === 'preparing').length;

  return (
    <div className="min-h-screen bg-[#080d14] text-white flex flex-col">

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 bg-[#0a1120]/90 backdrop-blur-md border-b border-slate-800 px-4 py-3">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-3 flex-wrap">

          {/* Logo */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
              <ChefHat className="w-4 h-4 text-black" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-white font-bold text-base leading-none">Monitor da Cozinha</h1>
              <p className="text-slate-500 text-[11px] mt-0.5">KDS — Tempo real</p>
            </div>
          </div>

          {/* Counters */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
              <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
              <span className="text-yellow-300 text-xs font-bold tabular-nums">{pendingCount}</span>
              <span className="text-yellow-500 text-[10px] hidden sm:inline">aguardando</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 rounded-xl">
              <div className="w-2 h-2 rounded-full bg-blue-400" />
              <span className="text-blue-300 text-xs font-bold tabular-nums">{preparingCount}</span>
              <span className="text-blue-500 text-[10px] hidden sm:inline">em preparo</span>
            </div>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2 shrink-0">

            {/* Pause button / countdown */}
            {isPaused ? (
              <PauseCountdownBadge pausedUntil={pausedUntil} onClick={() => setShowPauseModal(true)} />
            ) : (
              <button
                onClick={() => setShowPauseModal(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-medium border bg-slate-800 text-slate-400 border-slate-700 hover:text-amber-400 hover:border-amber-500/30 transition-colors"
              >
                <Pause className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Pausar</span>
              </button>
            )}

            {/* Audio unlock / toggle */}
            {!audioUnlocked ? (
              <button
                onClick={unlockAudio}
                className="flex items-center gap-2 px-3 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-xl transition-colors animate-pulse"
              >
                <Bell className="w-3.5 h-3.5" />
                Ativar Alertas Sonoros
              </button>
            ) : (
              <button
                onClick={() => setSoundEnabled(v => !v)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-medium border transition-colors ${
                  soundEnabled
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    : 'bg-slate-800 text-slate-500 border-slate-700'
                }`}
              >
                {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{soundEnabled ? 'Som ativo' : 'Mudo'}</span>
              </button>
            )}

            {/* Connection indicator */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-medium border ${
              connected
                ? 'bg-green-500/10 text-green-400 border-green-500/20'
                : 'bg-red-500/10 text-red-400 border-red-500/20'
            }`}>
              {connected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{connected ? 'Online' : 'Reconectando...'}</span>
            </div>
          </div>
        </div>
      </header>

      {showPauseModal && (
        <PauseRestaurantModal
          restaurantId={restaurantId}
          pausedUntil={pausedUntil}
          onClose={() => setShowPauseModal(false)}
        />
      )}

      {/* ── Filter tabs ─────────────────────────────────────────────────────── */}
      <div className="max-w-[1600px] w-full mx-auto px-4 pt-4">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('active')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              filter === 'active' ? 'bg-amber-500 text-black' : 'bg-slate-800/80 text-slate-400 hover:text-white border border-slate-700'
            }`}
          >
            Em aberto
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${filter === 'active' ? 'bg-black/20' : 'bg-slate-700 text-slate-300'}`}>{activeOrders.length}</span>
          </button>
          <button
            onClick={() => setFilter('ready')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              filter === 'ready' ? 'bg-green-500 text-black' : 'bg-slate-800/80 text-slate-400 hover:text-white border border-slate-700'
            }`}
          >
            Prontos
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${filter === 'ready' ? 'bg-black/20' : 'bg-slate-700 text-slate-300'}`}>{readyOrders.length}</span>
          </button>

          {/* Keyboard hint */}
          {displayOrders.length > 0 && (
            <span className="ml-auto self-center text-xs text-slate-600 hidden md:inline">
              Teclas <kbd className="bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded text-slate-400">1</kbd>–<kbd className="bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded text-slate-400">9</kbd> avançam os primeiros cards
            </span>
          )}
        </div>
      </div>

      {/* ── Orders grid ─────────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 py-4">
        {displayOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 bg-slate-800/60 rounded-2xl flex items-center justify-center mb-5">
              <ChefHat className="w-10 h-10 text-slate-600" />
            </div>
            <p className="text-slate-500 font-semibold text-lg">
              {filter === 'active' ? 'Nenhum pedido em aberto' : 'Nenhum pedido pronto'}
            </p>
            <p className="text-slate-600 text-sm mt-1">
              {filter === 'active'
                ? 'Os novos pedidos aparecerão aqui automaticamente.'
                : 'Marque os pedidos como prontos para vê-los aqui.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {displayOrders.map((order, idx) => {
              const shortcutIdx = idx < 9 ? idx + 1 : null;
              const ref = cardActionRefs.current[idx];
              return (
                <OrderCard
                  key={order.id}
                  order={order}
                  shortcutIndex={shortcutIdx}
                  onAdvance={advanceOrder}
                  actionRef={ref}
                />
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
