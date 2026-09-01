import { useState, useEffect, useRef } from 'react';
import {
  X, Search, ShoppingCart, Plus, Minus, Trash2, ChevronDown,
  Hash, Check, AlertCircle, ClipboardCheck, UtensilsCrossed,
  Truck, MapPin, Phone, CreditCard, Banknote, QrCode, User, Loader2,
  ArrowRight, Search as SearchIcon,
} from 'lucide-react';
import { supabase, sortProductComboGroups } from '../../lib/supabase';
import { useTenant } from '../../lib/tenant-context';
import { lookupCep as fetchCep } from '../../lib/cep';
import {
  Product, Category, CartItem, CartComboSelection, CartExtraSelection, RestaurantSettings,
  DeliveryPaymentMethod,
} from '../../types';
import ProductDrawer from '../customer/ProductDrawer';

const inputCls = 'w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500 transition-colors';

interface Props {
  onClose: () => void;
  onOrderPlaced: () => void;
}

// ─── Product card ─────────────────────────────────────────────────────────────

function ProductCard({ product, onClick }: { product: Product; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex gap-3 bg-slate-800/70 rounded-xl p-3 border border-slate-700/50 hover:border-amber-500/50 hover:bg-slate-800 transition-all text-left active:scale-[0.98]"
    >
      {product.image_url && (
        <img src={product.image_url} alt={product.name} className="w-16 h-16 object-cover rounded-lg shrink-0" />
      )}
      <div className="flex-1 min-w-0 py-0.5">
        <p className="font-semibold text-white text-sm leading-tight">{product.name}</p>
        {product.description && (
          <p className="text-slate-400 text-xs mt-1 line-clamp-2">{product.description}</p>
        )}
        <div className="flex items-center justify-between mt-2">
          <p className="text-amber-400 font-bold text-sm">R$ {product.price.toFixed(2).replace('.', ',')}</p>
          {product.is_combo && (
            <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-medium">COMBO</span>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Cart panel (counter mode) ────────────────────────────────────────────────

interface CartPanelProps {
  items: CartItem[];
  tableNumber: string;
  serviceMode: 'table' | 'counter';
  placing: boolean;
  orderMode: 'counter' | 'delivery';
  deliveryFee: number;
  onUpdateQty: (cartId: string, delta: number) => void;
  onRemove: (cartId: string) => void;
  onCheckout: () => void;
}

function CartPanel({ items, tableNumber, serviceMode, placing, orderMode, deliveryFee, onUpdateQty, onRemove, onCheckout }: CartPanelProps) {
  const subtotal = items.reduce((s, i) => s + i.itemTotal * i.quantity, 0);
  const total = subtotal + deliveryFee;

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-800">
      <div className="px-5 py-4 border-b border-slate-800 shrink-0">
        <h3 className="font-bold text-white flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-amber-400" />
          Carrinho
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          {orderMode === 'delivery' ? 'Delivery' : serviceMode === 'table' ? `Mesa ${tableNumber}` : 'Balcão'} · {items.length} {items.length === 1 ? 'item' : 'itens'}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {items.length === 0 ? (
          <div className="py-16 text-center">
            <ShoppingCart className="w-10 h-10 mx-auto text-slate-700 mb-3" />
            <p className="text-slate-500 text-sm">Carrinho vazio</p>
            <p className="text-slate-600 text-xs mt-1">Selecione produtos ao lado.</p>
          </div>
        ) : items.map(item => (
          <div key={item.cartId} className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-white leading-tight">{item.product.name}</p>
              <button onClick={() => onRemove(item.cartId)} className="text-slate-600 hover:text-red-400 transition-colors shrink-0 p-0.5">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            {item.comboSelections.map(cs => {
              const chosen = cs.items.filter(i => i.qty > 0);
              if (!chosen.length) return null;
              const gn = (cs.groupName ?? '').trim();
              return (
                <div key={cs.groupId} className="mt-0.5">
                  {gn && <p className="text-xs text-slate-500">{gn}</p>}
                  {chosen.map(i => (
                    <div key={i.id}>
                      <p className="text-xs text-slate-300 font-medium ml-2">{i.qty > 1 ? `${i.qty}x ` : ''}{i.name}</p>
                      {(i.extras ?? []).filter(e => e.qty > 0).map(ex => (
                        <p key={ex.id} className="text-xs text-slate-500 ml-4">+{ex.qty}× {ex.name}</p>
                      ))}
                    </div>
                  ))}
                </div>
              );
            })}
            {item.extraSelections.filter(e => e.qty > 0).map(ex => (
              <p key={ex.extraId} className="text-xs text-slate-500 mt-0.5">+{ex.qty}× {ex.name}</p>
            ))}
            <div className="flex items-center justify-between mt-2.5">
              <div className="flex items-center gap-2">
                <button onClick={() => onUpdateQty(item.cartId, -1)} className="w-6 h-6 rounded-full border border-slate-600 flex items-center justify-center text-slate-400 hover:border-amber-500 hover:text-amber-400 transition-colors">
                  <Minus className="w-2.5 h-2.5" />
                </button>
                <span className="text-sm font-bold text-white w-4 text-center">{item.quantity}</span>
                <button onClick={() => onUpdateQty(item.cartId, 1)} className="w-6 h-6 rounded-full border border-slate-600 flex items-center justify-center text-slate-400 hover:border-amber-500 hover:text-amber-400 transition-colors">
                  <Plus className="w-2.5 h-2.5" />
                </button>
              </div>
              <p className="text-sm font-bold text-amber-400">R$ {(item.itemTotal * item.quantity).toFixed(2).replace('.', ',')}</p>
            </div>
          </div>
        ))}
      </div>

      {items.length > 0 && (
        <div className="shrink-0 px-4 py-4 border-t border-slate-800 space-y-3">
          {orderMode === 'delivery' && deliveryFee > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400 flex items-center gap-1"><Truck className="w-3.5 h-3.5" /> Taxa de entrega</span>
              <span className="text-slate-300 font-semibold">R$ {deliveryFee.toFixed(2).replace('.', ',')}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-sm">Total</span>
            <span className="text-xl font-black text-white">R$ {total.toFixed(2).replace('.', ',')}</span>
          </div>
          <button disabled={placing} onClick={onCheckout}
            className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 disabled:cursor-not-allowed text-black font-bold py-3.5 rounded-xl transition-colors text-sm">
            {placing ? <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
            {placing ? 'Enviando...' : 'Confirmar Pedido'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Delivery form ────────────────────────────────────────────────────────────

interface DeliveryFormProps {
  delName: string; setDelName: (v: string) => void;
  delWhatsapp: string; setDelWhatsapp: (v: string) => void;
  delCep: string; setDelCep: (v: string) => void;
  delStreet: string; setDelStreet: (v: string) => void;
  delNumber: string; setDelNumber: (v: string) => void;
  delBairro: string; setDelBairro: (v: string) => void;
  delComplement: string; setDelComplement: (v: string) => void;
  delReference: string; setDelReference: (v: string) => void;
  delPayment: DeliveryPaymentMethod; setDelPayment: (v: DeliveryPaymentMethod) => void;
  delChangeFor: string; setDelChangeFor: (v: string) => void;
  delDistance: number | null;
  delFee: number;
  delEstMin: number | null;
  cepLoading: boolean;
  geoLoading: boolean;
  outOfRange: boolean;
  customerLoading: boolean;
  customerFound: boolean;
  onSearchCustomer: () => void;
  onLookupCep: (cep: string) => void;
  onGeocode: () => void;
  onSubmit: () => void;
  showSubmitButton: boolean;
}

function DeliveryFormSection(props: DeliveryFormProps) {
  const {
    delName, setDelName, delWhatsapp, setDelWhatsapp,
    delCep, setDelCep, delStreet, setDelStreet, delNumber, setDelNumber,
    delBairro, setDelBairro, delComplement, setDelComplement,
    delReference, setDelReference, delPayment, setDelPayment,
    delChangeFor, setDelChangeFor,
    delDistance, delFee, delEstMin,
    cepLoading, geoLoading, outOfRange, customerLoading, customerFound,
    onSearchCustomer, onLookupCep, onGeocode, onSubmit, showSubmitButton,
  } = props;

  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="px-5 py-4 border-b border-slate-800 bg-slate-900/50">
      <form ref={formRef} onSubmit={e => { e.preventDefault(); onSubmit(); }}
        className="space-y-3">

        {/* Phone + search button */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              value={delWhatsapp}
              onChange={e => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 11);
                setDelWhatsapp(v);
              }}
              className={`${inputCls} pl-9 ${customerFound ? 'border-green-500/50' : ''}`}
              placeholder="WhatsApp / Telefone do cliente *"
              type="tel"
            />
            {customerLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500 animate-spin" />}
            {customerFound && !customerLoading && <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />}
          </div>
          <button type="button" onClick={onSearchCustomer}
            className="w-11 h-11 shrink-0 rounded-xl bg-amber-500 hover:bg-amber-400 flex items-center justify-center transition-colors"
            title="Buscar cliente">
            <SearchIcon className="w-4 h-4 text-black" />
          </button>
        </div>
        {customerFound && (
          <p className="text-xs text-green-400 -mt-1.5 ml-1 flex items-center gap-1">
            <User className="w-3 h-3" /> Cliente cadastrado — dados preenchidos automaticamente
          </p>
        )}

        {/* Name */}
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={delName} onChange={e => setDelName(e.target.value)}
            className={`${inputCls} pl-9`} placeholder="Nome do cliente *" />
        </div>

        {/* CEP */}
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={delCep}
            onChange={e => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 8);
              setDelCep(v);
              if (v.length === 8) onLookupCep(v);
            }}
            className={`${inputCls} pl-9`} placeholder="CEP (auto-completa endereço)" />
          {cepLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500 animate-spin" />}
        </div>

        {/* Street */}
        <input value={delStreet} onChange={e => setDelStreet(e.target.value)} onBlur={onGeocode}
          className={inputCls} placeholder="Rua / Logradouro *" />

        {/* Number + Bairro */}
        <div className="grid grid-cols-2 gap-2">
          <input value={delNumber} onChange={e => setDelNumber(e.target.value)} onBlur={onGeocode}
            className={inputCls} placeholder="Número *" />
          <input value={delBairro} onChange={e => setDelBairro(e.target.value)} onBlur={onGeocode}
            className={inputCls} placeholder="Bairro *" />
        </div>

        {/* Complement + Reference (optional) */}
        <div className="grid grid-cols-2 gap-2">
          <input value={delComplement} onChange={e => setDelComplement(e.target.value)}
            className={inputCls} placeholder="Complemento" />
          <input value={delReference} onChange={e => setDelReference(e.target.value)}
            className={inputCls} placeholder="Ponto de referência" />
        </div>

        {/* Distance / fee / out of range */}
        {geoLoading && (
          <div className="flex items-center gap-2 text-xs text-amber-600">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Calculando distância e taxa de entrega...
          </div>
        )}
        {outOfRange && !geoLoading && (
          <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
            <AlertCircle className="w-3.5 h-3.5" /> Endereço fora da área de entrega.
          </div>
        )}
        {!outOfRange && delDistance !== null && !geoLoading && (
          <div className="flex items-center justify-between text-xs bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5">
            <span className="text-slate-400 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-amber-400" /> {delDistance.toFixed(1)} km do restaurante
            </span>
            <span className="font-semibold text-amber-400">
              Taxa: R$ {delFee.toFixed(2).replace('.', ',')}{delEstMin ? ` · ~${delEstMin} min` : ''}
            </span>
          </div>
        )}

        {/* Payment method */}
        <div className="space-y-1.5 pt-1">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Pagamento na Entrega</p>
          <div className="grid grid-cols-3 gap-2">
            {([
              { v: 'card_delivery' as const, label: 'Cartão', icon: <CreditCard className="w-3.5 h-3.5" /> },
              { v: 'pix_delivery' as const, label: 'Pix', icon: <QrCode className="w-3.5 h-3.5" /> },
              { v: 'cash_delivery' as const, label: 'Dinheiro', icon: <Banknote className="w-3.5 h-3.5" /> },
            ]).map(opt => (
              <button key={opt.v} type="button" onClick={() => setDelPayment(opt.v)}
                className={`flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                  delPayment === opt.v
                    ? 'border-amber-400 bg-amber-500/10 text-amber-300'
                    : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'
                }`}>
                <span className={delPayment === opt.v ? 'text-amber-400' : 'text-slate-500'}>{opt.icon}</span>
                {opt.label}
              </button>
            ))}
          </div>
          {delPayment === 'cash_delivery' && (
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-medium">R$</span>
              <input type="number" min={0} step={0.01} value={delChangeFor}
                onChange={e => setDelChangeFor(e.target.value)}
                className={`${inputCls} pl-9`} placeholder="Troco para quanto? *" />
            </div>
          )}
        </div>

        {showSubmitButton && (
          <button type="submit"
            className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-bold py-3.5 rounded-xl transition-colors text-sm">
            Continuar para o Cardápio <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </form>
    </div>
  );
}

// ─── Main drawer ──────────────────────────────────────────────────────────────

export default function CashierOrderDrawer({ onClose, onOrderPlaced }: Props) {
  const { restaurant } = useTenant();
  const restaurantId = restaurant?.id ?? null;
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  const [tableNumber, setTableNumber] = useState('01');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [placing, setPlacing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [orderMode, setOrderMode] = useState<'counter' | 'delivery'>('counter');
  const [showCartDrawer, setShowCartDrawer] = useState(false);
  const [delFormSubmitted, setDelFormSubmitted] = useState(false);

  // Delivery fields
  const [delName, setDelName] = useState('');
  const [delWhatsapp, setDelWhatsapp] = useState('');
  const [delCep, setDelCep] = useState('');
  const [delStreet, setDelStreet] = useState('');
  const [delNumber, setDelNumber] = useState('');
  const [delBairro, setDelBairro] = useState('');
  const [delComplement, setDelComplement] = useState('');
  const [delReference, setDelReference] = useState('');
  const [delLat, setDelLat] = useState<number | null>(null);
  const [delLng, setDelLng] = useState<number | null>(null);
  const [delDistance, setDelDistance] = useState<number | null>(null);
  const [delFee, setDelFee] = useState(0);
  const [delEstMin, setDelEstMin] = useState<number | null>(null);
  const [delPayment, setDelPayment] = useState<DeliveryPaymentMethod>('card_delivery');
  const [delChangeFor, setDelChangeFor] = useState('');
  const [cepLoading, setCepLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [outOfRange, setOutOfRange] = useState(false);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerFound, setCustomerFound] = useState(false);

  const categoryRefs = useRef<Record<string, HTMLElement | null>>({});
  const geocodeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!restaurantId) return;
    async function load() {
      const [settRes, catRes, prodRes] = await Promise.all([
        supabase.from('restaurant_settings').select('*').eq('restaurant_id', restaurantId).maybeSingle(),
        supabase.from('categories').select('*').eq('restaurant_id', restaurantId).eq('active', true).order('sort_order').order('name'),
        supabase.from('products').select('*, combo_groups(*, combo_group_items(*, combo_item_extras(*))), product_extras(*)').eq('restaurant_id', restaurantId).eq('active', true).order('sort_order').order('name'),
      ]);
      if (settRes.data) setSettings(settRes.data as RestaurantSettings);
      const cats = (catRes.data ?? []) as Category[];
      setCategories(cats);
      setProducts(sortProductComboGroups((prodRes.data ?? []) as Product[]));
      if (cats.length > 0) setExpandedCats(new Set([cats[0].id]));
    }
    load();
  }, [restaurantId]);

  const tableCount = settings?.table_count ?? 10;
  const serviceMode = settings?.service_mode ?? 'table';
  const tables = Array.from({ length: tableCount }, (_, i) => String(i + 1).padStart(2, '0'));

  function addToCart(product: Product, combos: CartComboSelection[], extras: CartExtraSelection[], total: number, quantity: number) {
    setCart(prev => {
      const existing = prev.find(i =>
        i.product.id === product.id &&
        JSON.stringify(i.comboSelections) === JSON.stringify(combos) &&
        JSON.stringify(i.extraSelections) === JSON.stringify(extras)
      );
      if (existing) {
        return prev.map(i => i.cartId === existing.cartId ? { ...i, quantity: i.quantity + quantity } : i);
      }
      return [...prev, { cartId: crypto.randomUUID(), product, quantity, comboSelections: combos, extraSelections: extras, itemTotal: total }];
    });
    setSelectedProduct(null);
  }

  function updateCartQty(cartId: string, delta: number) {
    setCart(prev => prev.map(i => i.cartId === cartId ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i));
  }

  function removeFromCart(cartId: string) {
    setCart(prev => prev.filter(i => i.cartId !== cartId));
  }

  // Customer lookup by phone — searches delivery_customer_profiles, loyalty_customers, and recent orders
  async function lookupCustomer(phone?: string) {
    const queryPhone = phone ?? delWhatsapp;
    if (!restaurantId || queryPhone.length < 10) return;
    setCustomerLoading(true);
    setCustomerFound(false);
    try {
      // 1. Try delivery_customer_profiles (dedicated table)
      const { data: profile } = await supabase
        .from('delivery_customer_profiles')
        .select('name, cep, street, number, bairro, complement, reference, lat, lng')
        .eq('restaurant_id', restaurantId)
        .eq('phone', queryPhone)
        .maybeSingle();

      if (profile) {
        if (profile.name) setDelName(profile.name);
        if (profile.cep) setDelCep(profile.cep);
        if (profile.street) setDelStreet(profile.street);
        if (profile.number) setDelNumber(profile.number);
        if (profile.bairro) setDelBairro(profile.bairro);
        if (profile.complement) setDelComplement(profile.complement);
        if (profile.reference) setDelReference(profile.reference);
        if (profile.lat) setDelLat(profile.lat);
        if (profile.lng) setDelLng(profile.lng);
        setCustomerFound(true);
        // Auto-geocode if we have enough address data
        if (profile.street && profile.number && profile.bairro) {
          setTimeout(() => geocodeAddress(), 300);
        }
        return;
      }

      // 2. Try loyalty_customers for name
      const { data: loyalty } = await supabase
        .from('loyalty_customers')
        .select('nome, phone')
        .eq('restaurant_id', restaurantId)
        .eq('phone', queryPhone)
        .maybeSingle();

      if (loyalty?.nome) {
        setDelName(loyalty.nome);
        setCustomerFound(true);
      }

      // 3. Search recent delivery orders for address data
      const { data: recentOrder } = await supabase
        .from('orders')
        .select('delivery_name, delivery_cep, delivery_street, delivery_number, delivery_bairro, delivery_complement, delivery_reference')
        .eq('restaurant_id', restaurantId)
        .eq('delivery_mode', 'delivery')
        .eq('delivery_whatsapp', queryPhone)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recentOrder) {
        if (recentOrder.delivery_name && !loyalty?.nome) setDelName(recentOrder.delivery_name);
        if (recentOrder.delivery_cep) setDelCep(recentOrder.delivery_cep);
        if (recentOrder.delivery_street) setDelStreet(recentOrder.delivery_street);
        if (recentOrder.delivery_number) setDelNumber(recentOrder.delivery_number);
        if (recentOrder.delivery_bairro) setDelBairro(recentOrder.delivery_bairro);
        if (recentOrder.delivery_complement) setDelComplement(recentOrder.delivery_complement);
        if (recentOrder.delivery_reference) setDelReference(recentOrder.delivery_reference);
        setCustomerFound(true);
        if (recentOrder.delivery_street && recentOrder.delivery_number && recentOrder.delivery_bairro) {
          setTimeout(() => geocodeAddress(), 300);
        }
      }
    } catch { /* ignore */ } finally { setCustomerLoading(false); }
  }

  // Save customer profile for future lookups
  async function saveCustomerProfile() {
    if (!restaurantId || !delWhatsapp || delWhatsapp.length < 10) return;
    try {
      await supabase.from('delivery_customer_profiles').upsert({
        restaurant_id: restaurantId,
        phone: delWhatsapp,
        name: delName || null,
        cep: delCep || null,
        street: delStreet || null,
        number: delNumber || null,
        bairro: delBairro || null,
        complement: delComplement || null,
        reference: delReference || null,
        lat: delLat,
        lng: delLng,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'restaurant_id,phone' });
    } catch { /* ignore */ }
  }

  function handleDelFormSubmit() {
    if (!delName.trim() || !delWhatsapp.trim() || !delStreet.trim() || !delNumber.trim() || !delBairro.trim()) return;
    if (outOfRange) return;
    if (delPayment === 'cash_delivery' && !delChangeFor.trim()) return;
    setDelFormSubmitted(true);
  }

  async function checkout() {
    if (cart.length === 0 || !settings || !restaurantId) return;

    if (orderMode === 'delivery') {
      if (!delName.trim() || !delWhatsapp.trim() || !delStreet.trim() || !delNumber.trim() || !delBairro.trim()) return;
      if (outOfRange) return;
      if (delPayment === 'cash_delivery' && !delChangeFor.trim()) return;
    }

    setPlacing(true);
    const itemTotal = cart.reduce((s, i) => s + i.itemTotal * i.quantity, 0);
    const deliveryFee = orderMode === 'delivery' ? delFee : 0;
    const total = itemTotal + deliveryFee;

    const deliveryFields = orderMode === 'delivery' ? {
      delivery_mode: 'delivery',
      delivery_name: delName,
      delivery_whatsapp: delWhatsapp,
      delivery_cep: delCep,
      delivery_street: delStreet,
      delivery_number: delNumber,
      delivery_bairro: delBairro,
      delivery_complement: delComplement || null,
      delivery_reference: delReference || null,
      delivery_lat: delLat,
      delivery_lng: delLng,
      delivery_distance_km: delDistance,
      delivery_fee: delFee,
      delivery_payment_method: delPayment,
      delivery_change_for: delChangeFor ? parseFloat(delChangeFor) : null,
      delivery_estimated_minutes: delEstMin,
      delivery_status: 'pending',
    } : { delivery_mode: 'pickup' };

    const { data: orderData, error } = await supabase
      .from('orders')
      .insert({
        restaurant_id: restaurantId,
        table_number: orderMode === 'delivery' ? 'Delivery' : tableNumber,
        service_mode: orderMode === 'delivery' ? 'counter' : serviceMode,
        total,
        ...deliveryFields,
      })
      .select()
      .maybeSingle();
    if (error || !orderData) { setPlacing(false); return; }

    const items = cart.map(ci => ({
      order_id: orderData.id,
      product_id: ci.product.id,
      product_name: ci.product.name,
      quantity: ci.quantity,
      unit_price: ci.itemTotal,
      customizations: {
        combos: ci.comboSelections.map(cs => ({
          groupName: cs.groupName,
          items: cs.items.filter(i => i.qty > 0).map(i => ({
            name: i.name,
            qty: i.qty,
            ...(i.extras && i.extras.length > 0 ? { extras: i.extras.filter(e => e.qty > 0).map(e => ({ name: e.name, price: e.price, qty: e.qty })) } : {}),
          })),
        })),
        extras: ci.extraSelections.filter(e => e.qty > 0),
      },
    }));
    await supabase.from('order_items').insert(items);

    // Save customer profile for future lookups
    if (orderMode === 'delivery') await saveCustomerProfile();

    setCart([]);
    setPlacing(false);
    setSuccess(true);
    setShowCartDrawer(false);
    if (orderMode === 'delivery') {
      setDelName(''); setDelWhatsapp(''); setDelCep(''); setDelStreet(''); setDelNumber('');
      setDelBairro(''); setDelComplement(''); setDelReference(''); setDelLat(null); setDelLng(null);
      setDelDistance(null); setDelFee(0); setDelEstMin(null); setDelChangeFor(''); setOutOfRange(false);
      setCustomerFound(false); setDelFormSubmitted(false);
    }
    setTimeout(() => {
      setSuccess(false);
      onOrderPlaced();
      onClose();
    }, 1400);
  }

  // CEP lookup — with fallback API
  async function lookupCep(cep: string) {
    const digits = cep.replace(/\D/g, '');
    if (digits.length !== 8) return;
    setCepLoading(true);
    try {
      const result = await fetchCep(digits);
      if (result) {
        setDelStreet(result.street);
        setDelBairro(result.bairro);
        if (result.street) {
          if (geocodeTimeoutRef.current) clearTimeout(geocodeTimeoutRef.current);
          geocodeTimeoutRef.current = setTimeout(() => geocodeAddress(), 500);
        }
      }
    } catch { /* ignore */ } finally { setCepLoading(false); }
  }

  function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  async function geocodeAddress() {
    if (!delStreet || !delNumber || !delBairro) return;
    const originLat = settings?.delivery_origin_lat;
    const originLng = settings?.delivery_origin_lng;
    if (originLat == null || originLng == null) return;
    setGeoLoading(true);
    setOutOfRange(false);
    try {
      const query = encodeURIComponent(`${delStreet} ${delNumber}, ${delBairro}, ${delCep}, Brasil`);
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`, {
        headers: { 'Accept-Language': 'pt-BR' },
      });
      const data = await res.json();
      if (data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        const km = haversineKm(originLat, originLng, lat, lng);
        const maxR = settings?.delivery_max_radius_km ?? 10;
        const zones = settings?.delivery_km_zones ?? [];
        const zone = zones.find(z => km >= z.from && km <= z.to) ?? null;
        setDelLat(lat); setDelLng(lng); setDelDistance(km);
        if (km > maxR) {
          setOutOfRange(true);
          setDelFee(0); setDelEstMin(null);
        } else {
          setDelFee(zone?.rate ?? 0);
          setDelEstMin(zone?.minutes ?? null);
        }
      }
    } catch { /* ignore */ } finally { setGeoLoading(false); }
  }

  const searchActive = searchQuery.trim().length >= 3;
  const filteredProducts = searchActive
    ? products.filter(p =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description ?? '').toLowerCase().includes(searchQuery.toLowerCase())
    )
    : products;

  const productsByCategory = categories
    .map(cat => ({ category: cat, products: filteredProducts.filter(p => p.category_id === cat.id) }))
    .filter(g => g.products.length > 0);

  const uncategorized = filteredProducts.filter(p => !p.category_id);
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cart.reduce((s, i) => s + i.itemTotal * i.quantity, 0);

  function toggleCat(id: string) {
    setExpandedCats(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const isDelivery = orderMode === 'delivery';
  const showCatalog = !isDelivery || delFormSubmitted;

  const deliveryFormProps: DeliveryFormProps = {
    delName, setDelName, delWhatsapp, setDelWhatsapp,
    delCep, setDelCep, delStreet, setDelStreet, delNumber, setDelNumber,
    delBairro, setDelBairro, delComplement, setDelComplement,
    delReference, setDelReference, delPayment, setDelPayment,
    delChangeFor, setDelChangeFor,
    delDistance, delFee, delEstMin,
    cepLoading, geoLoading, outOfRange, customerLoading, customerFound,
    onSearchCustomer: () => lookupCustomer(),
    onLookupCep: lookupCep, onGeocode: geocodeAddress,
    onSubmit: handleDelFormSubmit,
    showSubmitButton: !delFormSubmitted,
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative ml-auto w-full max-w-5xl h-full bg-slate-950 flex flex-col shadow-2xl animate-[slideInRight_0.25s_ease-out]">

        {/* Top bar */}
        <header className="shrink-0 flex items-center gap-4 px-6 py-4 bg-slate-900 border-b border-slate-800">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-9 h-9 bg-amber-500 rounded-xl flex items-center justify-center shrink-0">
              <UtensilsCrossed className="w-4 h-4 text-black" />
            </div>
            <div>
              <h2 className="text-white font-bold text-base leading-none">Novo Pedido — Caixa</h2>
              <p className="text-slate-500 text-xs mt-0.5">Faça o pedido diretamente pelo painel administrativo.</p>
            </div>
          </div>

          {/* Mode selector */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-800 rounded-xl shrink-0">
            <button onClick={() => { setOrderMode('counter'); setDelFormSubmitted(false); }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                orderMode === 'counter' ? 'bg-amber-500 text-black' : 'text-slate-400 hover:text-white'
              }`}>
              <UtensilsCrossed className="w-3.5 h-3.5" /> Balcão
            </button>
            {(settings?.delivery_enabled ?? false) && (
              <button onClick={() => setOrderMode('delivery')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                  orderMode === 'delivery' ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white'
                }`}>
                <Truck className="w-3.5 h-3.5" /> Delivery
              </button>
            )}
          </div>

          {/* Table selector — only for counter+table mode */}
          {orderMode === 'counter' && serviceMode === 'table' && (
            <div className="flex items-center gap-2 shrink-0">
              <Hash className="w-4 h-4 text-slate-400" />
              <label className="text-xs text-slate-400 hidden sm:inline">Mesa</label>
              <select value={tableNumber} onChange={e => setTableNumber(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-white text-sm font-bold rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500 transition-colors">
                {tables.map(t => <option key={t} value={t}>Mesa {t}</option>)}
              </select>
            </div>
          )}

          {orderMode === 'counter' && serviceMode !== 'table' && (
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl shrink-0">
              <span className="text-sm font-bold text-white">Balcão</span>
            </div>
          )}

          {isDelivery && (
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/30 rounded-xl shrink-0">
              <Truck className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-bold text-blue-300">Delivery</span>
            </div>
          )}

          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors shrink-0">
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">

          {/* ── Left: catalog ────────────────────────────────────────────── */}
          <div className={`flex-1 flex flex-col ${isDelivery && !delFormSubmitted ? 'overflow-y-auto' : showCatalog ? 'overflow-y-auto' : 'overflow-hidden'}`}>

            {/* Delivery form — shown first in delivery mode, or collapsed above catalog after submit */}
            {isDelivery && <DeliveryFormSection {...deliveryFormProps} />}

            {/* Catalog — hidden until form is submitted in delivery mode */}
            {showCatalog && !selectedProduct && (
              <>
                {/* Search bar */}
                <div className="px-5 py-3 border-b border-slate-800 shrink-0">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Buscar produto (mín. 3 caracteres)..."
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-9 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors" />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Category pills */}
                {!searchActive && categories.length > 0 && (
                  <div className="flex gap-2 px-5 py-2.5 overflow-x-auto no-scrollbar border-b border-slate-800 shrink-0">
                    {categories.map(cat => (
                      <button key={cat.id}
                        onClick={() => {
                          setExpandedCats(prev => { const n = new Set(prev); n.add(cat.id); return n; });
                          categoryRefs.current[cat.id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }}
                        className="whitespace-nowrap text-xs font-semibold px-3 py-1.5 rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors shrink-0">
                        {cat.icon && <span className="mr-1">{cat.icon}</span>}
                        {cat.name}
                      </button>
                    ))}
                  </div>
                )}

                {/* Product list */}
                <div className="px-5 py-4 space-y-3">
                  {searchActive ? (
                    <>
                      {filteredProducts.length === 0 ? (
                        <div className="py-16 text-center text-slate-600">
                          <p className="text-sm">Nenhum resultado para “{searchQuery}”.</p>
                        </div>
                      ) : (
                        <>
                          <p className="text-xs text-slate-500">{filteredProducts.length} resultado(s)</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {filteredProducts.map(p => <ProductCard key={p.id} product={p} onClick={() => setSelectedProduct(p)} />)}
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      {productsByCategory.map(({ category, products: prods }) => (
                        <section key={category.id}
                          ref={el => { categoryRefs.current[category.id] = el; }}
                          className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-800">
                          <button onClick={() => toggleCat(category.id)}
                            className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-slate-800/60 transition-colors">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                              {category.icon && <span>{category.icon}</span>}
                              {category.name}
                              <span className="text-slate-500 font-normal text-xs">({prods.length})</span>
                            </h3>
                            <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${expandedCats.has(category.id) ? 'rotate-180' : ''}`} />
                          </button>
                          {expandedCats.has(category.id) && (
                            <div className="px-3 pb-3 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                              {prods.map(p => <ProductCard key={p.id} product={p} onClick={() => setSelectedProduct(p)} />)}
                            </div>
                          )}
                        </section>
                      ))}
                      {uncategorized.length > 0 && (
                        <section className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-800">
                          <div className="px-4 py-3.5 border-b border-slate-800">
                            <h3 className="text-sm font-bold text-white">Outros</h3>
                          </div>
                          <div className="px-3 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                            {uncategorized.map(p => <ProductCard key={p.id} product={p} onClick={() => setSelectedProduct(p)} />)}
                          </div>
                        </section>
                      )}
                      {productsByCategory.length === 0 && uncategorized.length === 0 && (
                        <div className="py-20 text-center text-slate-600">
                          <p>Nenhum produto no cardápio.</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            )}

            {/* Inline product customization — replaces catalog within same column */}
            {showCatalog && selectedProduct && (
              <ProductDrawer inline product={selectedProduct}
                onClose={() => setSelectedProduct(null)}
                onAdd={(combos, extras, total, qty) => addToCart(selectedProduct, combos, extras, total, qty)} />
            )}
          </div>

          {/* ── Right: cart panel — counter mode (hidden on narrow screens, FAB used instead) ────────────────── */}
          {!isDelivery && (
            <div className="w-72 xl:w-80 shrink-0 hidden lg:block">
              <CartPanel items={cart} tableNumber={tableNumber} serviceMode={serviceMode}
                placing={placing} orderMode={orderMode} deliveryFee={0}
                onUpdateQty={updateCartQty} onRemove={removeFromCart} onCheckout={checkout} />
            </div>
          )}
        </div>

        {/* Cart FAB — delivery mode OR counter mode on narrow screens */}
        {((isDelivery && delFormSubmitted) || (!isDelivery)) && cartCount > 0 && !showCartDrawer && (
          <button onClick={() => setShowCartDrawer(true)}
            className="absolute bottom-5 right-5 z-10 flex items-center gap-3 bg-amber-500 hover:bg-amber-400 text-black font-bold px-5 py-3.5 rounded-2xl shadow-2xl transition-all hover:scale-105 active:scale-95">
            <div className="relative">
              <ShoppingCart className="w-5 h-5" />
              <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">{cartCount}</span>
            </div>
            <span className="text-sm">{cartCount} {cartCount === 1 ? 'item' : 'itens'}</span>
            <span className="text-sm">·</span>
            <span className="text-sm">R$ {(cartTotal + delFee).toFixed(2).replace('.', ',')}</span>
          </button>
        )}

        {/* Cart drawer — delivery mode OR counter mode on narrow screens */}
        {showCartDrawer && (
          <>
            <div className="absolute inset-0 bg-black/50 z-20" onClick={() => setShowCartDrawer(false)} />
            <div className="absolute right-0 top-0 bottom-0 w-80 sm:w-96 z-30 animate-[slideInRight_0.2s_ease-out]">
              <div className="flex flex-col h-full bg-slate-900 border-l border-slate-800">
                <div className="px-5 py-4 border-b border-slate-800 shrink-0 flex items-center justify-between">
                  <h3 className="font-bold text-white flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-amber-400" /> Carrinho — {isDelivery ? 'Delivery' : serviceMode === 'table' ? `Mesa ${tableNumber}` : 'Balcão'}
                  </h3>
                  <button onClick={() => setShowCartDrawer(false)} className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                  {cart.length === 0 ? (
                    <div className="py-16 text-center">
                      <ShoppingCart className="w-10 h-10 mx-auto text-slate-700 mb-3" />
                      <p className="text-slate-500 text-sm">Carrinho vazio</p>
                    </div>
                  ) : cart.map(item => (
                    <div key={item.cartId} className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-white leading-tight">{item.product.name}</p>
                        <button onClick={() => removeFromCart(item.cartId)} className="text-slate-600 hover:text-red-400 transition-colors shrink-0 p-0.5">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {item.comboSelections.map(cs => {
                        const chosen = cs.items.filter(i => i.qty > 0);
                        if (!chosen.length) return null;
                        const gn = (cs.groupName ?? '').trim();
                        return (
                          <div key={cs.groupId} className="mt-0.5">
                            {gn && <p className="text-xs text-slate-500">{gn}</p>}
                            {chosen.map(i => (
                              <div key={i.id}>
                                <p className="text-xs text-slate-300 font-medium ml-2">{i.qty > 1 ? `${i.qty}x ` : ''}{i.name}</p>
                                {(i.extras ?? []).filter(e => e.qty > 0).map(ex => (
                                  <p key={ex.id} className="text-xs text-slate-500 ml-4">+{ex.qty}× {ex.name}</p>
                                ))}
                              </div>
                            ))}
                          </div>
                        );
                      })}
                      {item.extraSelections.filter(e => e.qty > 0).map(ex => (
                        <p key={ex.extraId} className="text-xs text-slate-500 mt-0.5">+{ex.qty}× {ex.name}</p>
                      ))}
                      <div className="flex items-center justify-between mt-2.5">
                        <div className="flex items-center gap-2">
                          <button onClick={() => updateCartQty(item.cartId, -1)} className="w-6 h-6 rounded-full border border-slate-600 flex items-center justify-center text-slate-400 hover:border-amber-500 hover:text-amber-400 transition-colors">
                            <Minus className="w-2.5 h-2.5" />
                          </button>
                          <span className="text-sm font-bold text-white w-4 text-center">{item.quantity}</span>
                          <button onClick={() => updateCartQty(item.cartId, 1)} className="w-6 h-6 rounded-full border border-slate-600 flex items-center justify-center text-slate-400 hover:border-amber-500 hover:text-amber-400 transition-colors">
                            <Plus className="w-2.5 h-2.5" />
                          </button>
                        </div>
                        <p className="text-sm font-bold text-amber-400">R$ {(item.itemTotal * item.quantity).toFixed(2).replace('.', ',')}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {cart.length > 0 && (
                  <div className="shrink-0 px-4 py-4 border-t border-slate-800 space-y-3">
                    {delFee > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400 flex items-center gap-1"><Truck className="w-3.5 h-3.5" /> Taxa de entrega</span>
                        <span className="text-slate-300 font-semibold">R$ {delFee.toFixed(2).replace('.', ',')}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-sm">Total</span>
                      <span className="text-xl font-black text-white">R$ {(cartTotal + (isDelivery ? delFee : 0)).toFixed(2).replace('.', ',')}</span>
                    </div>
                    <button disabled={placing} onClick={checkout}
                      className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 disabled:cursor-not-allowed text-black font-bold py-3.5 rounded-xl transition-colors text-sm">
                      {placing ? <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
                      {placing ? 'Enviando...' : 'Confirmar Pedido'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Success overlay */}
        {success && (
          <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center z-40 pointer-events-none">
            <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center mb-4 animate-bounce">
              <Check className="w-10 h-10 text-white" strokeWidth={3} />
            </div>
            <p className="text-white font-bold text-xl">Pedido enviado!</p>
            <p className="text-slate-400 text-sm mt-1">
              {orderMode === 'delivery' ? 'Delivery — aguardando preparo.' : serviceMode === 'table' ? `Mesa ${tableNumber} — aguardando preparo.` : 'Balcão — aguardando preparo.'}
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
