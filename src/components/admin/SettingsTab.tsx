import { useState, useEffect, useCallback } from 'react';
import { Truck, Save, Check, Printer, X, FileText, AlertCircle, QrCode, Copy, Hash, ChefHat, ExternalLink, Bell, BellOff, Volume2, Music, ImageDown, Plus, Trash2, MapPin, Navigation } from 'lucide-react';
import BusinessHoursSection from './BusinessHoursSection';
import QRCode from 'qrcode';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../lib/tenant-context';
import { RestaurantSettings, DeliveryKmZone, BusinessHoursMap } from '../../types';
import { getDefaultBusinessHours } from '../../lib/business-hours';
import ImageUpload from './ImageUpload';
import PrintSettingsModal from './PrintSettingsModal';

const PRESET_SOUNDS = [
  {
    id: 'chime',
    name: 'Chime Suave',
    description: 'Sino ascendente, discreto',
    url: '/sounds/alert-ascending-chime-betacut-1-00-02.mp3',
  },
  {
    id: 'unlock',
    name: 'Desbloqueio',
    description: 'Efeito de nível desbloqueado',
    url: '/sounds/game-ui-level-unlock-om-fx-1-1-00-05.mp3',
  },
  {
    id: 'shopbell',
    name: 'Sino de Loja',
    description: 'Notificação estilo balcão',
    url: '/sounds/notification-new-client-shop-bell-bosnow-1-00-02.mp3',
  },
] as const;

export default function SettingsTab() {
  const { restaurant } = useTenant();
  const restaurantId = restaurant?.id ?? null;

  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [tableCount, setTableCount] = useState(10);
  const [kitchenEnabled, setKitchenEnabled] = useState(false);
  const [alertSoundUrl, setAlertSoundUrl] = useState<string | null>(null);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>('default');
  // Delivery module
  const [deliveryEnabled, setDeliveryEnabled] = useState(false);
  const [deliveryOriginAddress, setDeliveryOriginAddress] = useState('');
  const [deliveryOriginLat, setDeliveryOriginLat] = useState('');
  const [deliveryOriginLng, setDeliveryOriginLng] = useState('');
  const [deliveryMaxRadius, setDeliveryMaxRadius] = useState(10);
  const [deliveryKmZones, setDeliveryKmZones] = useState<DeliveryKmZone[]>([]);
  const [showVirtualAssistant, setShowVirtualAssistant] = useState(false);
  const [businessHours, setBusinessHours] = useState<BusinessHoursMap>(getDefaultBusinessHours());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Cupom config modal
  const [showCupomModal, setShowCupomModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [cnpj, setCnpj] = useState('');
  const [address, setAddress] = useState('');
  const [receiptFooter, setReceiptFooter] = useState('');
  const [savingCupom, setSavingCupom] = useState(false);
  const [savedCupom, setSavedCupom] = useState(false);

  // QR modal state
  const [qrModal, setQrModal] = useState<{ tableNum: number | null; url: string; dataUrl: string; title: string } | null>(null);
  const [copiedTable, setCopiedTable] = useState<number | null>(null);

  useEffect(() => { fetchSettings(); }, [restaurantId]);

  useEffect(() => {
    if ('Notification' in window) setNotifPerm(Notification.permission);
  }, []);

  async function fetchSettings() {
    const q = supabase.from('restaurant_settings').select('*');
    const { data } = await (restaurantId
      ? q.eq('restaurant_id', restaurantId)
      : q.is('restaurant_id', null)
    ).maybeSingle();
    if (data) {
      setSettings(data as RestaurantSettings);
      setName(data.name);
      setLogoUrl(data.logo_url ?? '');
      setTableCount(data.table_count ?? 10);
      setKitchenEnabled(data.kitchen_enabled ?? false);
      setAlertSoundUrl(data.alert_sound_url ?? null);
      setDeliveryEnabled(data.delivery_enabled ?? false);
      setDeliveryOriginAddress(data.delivery_origin_address ?? '');
      setDeliveryOriginLat(data.delivery_origin_lat != null ? String(data.delivery_origin_lat) : '');
      setDeliveryOriginLng(data.delivery_origin_lng != null ? String(data.delivery_origin_lng) : '');
      setDeliveryMaxRadius(data.delivery_max_radius_km ?? 10);
      setDeliveryKmZones(data.delivery_km_zones ?? []);
      setShowVirtualAssistant(data.show_virtual_assistant ?? false);
      setCnpj(data.cnpj ?? '');
      setAddress(data.address ?? '');
      setReceiptFooter(data.receipt_footer ?? '');
    }
  }

  async function save() {
    setSaving(true);
    setSaveError(null);
    const payload = {
      name,
      logo_url: logoUrl || null,
      table_count: tableCount,
      kitchen_enabled: kitchenEnabled,
      alert_sound_url: alertSoundUrl,
      delivery_enabled: deliveryEnabled,
      delivery_origin_address: deliveryOriginAddress || null,
      delivery_origin_lat: deliveryOriginLat ? parseFloat(deliveryOriginLat) : null,
      delivery_origin_lng: deliveryOriginLng ? parseFloat(deliveryOriginLng) : null,
      delivery_max_radius_km: deliveryMaxRadius,
      delivery_km_zones: deliveryKmZones,
      show_virtual_assistant: showVirtualAssistant,
      business_hours: businessHours,
      updated_at: new Date().toISOString(),
      ...(restaurantId ? { restaurant_id: restaurantId } : {}),
    };
    const { error } = settings?.id
      ? await supabase.from('restaurant_settings').update(payload).eq('id', settings.id)
      : await supabase.from('restaurant_settings').insert(payload);
    setSaving(false);
    if (error) {
      setSaveError('Erro ao salvar configurações. Verifique se você tem permissão para editar este restaurante.');
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    fetchSettings();
  }

  async function saveCupom() {
    setSavingCupom(true);
    const payload = {
      cnpj: cnpj.trim() || null,
      address: address.trim() || null,
      receipt_footer: receiptFooter.trim() || null,
      updated_at: new Date().toISOString(),
    };
    if (settings?.id) {
      const { error } = await supabase.from('restaurant_settings').update(payload).eq('id', settings.id);
      if (error) { setSavingCupom(false); setSaveError('Erro ao salvar dados do cupom.'); return; }
    }
    setSavingCupom(false);
    setSavedCupom(true);
    setTimeout(() => setSavedCupom(false), 2500);
    fetchSettings();
  }

  async function requestNotifPermission() {
    if (!('Notification' in window)) return;
    const perm = await Notification.requestPermission();
    setNotifPerm(perm);
  }

  async function selectAlertSound(url: string) {
    setAlertSoundUrl(url);
    if (settings?.id) {
      await supabase.from('restaurant_settings').update({ alert_sound_url: url, updated_at: new Date().toISOString() }).eq('id', settings.id);
    }
  }

  function previewSound(url: string) {
    const audio = new Audio(url);
    audio.play().catch(() => {});
  }

  const tableUrl = useCallback((n: number) => {
    const num = String(n).padStart(2, '0');
    const base = restaurant?.slug ? `/${restaurant.slug}` : '';
    return `${window.location.origin}${base}/mesa/${num}`;
  }, [restaurant?.slug]);

  async function openQrModal(n: number) {
    const url = tableUrl(n);
    const dataUrl = await QRCode.toDataURL(url, { width: 300, margin: 2, color: { dark: '#1e293b', light: '#ffffff' } });
    setQrModal({ tableNum: n, url, dataUrl, title: `Mesa ${String(n).padStart(2, '0')}` });
  }

  async function openGenericQr(url: string, title: string) {
    const dataUrl = await QRCode.toDataURL(url, { width: 300, margin: 2, color: { dark: '#1e293b', light: '#ffffff' } });
    setQrModal({ tableNum: null, url, dataUrl, title });
  }

  function copyLink(n: number) {
    navigator.clipboard.writeText(tableUrl(n));
    setCopiedTable(n);
    setTimeout(() => setCopiedTable(null), 2000);
  }

  async function saveJpg() {
    if (!qrModal) return;
    const canvas = document.createElement('canvas');
    const size = 400;
    canvas.width = size;
    canvas.height = size + 120;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const img = new Image();
    img.src = qrModal.dataUrl;
    await new Promise(res => { img.onload = res; });

    const qrSize = size - 40;
    ctx.drawImage(img, 20, 20, qrSize, qrSize);

    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(qrModal.title, canvas.width / 2, size + 72);

    ctx.fillStyle = '#64748b';
    ctx.font = '18px sans-serif';
    ctx.fillText(name || 'Cardápio Digital', canvas.width / 2, size + 100);

    const link = document.createElement('a');
    link.download = `${qrModal.title.toLowerCase().replace(/\s+/g, '-')}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.95);
    link.click();
  }

  function printQr() {
    if (!qrModal) return;
    const html = `<!DOCTYPE html><html><head><title>${qrModal.title}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box;}
        body{font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;background:#fff;padding:32px;}
        img{width:260px;height:260px;display:block;}
        .label{font-size:48px;font-weight:900;color:#1e293b;margin-top:16px;letter-spacing:-1px;}
        .sub{font-size:14px;color:#64748b;margin-top:6px;}
        .url{font-size:10px;color:#94a3b8;margin-top:12px;word-break:break-all;text-align:center;max-width:260px;}
        @media print{body{margin:0;}}
      </style>
    </head><body>
      <img src="${qrModal.dataUrl}" />
      <div class="label">${qrModal.title}</div>
      <div class="sub">${name || 'Cardápio Digital'}</div>
      <div class="url">${qrModal.url}</div>
    </body></html>`;
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:420px;height:560px;border:none;opacity:0;pointer-events:none;';
    document.body.appendChild(iframe);
    iframe.onload = () => {
      const w = iframe.contentWindow!;
      const img = w.document.querySelector('img');
      const doPrint = () => { w.focus(); w.print(); };
      w.addEventListener('afterprint', () => { if (iframe.parentNode) document.body.removeChild(iframe); }, { once: true });
      if (img && !img.complete) { img.onload = doPrint; img.onerror = doPrint; } else { doPrint(); }
      setTimeout(() => { if (iframe.parentNode) document.body.removeChild(iframe); }, 60000);
    };
    iframe.srcdoc = html;
  }

  const tables = Array.from({ length: tableCount }, (_, i) => i + 1);

  return (
    <div className="p-3 sm:p-6 max-w-6xl mx-auto space-y-6 sm:space-y-8">
      <div>
        <h2 className="text-xl font-bold text-white">Configurações do Restaurante</h2>
        <p className="text-slate-400 text-sm mt-1">Personalize as informações e o fluxo de atendimento.</p>
      </div>

      {saveError && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{saveError}</span>
          <button onClick={() => setSaveError(null)} className="text-red-400 hover:text-red-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Branding */}
      <section className="bg-[#0f2040] rounded-2xl p-6 border border-[#1e3868] space-y-4">
        <h3 className="font-semibold text-white text-sm uppercase tracking-wider">Identidade</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Nome do Restaurante</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className={inputCls}
              placeholder="Ex: Sabor da Casa"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Logo do Restaurante (opcional)</label>
            <ImageUpload value={logoUrl} onChange={setLogoUrl} />
          </div>
        </div>
      </section>

{/* Mesas / QR Codes */}
      <section className="bg-[#0f2040] rounded-2xl p-6 border border-[#1e3868] space-y-5">
        <div>
          <h3 className="font-semibold text-white text-sm uppercase tracking-wider flex items-center gap-2">
            <QrCode className="w-4 h-4 text-amber-400" /> Mesas e QR Codes
          </h3>
          <p className="text-xs text-slate-500 mt-1">Defina o número de mesas e gere os QR Codes para posicionar em cada uma.</p>
        </div>

        {/* Table count input */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[#1a3260] border border-[#1e3868] rounded-xl px-4 py-2.5 flex-1">
            <Hash className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="number"
              min={1}
              max={99}
              value={tableCount}
              onChange={e => setTableCount(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
              className="bg-transparent text-white text-sm w-full focus:outline-none"
              placeholder="Número de mesas"
            />
          </div>
          <span className="text-slate-400 text-sm whitespace-nowrap">mesa{tableCount !== 1 ? 's' : ''}</span>
        </div>

        {/* Table grid */}
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
          {tables.map(n => (
            <div
              key={n}
              className="bg-[#1a3260] border border-[#1e3868] rounded-xl p-2 flex flex-col items-center gap-1.5 group hover:border-amber-500/50 hover:bg-[#2a4d9a]/80 transition-all"
            >
              <span className="text-white font-bold text-lg leading-none">{String(n).padStart(2, '0')}</span>
              <span className="text-slate-500 text-[9px] uppercase tracking-wider">mesa</span>
              <div className="flex gap-1 w-full">
                <button
                  onClick={() => copyLink(n)}
                  title="Copiar link"
                  className={`flex-1 flex items-center justify-center py-1 rounded-lg transition-colors text-[10px] font-medium ${
                    copiedTable === n
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'bg-[#1e3868] hover:bg-slate-600 text-slate-400 hover:text-white border border-transparent'
                  }`}
                >
                  {copiedTable === n ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                </button>
                <button
                  onClick={() => openQrModal(n)}
                  title="Ver QR Code"
                  className="flex-1 flex items-center justify-center py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 border border-amber-500/20 transition-colors"
                >
                  <QrCode className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-slate-500">
          Clique no <span className="text-amber-400">ícone QR</span> para visualizar, imprimir ou salvar como JPG, ou no <span className="text-slate-300">ícone copiar</span> para copiar o link da mesa.
        </p>
      </section>

      {/* Impressão */}
      <section className="bg-[#0f2040] rounded-2xl p-6 border border-[#1e3868] space-y-4">
        <div>
          <h3 className="font-semibold text-white text-sm uppercase tracking-wider flex items-center gap-2">
            <Printer className="w-4 h-4 text-amber-400" /> Impressão
          </h3>
          <p className="text-xs text-slate-500 mt-1">Configure os dados exibidos na impressão do cupom.</p>
        </div>

        <button
          onClick={() => setShowCupomModal(true)}
          className="w-full flex items-center justify-center gap-2 bg-[#1a3260] hover:bg-[#2a4d9a] border border-[#1e3868] text-white font-semibold px-4 py-3 rounded-xl transition-colors text-sm"
        >
          <FileText className="w-4 h-4 text-amber-400" />
          Configuração de Cupom
          {(settings?.cnpj || settings?.address || settings?.receipt_footer) && (
            <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full ml-1">Configurado</span>
          )}
        </button>

        <button
          onClick={() => setShowPrintModal(true)}
          disabled={!restaurantId}
          className="w-full flex items-center justify-center gap-2 bg-[#1a3260] hover:bg-[#2a4d9a] border border-[#1e3868] text-white font-semibold px-4 py-3 rounded-xl transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Printer className="w-4 h-4 text-amber-400" />
          Impressoras Térmicas (Print Agent)
        </button>
      </section>

      {/* Monitor da Cozinha */}
      <section className="bg-[#0f2040] rounded-2xl p-6 border border-[#1e3868] space-y-4">
        <div>
          <h3 className="font-semibold text-white text-sm uppercase tracking-wider flex items-center gap-2">
            <ChefHat className="w-4 h-4 text-amber-400" /> Monitor da Cozinha (KDS)
          </h3>
          <p className="text-xs text-slate-500 mt-1">Tela dedicada para a equipe da cozinha acompanhar e avançar os pedidos em tempo real.</p>
        </div>

        {/* Toggle */}
        <button
          onClick={() => setKitchenEnabled(v => !v)}
          className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left ${
            kitchenEnabled
              ? 'border-amber-500 bg-amber-500/10'
              : 'border-[#1e3868] bg-[#1a3260] hover:border-[#2a4d9a]'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${kitchenEnabled ? 'bg-amber-500' : 'bg-[#1e3868]'}`}>
              <ChefHat className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-semibold text-white text-sm">Monitor da Cozinha</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {kitchenEnabled ? 'Habilitado — acesso disponível via URL abaixo.' : 'Desabilitado — habilite para usar a tela KDS.'}
              </p>
            </div>
          </div>
          <div className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${kitchenEnabled ? 'bg-amber-500' : 'bg-[#1e3868]'}`}>
            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${kitchenEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
          </div>
        </button>

        {/* URL card */}
        {kitchenEnabled && (
          <div className="bg-[#1a3260]/60 border border-[#1e3868] rounded-xl p-4 space-y-3">
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">URL de acesso</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-amber-400 text-sm bg-[#0f2040] border border-[#1e3868] rounded-lg px-3 py-2.5 truncate select-all">
                {window.location.origin}/{restaurant?.slug}/cozinha
              </code>
              <button
                onClick={() => navigator.clipboard.writeText(`${window.location.origin}/${restaurant?.slug}/cozinha`)}
                title="Copiar URL"
                className="shrink-0 p-2.5 bg-[#1e3868] hover:bg-slate-600 text-slate-300 hover:text-white rounded-lg transition-colors"
              >
                <Copy className="w-4 h-4" />
              </button>
              <button
                onClick={() => openGenericQr(`${window.location.origin}/${restaurant?.slug}/cozinha`, 'Cozinha')}
                title="Ver QR Code"
                className="shrink-0 p-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-lg transition-colors"
              >
                <QrCode className="w-4 h-4" />
              </button>
              <a
                href={`/${restaurant?.slug}/cozinha`}
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir em nova aba"
                className="shrink-0 p-2.5 bg-[#1e3868] hover:bg-slate-600 text-slate-300 hover:text-white rounded-lg transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
            <p className="text-xs text-slate-500">
              Abra esta URL em um tablet ou monitor na cozinha. Não requer login.
            </p>
          </div>
        )}
      </section>

      {/* Alertas Sonoros */}
      <section className="bg-[#0f2040] rounded-2xl p-6 border border-[#1e3868] space-y-4">
        <div>
          <h3 className="font-semibold text-white text-sm uppercase tracking-wider flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-400" /> Alertas Sonoros
          </h3>
          <p className="text-xs text-slate-500 mt-1">Escolha o som para novos pedidos e configure notificações em segundo plano.</p>
        </div>

        {/* Desktop notifications */}
        <div className="bg-[#1a3260]/60 border border-[#1e3868] rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Notificações em segundo plano</p>
          <p className="text-xs text-slate-500">Receba alertas mesmo com o navegador minimizado ou outra janela ativa.</p>
          {'Notification' in window ? (
            notifPerm === 'granted' ? (
              <div className="flex items-center gap-2 text-green-400 text-xs font-medium">
                <Bell className="w-3.5 h-3.5" /> Notificações ativadas no navegador.
              </div>
            ) : notifPerm === 'denied' ? (
              <div className="flex items-center gap-2 text-red-400 text-xs">
                <BellOff className="w-3.5 h-3.5" /> Notificações bloqueadas. Habilite nas configurações do navegador.
              </div>
            ) : (
              <button
                onClick={requestNotifPermission}
                className="flex items-center gap-2 text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 px-3 py-2 rounded-lg transition-colors"
              >
                <Bell className="w-3.5 h-3.5" /> Permitir Notificações
              </button>
            )
          ) : (
            <p className="text-xs text-slate-500">Navegador não suporta notificações.</p>
          )}
        </div>

        {/* Preset sound selector */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Music className="w-3.5 h-3.5 text-slate-400" /> Som de alerta
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PRESET_SOUNDS.map(preset => {
              const selected = alertSoundUrl === preset.url;
              return (
                <button
                  key={preset.id}
                  onClick={() => selectAlertSound(preset.url)}
                  className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 text-left transition-all ${
                    selected
                      ? 'border-amber-500 bg-amber-500/10'
                      : 'border-[#1e3868] bg-[#1a3260]/50 hover:border-[#2a4d9a] hover:bg-[#1a3260]'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${selected ? 'bg-amber-500' : 'bg-[#1e3868]'}`}>
                    <Volume2 className={`w-4 h-4 ${selected ? 'text-black' : 'text-slate-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold leading-tight ${selected ? 'text-amber-300' : 'text-slate-200'}`}>{preset.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{preset.description}</p>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); previewSound(preset.url); }}
                    title="Testar"
                    className={`shrink-0 p-1.5 rounded-lg transition-colors ${selected ? 'text-amber-400 hover:bg-amber-500/20' : 'text-slate-500 hover:text-slate-300 hover:bg-[#2a4d9a]'}`}
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <BusinessHoursSection value={businessHours} onChange={setBusinessHours} />

      {/* Módulo Delivery */}
      <section className="bg-[#0f2040] rounded-2xl p-6 border border-[#1e3868] space-y-5">
        <div>
          <h3 className="font-semibold text-white text-sm uppercase tracking-wider flex items-center gap-2">
            <Truck className="w-4 h-4 text-amber-400" /> Módulo Delivery (Add-on)
          </h3>
          <p className="text-xs text-slate-500 mt-1">Permite que clientes escolham entre Delivery e Retirada no checkout.</p>
        </div>

        {/* Toggle */}
        <button
          onClick={() => setDeliveryEnabled(v => !v)}
          className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left ${
            deliveryEnabled ? 'border-amber-500 bg-amber-500/10' : 'border-[#1e3868] bg-[#1a3260] hover:border-[#2a4d9a]'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${deliveryEnabled ? 'bg-amber-500' : 'bg-[#1e3868]'}`}>
              <Truck className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-semibold text-white text-sm">Ativar Módulo Delivery</p>
              <p className="text-xs text-slate-400 mt-0.5">{deliveryEnabled ? 'Habilitado — clientes podem escolher Delivery.' : 'Desabilitado — apenas Retirada / Mesa.'}</p>
            </div>
          </div>
          <div className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${deliveryEnabled ? 'bg-amber-500' : 'bg-[#1e3868]'}`}>
            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${deliveryEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
          </div>
        </button>

        {deliveryEnabled && (
          <div className="space-y-5">
            {/* Delivery URL card */}
            <div className="bg-[#1a3260]/60 border border-[#1e3868] rounded-xl p-4 space-y-3">
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-amber-400" /> URL do Cardápio Delivery
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-amber-400 text-sm bg-[#0f2040] border border-[#1e3868] rounded-lg px-3 py-2.5 truncate select-all">
                  {window.location.origin}/{restaurant?.slug}/delivery
                </code>
                <button
                  onClick={() => navigator.clipboard.writeText(`${window.location.origin}/${restaurant?.slug}/delivery`)}
                  title="Copiar URL"
                  className="shrink-0 p-2.5 bg-[#1e3868] hover:bg-slate-600 text-slate-300 hover:text-white rounded-lg transition-colors"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  onClick={() => openGenericQr(`${window.location.origin}/${restaurant?.slug}/delivery`, 'Delivery')}
                  title="Ver QR Code"
                  className="shrink-0 p-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-lg transition-colors"
                >
                  <QrCode className="w-4 h-4" />
                </button>
                <a
                  href={`/${restaurant?.slug}/delivery`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Abrir em nova aba"
                  className="shrink-0 p-2.5 bg-[#1e3868] hover:bg-slate-600 text-slate-300 hover:text-white rounded-lg transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
              <p className="text-xs text-slate-500">
                Compartilhe este link ou QR Code para que clientes façam pedidos delivery. O modo entrega já vem pré-selecionado.
              </p>
            </div>

            {/* Origin address */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-amber-400" /> Endereço do Restaurante (Ponto Zero)</p>
              <input
                value={deliveryOriginAddress}
                onChange={e => setDeliveryOriginAddress(e.target.value)}
                className={inputCls}
                placeholder="Ex: Rua das Flores, 123 — Jardim América — São Paulo/SP"
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Latitude</label>
                  <input value={deliveryOriginLat} onChange={e => setDeliveryOriginLat(e.target.value)} className={inputCls} placeholder="-23.5505" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Longitude</label>
                  <input value={deliveryOriginLng} onChange={e => setDeliveryOriginLng(e.target.value)} className={inputCls} placeholder="-46.6333" />
                </div>
              </div>
              <p className="text-xs text-slate-500">Abra o Google Maps, clique no ponto do restaurante e copie as coordenadas exibidas.</p>
            </div>

            {/* Max radius */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Raio Máximo de Entrega (km)</label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={deliveryMaxRadius}
                  onChange={e => setDeliveryMaxRadius(parseFloat(e.target.value) || 10)}
                  className={`${inputCls} w-32`}
                />
                <span className="text-slate-400 text-sm">km do restaurante</span>
              </div>
            </div>

            {/* KM Zones */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Tabela de Faixas de KM</p>
                <button
                  onClick={() => setDeliveryKmZones(z => [...z, { from: z.length === 0 ? 0 : z[z.length - 1].to + 0.1, to: z.length === 0 ? 3 : z[z.length - 1].to + 3, rate: 6, minutes: 30 }])}
                  className="flex items-center gap-1.5 text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar faixa
                </button>
              </div>
              {deliveryKmZones.length === 0 && (
                <p className="text-xs text-slate-500 text-center py-3 bg-[#1a3260]/50 rounded-xl border border-dashed border-[#1e3868]">Nenhuma faixa configurada. Adicione pelo menos uma.</p>
              )}
              {deliveryKmZones.map((zone, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 items-end">
                  <div>
                    {i === 0 && <label className="block text-[10px] text-slate-500 mb-1">De (km)</label>}
                    <input type="number" min={0} step={0.1} value={zone.from} onChange={e => { const z = [...deliveryKmZones]; z[i] = { ...z[i], from: parseFloat(e.target.value) || 0 }; setDeliveryKmZones(z); }} className={inputCls} />
                  </div>
                  <div>
                    {i === 0 && <label className="block text-[10px] text-slate-500 mb-1">Até (km)</label>}
                    <input type="number" min={0} step={0.1} value={zone.to} onChange={e => { const z = [...deliveryKmZones]; z[i] = { ...z[i], to: parseFloat(e.target.value) || 0 }; setDeliveryKmZones(z); }} className={inputCls} />
                  </div>
                  <div>
                    {i === 0 && <label className="block text-[10px] text-slate-500 mb-1">Taxa (R$)</label>}
                    <input type="number" min={0} step={0.01} value={zone.rate} onChange={e => { const z = [...deliveryKmZones]; z[i] = { ...z[i], rate: parseFloat(e.target.value) || 0 }; setDeliveryKmZones(z); }} className={inputCls} />
                  </div>
                  <div>
                    {i === 0 && <label className="block text-[10px] text-slate-500 mb-1">Tempo (min)</label>}
                    <input type="number" min={0} value={zone.minutes} onChange={e => { const z = [...deliveryKmZones]; z[i] = { ...z[i], minutes: parseInt(e.target.value) || 0 }; setDeliveryKmZones(z); }} className={inputCls} />
                  </div>
                  <button onClick={() => setDeliveryKmZones(z => z.filter((_, idx) => idx !== i))} className="mb-0.5 w-9 h-[42px] flex items-center justify-center text-slate-500 hover:text-red-400 bg-[#1a3260] border border-[#1e3868] rounded-xl transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {deliveryKmZones.length > 0 && (
                <p className="text-xs text-slate-500">Ex: 0–3 km → R$ 6,00 · 30 min &nbsp;|&nbsp; 3.1–6 km → R$ 10,00 · 45 min</p>
              )}
            </div>
          </div>
        )}
      </section>

      <button
        onClick={save}
        disabled={saving}
        className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black font-semibold px-6 py-3 rounded-xl transition-colors"
      >
        {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
        {saved ? 'Salvo!' : saving ? 'Salvando...' : 'Salvar Configurações'}
      </button>

      {showPrintModal && restaurantId && (
        <PrintSettingsModal restaurantId={restaurantId} onClose={() => setShowPrintModal(false)} />
      )}

      {/* Cupom Config Modal */}
      {showCupomModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0f2040] border border-[#1e3868] rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-[#1e3868]">
              <div>
                <h3 className="font-bold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-400" /> Configuração de Cupom
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Dados exibidos na impressão da conta.</p>
              </div>
              <button onClick={() => setShowCupomModal(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">CNPJ</label>
                <input value={cnpj} onChange={e => setCnpj(e.target.value)} className={inputCls} placeholder="00.000.000/0000-00" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Endereço</label>
                <input value={address} onChange={e => setAddress(e.target.value)} className={inputCls} placeholder="Rua Exemplo, 123 — Bairro — Cidade/UF" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">
                  Rodapé do Cupom
                  <span className={`ml-2 font-medium ${receiptFooter.length > 40 ? 'text-red-400' : 'text-slate-500'}`}>
                    {receiptFooter.length}/40
                  </span>
                </label>
                <input
                  value={receiptFooter}
                  onChange={e => setReceiptFooter(e.target.value.slice(0, 40))}
                  className={inputCls}
                  placeholder="Ex: Obrigado pela sua visita!"
                  maxLength={40}
                />
              </div>

              {/* Receipt preview */}
              <div className="bg-white rounded-xl p-4 font-mono text-black text-[11px] leading-relaxed text-center border border-slate-200">
                <div className="font-bold text-sm">{name || 'Nome do Restaurante'}</div>
                {cnpj && <div>CNPJ: {cnpj}</div>}
                {address && <div>{address}</div>}
                <div className="border-t border-dashed border-gray-400 my-1" />
                <div className="text-left">
                  <div><span className="font-bold">2x</span> X-Burguer Especial  <span className="float-right">R$ 50,00</span></div>
                  <div><span className="font-bold">1x</span> Suco de Laranja     <span className="float-right">R$ 12,00</span></div>
                </div>
                <div className="border-t border-dashed border-gray-400 my-1" />
                <div className="font-bold flex justify-between">
                  <span>TOTAL</span><span>R$ 62,00</span>
                </div>
                {receiptFooter && (
                  <>
                    <div className="border-t border-dashed border-gray-400 my-1" />
                    <div className="text-gray-600">{receiptFooter}</div>
                  </>
                )}
              </div>
            </div>

            <div className="flex gap-3 p-5 border-t border-[#1e3868]">
              <button onClick={() => setShowCupomModal(false)} className="flex-1 bg-[#1a3260] hover:bg-[#2a4d9a] text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
                Cancelar
              </button>
              <button
                onClick={async () => { await saveCupom(); setShowCupomModal(false); }}
                disabled={savingCupom}
                className="flex-1 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
              >
                {savedCupom ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                {savedCupom ? 'Salvo!' : savingCupom ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {qrModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setQrModal(null)}>
          <div
            className="bg-[#0f2040] border border-[#1e3868] rounded-2xl w-full max-w-sm overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#1e3868]">
              <div>
                <h3 className="font-bold text-white flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-amber-400" /> {qrModal.title}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[260px]">{qrModal.url}</p>
              </div>
              <button onClick={() => setQrModal(null)} className="text-slate-400 hover:text-white p-1 shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col items-center px-8 py-6 gap-4">
              <div className="bg-white rounded-2xl p-4 shadow-lg">
                <img src={qrModal.dataUrl} alt={`QR ${qrModal.title}`} className="w-52 h-52" />
              </div>
              <div className="text-center">
                <p className="text-4xl font-black text-white tracking-tight">{qrModal.title}</p>
                <p className="text-slate-400 text-sm mt-1">{name || 'Cardápio Digital'}</p>
              </div>
            </div>

            <div className="flex gap-2 px-5 pb-5">
              <button
                onClick={() => qrModal.tableNum != null ? copyLink(qrModal.tableNum) : navigator.clipboard.writeText(qrModal.url)}
                className={`flex-1 flex items-center justify-center gap-2 font-semibold px-3 py-3 rounded-xl transition-colors text-sm ${
                  copiedTable === qrModal.tableNum
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'bg-[#1a3260] hover:bg-[#2a4d9a] border border-[#1e3868] text-slate-300'
                }`}
              >
                {copiedTable === qrModal.tableNum ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copiedTable === qrModal.tableNum ? 'Copiado!' : 'Copiar'}
              </button>
              <button
                onClick={saveJpg}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-3 py-3 rounded-xl transition-colors text-sm"
              >
                <ImageDown className="w-4 h-4" />
                Salvar JPG
              </button>
              <button
                onClick={printQr}
                className="flex-1 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold px-3 py-3 rounded-xl transition-colors text-sm"
              >
                <Printer className="w-4 h-4" />
                Imprimir
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

const inputCls = 'w-full bg-[#1a3260] border border-[#1e3868] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors';
