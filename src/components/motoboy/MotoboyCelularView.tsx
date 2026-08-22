import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Bike, MapPin, WifiOff, CheckCircle2, AlertCircle, Shield } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type GpsStatus = 'requesting' | 'granted' | 'denied' | 'unavailable';

const UPDATE_INTERVAL_MS = 20_000;   // max one Supabase write every 20 s
const MIN_DISTANCE_M = 30;           // or if moved at least 30 m

function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6_371_000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function MotoboyCelularView() {
  const { motoboyId } = useParams<{ motoboyId: string }>();
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>('requesting');
  const [coords, setCoords] = useState<{ lat: number; lng: number; acc: number } | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [bgWarning, setBgWarning] = useState(false);

  const lastSentRef = useRef<{ lat: number; lng: number; time: number } | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // ── Wake Lock: keep screen on ─────────────────────────────────────────────
  async function acquireWakeLock() {
    if (!('wakeLock' in navigator)) return;
    try {
      wakeLockRef.current = await (navigator.wakeLock as any).request('screen');
      setWakeLockActive(true);
      wakeLockRef.current.addEventListener('release', () => {
        setWakeLockActive(false);
        // Re-acquire when tab becomes visible again
        if (!document.hidden) acquireWakeLock();
      });
    } catch { /* browser denied */ }
  }

  useEffect(() => {
    acquireWakeLock();
    const onVisible = () => { if (!document.hidden && !wakeLockRef.current) acquireWakeLock(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      wakeLockRef.current?.release();
    };
  }, []);

  // ── GPS watch + throttled Supabase update ────────────────────────────────
  async function persistLocation(lat: number, lng: number) {
    if (!motoboyId) return;
    const now = Date.now();
    const prev = lastSentRef.current;

    const timePassed = !prev || (now - prev.time) >= UPDATE_INTERVAL_MS;
    const movedEnough = !prev || distanceMeters(prev.lat, prev.lng, lat, lng) >= MIN_DISTANCE_M;

    if (!timePassed && !movedEnough) return;

    lastSentRef.current = { lat, lng, time: now };

    await supabase
      .from('delivery_motoboys')
      .update({ last_lat: lat, last_lng: lng, last_seen_at: new Date().toISOString() })
      .eq('id', motoboyId);

    setLastUpdate(new Date());
  }

  useEffect(() => {
    if (!navigator.geolocation) { setGpsStatus('unavailable'); return; }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, accuracy: acc } = pos.coords;
        setGpsStatus('granted');
        setCoords({ lat, lng, acc });
        persistLocation(lat, lng);
      },
      () => setGpsStatus('denied'),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [motoboyId]);

  // ── Background warning after 10 s of no update ───────────────────────────
  useEffect(() => {
    if (!lastUpdate) return;
    const id = setTimeout(() => setBgWarning(true), 40_000);
    setBgWarning(false);
    return () => clearTimeout(id);
  }, [lastUpdate]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 gap-6">

      {/* Header */}
      <div className="text-center">
        <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-2xl transition-all duration-500 ${gpsStatus === 'granted' ? 'bg-amber-500 shadow-amber-500/30' : 'bg-slate-800'}`}>
          <Bike className={`w-10 h-10 ${gpsStatus === 'granted' ? 'text-black' : 'text-slate-500'}`} />
        </div>
        <h1 className="text-2xl font-bold text-white">Gula Entregas</h1>
        <p className="text-slate-500 text-sm mt-1">Painel do Entregador</p>
      </div>

      {/* Main status card */}
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">

        {gpsStatus === 'requesting' && (
          <div className="p-6 text-center space-y-3">
            <div className="w-10 h-10 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mx-auto" />
            <p className="text-slate-400 text-sm">Solicitando permissão de localização...</p>
          </div>
        )}

        {gpsStatus === 'granted' && (
          <>
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-sm font-bold text-emerald-400">Rastreamento Ativo</span>
              </div>
              {wakeLockActive && (
                <div className="flex items-center gap-1 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-full">
                  <Shield className="w-3 h-3" />
                  Tela protegida
                </div>
              )}
            </div>

            <div className="p-5 space-y-4">
              {coords && (
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-slate-500 mb-0.5">Coordenadas atuais</p>
                      <p className="text-sm text-white font-mono">
                        {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                      </p>
                      <p className="text-xs text-slate-600">Precisão: ±{Math.round(coords.acc)}m</p>
                    </div>
                  </div>

                  {lastUpdate && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Enviado ao ADM às {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
                <p className="text-emerald-400 font-semibold text-sm">Conectado. Aguardando Pedidos...</p>
              </div>

              {bgWarning && (
                <div className="flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3">
                  <AlertCircle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-yellow-300">
                    Não há atualização recente. Mantenha o aplicativo aberto e a tela ativa para rastreamento contínuo.
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        {gpsStatus === 'denied' && (
          <div className="p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <p className="text-red-400 font-semibold">Permissão de GPS negada</p>
              <p className="text-slate-500 text-sm mt-1">
                Habilite a localização nas configurações do navegador e recarregue.
              </p>
            </div>
            <button onClick={() => window.location.reload()}
              className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">
              Tentar novamente
            </button>
          </div>
        )}

        {gpsStatus === 'unavailable' && (
          <div className="p-6 text-center space-y-3">
            <WifiOff className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-slate-400 font-semibold">GPS não disponível</p>
            <p className="text-slate-500 text-sm">Este dispositivo não suporta geolocalização.</p>
          </div>
        )}
      </div>

      {/* Background tracking notice */}
      {gpsStatus === 'granted' && (
        <div className="w-full max-w-sm bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3">
          <p className="text-xs text-slate-500 text-center leading-relaxed">
            <strong className="text-slate-400">Atenção:</strong> Para rastreamento contínuo, mantenha o navegador em primeiro plano e a tela ligada. Fechar o aplicativo ou bloquear o celular interrompe o GPS.
          </p>
        </div>
      )}
    </div>
  );
}
