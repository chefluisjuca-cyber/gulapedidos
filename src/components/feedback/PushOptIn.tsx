import { useState, useEffect } from 'react';
import { Bell, Check, Loader2, AlertCircle, BellRing } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../lib/tenant-context';

export default function PushOptIn() {
  const { restaurant } = useTenant();
  const restaurantId = restaurant?.id ?? null;
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<'idle' | 'searching' | 'subscribing' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [leadName, setLeadName] = useState('');

  useEffect(() => {
    if (!restaurant) return;
    const stored = sessionStorage.getItem('push_optin_phone');
    if (stored) setPhone(stored);
  }, [restaurant]);

  function maskPhone(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  async function handleOptIn() {
    if (!restaurantId || !phone.trim()) return;
    setStatus('searching');
    setErrorMsg('');

    const digits = phone.replace(/\D/g, '');
    // The phone is stored formatted like "(11) 96423-3303" but the user may type
    // it with or without formatting. Search by the last 8 digits to match regardless
    // of how the phone was stored.
    const lastDigits = digits.slice(-8);
    const { data: leads } = await supabase
      .from('feedback_leads')
      .select('id, name, push_enabled')
      .eq('restaurant_id', restaurantId)
      .ilike('phone', `%${lastDigits}%`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!leads) {
      setStatus('error');
      setErrorMsg('Nao encontramos seu cadastro. Verifique o telefone ou preencha a pesquisa de satisfacao primeiro.');
      return;
    }

    setLeadName(leads.name);

    // Check if already has push subscription
    if (leads.push_enabled) {
      setStatus('done');
      return;
    }

    // Request notification permission and subscribe
    setStatus('subscribing');
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setStatus('error');
        setErrorMsg('Seu navegador nao suporta notificacoes push.');
        return;
      }

      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        setStatus('error');
        setErrorMsg('Notificacoes push nao configuradas. Tente novamente mais tarde.');
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus('error');
        setErrorMsg('Voce precisa autorizar as notificacoes para receber ofertas.');
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      const subJson = sub.toJSON();
      const { error: updateErr } = await supabase
        .from('feedback_leads')
        .update({
          push_subscription: {
            endpoint: subJson.endpoint,
            keys: {
              p256dh: subJson.keys?.p256dh ?? '',
              auth: subJson.keys?.auth ?? '',
            },
          },
          push_enabled: true,
        })
        .eq('id', leads.id);

      if (updateErr) {
        setStatus('error');
        setErrorMsg('Erro ao salvar inscricao. Tente novamente.');
        return;
      }

      setStatus('done');
    } catch {
      setStatus('error');
      setErrorMsg('Erro ao ativar notificacoes. Tente novamente.');
    }
  }

  function urlBase64ToUint8Array(base64: string): Uint8Array {
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    const base64Str = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64Str);
    const arr = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col max-w-lg mx-auto">
      <header className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-5 text-center">
        <h1 className="text-white font-black text-xl flex items-center justify-center gap-2">
          <BellRing className="w-5 h-5" /> {restaurant.name}
        </h1>
        <p className="text-white/80 text-xs mt-1">Ativar Notificacoes de Ofertas</p>
      </header>

      <main className="flex-1 px-6 py-8 flex flex-col items-center justify-center">
        {status === 'done' ? (
          <div className="text-center space-y-4">
            <div className="w-20 h-20 rounded-full bg-green-500/15 flex items-center justify-center mx-auto">
              <Check className="w-10 h-10 text-green-400" />
            </div>
            <h2 className="text-white font-bold text-lg">Tudo pronto, {leadName || 'cliente'}!</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              Voce agora recebera notificacoes com promocoes e ofertas especiais diretamente
              no seu celular ou navegador. Fique de olho!
            </p>
          </div>
        ) : (
          <div className="w-full space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-full bg-amber-500/15 flex items-center justify-center mx-auto">
                <Bell className="w-8 h-8 text-amber-400" />
              </div>
              <h2 className="text-white font-bold text-lg">Receba ofertas exclusivas</h2>
              <p className="text-slate-500 text-sm leading-relaxed">
                Ative as notificacoes para receber promocoes, descontos e brindees especiais
                do {restaurant.name} direto no seu celular.
              </p>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1.5">
                Confirme seu telefone (o mesmo usado na pesquisa)
              </label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(maskPhone(e.target.value))}
                placeholder="(11) 99999-9999"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3.5 text-white text-sm placeholder:text-slate-600 focus:border-amber-500/50 focus:outline-none transition-colors"
                disabled={status === 'searching' || status === 'subscribing'}
              />
            </div>

            {errorMsg && (
              <div className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              onClick={handleOptIn}
              disabled={!phone.trim() || status === 'searching' || status === 'subscribing'}
              className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold py-3.5 rounded-xl transition-colors text-sm"
            >
              {status === 'searching' || status === 'subscribing' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {status === 'searching' ? 'Localizando cadastro...' : 'Ativando notificacoes...'}
                </>
              ) : (
                <>
                  <Bell className="w-4 h-4" />
                  Ativar Notificacoes
                </>
              )}
            </button>

            <p className="text-[11px] text-slate-600 text-center leading-relaxed">
              Ao ativar, voce autoriza o {restaurant.name} a enviar notificacoes push.
              Voce pode desativar a qualquer momento nas configuracoes do navegador.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
