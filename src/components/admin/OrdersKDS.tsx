import { useState, useEffect, useRef, useCallback } from 'react';
import { Clock, ChefHat, CheckCircle, Bell, Trash2, MapPin, Receipt, MessageSquare, Volume2, VolumeX, Printer, UtensilsCrossed, PlusCircle, BellOff, Trophy, Coins, Percent, Gift, Check, X, Truck, Navigation, Phone, Timer, User, ChevronDown } from 'lucide-react';
import TutorialHelpButton from './TutorialHelpButton';
import { supabase, normalizeOrderItems } from '../../lib/supabase';
import { Order, WaiterCall, OrderStatus, RestaurantSettings } from '../../types';
import { printKitchen, printReceipt, printReceiptUSB, printKitchenUSB } from '../../lib/print';
import { hasPairedPrinter } from '../../lib/usb-printer';
import CashierOrderDrawer from './CashierOrderDrawer';
import FloatingOrderMonitor from './FloatingOrderMonitor';
import { useTenant } from '../../lib/tenant-context';

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; next?: OrderStatus; nextLabel?: string }> = {
  pending:   { label: 'Pendente',   color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',  next: 'preparing', nextLabel: 'Iniciar Preparo' },
  preparing: { label: 'Em Preparo', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30',         next: 'ready',     nextLabel: 'Marcar Pronto' },
  ready:     { label: 'Pronto',     color: 'bg-green-500/20 text-green-300 border-green-500/30',       next: 'closed',    nextLabel: 'Finalizar' },
  closed:    { label: 'Finalizado', color: 'bg-slate-600/30 text-slate-400 border-slate-600/30' },
};

interface Motoboy { id: string; name: string; phone: string | null; }

interface AcceptModal {
  order: Order;
  estimatedMinutes: number;
  motoboyId: string;
}

function DeliveryPaymentLabel({ method }: { method: string }) {
  const map: Record<string, string> = {
    card_delivery: 'Cartão na Entrega',
    pix_delivery: 'Pix na Entrega',
    cash_delivery: 'Dinheiro na Entrega',
  };
  return <>{map[method] ?? method}</>;
}

function openMaps(address: string) {
  const encoded = encodeURIComponent(address);
  window.open(`https://www.google.com/maps/search/?api=1&query=${encoded}`, '_blank');
}

function openWaze(lat: number | null, lng: number | null, address: string) {
  if (lat && lng) {
    window.open(`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`, '_blank');
  } else {
    window.open(`https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`, '_blank');
  }
}

function dispatchPushToClient(order: Order) {
  if ('serviceWorker' in navigator && 'PushManager' in window) {
    navigator.serviceWorker.ready.then(reg => {
      reg.showNotification('Seu pedido saiu para entrega!', {
        body: 'O motoboy já está a caminho. Fique de olho!',
        icon: '/gula-pedidos-digial.png',
        tag: `delivery-${order.id}`,
      });
    }).catch(() => {});
  }
}

function synthAlert(ctx: AudioContext) {
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(1.0, ctx.currentTime);
  masterGain.connect(ctx.destination);
  const pulses = [
    { freq: 880,  start: 0,    dur: 0.12 },
    { freq: 1100, start: 0.18, dur: 0.12 },
    { freq: 1320, start: 0.36, dur: 0.20 },
  ];
  pulses.forEach(({ freq, start, dur }) => {
    const osc = ctx.createOscillator();
    const envGain = ctx.createGain();
    osc.connect(envGain);
    envGain.connect(masterGain);
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
    envGain.gain.setValueAtTime(0, ctx.currentTime + start);
    envGain.gain.linearRampToValueAtTime(0.9, ctx.currentTime + start + 0.01);
    envGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
    osc.start(ctx.currentTime + start);
    osc.stop(ctx.currentTime + start + dur + 0.01);
  });
}

export default function OrdersKDS() {
  const { restaurant } = useTenant();
  const restaurantId = restaurant?.id ?? null;
  const [orders, setOrders] = useState<Order[]>([]);
  const [waiterCalls, setWaiterCalls] = useState<WaiterCall[]>([]);
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>('default');
  const [showCashierDrawer, setShowCashierDrawer] = useState(false);
  const [motoboys, setMotoboys] = useState<Motoboy[]>([]);
  const [acceptModal, setAcceptModal] = useState<AcceptModal | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const settingsRef = useRef<RestaurantSettings | null>(null);
  const soundEnabledRef = useRef(true);
  const alertAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioUnlockedRef = useRef(false);
  const synthIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isLoopingRef = useRef(false);
  const prevOrderCount = useRef(0);
  const prevCallCount = useRef(0);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
    if (!soundEnabled) stopAlertLoop();
  }, [soundEnabled]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Instancia (ou troca) o Audio quando a URL do alerta muda.
  // O elemento é criado uma vez e reutilizado — chave para o pre-unlock funcionar.
  useEffect(() => {
    const soundUrl = settings?.alert_sound_url;
    if (!soundUrl) return;
    const audio = new Audio(soundUrl);
    audio.loop = false;
    alertAudioRef.current = audio;
    audioUnlockedRef.current = false;
  }, [settings?.alert_sound_url]);

  // Pre-unlock: no primeiro clique do usuário no painel faz play+pause
  // para que o Chrome permita o audio play mesmo com a aba em segundo plano.
  useEffect(() => {
    function tryPreUnlock() {
      const audio = alertAudioRef.current;
      if (!audio || audioUnlockedRef.current) return;
      audio.play().then(() => {
        audio.pause();
        audio.currentTime = 0;
        audioUnlockedRef.current = true;
      }).catch(() => {});
    }
    document.addEventListener('click', tryPreUnlock);
    return () => document.removeEventListener('click', tryPreUnlock);
  }, []);

  useEffect(() => {
    if ('Notification' in window) setNotifPerm(Notification.permission);
    return () => { stopAlertLoop(); };
  }, []);

  // Auto-register service worker and request notification permission on mount
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(perm => setNotifPerm(perm));
    }
  }, []);

  // Wake Lock: keep screen on after first user interaction
  useEffect(() => {
    let wakeLock: WakeLockSentinel | null = null;
    async function requestWakeLock() {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen');
          wakeLock.addEventListener('release', () => { wakeLock = null; });
        }
      } catch {}
    }
    function onClick() { if (!wakeLock) requestWakeLock(); }
    document.addEventListener('click', onClick, { once: true });
    return () => document.removeEventListener('click', onClick);
  }, []);

  function stopAlertLoop() {
    isLoopingRef.current = false;
    if (alertAudioRef.current) {
      alertAudioRef.current.pause();
      alertAudioRef.current.currentTime = 0;
    }
    if (synthIntervalRef.current !== null) {
      clearInterval(synthIntervalRef.current);
      synthIntervalRef.current = null;
    }
  }

  function playAlertMp3() {
    const audio = alertAudioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    setTimeout(() => {
      audio.play().catch(err => {
        console.log('Tentando contornar bloqueio de áudio em background...', err);
        audio.load();
        audio.play().catch(() => {});
      });
    }, 50);
  }

  function startAlertLoop() {
    if (isLoopingRef.current) return;
    if (!soundEnabledRef.current) return;
    isLoopingRef.current = true;

    const soundUrl = settingsRef.current?.alert_sound_url;
    if (soundUrl && alertAudioRef.current) {
      playAlertMp3();
      synthIntervalRef.current = setInterval(() => {
        if (!soundEnabledRef.current || !isLoopingRef.current) { stopAlertLoop(); return; }
        playAlertMp3();
      }, 3000);
    } else {
      // Synth fallback quando não há arquivo de áudio configurado
      try {
        if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
        const ctx = audioCtxRef.current;
        if (ctx.state === 'suspended') ctx.resume();
        synthAlert(ctx);
      } catch {}
      synthIntervalRef.current = setInterval(() => {
        if (!soundEnabledRef.current || !isLoopingRef.current) { stopAlertLoop(); return; }
        try {
          const ctx = audioCtxRef.current;
          if (ctx) synthAlert(ctx);
        } catch {}
      }, 3000);
    }
  }

  function sendNotification(label: string) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const options: NotificationOptions = {
      body: 'Acesse o painel para visualizar.',
      icon: '/gula-pedidos-digial.png',
      tag: 'kds-alert',
      renotify: true,
      requireInteraction: true,
      vibrate: [200, 100, 200],
    };
    try {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification(`🍽️ ${label}`, options);
        }).catch(() => {
          new Notification(`🍽️ ${label}`, options);
        });
      } else {
        new Notification(`🍽️ ${label}`, options);
      }
    } catch {}
  }

  const fetchData = useCallback(async () => {
    const ordersQuery = supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false }).limit(100);
    const callsQuery = supabase.from('waiter_calls').select('*').eq('status', 'pending').order('created_at', { ascending: false });

    const [ordersRes, callsRes] = await Promise.all([
      restaurantId ? ordersQuery.eq('restaurant_id', restaurantId) : ordersQuery.is('restaurant_id', null),
      restaurantId ? callsQuery.eq('restaurant_id', restaurantId) : callsQuery.is('restaurant_id', null),
    ]);

    if (ordersRes.data) {
      setOrders(() => {
        const newOrders = (ordersRes.data as Order[]).map(o => ({ ...o, order_items: normalizeOrderItems(o.order_items ?? []) }));
        const pendingCount = newOrders.filter(o => o.status === 'pending').length;

        if (pendingCount > prevOrderCount.current) {
          sendNotification('Novo Pedido');
          startAlertLoop();
        }
        if (pendingCount === 0) {
          stopAlertLoop();
        }

        prevOrderCount.current = pendingCount;
        return newOrders;
      });
    }

    if (callsRes.data) {
      setWaiterCalls(() => {
        const newCalls = callsRes.data as WaiterCall[];
        const newCount = newCalls.length;
        if (newCount > prevCallCount.current) sendNotification('Chamado de Garçom');
        prevCallCount.current = newCount;
        return newCalls;
      });
    }
  }, [restaurantId]);

  useEffect(() => {
    fetchData();

    const settingsQ = () => {
      const q = supabase.from('restaurant_settings').select('*');
      return restaurantId ? q.eq('restaurant_id', restaurantId) : q.is('restaurant_id', null);
    };
    settingsQ().maybeSingle().then(({ data }) => {
      if (data) setSettings(data as RestaurantSettings);
    });

    // Fetch motoboys for delivery assignment
    if (restaurantId) {
      supabase.from('delivery_motoboys').select('id,name,phone').eq('restaurant_id', restaurantId).eq('active', true).then(({ data }) => {
        if (data) setMotoboys(data as Motoboy[]);
      });
    }

    const ch = supabase
      .channel('kds-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'waiter_calls' }, fetchData)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'restaurant_settings' }, () => {
        settingsQ().maybeSingle().then(({ data }) => {
          if (data) setSettings(data as RestaurantSettings);
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchData]);

  async function requestNotifPermission() {
    if (!('Notification' in window)) return;
    const perm = await Notification.requestPermission();
    setNotifPerm(perm);
  }

  async function advanceStatus(order: Order) {
    const cfg = STATUS_CONFIG[order.status];
    if (!cfg.next) return;
    // For delivery orders going from pending→preparing, open accept modal
    if (order.delivery_mode === 'delivery' && order.status === 'pending') {
      setAcceptModal({
        order,
        estimatedMinutes: order.delivery_estimated_minutes ?? 40,
        motoboyId: order.delivery_motoboy_id ?? '',
      });
      return;
    }
    const updates: Record<string, unknown> = { status: cfg.next, updated_at: new Date().toISOString() };
    // For delivery orders, keep delivery_status in sync EXCEPT for dispatched
    // (dispatched is set explicitly via the "Sair p/ Entrega" button)
    if (order.delivery_mode === 'delivery') {
      if (cfg.next === 'closed') updates.delivery_status = 'delivered';
    }
    await supabase.from('orders').update(updates).eq('id', order.id);
  }

  async function confirmAccept() {
    if (!acceptModal) return;
    await supabase.from('orders').update({
      status: 'preparing',
      delivery_status: 'preparing',
      delivery_estimated_minutes: acceptModal.estimatedMinutes,
      delivery_motoboy_id: acceptModal.motoboyId || null,
      updated_at: new Date().toISOString(),
    }).eq('id', acceptModal.order.id);
    setAcceptModal(null);
  }

  async function dispatchDelivery(order: Order) {
    await supabase.from('orders').update({
      delivery_status: 'dispatched',
      status: 'ready',
      updated_at: new Date().toISOString(),
    }).eq('id', order.id);
    dispatchPushToClient(order);
  }

  function deliveryFullAddress(order: Order): string {
    return [
      order.delivery_street,
      order.delivery_number,
      order.delivery_bairro,
      order.delivery_complement,
    ].filter(Boolean).join(', ');
  }

  async function resolveCall(id: string) {
    await supabase.from('waiter_calls').update({ status: 'resolved' }).eq('id', id);
    fetchData();
  }

  async function applyLoyaltyBenefit(order: Order, action: 'applied' | 'accumulated') {
    await supabase.from('orders').update({ loyalty_benefit_action: action }).eq('id', order.id);

    if (action === 'applied' && order.loyalty_customer_phone && order.loyalty_reward_id) {
      // Deduct from customer balance
      const q = supabase.from('loyalty_customers').select('*').eq('phone', order.loyalty_customer_phone);
      const { data: customer } = await (restaurantId
        ? q.eq('restaurant_id', restaurantId).maybeSingle()
        : q.is('restaurant_id', null).maybeSingle()
      );
      if (customer) {
        const { data: reward } = await supabase.from('loyalty_rewards').select('*').eq('id', order.loyalty_reward_id).maybeSingle();
        if (reward) {
          const now = new Date().toISOString();
          const rewardTx = {
            tipo: 'resgate' as const,
            descricao: `Resgate aprovado: ${reward.nome_recompensa}`,
            pontos: -(reward.pontos_necessarios),
            cashback: 0,
            data: now,
          };
          await supabase.from('loyalty_customers').update({
            saldo_pontos: Math.max(0, customer.saldo_pontos - reward.pontos_necessarios),
            saldo_cashback: Math.max(0, Number(customer.saldo_cashback) - (reward.pontos_necessarios ?? 0)),
            historico_transacoes: [...(customer.historico_transacoes ?? []), rewardTx],
            updated_at: now,
          }).eq('id', customer.id);
        }
      }
    }

    fetchData();
  }

  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  function toggleOrderExpand(id: string) {
    setExpandedOrders(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const pendingOrders = orders.filter(o => o.status === 'pending');
  const preparingOrders = orders.filter(o => o.status === 'preparing');
  const readyOrders = orders.filter(o => o.status === 'ready');

  async function handlePrintKitchen(order: Order) {
    if (hasPairedPrinter()) { try { await printKitchenUSB(order); return; } catch {} }
    await printKitchen(order);
  }

  async function handlePrintReceipt(order: Order) {
    if (hasPairedPrinter()) { try { await printReceiptUSB(order, settings); return; } catch {} }
    await printReceipt(order, settings);
  }

  const pendingCount = orders.filter(o => o.status === 'pending').length;

  function renderOrderCard(order: Order) {
    const cfg = STATUS_CONFIG[order.status];
    return (
            <div key={order.id} className={`bg-[#0f2040] border rounded-2xl overflow-hidden ${order.status === 'pending' ? 'border-yellow-500/40 shadow-yellow-500/10 shadow-lg' : 'border-[#1e3868]'}`}>
              <button
                onClick={() => toggleOrderExpand(order.id)}
                className={`w-full px-4 py-3 flex items-center justify-between border-b border-[#1e3868] ${order.status === 'pending' ? 'bg-yellow-500/5' : ''} hover:bg-[#1a3260]/40 transition-colors text-left`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {order.delivery_mode === 'delivery'
                    ? <Truck className="w-4 h-4 text-blue-400 shrink-0" />
                    : <MapPin className="w-4 h-4 text-amber-400 shrink-0" />}
                  <span className="text-white font-bold truncate">
                    {order.delivery_mode === 'delivery'
                      ? (order.delivery_name || 'Delivery')
                      : `Mesa ${order.table_number}`}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium shrink-0 ${cfg.color}`}>{cfg.label}</span>
                  {order.delivery_mode === 'delivery' && order.delivery_status === 'dispatched' && (
                    <span className="text-[10px] bg-orange-500/20 text-orange-300 border border-orange-500/30 px-1.5 py-0.5 rounded-full shrink-0">A caminho</span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-amber-400 font-bold text-sm">R$ {order.total.toFixed(2).replace('.', ',')}</span>
                  <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${expandedOrders.has(order.id) ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {/* Collapsed: quick summary */}
              {!expandedOrders.has(order.id) && (
                <div className="px-4 py-2.5 flex items-center justify-between gap-2">
                  <p className="text-slate-400 text-xs truncate">
                    {(order.order_items ?? []).slice(0, 2).map(item => `${item.quantity}× ${item.product_name}`).join(', ')}
                    {(order.order_items ?? []).length > 2 && ` +${(order.order_items ?? []).length - 2} mais`}
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    {order.delivery_mode === 'delivery' && (order.status === 'preparing' || order.status === 'ready') && order.delivery_status !== 'dispatched' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); dispatchDelivery(order); }}
                        className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-white transition-colors"
                      >
                        <Truck className="w-3 h-3" /> Sair p/ Entrega
                      </button>
                    )}
                    {cfg.next && (
                      <button
                        onClick={(e) => { e.stopPropagation(); advanceStatus(order); }}
                        className={'flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors ' + (
                          cfg.next === 'preparing' ? 'bg-blue-500 hover:bg-blue-400 text-white' :
                          cfg.next === 'ready' ? 'bg-green-500 hover:bg-green-400 text-white' :
                          'bg-slate-700 hover:bg-slate-600 text-white'
                        )}
                      >
                        {cfg.next === 'preparing' && <ChefHat className="w-3 h-3" />}
                        {cfg.next === 'ready' && <CheckCircle className="w-3 h-3" />}
                        {cfg.next === 'closed' && <Receipt className="w-3 h-3" />}
                        {cfg.nextLabel}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Expanded: full details */}
              {expandedOrders.has(order.id) && (
                <>
              <div className="px-4 py-1 flex items-center gap-1 text-slate-500 text-xs">
                <Clock className="w-3 h-3" />
                {new Date(order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                {order.delivery_mode === 'delivery' && order.delivery_whatsapp && (
                  <span className="ml-2 flex items-center gap-1"><Phone className="w-3 h-3" />{order.delivery_whatsapp}</span>
                )}
              </div>

              <div className="p-4 space-y-2">
                {(order.order_items ?? []).map(item => (
                  <div key={item.id} className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm">
                        <span className="font-medium text-amber-400">{item.quantity}×</span> {item.product_name}
                      </p>
                      {item.customizations?.combos?.map((c, i) => {
                        const chosen = c.items.filter(x => x.qty > 0);
                        if (!chosen.length) return null;
                        const gn = (c.groupName ?? '').trim();
                        return (
                          <div key={i} className="ml-4">
                            {gn && <p className="text-slate-500 text-xs">↳ {gn}</p>}
                            {chosen.map((x, xi) => (
                              <div key={xi}>
                                <p className="text-slate-300 text-xs font-medium ml-2">{x.qty > 1 ? `${x.qty}x ` : ''}{x.name}</p>
                                {(x.extras ?? []).filter(e => e.qty > 0).map((e, ei) => (
                                  <p key={ei} className="text-slate-500 text-xs ml-4">+{e.qty}× {e.name}</p>
                                ))}
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                    <span className="text-slate-400 text-xs ml-2 shrink-0">R${(item.unit_price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {/* Loyalty info panel */}
              {order.loyalty_customer_phone && (
                <div className="mx-4 mb-3 rounded-xl border border-amber-500/20 bg-amber-500/5 overflow-hidden">
                  <div className="px-3 py-2 flex items-center gap-2 border-b border-amber-500/10">
                    <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <p className="text-xs font-semibold text-amber-300 truncate">
                      {order.loyalty_customer_name || order.loyalty_customer_phone}
                    </p>
                    {order.loyalty_customer_name && (
                      <p className="text-xs text-amber-500 truncate">{order.loyalty_customer_phone}</p>
                    )}
                  </div>
                  <div className="px-3 py-2 space-y-2">
                    <div className="flex gap-2 flex-wrap">
                      {order.loyalty_points_earned > 0 && (
                        <span className="flex items-center gap-1 text-[11px] bg-amber-500/10 text-amber-300 rounded-lg px-2 py-1">
                          <Coins className="w-3 h-3" />+{order.loyalty_points_earned} pts
                        </span>
                      )}
                      {Number(order.loyalty_cashback_earned) > 0 && (
                        <span className="flex items-center gap-1 text-[11px] bg-green-500/10 text-green-300 rounded-lg px-2 py-1">
                          <Percent className="w-3 h-3" />+R$ {Number(order.loyalty_cashback_earned).toFixed(2)}
                        </span>
                      )}
                      {order.loyalty_discount > 0 && (
                        <span className="flex items-center gap-1 text-[11px] bg-blue-500/10 text-blue-300 rounded-lg px-2 py-1">
                          <Gift className="w-3 h-3" />-R$ {Number(order.loyalty_discount).toFixed(2)} desconto
                        </span>
                      )}
                    </div>

                    {order.loyalty_reward_id && order.loyalty_benefit_action === 'pending' && (
                      <div className="space-y-1.5">
                        <p className="text-[11px] text-amber-400 font-medium">Recompensa solicitada — aplicar?</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => applyLoyaltyBenefit(order, 'applied')}
                            className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-semibold py-1.5 rounded-lg bg-green-500/15 text-green-400 border border-green-500/20 hover:bg-green-500/25 transition-colors"
                          >
                            <Check className="w-3 h-3" /> Aplicar desconto
                          </button>
                          <button
                            onClick={() => applyLoyaltyBenefit(order, 'accumulated')}
                            className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-semibold py-1.5 rounded-lg bg-slate-700/60 text-slate-300 border border-slate-600 hover:bg-slate-700 transition-colors"
                          >
                            <X className="w-3 h-3" /> Acumular
                          </button>
                        </div>
                      </div>
                    )}

                    {order.loyalty_benefit_action === 'applied' && (
                      <p className="text-[11px] text-green-400 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Desconto aplicado neste pedido
                      </p>
                    )}
                    {order.loyalty_benefit_action === 'accumulated' && (
                      <p className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Coins className="w-3 h-3" /> Benefício acumulado para próxima compra
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Delivery info panel */}
              {order.delivery_mode === 'delivery' && (
                <div className="mx-4 mb-3 rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Truck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span className="text-xs font-bold text-blue-300">DELIVERY</span>
                    {order.delivery_status === 'dispatched' && <span className="text-[10px] bg-orange-500/20 text-orange-300 border border-orange-500/30 px-1.5 py-0.5 rounded-full">Saiu para entrega</span>}
                    {order.delivery_status === 'delivered' && <span className="text-[10px] bg-green-500/20 text-green-300 border border-green-500/30 px-1.5 py-0.5 rounded-full">Entregue</span>}
                  </div>
                  {order.delivery_name && (
                    <p className="text-xs text-slate-300 flex items-center gap-1.5"><User className="w-3 h-3 text-slate-500" />{order.delivery_name}</p>
                  )}
                  {order.delivery_whatsapp && (
                    <p className="text-xs text-slate-400 flex items-center gap-1.5"><Phone className="w-3 h-3 text-slate-500" />{order.delivery_whatsapp}</p>
                  )}
                  {order.delivery_street && (
                    <p className="text-xs text-slate-300 flex items-center gap-1.5"><MapPin className="w-3 h-3 text-blue-400 shrink-0" />{deliveryFullAddress(order)}</p>
                  )}
                  {order.delivery_reference && (
                    <p className="text-xs text-slate-500 italic">Ref: {order.delivery_reference}</p>
                  )}
                  <div className="flex items-center gap-3 flex-wrap pt-0.5">
                    {order.delivery_distance_km != null && (
                      <span className="text-[11px] text-slate-400">{Number(order.delivery_distance_km).toFixed(1)} km</span>
                    )}
                    {order.delivery_fee > 0 && (
                      <span className="text-[11px] text-blue-300 font-semibold">Taxa: R$ {Number(order.delivery_fee).toFixed(2)}</span>
                    )}
                    {order.delivery_estimated_minutes && (
                      <span className="text-[11px] text-slate-400 flex items-center gap-1"><Timer className="w-3 h-3" />~{order.delivery_estimated_minutes} min</span>
                    )}
                    {order.delivery_payment_method && order.delivery_payment_method !== 'counter' && (
                      <span className="text-[11px] text-slate-400"><DeliveryPaymentLabel method={order.delivery_payment_method} /></span>
                    )}
                    {order.delivery_change_for && (
                      <span className="text-[11px] text-yellow-400">Troco p/ R$ {Number(order.delivery_change_for).toFixed(2)}</span>
                    )}
                  </div>
                  {order.delivery_street && (
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => openMaps(deliveryFullAddress(order))}
                        className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-semibold py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white border border-slate-600 transition-colors"
                      >
                        <Navigation className="w-3 h-3" /> Google Maps
                      </button>
                      <button
                        onClick={() => openWaze(order.delivery_lat, order.delivery_lng, deliveryFullAddress(order))}
                        className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-semibold py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 transition-colors"
                      >
                        <Navigation className="w-3 h-3" /> Waze
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="px-4 pb-4 space-y-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePrintKitchen(order)}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                  >
                    <UtensilsCrossed className="w-3.5 h-3.5" /> Cozinha
                  </button>
                  <button
                    onClick={() => handlePrintReceipt(order)}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5" /> Conta
                  </button>
                </div>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="text-xs text-slate-500">
                    {order.delivery_mode === 'delivery' ? '🛵 Delivery' : order.service_mode === 'table' ? '🍽️ Mesa' : '🧾 Balcão'}
                    {' · '}<span className="text-amber-400 font-bold">R$ {order.total.toFixed(2).replace('.', ',')}</span>
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {order.delivery_mode === 'delivery' && (order.status === 'preparing' || order.status === 'ready') && order.delivery_status !== 'dispatched' && (
                      <button
                        onClick={() => dispatchDelivery(order)}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 text-white transition-colors"
                      >
                        <Truck className="w-3.5 h-3.5" /> Saiu p/ Entrega
                      </button>
                    )}
                    {cfg.next && (
                      <button
                        onClick={() => advanceStatus(order)}
                        className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl transition-colors ${
                          cfg.next === 'preparing' ? 'bg-blue-500 hover:bg-blue-400 text-white' :
                          cfg.next === 'ready' ? 'bg-green-500 hover:bg-green-400 text-white' :
                          'bg-slate-700 hover:bg-slate-600 text-white'
                        }`}
                      >
                        {cfg.next === 'preparing' && <ChefHat className="w-3.5 h-3.5" />}
                        {cfg.next === 'ready' && <CheckCircle className="w-3.5 h-3.5" />}
                        {cfg.next === 'closed' && <Receipt className="w-3.5 h-3.5" />}
                        {cfg.nextLabel}
                      </button>
                    )}
                  </div>
                </div>
              </div>
                </>
              )}
            </div>
          );
  }

  const callTypeLabels: Record<string, string> = {
    attention: '🛎️ Chamar Atendimento',
    request: '📋 Solicitar Algo',
    bill: '💳 Solicitar Conta',
  };

  return (
    <div className="p-3 sm:p-6 max-w-6xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ChefHat className="w-5 h-5 text-amber-400" /> Monitor de Pedidos (KDS)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Atualização em tempo real.</p>
          <TutorialHelpButton videoId="TFpHH5C_8cw" title="Operação de Pedidos e Canais de Vendas" />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowCashierDrawer(true)}
            className="flex items-center gap-2 text-xs px-3 py-2 rounded-xl border transition-colors bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Novo Pedido
          </button>

          {'Notification' in window && notifPerm !== 'granted' && (
            <button
              onClick={requestNotifPermission}
              title={notifPerm === 'denied' ? 'Notificações bloqueadas no navegador' : 'Ativar notificações em segundo plano'}
              className={`flex items-center gap-2 text-xs px-3 py-2 rounded-xl border transition-colors ${
                notifPerm === 'denied'
                  ? 'bg-red-500/10 text-red-400 border-red-500/30 cursor-not-allowed'
                  : 'bg-[#1a3260] text-slate-400 border-[#1e3868] hover:text-white hover:border-[#2a4d9a]'
              }`}
            >
              {notifPerm === 'denied' ? <BellOff className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
              {notifPerm === 'denied' ? 'Notif. bloqueada' : 'Ativar Notificações'}
            </button>
          )}
          {notifPerm === 'granted' && (
            <div className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border bg-green-500/10 text-green-400 border-green-500/30">
              <Bell className="w-3.5 h-3.5" /> Notif. ativa
            </div>
          )}

          <button
            onClick={() => setSoundEnabled(v => !v)}
            className={`flex items-center gap-2 text-xs px-3 py-2 rounded-xl border transition-colors ${soundEnabled ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' : 'bg-slate-800 text-slate-500 border-slate-700'}`}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            {soundEnabled ? 'Som Ativo' : 'Som Mudo'}
          </button>
          <FloatingOrderMonitor />
        </div>
      </div>

      {/* Looping alert banner */}
      {pendingCount > 0 && soundEnabled && (
        <div className="flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-3">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-yellow-500" />
          </span>
          <p className="text-yellow-300 text-xs font-semibold flex-1">
            {pendingCount === 1 ? '1 pedido pendente' : `${pendingCount} pedidos pendentes`} — alerta sonoro em loop
          </p>
          <p className="text-yellow-500 text-xs">Clique em "Iniciar Preparo" para silenciar</p>
        </div>
      )}

      {/* Waiter Calls */}
      {waiterCalls.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-red-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Bell className="w-4 h-4 animate-pulse" /> Chamados de Garçom ({waiterCalls.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {waiterCalls.map(call => (
              <div key={call.id} className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-1.5 h-full bg-red-500 rounded-r-xl" />
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-white font-bold text-sm flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-red-400" /> Mesa {call.table_number}
                    </p>
                    <p className="text-red-300 text-xs mt-1">{callTypeLabels[call.call_type] ?? call.call_type}</p>
                    {call.message && <p className="text-slate-300 text-xs mt-1 italic">"{call.message}"</p>}
                    <p className="text-slate-500 text-[10px] mt-1.5">{new Date(call.created_at).toLocaleTimeString('pt-BR')}</p>
                  </div>
                  <button onClick={() => resolveCall(call.id)} className="text-green-400 hover:text-green-300 p-1 shrink-0" title="Resolver">
                    <CheckCircle className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* KDS three-column layout: left (pending top, preparing bottom), right (ready) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left column: Pending (top) + Preparing (bottom) */}
        <div className="space-y-4">
          {/* Pending */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
              <h3 className="text-sm font-bold text-yellow-300 uppercase tracking-wider">Pendentes</h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 font-bold">{pendingOrders.length}</span>
            </div>
            <div className="space-y-3">
              {pendingOrders.map(order => renderOrderCard(order))}
              {pendingOrders.length === 0 && (
                <div className="py-10 text-center text-slate-600 border border-dashed border-[#1e3868] rounded-2xl">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-xs">Nenhum pedido pendente.</p>
                </div>
              )}
            </div>
          </section>

          {/* Preparing */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <h3 className="text-sm font-bold text-blue-300 uppercase tracking-wider">Em Preparo</h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 font-bold">{preparingOrders.length}</span>
            </div>
            <div className="space-y-3">
              {preparingOrders.map(order => renderOrderCard(order))}
              {preparingOrders.length === 0 && (
                <div className="py-10 text-center text-slate-600 border border-dashed border-[#1e3868] rounded-2xl">
                  <ChefHat className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-xs">Nenhum pedido em preparo.</p>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Right column: Ready */}
        <div>
          <section>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <h3 className="text-sm font-bold text-green-300 uppercase tracking-wider">Prontos</h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 font-bold">{readyOrders.length}</span>
            </div>
            <div className="space-y-3">
              {readyOrders.map(order => renderOrderCard(order))}
              {readyOrders.length === 0 && (
                <div className="py-10 text-center text-slate-600 border border-dashed border-[#1e3868] rounded-2xl">
                  <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-xs">Nenhum pedido pronto.</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {showCashierDrawer && (
        <CashierOrderDrawer
          onClose={() => setShowCashierDrawer(false)}
          onOrderPlaced={fetchData}
        />
      )}

      {/* Accept Delivery Modal */}
      {acceptModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b border-[#1e3868]">
              <h3 className="font-bold text-white flex items-center gap-2"><Truck className="w-4 h-4 text-blue-400" /> Aceitar Pedido Delivery</h3>
              <button onClick={() => setAcceptModal(null)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5 flex items-center gap-1.5"><Timer className="w-3.5 h-3.5" /> Tempo estimado de entrega (minutos)</label>
                <div className="flex items-center gap-3">
                  <button onClick={() => setAcceptModal(m => m ? { ...m, estimatedMinutes: Math.max(5, m.estimatedMinutes - 5) } : m)} className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 text-white hover:bg-slate-700 transition-colors flex items-center justify-center font-bold text-lg">−</button>
                  <input
                    type="number"
                    min={5}
                    value={acceptModal.estimatedMinutes}
                    onChange={e => setAcceptModal(m => m ? { ...m, estimatedMinutes: parseInt(e.target.value) || 30 } : m)}
                    className="flex-1 text-center bg-slate-800 border border-slate-700 rounded-xl py-2.5 text-white font-bold focus:outline-none focus:border-amber-500"
                  />
                  <button onClick={() => setAcceptModal(m => m ? { ...m, estimatedMinutes: m.estimatedMinutes + 5 } : m)} className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 text-white hover:bg-slate-700 transition-colors flex items-center justify-center font-bold text-lg">+</button>
                </div>
              </div>
              {motoboys.length > 0 && (
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5 flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Atribuir entregador</label>
                  <select
                    value={acceptModal.motoboyId}
                    onChange={e => setAcceptModal(m => m ? { ...m, motoboyId: e.target.value } : m)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500"
                  >
                    <option value="">— Sem entregador —</option>
                    {motoboys.map(mb => <option key={mb.id} value={mb.id}>{mb.name}{mb.phone ? ` · ${mb.phone}` : ''}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="flex gap-3 p-5 border-t border-slate-800">
              <button onClick={() => setAcceptModal(null)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">Cancelar</button>
              <button onClick={confirmAccept} className="flex-1 bg-blue-500 hover:bg-blue-400 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2">
                <Check className="w-4 h-4" /> Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
