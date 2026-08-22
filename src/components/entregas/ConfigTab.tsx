import { useState } from 'react';
import {
  Phone, Plus, Trash2, X, Save, MapPin, Settings,
  UserCheck, UserX, Crosshair, Lock, CheckCircle2,
  Wifi, WifiOff, ChevronUp, ChevronDown, Copy, Check,
  MapPinned
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { DeliveryMotoboy, DeliverySettings, KmZone } from '../../types';

interface Props {
  restaurantId: string | null;
  motoboys: DeliveryMotoboy[];
  dsettings: DeliverySettings | null;
  onRefresh: () => void;
}

function fmtCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={`w-10 h-6 rounded-full transition-all relative shrink-0 ${on ? 'bg-amber-500' : 'bg-slate-700'}`}
    >
      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-1'}`} />
    </button>
  );
}

// ── 99Food credential modal ───────────────────────────────────────────────────
interface Modal99Props {
  restaurantId: string;
  dsettingsId: string | null;
  initialAppKey?: string;
  initialAppSecret?: string;
  initialOwnLogistics: boolean;
  onSaved: (data: { ownLogistics: boolean }) => void;
  onCancel: () => void;
}

function ChannelModal99({
  restaurantId, dsettingsId,
  initialAppKey = '', initialAppSecret = '',
  initialOwnLogistics,
  onSaved, onCancel,
}: Modal99Props) {
  const [appKey, setAppKey] = useState(initialAppKey);
  const [appSecret, setAppSecret] = useState(initialAppSecret);
  const [ownLogistics, setOwnLogistics] = useState(initialOwnLogistics);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState('');

  async function handleSave() {
    if (!appKey.trim() || !appSecret.trim()) { setErr('Preencha todos os campos obrigatórios.'); return; }
    setSaving(true);
    setErr('');
    const payload = { food99_app_key: appKey.trim(), food99_app_secret: appSecret.trim(), food99_own_logistics: ownLogistics, channel_99food: true };
    let error;
    if (dsettingsId) {
      ({ error } = await supabase.from('delivery_settings').update(payload).eq('id', dsettingsId));
    } else {
      ({ error } = await supabase.from('delivery_settings').insert({ restaurant_id: restaurantId, ...payload }));
    }
    if (error) { setErr(error.message); setSaving(false); return; }
    setSaved(true);
    setTimeout(() => { onSaved({ ownLogistics }); }, 900);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-orange-500">
              <Wifi className="w-3.5 h-3.5 text-white" />
            </div>
            <h2 className="font-bold text-white">Conectar 99Food</h2>
          </div>
          <button onClick={onCancel} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-400">Obtenha as credenciais no portal do parceiro da 99Food.</p>
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">App Key *</label>
            <input value={appKey} onChange={e => setAppKey(e.target.value)} placeholder="app_key_xxxxxxxxxx"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white font-mono placeholder-slate-600 focus:outline-none focus:border-amber-500" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">App Secret *</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input type="password" value={appSecret} onChange={e => setAppSecret(e.target.value)} placeholder="••••••••••••••••"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white font-mono placeholder-slate-600 focus:outline-none focus:border-amber-500" />
            </div>
          </div>
          <div className="bg-slate-800/60 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">Logística Própria</p>
                <p className="text-xs text-slate-400">Usar seus motoboys para entregar</p>
              </div>
              <Toggle on={ownLogistics} onChange={setOwnLogistics} />
            </div>
            {!ownLogistics && (
              <p className="text-xs text-amber-400 border-t border-slate-700 pt-2 mt-2">
                Pedidos deste canal irão direto para "Entregues por Terceiros", sem aparecer na mesa de despacho.
              </p>
            )}
          </div>
          {err && <p className="text-xs text-red-400">{err}</p>}
          <button onClick={handleSave} disabled={saving || saved}
            className={`w-full font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-sm transition-all ${saved ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black'}`}
          >
            {saving ? <><div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> Conectando...</>
              : saved ? <><CheckCircle2 className="w-4 h-4" /> Conectado!</>
              : <><Wifi className="w-4 h-4" /> Salvar e Conectar</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Motoboys CRUD ─────────────────────────────────────────────────────────────
function MotoboysSection({ restaurantId, motoboys, onRefresh }: {
  restaurantId: string;
  motoboys: DeliveryMotoboy[];
  onRefresh: () => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function addMotoboy() {
    if (!name.trim()) { setErr('Nome obrigatório.'); return; }
    setSaving(true);
    setErr('');
    const { error } = await supabase.from('delivery_motoboys').insert({
      restaurant_id: restaurantId,
      name: name.trim(),
      phone: phone.trim() || null,
      active: true,
    });
    if (error) { setErr(error.message); } else { setName(''); setPhone(''); onRefresh(); }
    setSaving(false);
  }

  async function toggleActive(mb: DeliveryMotoboy) {
    if (!mb.active) {
      // Activating → join end of queue
      const { data } = await supabase
        .from('delivery_motoboys')
        .select('queue_position')
        .eq('restaurant_id', restaurantId)
        .not('queue_position', 'is', null)
        .order('queue_position', { ascending: false })
        .limit(1);
      const nextPos = ((data?.[0]?.queue_position as number | null | undefined) ?? 0) + 1;
      await supabase.from('delivery_motoboys').update({ active: true, queue_position: nextPos }).eq('id', mb.id);
    } else {
      // Deactivating → remove from queue
      await supabase.from('delivery_motoboys').update({ active: false, queue_position: null }).eq('id', mb.id);
    }
    onRefresh();
  }

  async function moveInQueue(mb: DeliveryMotoboy, direction: 'up' | 'down') {
    const queue = [...motoboys]
      .filter(m => m.active && m.queue_position != null)
      .sort((a, b) => (a.queue_position ?? 0) - (b.queue_position ?? 0));
    const idx = queue.findIndex(m => m.id === mb.id);
    if (idx < 0) return;
    const swapWith = direction === 'up' ? queue[idx - 1] : queue[idx + 1];
    if (!swapWith) return;
    await supabase.from('delivery_motoboys').update({ queue_position: swapWith.queue_position }).eq('id', mb.id);
    await supabase.from('delivery_motoboys').update({ queue_position: mb.queue_position }).eq('id', swapWith.id);
    onRefresh();
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-2">
        <UserCheck className="w-4 h-4 text-amber-400" />
        <h3 className="font-semibold text-white text-sm">Motoboys</h3>
        <span className="ml-auto text-xs bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded-full">{motoboys.length}</span>
      </div>
      <div className="p-5 space-y-4">
        <div className="flex gap-2">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addMotoboy()}
            placeholder="Nome *"
            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
          <input
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="Telefone"
            className="w-36 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
          <button
            onClick={addMotoboy}
            disabled={saving}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black font-bold px-3 py-2 rounded-xl text-sm transition-colors"
          >
            {saving ? <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : <Plus className="w-4 h-4" />}
          </button>
        </div>
        {err && <p className="text-xs text-red-400">{err}</p>}

        {motoboys.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-4">Nenhum motoboy cadastrado</p>
        ) : (
          <div className="space-y-2">
            {/* Sort: active+queued first (by position), then rest */}
            {[...motoboys]
              .sort((a, b) => {
                if (a.queue_position != null && b.queue_position != null) return a.queue_position - b.queue_position;
                if (a.queue_position != null) return -1;
                if (b.queue_position != null) return 1;
                return 0;
              })
              .map((mb, _, sorted) => {
                const queuedList = sorted.filter(m => m.active && m.queue_position != null);
                const queueIdx = queuedList.findIndex(m => m.id === mb.id);
                const isQueued = queueIdx >= 0;
                return (
                  <div key={mb.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors ${mb.active ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-800/20 border-slate-800 opacity-50'}`}>
                    {/* Queue position badge */}
                    {isQueued && (
                      <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-black text-black">{queueIdx + 1}</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">{mb.name}</p>
                      {mb.phone && <p className="text-xs text-slate-400">{mb.phone}</p>}
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border shrink-0 ${mb.active ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-slate-500/20 text-slate-500 border-slate-500/30'}`}>
                      {mb.active ? (isQueued ? `Fila #${queueIdx + 1}` : 'Ativo') : 'Inativo'}
                    </span>
                    {/* Up/Down queue reorder — only for queued motoboys */}
                    {isQueued && (
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <button
                          onClick={() => moveInQueue(mb, 'up')}
                          disabled={queueIdx === 0}
                          className="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                          title="Subir na fila"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => moveInQueue(mb, 'down')}
                          disabled={queueIdx === queuedList.length - 1}
                          className="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                          title="Descer na fila"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    <button
                      onClick={() => toggleActive(mb)}
                      className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors shrink-0 ${mb.active ? 'text-slate-400 hover:text-red-400 hover:bg-red-500/10' : 'text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10'}`}
                    >
                      {mb.active ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                );
              })}
            {motoboys.some(m => m.active && m.queue_position != null) && (
              <p className="text-[11px] text-slate-500 pt-1 text-center">
                Use as setas para ajustar a ordem de chegada. O #1 será sugerido primeiro para a próxima rodada.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Settings form ─────────────────────────────────────────────────────────────
function SettingsSection({ restaurantId, dsettings, onRefresh }: {
  restaurantId: string;
  dsettings: DeliverySettings | null;
}) {
  const s = dsettings;
  const [address, setAddress] = useState(s?.restaurant_address ?? '');
  const [lat, setLat] = useState(s?.latitude != null ? String(s.latitude) : '');
  const [lng, setLng] = useState(s?.longitude != null ? String(s.longitude) : '');
  const [geocoding, setGeocoding] = useState(false);
  const [geoErr, setGeoErr] = useState('');

  const [dailyRate, setDailyRate] = useState(String(s?.daily_rate ?? 0));
  const [maxPerRound, setMaxPerRound] = useState(String(s?.max_deliveries_per_round ?? 0));
  const [zones, setZones] = useState<KmZone[]>(s?.km_zones ?? []);

  const [channelPhone, setChannelPhone] = useState(s?.channel_phone ?? true);
  const [channelIfood, setChannelIfood] = useState(s?.channel_ifood ?? false);
  const [ifoodOwnLogistics, setIfoodOwnLogistics] = useState(s?.ifood_own_logistics ?? true);
  const [ifoodMerchantId, setIfoodMerchantId] = useState(s?.ifood_merchant_id ?? '');
  const [ifoodClientId, setIfoodClientId] = useState(s?.ifood_client_id ?? '');
  const [ifoodClientSecret, setIfoodClientSecret] = useState(s?.ifood_client_secret ?? '');
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [channel99food, setChannel99food] = useState(s?.channel_99food ?? false);
  const [food99OwnLogistics, setFood99OwnLogistics] = useState(s?.food99_own_logistics ?? false);

  const [show99Modal, setShow99Modal] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function handle99Toggle(val: boolean) {
    if (val) {
      setChannel99food(true);
      setShow99Modal(true);
    } else {
      setChannel99food(false);
    }
  }

  async function geocodeAddress() {
    if (!address.trim()) { setGeoErr('Digite o endereço primeiro.'); return; }
    setGeocoding(true);
    setGeoErr('');
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&countrycodes=br`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error('Falha na requisição');
      const data = await res.json();
      if (!data.length) { setGeoErr('Endereço não encontrado. Tente ser mais específico.'); return; }
      setLat(parseFloat(data[0].lat).toFixed(7));
      setLng(parseFloat(data[0].lon).toFixed(7));
    } catch {
      setGeoErr('Erro ao geocodificar. Verifique o endereço ou insira as coordenadas manualmente.');
    } finally {
      setGeocoding(false);
    }
  }

  function addZone() {
    const lastTo = zones.length ? zones[zones.length - 1].to : 0;
    setZones(prev => [...prev, { from: lastTo, to: lastTo + 5, rate: 0 }]);
  }

  function removeZone(idx: number) {
    setZones(prev => prev.filter((_, i) => i !== idx));
  }

  function updateZone(idx: number, field: keyof KmZone, val: number) {
    setZones(prev => prev.map((z, i) => i === idx ? { ...z, [field]: val } : z));
  }

  async function save() {
    setSaving(true);
    const payload = {
      restaurant_id: restaurantId,
      restaurant_address: address.trim() || null,
      latitude: lat ? parseFloat(lat) : null,
      longitude: lng ? parseFloat(lng) : null,
      daily_rate: parseFloat(dailyRate) || 0,
      max_deliveries_per_round: parseInt(maxPerRound) || 0,
      km_zones: zones,
      channel_phone: channelPhone,
      channel_ifood: channelIfood,
      ifood_own_logistics: ifoodOwnLogistics,
      ifood_merchant_id: channelIfood ? ifoodMerchantId.trim() || null : null,
      ifood_client_id: channelIfood ? ifoodClientId.trim() || null : null,
      ifood_client_secret: channelIfood ? ifoodClientSecret.trim() || null : null,
      channel_99food: channel99food,
      food99_own_logistics: food99OwnLogistics,
    };

    if (s?.id) {
      await supabase.from('delivery_settings').update(payload).eq('id', s.id);
    } else {
      await supabase.from('delivery_settings').insert(payload);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    onRefresh();
    setSaving(false);
  }

  const food99Connected = !!(s?.food99_app_key);

  return (
    <div className="space-y-4">

      {/* ── Ponto Zero ─────────────────────────────────────────────────────── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-amber-400" />
          <h3 className="font-semibold text-white text-sm">Ponto Zero (Endereço do Restaurante)</h3>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex gap-2">
            <input
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="Rua, número, bairro, cidade — Ex: Av. Paulista, 1000, Bela Vista, São Paulo"
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
            <button
              onClick={geocodeAddress}
              disabled={geocoding}
              title="Buscar coordenadas pelo endereço"
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 disabled:opacity-50 text-slate-300 hover:text-white font-semibold px-3 py-2.5 rounded-xl text-sm transition-colors whitespace-nowrap"
            >
              {geocoding
                ? <div className="w-4 h-4 border-2 border-slate-400/30 border-t-slate-400 rounded-full animate-spin" />
                : <Crosshair className="w-4 h-4" />}
              <span className="hidden sm:inline">Geocodificar</span>
            </button>
          </div>
          {geoErr && <p className="text-xs text-red-400">{geoErr}</p>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Latitude</label>
              <input
                value={lat}
                onChange={e => setLat(e.target.value)}
                placeholder="-23.5489"
                className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-300 font-mono placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Longitude</label>
              <input
                value={lng}
                onChange={e => setLng(e.target.value)}
                placeholder="-46.6388"
                className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-300 font-mono placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {lat && lng && (
            <div className="space-y-2">
              <p className="text-xs text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Ponto Zero definido: {parseFloat(lat).toFixed(5)}, {parseFloat(lng).toFixed(5)}
              </p>
              <button
                onClick={() => setShowMapModal(true)}
                className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1.5 transition-colors font-semibold"
              >
                <MapPinned className="w-3.5 h-3.5" />
                Ver no mapa e confirmar local
              </button>
            </div>
          )}
          <p className="text-xs text-slate-500">
            As coordenadas são usadas como origem absoluta nos cálculos de distância de entrega.
          </p>
        </div>
      </div>

      {/* ── Canais ─────────────────────────────────────────────────────────── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-2">
          <Phone className="w-4 h-4 text-amber-400" />
          <h3 className="font-semibold text-white text-sm">Canais de Pedidos</h3>
        </div>
        <div className="p-5 space-y-5">

          {/* Phone */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Telefone / WhatsApp</p>
              <p className="text-xs text-slate-400">Pedidos recebidos manualmente via formulário</p>
            </div>
            <Toggle on={channelPhone} onChange={setChannelPhone} />
          </div>

          {/* iFood */}
          <div className="border-t border-slate-800 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-white">iFood</p>
                  {channelIfood && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${(s?.ifood_client_id || ifoodClientId) ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'}`}>
                      {(s?.ifood_client_id || ifoodClientId) ? 'CONECTADO' : 'SEM CREDENCIAIS'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400">Configure na aba "Integração iFood"</p>
              </div>
              <Toggle on={channelIfood} onChange={setChannelIfood} />
            </div>
          </div>

          {/* 99Food */}
          <div className="border-t border-slate-800 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-white">99Food</p>
                  {channel99food && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${food99Connected ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'}`}>
                      {food99Connected ? 'CONECTADO' : 'SEM CREDENCIAIS'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400">Integração com marketplace</p>
              </div>
              <div className="flex items-center gap-3">
                {channel99food && (
                  <button
                    onClick={() => setShow99Modal(true)}
                    className="text-xs text-slate-400 hover:text-amber-400 flex items-center gap-1 transition-colors"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Credenciais</span>
                  </button>
                )}
                <Toggle on={channel99food} onChange={handle99Toggle} />
              </div>
            </div>
            {channel99food && (
              <div className="mt-3 ml-4 flex items-center gap-2 text-xs text-slate-400">
                {food99OwnLogistics ? <Wifi className="w-3.5 h-3.5 text-emerald-400" /> : <WifiOff className="w-3.5 h-3.5 text-slate-500" />}
                {food99OwnLogistics ? 'Logística própria ativa — pedidos aparecem na mesa de despacho' : 'Logística da 99Food — pedidos vão para Entregues por Terceiros'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Financial ──────────────────────────────────────────────────────── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-2">
          <Settings className="w-4 h-4 text-amber-400" />
          <h3 className="font-semibold text-white text-sm">Configurações Financeiras</h3>
        </div>
        <div className="p-5 space-y-5">
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-2">Diária Fixa por Motoboy</label>
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-sm">R$</span>
              <input
                value={dailyRate}
                onChange={e => setDailyRate(e.target.value)}
                type="number" step="0.50" min="0"
                className="w-32 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
              />
              <span className="text-slate-500 text-xs">/ dia</span>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-1">Limite Máximo de Entregas por Rodada</label>
            <p className="text-xs text-slate-500 mb-2">O algoritmo fatia automaticamente grupos maiores em subgrupos (FIFO). Use 0 para sem limite.</p>
            <div className="flex items-center gap-2">
              <input
                value={maxPerRound}
                onChange={e => setMaxPerRound(e.target.value.replace(/\D/g, ''))}
                type="number" step="1" min="0" max="20"
                className="w-20 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 text-center"
              />
              <span className="text-slate-500 text-xs">
                {parseInt(maxPerRound) > 0 ? `máx. ${maxPerRound} pedidos por motoboy por rodada` : 'sem limite'}
              </span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Zonas de Entrega por KM</label>
              <button onClick={addZone} className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Adicionar zona
              </button>
            </div>
            {zones.length === 0 ? (
              <p className="text-slate-500 text-sm py-2">Nenhuma zona configurada — taxa será R$ 0,00</p>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-4 gap-2 text-xs text-slate-500 px-1 mb-1">
                  <span>De (km)</span><span>Até (km)</span><span>Taxa (R$)</span><span />
                </div>
                {zones.map((z, idx) => (
                  <div key={idx} className="grid grid-cols-4 gap-2 items-center">
                    <input value={z.from} onChange={e => updateZone(idx, 'from', parseFloat(e.target.value) || 0)} type="number" step="0.5" min="0"
                      className="bg-slate-800 border border-slate-700 rounded-xl px-2 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500 text-center" />
                    <input value={z.to} onChange={e => updateZone(idx, 'to', parseFloat(e.target.value) || 0)} type="number" step="0.5" min="0"
                      className="bg-slate-800 border border-slate-700 rounded-xl px-2 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500 text-center" />
                    <input value={z.rate} onChange={e => updateZone(idx, 'rate', parseFloat(e.target.value) || 0)} type="number" step="0.50" min="0"
                      className="bg-slate-800 border border-slate-700 rounded-xl px-2 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500 text-center" />
                    <button onClick={() => removeZone(idx)} className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-red-400 transition-colors mx-auto">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <p className="text-xs text-slate-500 mt-2">
                  A taxa aplicada é a da zona cujo "De" seja menor ou igual à distância do pedido (maior faixa que se enquadra).
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className={`w-full font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-sm transition-all ${
          saved ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
               : 'bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black'
        }`}
      >
        {saving
          ? <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
          : saved
          ? <><CheckCircle2 className="w-4 h-4" /> Configurações salvas!</>
          : <><Save className="w-4 h-4" /> Salvar Configurações</>
        }
      </button>

      {/* Modals */}
      {show99Modal && (
        <ChannelModal99
          restaurantId={restaurantId}
          dsettingsId={s?.id ?? null}
          initialAppKey={s?.food99_app_key ?? ''}
          initialAppSecret={s?.food99_app_secret ?? ''}
          initialOwnLogistics={food99OwnLogistics}
          onSaved={({ ownLogistics }) => {
            setFood99OwnLogistics(ownLogistics);
            setShow99Modal(false);
            onRefresh();
          }}
          onCancel={() => {
            setChannel99food(false);
            setShow99Modal(false);
          }}
        />
      )}

      {/* Map confirmation modal */}
      {showMapModal && lat && lng && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowMapModal(false)}>
          <div className="bg-slate-900 rounded-2xl border border-slate-700 max-w-2xl w-full overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
              <h3 className="font-bold text-white flex items-center gap-2 text-sm">
                <MapPinned className="w-4 h-4 text-amber-400" />
                Confirmar Localização do Restaurante
              </h3>
              <button onClick={() => setShowMapModal(false)} className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-slate-400">
                Confirme se o marcador está na posição correta do seu restaurante. Esta será a origem para o cálculo de distâncias e taxas de entrega.
              </p>
              <div className="rounded-xl overflow-hidden border border-slate-700">
                <iframe
                  title="Mapa do restaurante"
                  className="w-full h-72"
                  loading="lazy"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(lng) - 0.01}%2C${parseFloat(lat) - 0.008}%2C${parseFloat(lng) + 0.01}%2C${parseFloat(lat) + 0.008}&layer=mapnik&marker=${lat}%2C${lng}`}
                />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-mono">{parseFloat(lat).toFixed(6)}, {parseFloat(lng).toFixed(6)}</span>
                <a
                  href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1"
                >
                  <MapPin className="w-3.5 h-3.5" /> Abrir em tela cheia
                </a>
              </div>
              <button
                onClick={() => setShowMapModal(false)}
                className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-3 rounded-xl transition-colors text-sm"
              >
                <CheckCircle2 className="w-4 h-4" />
                Confirmar Localização
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
const WEBHOOK_URL = 'https://sslcpewhqsznhikqbrua.supabase.co/functions/v1/ifood-webhook';

function IfoodSection({ restaurantId, dsettings, onRefresh }: {
  restaurantId: string;
  dsettings: DeliverySettings | null;
  onRefresh: () => void;
}) {
  const s = dsettings;
  const [enabled, setEnabled] = useState(s?.channel_ifood ?? false);
  const [merchantId, setMerchantId] = useState(s?.ifood_merchant_id ?? '');
  const [clientId, setClientId] = useState(s?.ifood_client_id ?? '');
  const [clientSecret, setClientSecret] = useState(s?.ifood_client_secret ?? '');
  const [ownLogistics, setOwnLogistics] = useState(s?.ifood_own_logistics ?? true);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const hasCredentials = !!(s?.ifood_client_id || clientId);

  async function save() {
    setSaving(true);
    const payload = {
      restaurant_id: restaurantId,
      channel_ifood: enabled,
      ifood_merchant_id: enabled ? merchantId.trim() || null : null,
      ifood_client_id: enabled ? clientId.trim() || null : null,
      ifood_client_secret: enabled ? clientSecret.trim() || null : null,
      ifood_own_logistics: ownLogistics,
    };
    if (s?.id) {
      await supabase.from('delivery_settings').update(payload).eq('id', s.id);
    } else {
      await supabase.from('delivery_settings').insert(payload);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    onRefresh();
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      {/* Main toggle card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-2">
          <div className="w-5 h-5 rounded flex items-center justify-center bg-red-500/20">
            <span className="text-[10px] font-black text-red-400">iF</span>
          </div>
          <h3 className="font-semibold text-white text-sm">Integração com iFood</h3>
          {enabled && (
            <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full border ${hasCredentials ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'}`}>
              {hasCredentials ? 'CONECTADO' : 'SEM CREDENCIAIS'}
            </span>
          )}
        </div>
        <div className="p-5 space-y-5">
          {/* Toggle row */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Habilitar Integração iFood</p>
              <p className="text-xs text-slate-400">Receba pedidos do marketplace automaticamente</p>
            </div>
            <Toggle on={enabled} onChange={setEnabled} />
          </div>

          {/* Conditional fields */}
          {enabled && (
            <div className="space-y-4 pt-1 border-t border-slate-800">
              {/* Sandbox badge */}
              <div className="flex items-center gap-2 pt-1">
                <span className="text-[11px] font-bold bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 px-2.5 py-1 rounded-full">
                  Modo: Sandbox (Testes)
                </span>
              </div>

              {/* Webhook URL */}
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">
                  URL do Webhook
                  <span className="ml-1 text-slate-600 font-normal normal-case">(cole no portal do iFood)</span>
                </label>
                <div className="flex gap-2">
                  <code className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-red-300 font-mono truncate select-all">
                    {WEBHOOK_URL}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(WEBHOOK_URL);
                      setCopiedWebhook(true);
                      setTimeout(() => setCopiedWebhook(false), 2000);
                    }}
                    className={`shrink-0 flex items-center gap-1 px-2.5 py-2 rounded-xl border text-xs font-semibold transition-colors ${copiedWebhook ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}
                  >
                    {copiedWebhook ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Merchant ID */}
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">
                  Merchant ID
                  <span className="ml-1 text-slate-600 font-normal normal-case">(Portal do Parceiro → Minha Conta)</span>
                </label>
                <input
                  value={merchantId}
                  onChange={e => setMerchantId(e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white font-mono placeholder-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Client ID */}
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">Client ID</label>
                <input
                  value={clientId}
                  onChange={e => setClientId(e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white font-mono placeholder-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Client Secret */}
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">Client Secret</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                  <input
                    type="password"
                    value={clientSecret}
                    onChange={e => setClientSecret(e.target.value)}
                    placeholder="••••••••••••••••••••••••"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white font-mono placeholder-slate-600 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Own logistics */}
              <div className="bg-slate-800/60 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">Logística Própria</p>
                    <p className="text-xs text-slate-400">Usar seus motoboys para entregar pedidos do iFood</p>
                  </div>
                  <Toggle on={ownLogistics} onChange={setOwnLogistics} />
                </div>
                {!ownLogistics && (
                  <p className="text-xs text-amber-400 border-t border-slate-700 pt-2">
                    Pedidos do iFood irão direto para "Entregues por Terceiros", sem aparecer na mesa de despacho.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className={`w-full font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-sm transition-all ${
          saved ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
               : 'bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black'
        }`}
      >
        {saving
          ? <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
          : saved
          ? <><CheckCircle2 className="w-4 h-4" /> Salvo!</>
          : <><Save className="w-4 h-4" /> Salvar Integração iFood</>
        }
      </button>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function ConfigTab({ restaurantId, motoboys, dsettings, onRefresh }: Props) {
  const [section, setSection] = useState<'motoboys' | 'settings' | 'ifood'>('motoboys');

  if (!restaurantId) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setSection('motoboys')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${section === 'motoboys' ? 'bg-amber-500 text-black' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
        >
          Motoboys
        </button>
        <button
          onClick={() => setSection('settings')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${section === 'settings' ? 'bg-amber-500 text-black' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
        >
          Canais e Tarifas
        </button>
        <button
          onClick={() => setSection('ifood')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${section === 'ifood' ? 'bg-red-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
        >
          Integração iFood
        </button>
      </div>

      {section === 'motoboys' && (
        <MotoboysSection restaurantId={restaurantId} motoboys={motoboys} onRefresh={onRefresh} />
      )}
      {section === 'settings' && (
        <SettingsSection restaurantId={restaurantId} dsettings={dsettings} onRefresh={onRefresh} />
      )}
      {section === 'ifood' && (
        <IfoodSection restaurantId={restaurantId} dsettings={dsettings} onRefresh={onRefresh} />
      )}
    </div>
  );
}
