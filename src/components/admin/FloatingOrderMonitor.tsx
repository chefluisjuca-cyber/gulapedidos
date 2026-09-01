import { useState, useEffect, useRef, useCallback } from 'react';
import { ExternalLink, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Order, WaiterCall } from '../../types';
import { useTenant } from '../../lib/tenant-context';

/**
 * Floating mini-window that stays always-on-top using the Document Picture-in-Picture API.
 * Shows just the app icon with a badge for pending orders count.
 * Clicking the icon brings the main page to the foreground WITHOUT closing the monitor.
 */
export default function FloatingOrderMonitor() {
  const { restaurant } = useTenant();
  const restaurantId = restaurant?.id ?? null;

  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const [floatingMode, setFloatingMode] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [callCount, setCallCount] = useState(0);
  const [hasNewAlert, setHasNewAlert] = useState(false);
  const [flashState, setFlashState] = useState(false);

  const soundEnabledRef = useRef(true);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const synthIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isLoopingRef = useRef(false);
  const prevPendingRef = useRef(0);
  const prevCallsRef = useRef(0);
  const flashIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const alertAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
    if (!soundEnabled) stopAlertLoop();
  }, [soundEnabled]);

  // ── Audio ──────────────────────────────────────────────────────────
  const playSynthAlert = useCallback(() => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(1.0, ctx.currentTime);
      masterGain.connect(ctx.destination);
      [
        { freq: 880, start: 0, dur: 0.12 },
        { freq: 1100, start: 0.18, dur: 0.12 },
        { freq: 1320, start: 0.36, dur: 0.20 },
      ].forEach(({ freq, start, dur }) => {
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
    } catch {}
  }, []);

  const playMp3Alert = useCallback(() => {
    const audio = alertAudioRef.current;
    if (!audio) return playSynthAlert();
    audio.currentTime = 0;
    audio.play().catch(() => playSynthAlert());
  }, [playSynthAlert]);

  function stopAlertLoop() {
    isLoopingRef.current = false;
    if (alertAudioRef.current) { alertAudioRef.current.pause(); alertAudioRef.current.currentTime = 0; }
    if (synthIntervalRef.current !== null) { clearInterval(synthIntervalRef.current); synthIntervalRef.current = null; }
  }

  function startAlertLoop() {
    if (isLoopingRef.current || !soundEnabledRef.current) return;
    isLoopingRef.current = true;
    playMp3Alert();
    synthIntervalRef.current = setInterval(() => {
      if (!soundEnabledRef.current || !isLoopingRef.current) { stopAlertLoop(); return; }
      playMp3Alert();
    }, 3000);
  }

  function startFlash() {
    setHasNewAlert(true);
    if (flashIntervalRef.current) clearInterval(flashIntervalRef.current);
    let toggle = false;
    flashIntervalRef.current = setInterval(() => { toggle = !toggle; setFlashState(toggle); }, 600);
  }

  function stopFlash() {
    setHasNewAlert(false);
    setFlashState(false);
    if (flashIntervalRef.current) { clearInterval(flashIntervalRef.current); flashIntervalRef.current = null; }
  }

  // ── Data ───────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    const ordersQuery = supabase.from('orders').select('id, status').order('created_at', { ascending: false }).limit(50);
    const callsQuery = supabase.from('waiter_calls').select('id, status').eq('status', 'pending');

    const [ordersRes, callsRes] = await Promise.all([
      restaurantId ? ordersQuery.eq('restaurant_id', restaurantId) : ordersQuery.is('restaurant_id', null),
      restaurantId ? callsQuery.eq('restaurant_id', restaurantId) : callsQuery.is('restaurant_id', null),
    ]);

    if (ordersRes.data) {
      const newPending = (ordersRes.data as Pick<Order, 'id' | 'status'>[]).filter(o => o.status === 'pending').length;
      setPendingCount(newPending);
      if (newPending > prevPendingRef.current) {
        startAlertLoop();
        startFlash();
        if ('Notification' in window && Notification.permission === 'granted') {
          try {
            const n = new Notification('🍽️ Novo Pedido!', {
              body: `${newPending} pedido(s) pendente(s).`,
              icon: '/gula-pedidos-digial.png',
              tag: 'gula-new-order',
              requireInteraction: true,
              renotify: true,
            });
            n.onclick = () => { window.focus(); n.close(); };
          } catch {}
        }
      }
      if (newPending === 0) { stopAlertLoop(); stopFlash(); }
      prevPendingRef.current = newPending;
    }

    if (callsRes.data) {
      const nc = (callsRes.data as Pick<WaiterCall, 'id' | 'status'>[]).length;
      setCallCount(nc);
      if (nc > prevCallsRef.current) { startAlertLoop(); startFlash(); }
      prevCallsRef.current = nc;
    }
  }, [restaurantId]);

  // Load alert sound
  useEffect(() => {
    const q = supabase.from('restaurant_settings').select('alert_sound_url');
    const sq = restaurantId ? q.eq('restaurant_id', restaurantId) : q.is('restaurant_id', null);
    sq.maybeSingle().then(({ data }) => {
      const url = (data as any)?.alert_sound_url;
      if (url) { const audio = new Audio(url); audio.loop = false; alertAudioRef.current = audio; }
    });
  }, [restaurantId]);

  // Realtime
  useEffect(() => {
    if (!restaurantId) return;
    fetchData();
    const ch = supabase
      .channel('floating-monitor')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'waiter_calls' }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(ch); stopAlertLoop(); stopFlash(); };
  }, [fetchData]);

  // Cleanup
  useEffect(() => {
    return () => { stopAlertLoop(); stopFlash(); if (pipWindow) pipWindow.close(); };
  }, []);

  // Pre-unlock audio
  useEffect(() => {
    function unlock() {
      if (!audioCtxRef.current) { try { audioCtxRef.current = new AudioContext(); } catch {} }
      if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume();
      if (alertAudioRef.current) {
        alertAudioRef.current.play().then(() => { alertAudioRef.current!.pause(); alertAudioRef.current!.currentTime = 0; }).catch(() => {});
      }
    }
    document.addEventListener('click', unlock);
    return () => document.removeEventListener('click', unlock);
  }, []);

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // ── PiP ────────────────────────────────────────────────────────────
  async function openPiP() {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      if (audioCtxRef.current.state === 'suspended') await audioCtxRef.current.resume();
      if (alertAudioRef.current) {
        await alertAudioRef.current.play().then(() => { alertAudioRef.current!.pause(); alertAudioRef.current!.currentTime = 0; }).catch(() => {});
      }
    } catch {}

    if ('documentPictureInPicture' in window) {
      try {
        const pip = await (window as any).documentPictureInPicture.requestWindow({ width: 120, height: 120 });
        setPipWindow(pip);
        pip.addEventListener('pagehide', () => setPipWindow(null));
        document.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
          pip.document.head.appendChild(node.cloneNode(true));
        });
        renderPiPContent(pip.document.body);
      } catch {
        setFloatingMode(true);
      }
    } else {
      setFloatingMode(true);
    }
  }

  function closePiP() {
    if (pipWindow) { pipWindow.close(); setPipWindow(null); }
    setFloatingMode(false);
    stopAlertLoop();
    stopFlash();
  }

  function focusMain() {
    // Just focus the window — do NOT navigate, which would close the PiP
    window.focus();
  }

  // Re-render PiP when state changes
  useEffect(() => {
    if (pipWindow) renderPiPContent(pipWindow.document.body);
  }, [pipWindow, pendingCount, callCount, hasNewAlert, flashState, soundEnabled]);

  function renderPiPContent(container: HTMLElement) {
    const total = pendingCount + callCount;
    const flash = hasNewAlert && flashState;
    const bg = flash ? '#f59e0b' : '#0d1f3c';
    const fg = flash ? '#000' : '#fff';

    container.innerHTML = `
      <div style="margin:0;padding:0;width:100vw;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:${bg};cursor:pointer;transition:background 0.3s;user-select:none;overflow:hidden;">
        <div style="position:relative;">
          <img src="/gula-pedidos-digial.png" style="width:56px;height:56px;border-radius:14px;" />
          ${total > 0 ? `<span style="position:absolute;top:-8px;right:-8px;background:#ef4444;color:#fff;font-size:13px;font-weight:800;min-width:22px;height:22px;border-radius:999px;display:flex;align-items:center;justify-content:center;padding:0 4px;border:2px solid ${bg};">${total > 99 ? '99+' : total}</span>` : ''}
        </div>
        <span style="margin-top:8px;font-size:11px;font-weight:700;color:${fg};">${total > 0 ? 'pedidos' : 'Gula'}</span>
      </div>
    `;

    const root = container.firstElementChild;
    root?.addEventListener('click', focusMain);
  }

  // ── Floating overlay fallback ──────────────────────────────────────
  if (floatingMode && !pipWindow) {
    const total = pendingCount + callCount;
    return (
      <>
        <button
          onClick={focusMain}
          title="Abrir painel de pedidos"
          className={`fixed bottom-4 right-4 z-[9999] w-16 h-16 rounded-2xl shadow-2xl flex items-center justify-center transition-colors ${hasNewAlert && flashState ? 'bg-amber-500' : 'bg-[#0d1f3c] border border-[#1e3868]'}`}
        >
          <div className="relative">
            <img src="/gula-pedidos-digial.png" alt="Gula" className="w-9 h-9 rounded-xl" />
            {total > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">
                {total > 99 ? '99+' : total}
              </span>
            )}
          </div>
        </button>
        <button
          onClick={closePiP}
          className="fixed bottom-20 right-4 z-[9999] w-7 h-7 rounded-full bg-[#0f2040] border border-[#1e3868] text-slate-400 hover:text-white flex items-center justify-center shadow-lg"
          title="Fechar monitor"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </>
    );
  }

  // ── Main button ────────────────────────────────────────────────────
  if (pipWindow) return null;

  return (
    <button
      onClick={openPiP}
      title="Abrir monitor flutuante (sempre visível)"
      className="flex items-center gap-2 text-xs px-3 py-2 rounded-xl border transition-colors bg-[#1a3260] text-slate-300 border-[#2a4d9a] hover:text-white hover:border-amber-500/50"
    >
      <ExternalLink className="w-3.5 h-3.5" />
      Monitor Flutuante
    </button>
  );
}
