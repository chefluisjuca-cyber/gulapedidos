import { useState, useEffect, useCallback } from 'react';
import { Pause, Play, X, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface PauseRestaurantModalProps {
  restaurantId: string | null;
  pausedUntil: string | null;
  onClose: () => void;
}

const QUICK_OPTIONS = [15, 30, 45, 60];

export function PauseRestaurantModal({ restaurantId, pausedUntil, onClose }: PauseRestaurantModalProps) {
  const [customMinutes, setCustomMinutes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPaused = pausedUntil ? new Date(pausedUntil) > new Date() : false;

  async function pauseRestaurant(minutes: number) {
    if (!restaurantId) return;
    setSaving(true);
    setError(null);
    const until = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    const { error: err } = await supabase
      .from('restaurant_settings')
      .update({ paused_until: until, updated_at: new Date().toISOString() })
      .or(`restaurant_id.eq.${restaurantId},restaurant_id.is.null`);
    setSaving(false);
    if (err) { setError(err.message); return; }
    onClose();
  }

  async function unpauseRestaurant() {
    if (!restaurantId) return;
    setSaving(true);
    setError(null);
    const { error: err } = await supabase
      .from('restaurant_settings')
      .update({ paused_until: null, updated_at: new Date().toISOString() })
      .or(`restaurant_id.eq.${restaurantId},restaurant_id.is.null`);
    setSaving(false);
    if (err) { setError(err.message); return; }
    onClose();
  }

  function handleCustom(e: React.FormEvent) {
    e.preventDefault();
    const mins = parseInt(customMinutes, 10);
    if (!mins || mins < 1) { setError('Informe um número válido de minutos.'); return; }
    if (mins > 600) { setError('Máximo de 600 minutos (10 horas).'); return; }
    pauseRestaurant(mins);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isPaused ? 'bg-amber-500/15' : 'bg-slate-800'}`}>
              <Pause className={`w-4.5 h-4.5 ${isPaused ? 'text-amber-400' : 'text-slate-400'}`} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Pausar Restaurante</h2>
              <p className="text-xs text-slate-500">{isPaused ? 'Restaurante pausado agora' : 'Aceitando pedidos normalmente'}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white p-1 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        {isPaused ? (
          <div className="space-y-4">
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-center">
              <Clock className="w-8 h-8 text-amber-400 mx-auto mb-2" />
              <p className="text-sm text-amber-300 font-medium mb-1">Restaurante pausado</p>
              <p className="text-xs text-slate-400">
                Voltamos a aceitar pedidos às <span className="font-semibold text-amber-400">{new Date(pausedUntil!).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
              </p>
            </div>
            <button
              onClick={unpauseRestaurant}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-400 disabled:opacity-60 text-black font-semibold py-3 rounded-xl transition-colors"
            >
              <Play className="w-4 h-4" />
              {saving ? 'Reabrindo...' : 'Reabrir agora'}
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <p className="text-xs font-medium text-slate-400 mb-3">Pausa rápida</p>
              <div className="grid grid-cols-4 gap-2">
                {QUICK_OPTIONS.map(min => (
                  <button
                    key={min}
                    onClick={() => pauseRestaurant(min)}
                    disabled={saving}
                    className="flex flex-col items-center gap-1 py-3 rounded-xl border border-slate-700 bg-slate-800 hover:border-amber-500/50 hover:bg-amber-500/10 text-slate-300 hover:text-amber-400 transition-all disabled:opacity-50"
                  >
                    <span className="text-lg font-bold">{min}</span>
                    <span className="text-[10px] text-slate-500">min</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800" /></div>
              <div className="relative flex justify-center"><span className="bg-slate-900 px-3 text-xs text-slate-600">ou personalizado</span></div>
            </div>

            <form onSubmit={handleCustom} className="flex gap-2">
              <input
                type="number"
                value={customMinutes}
                onChange={e => setCustomMinutes(e.target.value)}
                placeholder="Minutos"
                min={1}
                max={600}
                className="flex-1 bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-500 transition-colors placeholder-slate-500"
              />
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black text-sm font-semibold transition-colors"
              >
                Pausar
              </button>
            </form>

            <p className="text-xs text-slate-500 leading-relaxed">
              Durante a pausa, o cardapio exibira "Estamos com alta demanda! Voltamos a aceitar pedidos as HH:MM" e novos pedidos serao bloqueados. A loja reabre automaticamente ao fim do tempo.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Hook for pause state + countdown display
export function usePauseState(restaurantId: string | null) {
  const [pausedUntil, setPausedUntil] = useState<string | null>(null);
  const [showPauseModal, setShowPauseModal] = useState(false);

  const fetchPauseState = useCallback(async () => {
    if (!restaurantId) return;
    const { data } = await supabase
      .from('restaurant_settings')
      .select('paused_until')
      .or(`restaurant_id.eq.${restaurantId},restaurant_id.is.null`)
      .maybeSingle();
    setPausedUntil(data?.paused_until ?? null);
  }, [restaurantId]);

  useEffect(() => {
    fetchPauseState();
    if (!restaurantId) return;
    const channel = supabase
      .channel(`pause-state-${restaurantId}`)
      .on('postgres_changes',
        { event: '*', table: 'restaurant_settings', filter: `restaurant_id=eq.${restaurantId}` },
        () => fetchPauseState()
      )
      .on('postgres_changes',
        { event: '*', table: 'restaurant_settings', filter: 'restaurant_id=is.null' },
        () => fetchPauseState()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [restaurantId, fetchPauseState]);

  // Auto-unpause when timer expires (client-side safety net)
  useEffect(() => {
    if (!pausedUntil) return;
    const ms = new Date(pausedUntil).getTime() - Date.now();
    if (ms <= 0) { setPausedUntil(null); return; }
    const timer = setTimeout(() => setPausedUntil(null), ms);
    return () => clearTimeout(timer);
  }, [pausedUntil]);

  const isPaused = pausedUntil ? new Date(pausedUntil) > new Date() : false;

  return { pausedUntil, isPaused, showPauseModal, setShowPauseModal, fetchPauseState };
}

// Countdown badge component for headers
export function PauseCountdownBadge({ pausedUntil, onClick }: { pausedUntil: string | null; onClick: () => void }) {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    if (!pausedUntil || new Date(pausedUntil) <= new Date()) { setRemaining(''); return; }
    function update() {
      const ms = new Date(pausedUntil).getTime() - Date.now();
      if (ms <= 0) { setRemaining(''); return; }
      const mins = Math.floor(ms / 60000);
      const secs = Math.floor((ms % 60000) / 1000);
      setRemaining(`${mins}:${secs.toString().padStart(2, '0')}`);
    }
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [pausedUntil]);

  if (!remaining) return null;

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-400 text-xs font-semibold hover:bg-amber-500/25 transition-colors animate-pulse"
    >
      <Pause className="w-3.5 h-3.5" />
      <span>{remaining}</span>
    </button>
  );
}
