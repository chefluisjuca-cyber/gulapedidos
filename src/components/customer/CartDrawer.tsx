import { useState, useEffect, useCallback } from 'react';
import { X, Minus, Plus, Trash2, ShoppingBag, Truck, Star, Phone, Check, Gift, Coins, Percent, Trophy, MapPin, CreditCard, Banknote, QrCode, ChevronRight, AlertTriangle, Loader2, Search as SearchIcon, User, Home, Briefcase, Bookmark } from 'lucide-react';
import { CartItem, LoyaltyConfig, LoyaltyReward, LoyaltyCustomer, RestaurantSettings, DeliveryKmZone, DeliveryOrderMode, DeliveryPaymentMethod, SavedAddress } from '../../types';
import { lookupCep as fetchCep } from '../../lib/cep';
import { supabase } from '../../lib/supabase';

export interface DeliveryInfo {
  mode: DeliveryOrderMode;
  name: string;
  whatsapp: string;
  cep: string;
  street: string;
  number: string;
  bairro: string;
  complement: string;
  reference: string;
  lat: number | null;
  lng: number | null;
  distanceKm: number | null;
  fee: number;
  estimatedMinutes: number | null;
  paymentMethod: DeliveryPaymentMethod;
  changeFor: string;
}

interface Props {
  items: CartItem[];
  serviceMode: 'table' | 'counter';
  tableNumber: string;
  restaurantId: string | null;
  settings: RestaurantSettings | null;
  loyaltyConfig: LoyaltyConfig | null;
  loyaltyCustomer: LoyaltyCustomer | null;
  selectedReward: LoyaltyReward | null;
  loyaltyPhone: string;
  discount: number;
  deliveryInfo: DeliveryInfo;
  forceDelivery?: boolean;
  onDeliveryChange: (info: DeliveryInfo) => void;
  onClose: () => void;
  onUpdateQty: (cartId: string, delta: number) => void;
  onRemove: (cartId: string) => void;
  onOpenLoyalty: () => void;
  onClearLoyalty: () => void;
  onCheckout: (cashbackUsed: number) => void;
  placing: boolean;
  checkoutError?: string;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function zoneForDistance(zones: DeliveryKmZone[], km: number): DeliveryKmZone | null {
  return zones.find(z => km >= z.from && km <= z.to) ?? null;
}

const inputCls = 'w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-amber-400 transition-colors placeholder:text-gray-400';

export default function CartDrawer({
  items, serviceMode, tableNumber, restaurantId, settings,
  loyaltyConfig, loyaltyCustomer, selectedReward, loyaltyPhone, discount,
  deliveryInfo, onDeliveryChange, forceDelivery = false,
  onClose, onUpdateQty, onRemove, onOpenLoyalty, onClearLoyalty, onCheckout,
  placing, checkoutError = '',
}: Props) {
  const deliveryEnabled = (settings?.delivery_enabled ?? false) || forceDelivery;
  const canToggleMode = deliveryEnabled && !forceDelivery;
  const kmZones: DeliveryKmZone[] = settings?.delivery_km_zones ?? [];
  const maxRadius = settings?.delivery_max_radius_km ?? 10;
  const originLat = settings?.delivery_origin_lat ?? null;
  const originLng = settings?.delivery_origin_lng ?? null;

  const [cepLoading, setCepLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [outOfRange, setOutOfRange] = useState(false);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerFound, setCustomerFound] = useState(false);
  const [useCashback, setUseCashback] = useState(false);
  const [cashbackApplied, setCashbackApplied] = useState(0);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [showAddrPicker, setShowAddrPicker] = useState(false);

  const fetchSavedAddresses = useCallback(async (phone: string) => {
    if (!restaurantId || phone.length < 10) { setSavedAddresses([]); return; }
    const { data } = await supabase
      .from('delivery_customer_addresses')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('phone', phone)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true });
    setSavedAddresses((data ?? []) as SavedAddress[]);
  }, [restaurantId]);

  useEffect(() => {
    if (deliveryInfo.mode === 'delivery' && deliveryInfo.whatsapp.length >= 10) {
      fetchSavedAddresses(deliveryInfo.whatsapp);
    } else {
      setSavedAddresses([]);
    }
  }, [deliveryInfo.whatsapp, deliveryInfo.mode, fetchSavedAddresses]);

  function selectSavedAddress(addr: SavedAddress) {
    update({
      cep: addr.cep ?? deliveryInfo.cep,
      street: addr.street ?? deliveryInfo.street,
      number: addr.number ?? deliveryInfo.number,
      bairro: addr.bairro ?? deliveryInfo.bairro,
      complement: addr.complement ?? deliveryInfo.complement,
      reference: addr.reference ?? deliveryInfo.reference,
      lat: addr.lat ?? deliveryInfo.lat,
      lng: addr.lng ?? deliveryInfo.lng,
    });
    setShowAddrPicker(false);
    setTimeout(() => geocodeAndCalcDistance(), 100);
  }

  const subtotal = items.reduce((s, i) => s + i.itemTotal * i.quantity, 0);
  const deliveryFee = deliveryInfo.mode === 'delivery' ? deliveryInfo.fee : 0;
  const cashbackBalance = loyaltyConfig?.tipo_promocao === 'cashback' ? Number(loyaltyCustomer?.saldo_cashback ?? 0) : 0;
  const effectiveCashbackDiscount = useCashback ? Math.min(cashbackBalance, subtotal) : 0;
  const totalDiscount = discount + effectiveCashbackDiscount;
  const total = Math.max(0, subtotal - totalDiscount + deliveryFee);

  const loyaltyActive = loyaltyConfig !== null;
  const loyaltyLinked = loyaltyPhone.length > 0;
  const pointsToEarn = loyaltyConfig?.tipo_promocao === 'pontos_por_real'
    ? Math.floor(total * Number(loyaltyConfig.valor_conversao)) : 0;
  const cashbackToEarn = loyaltyConfig?.tipo_promocao === 'cashback'
    ? total * Number(loyaltyConfig.valor_conversao) / 100 : 0;

  function update(patch: Partial<DeliveryInfo>) {
    onDeliveryChange({ ...deliveryInfo, ...patch });
  }

  async function lookupCep(cep: string) {
    const digits = cep.replace(/\D/g, '');
    if (digits.length !== 8) return;
    setCepLoading(true);
    try {
      const result = await fetchCep(digits);
      if (result) {
        update({ street: result.street, bairro: result.bairro });
      }
    } catch { /* ignore */ } finally {
      setCepLoading(false);
    }
  }

  async function lookupCustomer() {
    if (!restaurantId || deliveryInfo.whatsapp.length < 10) return;
    setCustomerLoading(true);
    setCustomerFound(false);
    try {
      const { data: profile } = await supabase
        .from('delivery_customer_profiles')
        .select('name, cep, street, number, bairro, complement, reference, lat, lng')
        .eq('restaurant_id', restaurantId)
        .eq('phone', deliveryInfo.whatsapp)
        .maybeSingle();

      if (profile) {
        update({
          name: profile.name ?? deliveryInfo.name,
          cep: profile.cep ?? deliveryInfo.cep,
          street: profile.street ?? deliveryInfo.street,
          number: profile.number ?? deliveryInfo.number,
          bairro: profile.bairro ?? deliveryInfo.bairro,
          complement: profile.complement ?? deliveryInfo.complement,
          reference: profile.reference ?? deliveryInfo.reference,
          lat: profile.lat ?? deliveryInfo.lat,
          lng: profile.lng ?? deliveryInfo.lng,
        });
        setCustomerFound(true);
        return;
      }

      const { data: recentOrder } = await supabase
        .from('orders')
        .select('delivery_name, delivery_cep, delivery_street, delivery_number, delivery_bairro, delivery_complement, delivery_reference')
        .eq('restaurant_id', restaurantId)
        .eq('delivery_mode', 'delivery')
        .eq('delivery_whatsapp', deliveryInfo.whatsapp)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recentOrder) {
        update({
          name: recentOrder.delivery_name ?? deliveryInfo.name,
          cep: recentOrder.delivery_cep ?? deliveryInfo.cep,
          street: recentOrder.delivery_street ?? deliveryInfo.street,
          number: recentOrder.delivery_number ?? deliveryInfo.number,
          bairro: recentOrder.delivery_bairro ?? deliveryInfo.bairro,
          complement: recentOrder.delivery_complement ?? deliveryInfo.complement,
          reference: recentOrder.delivery_reference ?? deliveryInfo.reference,
        });
        setCustomerFound(true);
      }
    } catch { /* ignore */ } finally { setCustomerLoading(false); }
  }

  async function geocodeAndCalcDistance() {
    if (!deliveryInfo.street || !deliveryInfo.number || !deliveryInfo.bairro) return;
    if (originLat === null || originLng === null) return;
    setGeocoding(true);
    setOutOfRange(false);
    try {
      const query = encodeURIComponent(`${deliveryInfo.street} ${deliveryInfo.number}, ${deliveryInfo.bairro}, ${deliveryInfo.cep}, Brasil`);
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`, {
        headers: { 'Accept-Language': 'pt-BR' },
      });
      const data = await res.json();
      if (data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        const km = haversineKm(originLat, originLng, lat, lng);
        const zone = zoneForDistance(kmZones, km);
        if (km > maxRadius) {
          setOutOfRange(true);
          update({ lat, lng, distanceKm: km, fee: 0, estimatedMinutes: null });
        } else {
          update({
            lat, lng, distanceKm: km,
            fee: zone?.rate ?? 0,
            estimatedMinutes: zone?.minutes ?? null,
          });
        }
      }
    } catch { /* ignore */ } finally {
      setGeocoding(false);
    }
  }

  // Re-geocode when address fields change (debounced via blur)
  function handleAddressBlur() {
    if (deliveryInfo.mode === 'delivery') geocodeAndCalcDistance();
  }

  const deliveryFormValid = deliveryInfo.mode !== 'delivery' || (
    deliveryInfo.name.trim().length > 0 &&
    deliveryInfo.whatsapp.trim().length >= 10 &&
    deliveryInfo.street.trim().length > 0 &&
    deliveryInfo.number.trim().length > 0 &&
    deliveryInfo.bairro.trim().length > 0 &&
    !outOfRange &&
    (deliveryInfo.paymentMethod !== 'cash_delivery' || (deliveryInfo.changeFor.trim().length > 0))
  );

  const canCheckout = items.length > 0 && deliveryFormValid && !placing;

  const paymentOptions: { value: DeliveryPaymentMethod; label: string; icon: React.ReactNode }[] = [
    { value: 'card_delivery', label: 'Cartão na Entrega', icon: <CreditCard className="w-4 h-4" /> },
    { value: 'pix_delivery', label: 'Pix na Entrega', icon: <QrCode className="w-4 h-4" /> },
    { value: 'cash_delivery', label: 'Dinheiro', icon: <Banknote className="w-4 h-4" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl max-h-[95vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Seu Pedido</h2>
            {deliveryEnabled ? (
              <p className="text-xs text-gray-400 mt-0.5">
                {deliveryInfo.mode === 'delivery' ? '🛵 Delivery' : '🏠 Retirada no local'}
              </p>
            ) : (
              <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                {serviceMode === 'table' ? <Truck className="w-3 h-3" /> : <ShoppingBag className="w-3 h-3" />}
                Mesa {tableNumber} · {serviceMode === 'table' ? 'Entrega na mesa' : 'Retirada no balcão'}
              </p>
            )}
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-3 space-y-4">

          {/* Delivery/Pickup mode selector */}
          {canToggleMode && (
            <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-2xl">
              <button
                onClick={() => { update({ mode: 'pickup' }); setOutOfRange(false); }}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all ${
                  deliveryInfo.mode === 'pickup'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <ShoppingBag className="w-4 h-4" /> Retirada
              </button>
              <button
                onClick={() => update({ mode: 'delivery' })}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all ${
                  deliveryInfo.mode === 'delivery'
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Truck className="w-4 h-4" /> Delivery
              </button>
            </div>
          )}

          {/* Delivery address form */}
          {deliveryEnabled && deliveryInfo.mode === 'delivery' && (
            <div className="space-y-3 bg-amber-50 border border-amber-100 rounded-2xl p-4">
              <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" /> Endereço de Entrega
              </p>

              {/* Saved addresses picker */}
              {savedAddresses.length > 0 && (
                <div className="space-y-2">
                  {!showAddrPicker ? (
                    <button
                      onClick={() => setShowAddrPicker(true)}
                      className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white border border-amber-200 hover:border-amber-300 transition-colors text-left"
                    >
                      <Bookmark className="w-4 h-4 text-amber-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-amber-800">Endereços salvos ({savedAddresses.length})</p>
                        <p className="text-xs text-gray-400 truncate">{savedAddresses[0].nickname}: {savedAddresses[0].street}, {savedAddresses[0].number}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                    </button>
                  ) : (
                    <div className="space-y-2">
                      {savedAddresses.map(addr => (
                        <button
                          key={addr.id}
                          onClick={() => selectSavedAddress(addr)}
                          className="w-full flex items-center gap-3 px-3 py-3 rounded-xl bg-white border border-amber-200 hover:border-amber-400 hover:bg-amber-50/50 transition-all text-left"
                        >
                          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                            {addr.nickname.toLowerCase().includes('trabalho') || addr.nickname.toLowerCase().includes('work')
                              ? <Briefcase className="w-4 h-4 text-amber-600" />
                              : <Home className="w-4 h-4 text-amber-600" />
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold text-gray-900">{addr.nickname}</p>
                              {addr.is_default && <span className="text-[10px] bg-amber-500/20 text-amber-600 px-1.5 py-0.5 rounded-full font-semibold">Padrão</span>}
                            </div>
                            <p className="text-xs text-gray-500 truncate mt-0.5">{addr.street}, {addr.number}{addr.complement ? ` - ${addr.complement}` : ''}</p>
                            <p className="text-xs text-gray-400 truncate">{addr.bairro}</p>
                          </div>
                        </button>
                      ))}
                      <button
                        onClick={() => setShowAddrPicker(false)}
                        className="w-full text-xs text-gray-400 hover:text-gray-600 py-1.5 transition-colors"
                      >
                        Digitar endereço manualmente
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <input
                    className={inputCls}
                    placeholder="Seu nome completo *"
                    value={deliveryInfo.name}
                    onChange={e => update({ name: e.target.value })}
                  />
                </div>
                <div className="col-span-2 flex gap-2">
                  <input
                    className={`${inputCls} flex-1`}
                    placeholder="WhatsApp (com DDD) *"
                    type="tel"
                    value={deliveryInfo.whatsapp}
                    onChange={e => update({ whatsapp: e.target.value })}
                  />
                  <button type="button" onClick={lookupCustomer}
                    className="w-11 h-11 shrink-0 rounded-xl bg-amber-500 hover:bg-amber-400 flex items-center justify-center transition-colors"
                    title="Buscar cliente">
                    {customerLoading ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <SearchIcon className="w-4 h-4 text-white" />}
                  </button>
                </div>
                {customerFound && (
                  <p className="col-span-2 text-xs text-green-600 flex items-center gap-1 -mt-1">
                    <User className="w-3 h-3" /> Cliente encontrado — dados preenchidos automaticamente
                  </p>
                )}
                <div className="relative">
                  <input
                    className={inputCls}
                    placeholder="CEP *"
                    value={deliveryInfo.cep}
                    onChange={e => {
                      const v = e.target.value.replace(/\D/g, '').slice(0, 8);
                      update({ cep: v });
                      if (v.length === 8) lookupCep(v);
                    }}
                  />
                  {cepLoading && <Loader2 className="absolute right-3 top-3 w-4 h-4 text-amber-500 animate-spin" />}
                </div>
                <input
                  className={inputCls}
                  placeholder="Número *"
                  value={deliveryInfo.number}
                  onChange={e => update({ number: e.target.value })}
                  onBlur={handleAddressBlur}
                />
                <div className="col-span-2">
                  <input
                    className={inputCls}
                    placeholder="Rua / Logradouro *"
                    value={deliveryInfo.street}
                    onChange={e => update({ street: e.target.value })}
                    onBlur={handleAddressBlur}
                  />
                </div>
                <div className="col-span-2">
                  <input
                    className={inputCls}
                    placeholder="Bairro *"
                    value={deliveryInfo.bairro}
                    onChange={e => update({ bairro: e.target.value })}
                    onBlur={handleAddressBlur}
                  />
                </div>
                <div className="col-span-2">
                  <input
                    className={inputCls}
                    placeholder="Complemento (opcional)"
                    value={deliveryInfo.complement}
                    onChange={e => update({ complement: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <input
                    className={inputCls}
                    placeholder="Ponto de referência (opcional)"
                    value={deliveryInfo.reference}
                    onChange={e => update({ reference: e.target.value })}
                  />
                </div>
              </div>

              {/* Distance + fee feedback */}
              {geocoding && (
                <div className="flex items-center gap-2 text-xs text-amber-600">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Calculando distância...
                </div>
              )}
              {outOfRange && !geocoding && (
                <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  Endereço fora da nossa área de entrega. Máximo {maxRadius} km.
                </div>
              )}
              {!outOfRange && deliveryInfo.distanceKm !== null && !geocoding && (
                <div className="flex items-center justify-between text-xs bg-white border border-amber-200 rounded-xl px-3 py-2.5">
                  <span className="text-gray-600 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-amber-500" />
                    {deliveryInfo.distanceKm.toFixed(1)} km de distância
                  </span>
                  <span className="font-semibold text-amber-700">
                    Taxa: R$ {deliveryInfo.fee.toFixed(2).replace('.', ',')}
                    {deliveryInfo.estimatedMinutes ? ` · ~${deliveryInfo.estimatedMinutes} min` : ''}
                  </span>
                </div>
              )}

              {/* Payment method */}
              <div className="space-y-2 pt-1">
                <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">Pagamento na Entrega</p>
                <div className="space-y-1.5">
                  {paymentOptions.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => update({ paymentMethod: opt.value })}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                        deliveryInfo.paymentMethod === opt.value
                          ? 'border-amber-400 bg-amber-50 text-amber-800'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <span className={deliveryInfo.paymentMethod === opt.value ? 'text-amber-500' : 'text-gray-400'}>
                        {opt.icon}
                      </span>
                      {opt.label}
                      {deliveryInfo.paymentMethod === opt.value && <Check className="w-4 h-4 text-amber-500 ml-auto" />}
                    </button>
                  ))}
                </div>
                {deliveryInfo.paymentMethod === 'cash_delivery' && (
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">R$</span>
                    <input
                      className={`${inputCls} pl-9`}
                      type="number"
                      min={0}
                      step={0.01}
                      placeholder="Troco para quanto? *"
                      value={deliveryInfo.changeFor}
                      onChange={e => update({ changeFor: e.target.value })}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Cart items */}
          {items.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Seu carrinho está vazio.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map(item => (
                <div key={item.cartId} className="flex gap-3">
                  {item.product.image_url && (
                    <img src={item.product.image_url} alt={item.product.name} className="w-16 h-16 rounded-xl object-cover shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-900 leading-tight">{item.product.name}</p>
                      <button onClick={() => onRemove(item.cartId)} className="text-gray-300 hover:text-red-400 transition-colors shrink-0 p-0.5">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {item.meioAMeioSelection ? (
                      <>
                        {item.meioAMeioSelection.half1 && (
                          <div className="text-xs text-gray-400 mt-0.5">
                            <p>1ª metade: {item.meioAMeioSelection.half1.productName}</p>
                            {item.meioAMeioSelection.half1.extras?.filter(e => e.qty > 0).map(ex => (
                              <p key={ex.name} className="pl-2">+{ex.qty}× {ex.name}</p>
                            ))}
                          </div>
                        )}
                        {item.meioAMeioSelection.half2 && (
                          <div className="text-xs text-gray-400 mt-0.5">
                            <p>2ª metade: {item.meioAMeioSelection.half2.productName}</p>
                            {item.meioAMeioSelection.half2.extras?.filter(e => e.qty > 0).map(ex => (
                              <p key={ex.name} className="pl-2">+{ex.qty}× {ex.name}</p>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        {item.comboSelections.map(cs => {
                          const chosen = cs.items.filter(i => i.qty > 0);
                          if (!chosen.length) return null;
                          return (
                            <div key={cs.groupId} className="text-xs text-gray-400 mt-0.5">
                              <p>{cs.groupName}: {chosen.map(i => i.name).join(', ')}</p>
                              {chosen.map(i => (i.extras ?? []).filter(e => e.qty > 0).map(ex => (
                                <p key={ex.id} className="pl-2">+{ex.qty}× {ex.name}</p>
                              )))}
                            </div>
                          );
                        })}
                        {item.extraSelections.filter(e => e.qty > 0).map(ex => (
                          <p key={ex.extraId} className="text-xs text-gray-400 mt-0.5">+{ex.qty}× {ex.name}</p>
                        ))}
                      </>
                    )}
                    {item.observations && (
                      <p className="text-xs text-gray-500 italic mt-1">Obs: {item.observations}</p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2">
                        <button onClick={() => onUpdateQty(item.cartId, -1)} className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:border-amber-400 hover:text-amber-600 transition-colors">
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-sm font-bold text-gray-900 w-4 text-center">{item.quantity}</span>
                        <button onClick={() => onUpdateQty(item.cartId, 1)} className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:border-amber-400 hover:text-amber-600 transition-colors">
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <p className="text-sm font-bold text-amber-600">R$ {(item.itemTotal * item.quantity).toFixed(2).replace('.', ',')}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Loyalty CTA / status */}
          {items.length > 0 && loyaltyActive && (
            <div className="mt-2">
              {!loyaltyLinked ? (
                <button
                  onClick={onOpenLoyalty}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 hover:border-amber-300 transition-all"
                >
                  <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                    <Trophy className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-semibold text-amber-800">Gula Fidelidade</p>
                    <p className="text-xs text-amber-600 truncate">
                      {loyaltyConfig.tipo_promocao === 'pontos_por_real'
                        ? `Ganhe ${Math.floor(subtotal * Number(loyaltyConfig.valor_conversao))} pontos neste pedido`
                        : `Ganhe R$ ${(subtotal * Number(loyaltyConfig.valor_conversao) / 100).toFixed(2)} de cashback`}
                    </p>
                  </div>
                  <Star className="w-4 h-4 text-amber-400 shrink-0" />
                </button>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-500" />
                      <div>
                        <p className="text-sm font-semibold text-amber-800">{loyaltyCustomer?.nome || loyaltyPhone}</p>
                        {loyaltyCustomer?.nome && <p className="text-xs text-amber-600">{loyaltyPhone}</p>}
                      </div>
                    </div>
                    <button onClick={onClearLoyalty} className="text-xs text-amber-500 hover:text-amber-700 underline">Alterar</button>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {loyaltyConfig.tipo_promocao === 'pontos_por_real' && loyaltyCustomer && (
                      <div className="flex items-center gap-1 text-xs bg-amber-100 rounded-lg px-2.5 py-1.5">
                        <Coins className="w-3 h-3 text-amber-500" />
                        <span className="font-bold text-amber-700">{loyaltyCustomer.saldo_pontos}</span>
                        <span className="text-amber-600">pts</span>
                      </div>
                    )}
                    {loyaltyConfig.tipo_promocao === 'cashback' && loyaltyCustomer && (
                      <>
                        <div className="flex items-center gap-1 text-xs bg-green-100 rounded-lg px-2.5 py-1.5">
                          <Percent className="w-3 h-3 text-green-500" />
                          <span className="font-bold text-green-700">R$ {Number(loyaltyCustomer.saldo_cashback).toFixed(2)}</span>
                        </div>
                        {Number(loyaltyCustomer.saldo_cashback) > 0 && (
                          <button onClick={() => setUseCashback(prev => !prev)}
                            className={`flex items-center gap-1.5 text-xs rounded-lg px-2.5 py-1.5 border transition-all ${
                              useCashback ? 'bg-green-500 text-white border-green-500' : 'bg-white text-green-700 border-green-200 hover:border-green-300'
                            }`}>
                            <Percent className="w-3 h-3" />
                            {useCashback ? `Usar R$ ${Math.min(cashbackBalance, subtotal).toFixed(2)}` : `Usar cashback`}
                          </button>
                        )}
                      </>
                    )}
                    <div className="flex items-center gap-1 text-xs bg-white border border-amber-200 rounded-lg px-2.5 py-1.5">
                      {loyaltyConfig.tipo_promocao === 'pontos_por_real'
                        ? <><Coins className="w-3 h-3 text-amber-500" /><span className="text-amber-700">+{pointsToEarn} pts neste pedido</span></>
                        : <><Percent className="w-3 h-3 text-green-500" /><span className="text-green-700">+R$ {cashbackToEarn.toFixed(2)} cashback</span></>}
                    </div>
                  </div>
                  {selectedReward && discount > 0 && (
                    <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                      <span className="text-xs font-medium text-green-700 flex items-center gap-1.5">
                        <Gift className="w-3.5 h-3.5" /> {selectedReward.nome_recompensa}
                      </span>
                      <span className="text-xs font-bold text-green-700">-R$ {discount.toFixed(2)}</span>
                    </div>
                  )}
                  <button onClick={onOpenLoyalty} className="text-xs text-amber-600 hover:text-amber-800 underline">
                    {selectedReward ? 'Alterar recompensa' : 'Ver recompensas disponíveis'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="shrink-0 px-5 py-4 border-t border-gray-100 bg-white space-y-3">
            {(discount > 0 || effectiveCashbackDiscount > 0) && (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="text-gray-500">R$ {subtotal.toFixed(2).replace('.', ',')}</span>
                </div>
                {discount > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-green-600 flex items-center gap-1"><Gift className="w-3.5 h-3.5" /> Desconto recompensa</span>
                    <span className="text-green-600 font-semibold">-R$ {discount.toFixed(2).replace('.', ',')}</span>
                  </div>
                )}
                {effectiveCashbackDiscount > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-green-600 flex items-center gap-1"><Percent className="w-3.5 h-3.5" /> Cashback usado</span>
                    <span className="text-green-600 font-semibold">-R$ {effectiveCashbackDiscount.toFixed(2).replace('.', ',')}</span>
                  </div>
                )}
              </>
            )}
            {deliveryInfo.mode === 'delivery' && deliveryFee > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 flex items-center gap-1"><Truck className="w-3.5 h-3.5" /> Taxa de entrega</span>
                <span className="text-gray-700 font-semibold">R$ {deliveryFee.toFixed(2).replace('.', ',')}</span>
              </div>
            )}
            {deliveryInfo.mode === 'delivery' && deliveryInfo.estimatedMinutes && (
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>Tempo estimado</span>
                <span>~{deliveryInfo.estimatedMinutes} min</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-gray-600 text-sm">Total do pedido</span>
              <span className="text-xl font-bold text-gray-900">R$ {total.toFixed(2).replace('.', ',')}</span>
            </div>
            <button
              disabled={!canCheckout}
              onClick={() => onCheckout(effectiveCashbackDiscount)}
              className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl transition-colors text-base"
            >
              {placing ? 'Enviando pedido...' : 'Finalizar Pedido'}
            </button>
            {checkoutError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-center">{checkoutError}</p>
            )}
            <p className="text-[11px] text-gray-400 text-center">
              {deliveryInfo.mode === 'delivery'
                ? 'Seu pedido será entregue no endereço informado.'
                : serviceMode === 'table'
                  ? 'O garçom virá até sua mesa para o pagamento.'
                  : 'Dirija-se ao caixa para efetuar o pagamento.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
