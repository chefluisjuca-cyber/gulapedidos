import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { ShoppingCart, MapPin, Bell, Search, X, ChevronDown, Trophy, UtensilsCrossed, ClipboardList, User as UserIcon, RotateCcw, Phone, LogOut, Clock } from 'lucide-react';
import { supabase, sortProductComboGroups } from '../../lib/supabase';
import { useTenant } from '../../lib/tenant-context';
import { Product, Category, RestaurantSettings, CartItem, CartComboSelection, CartExtraSelection, LoyaltyConfig, LoyaltyCustomer, LoyaltyReward, Order } from '../../types';
import { isCurrentlyOpen, getTodayHours, formatShifts } from '../../lib/business-hours';
import { lookupCep } from '../../lib/cep';
import { DeliveryInfo } from './CartDrawer';
import ProductDrawer from './ProductDrawer';
import CartDrawer from './CartDrawer';
import OnlinePaymentModal from './OnlinePaymentModal';
import OrderTracking from './OrderTracking';
import WaiterCallModal from './WaiterCallModal';
import LoyaltyBenefitsModal from './LoyaltyBenefitsModal';
import LoyaltyAuthModal from './LoyaltyAuthModal';
import LoyaltyProfileModal from './LoyaltyProfileModal';
import ReorderReviewModal from './ReorderReviewModal';

export default function CustomerPanel({ forceDelivery = false }: { forceDelivery?: boolean }) {
  const { tableNumber = '01' } = useParams<{ tableNumber: string }>();
  const { restaurant } = useTenant();
  const restaurantId = restaurant?.id ?? null;

  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showCart, setShowCart] = useState(false);
  const [showWaiterCall, setShowWaiterCall] = useState(false);
  const [showLoyaltyModal, setShowLoyaltyModal] = useState(false);
  const [showLoyaltyAuth, setShowLoyaltyAuth] = useState(false);
  const [showLoyaltyProfile, setShowLoyaltyProfile] = useState(false);
  const [reorderOrder, setReorderOrder] = useState<Order | null>(null);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [deliveryInfo, setDeliveryInfo] = useState<DeliveryInfo>({
    mode: forceDelivery ? 'delivery' : 'pickup',
    name: '', whatsapp: '', cep: '', street: '', number: '',
    bairro: '', complement: '', reference: '',
    lat: null, lng: null, distanceKm: null, fee: 0, estimatedMinutes: null,
    paymentMethod: 'card_delivery', changeFor: '',
  });
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [pendingOnlineOrderId, setPendingOnlineOrderId] = useState<string | null>(null);
  const [showOnlinePayment, setShowOnlinePayment] = useState(false);
  const [onlinePayMethod, setOnlinePayMethod] = useState<'pix' | 'card' | null>(null);
  const [customerTab, setCustomerTab] = useState<'menu' | 'orders' | 'profile'>('menu');
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [myProfile, setMyProfile] = useState<{ name: string; phone: string; cep: string; street: string; number: string; bairro: string; complement: string; reference: string } | null>(null);
  const [editProfile, setEditProfile] = useState<{ name: string; phone: string; cep: string; street: string; number: string; bairro: string; complement: string; reference: string } | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileLookupPhone, setProfileLookupPhone] = useState('');
  const [loyaltyAuthUserId, setLoyaltyAuthUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const categoryRefs = useRef<Record<string, HTMLElement | null>>({});
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Loyalty state — persists across cart sessions
  const [loyaltyConfig, setLoyaltyConfig] = useState<LoyaltyConfig | null>(null);
  const [loyaltyPhone, setLoyaltyPhone] = useState('');
  const [loyaltyName, setLoyaltyName] = useState('');
  const [loyaltyCustomer, setLoyaltyCustomer] = useState<LoyaltyCustomer | null>(null);
  const [selectedReward, setSelectedReward] = useState<LoyaltyReward | null>(null);
  const [loyaltyDiscount, setLoyaltyDiscount] = useState(0);

  useEffect(() => {
    fetchSettings();
    fetchMenu();
    fetchLoyaltyConfig();
    const ch = supabase.channel('settings-watch')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'restaurant_settings' }, fetchSettings)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [restaurantId]);

  // Auth listener — safe pattern: set state only, defer Supabase calls
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setLoyaltyAuthUserId(session?.user?.id ?? null);
      setAuthChecked(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_ev, session) => {
      setLoyaltyAuthUserId(session?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load loyalty customer when auth user is known
  useEffect(() => {
    if (!loyaltyAuthUserId) return;
    (async () => {
      const q = supabase.from('loyalty_customers').select('*').eq('auth_user_id', loyaltyAuthUserId);
      const { data } = await (restaurantId
        ? q.eq('restaurant_id', restaurantId)
        : q.is('restaurant_id', null)
      ).maybeSingle();
      if (data) {
        const c = data as LoyaltyCustomer;
        setLoyaltyCustomer(c);
        setLoyaltyPhone(c.phone ?? c.email ?? '');
        setLoyaltyName(c.nome ?? '');
      }
    })();
  }, [loyaltyAuthUserId, restaurantId]);

  // Show welcome modal once per session when loyalty config loads and user is not authenticated
  useEffect(() => {
    if (!loyaltyConfig || !authChecked) return;
    if (loyaltyAuthUserId) return;
    if (sessionStorage.getItem('loyalty-welcome-seen')) return;
    setShowLoyaltyAuth(true);
  }, [loyaltyConfig?.id, authChecked, loyaltyAuthUserId]);

  async function fetchSettings() {
    const q = supabase.from('restaurant_settings').select('*');
    const { data } = await (restaurantId
      ? q.eq('restaurant_id', restaurantId)
      : q.is('restaurant_id', null)
    ).maybeSingle();
    if (data) setSettings(data as RestaurantSettings);
  }

  async function fetchLoyaltyConfig() {
    const q = supabase.from('loyalty_configs').select('*').eq('ativo', true);
    const { data } = await (restaurantId
      ? q.eq('restaurant_id', restaurantId).maybeSingle()
      : q.is('restaurant_id', null).maybeSingle()
    );
    if (data) setLoyaltyConfig(data as LoyaltyConfig);
  }

  async function fetchMenu() {
    const [catRes, prodRes] = await Promise.all([
      restaurantId
        ? supabase.from('categories').select('*').eq('active', true).eq('restaurant_id', restaurantId).order('sort_order').order('name')
        : supabase.from('categories').select('*').eq('active', true).is('restaurant_id', null).order('sort_order').order('name'),
      restaurantId
        ? supabase.from('products').select('*, combo_groups(*, combo_group_items(*, combo_item_extras(*))), product_extras(*)').eq('active', true).eq('restaurant_id', restaurantId).order('sort_order').order('name')
        : supabase.from('products').select('*, combo_groups(*, combo_group_items(*, combo_item_extras(*))), product_extras(*)').eq('active', true).is('restaurant_id', null).order('sort_order').order('name'),
    ]);
    const cats = (catRes.data ?? []) as Category[];
    const prods = (prodRes.data ?? []) as Product[];
    setCategories(cats);
    setProducts(sortProductComboGroups(prods));
    if (cats.length > 0) {
      setActiveCategory(cats[0].id);
      setExpandedCategories(new Set([cats[0].id]));
    }
  }

  useEffect(() => {
    observerRef.current?.disconnect();
    if (categories.length === 0) return;
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) setActiveCategory(e.target.id.replace('cat-', '')); });
    }, { rootMargin: '-40% 0px -55% 0px', threshold: 0 });
    categories.forEach(c => {
      const el = categoryRefs.current[c.id];
      if (el) obs.observe(el);
    });
    observerRef.current = obs;
    return () => obs.disconnect();
  }, [categories]);

  function toggleCategory(catId: string) {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(catId)) { next.delete(catId); } else { next.add(catId); }
      return next;
    });
  }

  function scrollToCategory(catId: string) {
    setActiveCategory(catId);
    setExpandedCategories(prev => { const next = new Set(prev); next.add(catId); return next; });
    const el = categoryRefs.current[catId];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function addToCart(product: Product, combos: CartComboSelection[], extras: CartExtraSelection[], total: number, quantity: number, meioAMeio?: import('../../types').CartMeioAMeioSelection, observations?: string) {
    setCart(prev => {
      // Meio a meio items are never merged — each is a unique entry
      if (!meioAMeio) {
        const existing = prev.find(i =>
          i.product.id === product.id &&
          !i.meioAMeioSelection &&
          JSON.stringify(i.comboSelections) === JSON.stringify(combos) &&
          JSON.stringify(i.extraSelections) === JSON.stringify(extras) &&
          (i.observations ?? '') === (observations ?? '')
        );
        if (existing) {
          return prev.map(i => i.cartId === existing.cartId ? { ...i, quantity: i.quantity + quantity } : i);
        }
      }
      return [...prev, { cartId: crypto.randomUUID(), product, quantity, comboSelections: combos, extraSelections: extras, meioAMeioSelection: meioAMeio, itemTotal: total, observations }];
    });
    setSelectedProduct(null);
  }

  function updateCartQty(cartId: string, delta: number) {
    setCart(prev => prev.map(i => i.cartId === cartId ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i));
  }

  function removeFromCart(cartId: string) {
    setCart(prev => prev.filter(i => i.cartId !== cartId));
  }

  function handleLoyaltyConfirm(phone: string, name: string, rewardId?: string, discount?: number) {
    setLoyaltyPhone(phone);
    setLoyaltyName(name);
    setLoyaltyDiscount(discount ?? 0);
    setShowLoyaltyModal(false);
    lookupLoyaltyCustomer(phone, rewardId);
  }

  function handleLoyaltyAuthSuccess(customer: LoyaltyCustomer) {
    setLoyaltyCustomer(customer);
    setLoyaltyPhone(customer.phone ?? customer.email ?? '');
    setLoyaltyName(customer.nome ?? '');
    setShowLoyaltyAuth(false);
    sessionStorage.setItem('loyalty-welcome-seen', '1');
  }

  function handleLoyaltyDecline() {
    setShowLoyaltyAuth(false);
    sessionStorage.setItem('loyalty-welcome-seen', '1');
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setLoyaltyAuthUserId(null);
    clearLoyalty();
    setShowLoyaltyProfile(false);
    sessionStorage.removeItem('loyalty-welcome-seen');
  }

  async function lookupLoyaltyCustomer(phone: string, rewardId?: string) {
    const q = supabase.from('loyalty_customers').select('*').eq('phone', phone);
    const { data } = await (restaurantId ? q.eq('restaurant_id', restaurantId) : q.is('restaurant_id', null)).maybeSingle();
    if (data) setLoyaltyCustomer(data as LoyaltyCustomer);

    if (rewardId) {
      const { data: reward } = await supabase.from('loyalty_rewards').select('*').eq('id', rewardId).maybeSingle();
      if (reward) setSelectedReward(reward as LoyaltyReward);
    } else {
      setSelectedReward(null);
    }
  }

  function clearLoyalty() {
    setLoyaltyPhone('');
    setLoyaltyName('');
    setLoyaltyCustomer(null);
    setSelectedReward(null);
    setLoyaltyDiscount(0);
  }

  async function checkout(cashbackUsed: number, isOnlinePayment = false) {
    if (cart.length === 0) return;
    if (isPaused) {
      setCheckoutError(`Estamos com alta demanda! Voltamos a aceitar pedidos às ${pausedUntilStr}.`);
      return;
    }
    if (isClosed) {
      setCheckoutError(todayHoursStr
        ? `Estamos fechados no momento. Nosso horário de atendimento hoje é das ${todayHoursStr}.`
        : 'Estamos fechados no momento. Volte durante o horário de atendimento.'
      );
      return;
    }
    setPlacingOrder(true);
    setCheckoutError('');
    const serviceMode = settings?.service_mode ?? 'counter';
    const isDelivery = forceDelivery || ((settings?.delivery_enabled ?? false) && deliveryInfo.mode === 'delivery');
    try {
      const rawTotal = cart.reduce((s, i) => s + i.itemTotal * i.quantity, 0);
      const deliveryFee = isDelivery ? deliveryInfo.fee : 0;
      const totalDiscount = loyaltyDiscount + cashbackUsed;
      const total = Math.max(0, rawTotal - totalDiscount + deliveryFee);

      // Only credit when order meets minimum value
      const meetsMinimum = loyaltyConfig
        ? total >= Number(loyaltyConfig.valor_minimo_pedido)
        : false;

      const loyaltyPoints = (meetsMinimum && loyaltyConfig?.tipo_promocao === 'pontos_por_real')
        ? Math.floor(total * Number(loyaltyConfig.valor_conversao))
        : 0;
      const loyaltyCashback = (meetsMinimum && loyaltyConfig?.tipo_promocao === 'cashback')
        ? total * Number(loyaltyConfig.valor_conversao) / 100
        : 0;

      const loyaltyIdentifier = loyaltyPhone || loyaltyCustomer?.email || null;
      const loyaltyActive = !!(loyaltyIdentifier || loyaltyAuthUserId);

      // Balance after this order: subtract used cashback, add earned cashback
      const loyaltyPointsTotal = loyaltyActive
        ? (loyaltyCustomer?.saldo_pontos ?? 0) + loyaltyPoints
        : 0;
      const loyaltyCashbackTotal = loyaltyActive
        ? Math.max(0, Number(loyaltyCustomer?.saldo_cashback ?? 0) - cashbackUsed) + loyaltyCashback
        : 0;

      const deliveryFields = isDelivery ? {
        delivery_mode: 'delivery',
        delivery_name: deliveryInfo.name,
        delivery_whatsapp: deliveryInfo.whatsapp,
        delivery_cep: deliveryInfo.cep,
        delivery_street: deliveryInfo.street,
        delivery_number: deliveryInfo.number,
        delivery_bairro: deliveryInfo.bairro,
        delivery_complement: deliveryInfo.complement || null,
        delivery_reference: deliveryInfo.reference,
        delivery_lat: deliveryInfo.lat,
        delivery_lng: deliveryInfo.lng,
        delivery_distance_km: deliveryInfo.distanceKm,
        delivery_fee: deliveryInfo.fee,
        delivery_payment_method: deliveryInfo.paymentMethod,
        delivery_change_for: deliveryInfo.changeFor ? parseFloat(deliveryInfo.changeFor) : null,
        delivery_estimated_minutes: deliveryInfo.estimatedMinutes,
        delivery_status: 'pending',
      } : { delivery_mode: 'pickup' };

      // Build order payload (used for both PIX insert and card edge function)
      const orderPayload: Record<string, unknown> = {
        table_number: isDelivery ? 'Delivery' : tableNumber,
        service_mode: serviceMode,
        total,
        ...deliveryFields,
        ...(restaurantId ? { restaurant_id: restaurantId } : {}),
        ...(loyaltyActive ? {
          loyalty_customer_phone: loyaltyIdentifier,
          loyalty_customer_name: loyaltyName || loyaltyCustomer?.nome || null,
          loyalty_reward_id: selectedReward?.id ?? null,
          loyalty_discount: loyaltyDiscount + cashbackUsed,
          loyalty_benefit_action: selectedReward ? 'pending' : 'none',
          loyalty_points_earned: loyaltyPoints,
          loyalty_cashback_earned: loyaltyCashback,
          loyalty_points_total: loyaltyPointsTotal,
          loyalty_cashback_total: loyaltyCashbackTotal,
        } : {}),
      };

      const itemsPayload = cart.map(ci => ({
        product_id: ci.product.id,
        product_name: ci.product.name,
        quantity: ci.quantity,
        unit_price: ci.itemTotal,
        ...(restaurantId ? { restaurant_id: restaurantId } : {}),
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
          ...(ci.meioAMeioSelection ? { meio_a_meio: ci.meioAMeioSelection } : {}),
          ...(ci.observations ? { observations: ci.observations } : {}),
        },
      }));

      // ── Card payment: do NOT create order in DB — edge function creates it on approval ──
      if (isOnlinePayment && deliveryInfo.paymentMethod === 'online_card') {
        const pendingId = crypto.randomUUID();
        setPendingOnlineOrderId(pendingId);
        setOnlinePayMethod('card');
        setShowOnlinePayment(true);
        setPlacingOrder(false);
        // Pass order data to the payment modal — order is created only if card is approved
        (window as Record<string, unknown>).__pendingOrderData = {
          orderPayload: { ...orderPayload, payment_status: 'pending', payment_method: 'online_card' },
          itemsPayload,
        };
        return;
      }

      // ── PIX payment: create order in DB first (PIX is async — webhook updates later) ──
      // ── Non-online: create order immediately ──
      const { data: orderData, error: orderErr } = await supabase
        .from('orders')
        .insert({
          ...orderPayload,
          ...(isOnlinePayment ? { payment_status: 'pending', payment_method: 'online_pix' } : {}),
        })
        .select()
        .maybeSingle();
      if (orderErr || !orderData) {
        setCheckoutError('Erro ao registrar pedido. Tente novamente.');
        return;
      }

      const items = itemsPayload.map(ci => ({ ...ci, order_id: orderData.id }));
      await supabase.from('order_items').insert(items);

      if (serviceMode === 'table') {
        await supabase.from('waiter_calls').insert({
          table_number: tableNumber,
          call_type: 'bill',
          message: 'Conta solicitada ao finalizar pedido.',
          ...(restaurantId ? { restaurant_id: restaurantId } : {}),
        });
      }

      // Credit points/cashback and deduct used cashback (minimum already enforced — values are 0 if below)
      if (loyaltyConfig && (loyaltyPoints > 0 || loyaltyCashback > 0 || cashbackUsed > 0)) {
        await creditLoyalty(total, loyaltyPoints, loyaltyCashback, cashbackUsed);
      }

      // Auto-save customer profile for ALL order types (delivery + pickup)
      // so name/phone/address are pre-filled on the next order
      const profilePhone = isDelivery ? deliveryInfo.whatsapp : loyaltyPhone;
      const profileName = isDelivery ? deliveryInfo.name : (loyaltyName || loyaltyCustomer?.nome || null);
      if (restaurantId && profilePhone) {
        await supabase.from('delivery_customer_profiles').upsert({
          restaurant_id: restaurantId,
          phone: profilePhone,
          name: profileName || null,
          ...(isDelivery ? {
            cep: deliveryInfo.cep || null,
            street: deliveryInfo.street || null,
            number: deliveryInfo.number || null,
            bairro: deliveryInfo.bairro || null,
            complement: deliveryInfo.complement || null,
            reference: deliveryInfo.reference || null,
            lat: deliveryInfo.lat,
            lng: deliveryInfo.lng,
          } : {}),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'restaurant_id,phone' });
      }

      // Register service worker for web push
      if ('serviceWorker' in navigator && isDelivery) {
        try {
          await navigator.serviceWorker.register('/sw.js');
        } catch { /* ignore */ }
      }

      // If PIX online payment, show payment modal instead of completing
      if (isOnlinePayment && deliveryInfo.paymentMethod === 'online_pix') {
        setPendingOnlineOrderId(orderData.id);
        setOnlinePayMethod('pix');
        setShowOnlinePayment(true);
        setPlacingOrder(false);
        return;
      }

      setCart([]);
      setShowCart(false);
      setCurrentOrderId(orderData.id);
      if (isDelivery) {
        setDeliveryInfo(prev => ({ ...prev, mode: 'pickup', name: '', whatsapp: '', cep: '', street: '', number: '', bairro: '', complement: '', reference: '', lat: null, lng: null, distanceKm: null, fee: 0, estimatedMinutes: null, changeFor: '' }));
      }
    } catch {
      setCheckoutError('Erro inesperado. Tente novamente.');
    } finally {
      setPlacingOrder(false);
    }
  }

  async function creditLoyalty(orderTotal: number, pointsEarned: number, cashbackEarned: number, cashbackUsed: number = 0) {
    if (!loyaltyConfig) return;

    const now = new Date().toISOString();
    const earnTx = {
      tipo: 'ganho' as const,
      descricao: loyaltyConfig.tipo_promocao === 'pontos_por_real'
        ? '+' + pointsEarned + ' pts - pedido R$ ' + orderTotal.toFixed(2)
        : '+R$ ' + cashbackEarned.toFixed(2) + ' cashback - pedido R$ ' + orderTotal.toFixed(2),
      pontos: pointsEarned,
      cashback: cashbackEarned,
      data: now,
      order_total: orderTotal,
    };

    const spendTx = cashbackUsed > 0 ? [{
      tipo: 'resgate' as const,
      descricao: '-R$ ' + cashbackUsed.toFixed(2) + ' cashback usado no pedido',
      cashback: -cashbackUsed,
      data: now,
      order_total: orderTotal,
    }] : [];

    // Find existing customer: prefer auth_user_id, fall back to phone
    let existing = null;
    if (loyaltyAuthUserId) {
      const q = supabase.from('loyalty_customers').select('*').eq('auth_user_id', loyaltyAuthUserId);
      const { data } = await (restaurantId ? q.eq('restaurant_id', restaurantId) : q.is('restaurant_id', null)).maybeSingle();
      existing = data;
    }
    if (!existing && loyaltyPhone) {
      const q = supabase.from('loyalty_customers').select('*').eq('phone', loyaltyPhone);
      const { data } = await (restaurantId ? q.eq('restaurant_id', restaurantId) : q.is('restaurant_id', null)).maybeSingle();
      existing = data;
    }

    if (!existing) {
      // Create phone-only record (no auth) if we have a phone number
      if (loyaltyPhone) {
        await supabase.from('loyalty_customers').insert({
          phone: loyaltyPhone,
          nome: loyaltyName || null,
          saldo_pontos: pointsEarned,
          saldo_cashback: cashbackEarned,
          total_visitas: 1,
          historico_transacoes: [earnTx],
          ...(restaurantId ? { restaurant_id: restaurantId } : {}),
        });
      }
      return;
    }

    const history = [...(existing.historico_transacoes ?? []), ...spendTx, earnTx];
    const { error: updateErr } = await supabase.from('loyalty_customers').update({
      nome: existing.nome || loyaltyName || null,
      saldo_pontos: existing.saldo_pontos + pointsEarned,
      saldo_cashback: Math.max(0, Number(existing.saldo_cashback) - cashbackUsed) + cashbackEarned,
      total_visitas: existing.total_visitas + 1,
      historico_transacoes: history,
      updated_at: now,
    }).eq('id', existing.id);

    if (updateErr) {
      console.error('[creditLoyalty] update failed:', updateErr.message, updateErr.code);
      return;
    }

    // Refresh the in-memory customer for profile display
    setLoyaltyCustomer(prev => prev ? {
      ...prev,
      saldo_pontos: prev.saldo_pontos + pointsEarned,
      saldo_cashback: Math.max(0, Number(prev.saldo_cashback) - cashbackUsed) + cashbackEarned,
      total_visitas: prev.total_visitas + 1,
      historico_transacoes: history,
    } : prev);
  }

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  const isPaused = !!(settings?.paused_until && new Date(settings.paused_until) > new Date());
  const pausedUntilStr = settings?.paused_until
    ? new Date(settings.paused_until).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : '';

  const isClosed = !isPaused && !isCurrentlyOpen(settings?.business_hours);
  const todayHours = getTodayHours(settings?.business_hours);
  const todayHoursStr = todayHours && todayHours.active && todayHours.shifts.length > 0
    ? formatShifts(todayHours.shifts)
    : '';

  const filteredProducts = searchQuery
    ? products.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.description ?? '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : products;

  const productsByCategory = categories
    .map(cat => ({ category: cat, products: filteredProducts.filter(p => p.category_id === cat.id) }))
    .filter(g => g.products.length > 0);

  const uncategorized = filteredProducts.filter(p => !p.category_id);

  async function fetchMyOrders() {
    if (!restaurantId) return;
    const phone = loyaltyPhone || deliveryInfo.whatsapp;
    if (!phone || phone.length < 10) { setMyOrders([]); return; }
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('restaurant_id', restaurantId)
      .or(`delivery_whatsapp.eq.${phone},loyalty_customer_phone.eq.${phone}`)
      .order('created_at', { ascending: false })
      .limit(20);
    setMyOrders((data ?? []) as Order[]);
  }

  // Realtime subscription for customer orders — keeps "Meus Pedidos" live
  useEffect(() => {
    if (customerTab !== 'orders') return;
    fetchMyOrders();
    const ch = supabase
      .channel('customer-orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchMyOrders)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, fetchMyOrders)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [customerTab, loyaltyPhone, deliveryInfo.whatsapp, restaurantId]);

  async function fetchMyProfile() {
    if (!restaurantId) return;
    const phone = loyaltyPhone || deliveryInfo.whatsapp;
    if (!phone || phone.length < 10) { setMyProfile(null); return; }

    // Try delivery_customer_profiles first
    const { data } = await supabase
      .from('delivery_customer_profiles')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('phone', phone)
      .maybeSingle();

    if (data) {
      setMyProfile({
        name: data.name ?? '', phone: data.phone, cep: data.cep ?? '',
        street: data.street ?? '', number: data.number ?? '', bairro: data.bairro ?? '',
        complement: data.complement ?? '', reference: data.reference ?? '',
      });
      return;
    }

    // Fall back to loyalty_customers for name/phone if no delivery profile
    if (loyaltyCustomer) {
      // Use loyaltyCustomer.phone only if it looks like a phone (not an email)
      const lcPhone = loyaltyCustomer.phone && !loyaltyCustomer.phone.includes('@') ? loyaltyCustomer.phone : phone;
      setMyProfile({
        name: loyaltyCustomer.nome ?? '', phone: lcPhone,
        cep: '', street: '', number: '', bairro: '', complement: '', reference: '',
      });
      return;
    }

    // No profile found — keep form visible with the phone pre-filled
    setMyProfile({ name: '', phone, cep: '', street: '', number: '', bairro: '', complement: '', reference: '' });
  }

  useEffect(() => {
    if (customerTab === 'profile') fetchMyProfile();
  }, [customerTab, loyaltyPhone, deliveryInfo.whatsapp, loyaltyCustomer]);

  useEffect(() => {
    if (myProfile) setEditProfile({ ...myProfile });
  }, [myProfile]);

  function repeatOrder(order: Order) {
    setReorderOrder(order);
  }

  function confirmReorder(items: CartItem[]) {
    if (items.length === 0) return;
    setCart(items);
    setReorderOrder(null);
    setCustomerTab('menu');
    setShowCart(true);
  }

  async function saveProfile() {
    if (!editProfile || !restaurantId) return;
    setSavingProfile(true);
    setProfileSaved(false);
    const phone = editProfile.phone || loyaltyPhone || deliveryInfo.whatsapp;
    if (!phone) {
      setSavingProfile(false);
      return;
    }
    await supabase.from('delivery_customer_profiles').upsert({
      restaurant_id: restaurantId,
      phone,
      name: editProfile.name || null,
      cep: editProfile.cep || null,
      street: editProfile.street || null,
      number: editProfile.number || null,
      bairro: editProfile.bairro || null,
      complement: editProfile.complement || null,
      reference: editProfile.reference || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'restaurant_id,phone' });
    setMyProfile({ ...editProfile, phone });
    setSavingProfile(false);
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 3000);
  }

  if (currentOrderId) {
    return (
      <OrderTracking
        orderId={currentOrderId}
        tableNumber={tableNumber}
        serviceMode={settings?.service_mode ?? 'table'}
        onClose={() => setCurrentOrderId(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col max-w-lg mx-auto relative lg:max-w-7xl lg:flex-row">
      {/* Header — becomes a left sidebar on desktop */}
      <header className="sticky top-0 z-30 bg-slate-900 border-b border-slate-800 shadow-lg lg:sticky lg:top-0 lg:h-screen lg:w-80 lg:flex-shrink-0 lg:border-b-0 lg:border-r lg:border-slate-800 lg:flex lg:flex-col">
        <div className="px-4 pt-5 pb-3 lg:flex-1 lg:overflow-y-auto lg:no-scrollbar">
          <div className="flex flex-col items-center text-center gap-2 relative lg:items-start lg:text-left">
            {settings?.logo_url ? (
              <img src={settings.logo_url} alt="Logo" className="w-20 h-20 object-cover rounded-2xl shadow-lg" />
            ) : (
              <img src="/gula-pedidos-digial.png" alt="Gula Pedidos Digital" className="w-20 h-20 object-contain rounded-2xl shadow-lg" />
            )}
            <h1 className="font-bold text-white text-xl leading-tight">{settings?.name ?? 'Cardápio Digital'}</h1>
            <p className="text-sm text-amber-400 flex items-center gap-1 font-medium">
              <MapPin className="w-3.5 h-3.5" />
              {forceDelivery ? 'Delivery' : `Mesa ${tableNumber}`}
            </p>
            {cartCount > 0 && (
              <button
                onClick={() => setShowCart(true)}
                className="absolute right-0 top-0 flex items-center gap-2 bg-amber-500 text-black px-3 py-2 rounded-xl font-bold text-sm"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>{cartCount}</span>
              </button>
            )}
            {loyaltyCustomer && (
              <button
                onClick={() => setShowLoyaltyProfile(true)}
                className="absolute left-0 top-0 flex items-center gap-1.5 bg-amber-500/15 text-amber-400 border border-amber-500/20 px-2.5 py-2 rounded-xl text-xs font-semibold"
              >
                <Trophy className="w-3.5 h-3.5" />
                {loyaltyConfig?.tipo_promocao === 'pontos_por_real'
                  ? `${loyaltyCustomer.saldo_pontos} pts`
                  : 'R$ ' + Number(loyaltyCustomer.saldo_cashback).toFixed(2)
                }
              </button>
            )}
          </div>

          <div className="mt-3 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar no cardápio..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-9 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-all"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {!searchQuery && (
          <div className="flex gap-2 px-4 pb-3 overflow-x-auto no-scrollbar lg:flex-col lg:gap-1.5 lg:px-3 lg:pb-4">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => scrollToCategory(cat.id)}
                className={`whitespace-nowrap text-xs font-semibold px-3 py-1.5 rounded-full transition-colors shrink-0 lg:w-full lg:text-left lg:rounded-xl lg:py-2.5 lg:text-sm ${
                  activeCategory === cat.id ? 'bg-amber-500 text-black' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {cat.icon && <span className="mr-1">{cat.icon}</span>}
                {cat.name}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Menu Content */}
      <main className="flex-1 px-4 py-4 pb-32 space-y-2 lg:px-8 lg:pb-32 lg:flex-1 lg:overflow-y-auto lg:max-h-screen">
        {isPaused && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 mb-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-amber-300 font-bold text-sm">Estamos com alta demanda!</p>
              <p className="text-amber-400/80 text-xs mt-0.5">Voltamos a aceitar pedidos às {pausedUntilStr}</p>
            </div>
          </div>
        )}
        {isClosed && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 mb-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-red-300 font-bold text-sm">Estamos fechados no momento</p>
              <p className="text-red-400/80 text-xs mt-0.5">
                {todayHoursStr
                  ? `Nosso horário de atendimento hoje é das ${todayHoursStr}.`
                  : 'Volte durante o horário de atendimento.'
                }
              </p>
            </div>
          </div>
        )}
        {searchQuery ? (
          <section className="pt-2">
            <p className="text-xs text-slate-500 mb-3">{filteredProducts.length} resultado(s)</p>
            <div className="grid grid-cols-1 gap-2 lg:grid-cols-2 xl:grid-cols-3">
              {filteredProducts.map(prod => <ProductCard key={prod.id} product={prod} allProducts={products} onClick={() => setSelectedProduct(prod)} />)}
            </div>
          </section>
        ) : (
          <>
            {productsByCategory.map(({ category, products: prods }) => {
              const isExpanded = expandedCategories.has(category.id);
              return (
                <section
                  key={category.id}
                  id={`cat-${category.id}`}
                  ref={el => { categoryRefs.current[category.id] = el; }}
                  className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 lg:scroll-mt-4"
                >
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-slate-800/60 transition-colors"
                  >
                    <h2 className="text-sm font-bold text-white flex items-center gap-2">
                      {category.icon && <span className="text-base">{category.icon}</span>}
                      {category.name}
                      <span className="text-xs font-normal text-slate-500">({prods.length})</span>
                    </h2>
                    <ChevronDown
                      className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {isExpanded && (
                    <div className="px-3 pb-3 grid grid-cols-1 gap-2 border-t border-slate-800 lg:grid-cols-2 xl:grid-cols-3">
                      {prods.map(prod => <ProductCard key={prod.id} product={prod} allProducts={products} onClick={() => setSelectedProduct(prod)} />)}
                    </div>
                  )}
                </section>
              );
            })}
            {uncategorized.length > 0 && (
              <section className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-800">
                <div className="px-4 py-3.5 border-b border-slate-800">
                  <h2 className="text-sm font-bold text-white">Outros</h2>
                </div>
                <div className="px-3 pb-3 grid grid-cols-1 gap-2 pt-2 lg:grid-cols-2 xl:grid-cols-3">
                  {uncategorized.map(prod => <ProductCard key={prod.id} product={prod} allProducts={products} onClick={() => setSelectedProduct(prod)} />)}
                </div>
              </section>
            )}
            {productsByCategory.length === 0 && uncategorized.length === 0 && (
              <div className="py-20 text-center text-slate-500">
                <p>Cardápio sendo preparado...</p>
              </div>
            )}
          </>
        )}
      </main>

      {(settings?.service_mode ?? 'counter') === 'table' && cartCount === 0 && (
        <button
          onClick={() => setShowWaiterCall(true)}
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-slate-800 border border-slate-700 text-white font-semibold px-5 py-3.5 rounded-full shadow-2xl hover:bg-slate-700 transition-colors"
          style={{ width: 'min(calc(100% - 3rem), 28rem)', maxWidth: '28rem' }}
        >
          <Bell className="w-4 h-4 text-amber-400" />
          <span>Chamar Garçom</span>
        </button>
      )}

      {(settings?.service_mode ?? 'counter') === 'table' && cartCount > 0 && (
        <div
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 flex gap-2"
          style={{ width: 'min(calc(100% - 3rem), 28rem)', maxWidth: '28rem' }}
        >
          <button
            onClick={() => setShowWaiterCall(true)}
            className="flex items-center gap-2 bg-slate-800 border border-slate-700 text-white font-semibold px-4 py-3.5 rounded-full shadow-2xl hover:bg-slate-700 transition-colors shrink-0"
          >
            <Bell className="w-4 h-4 text-amber-400" />
          </button>
          <button
            onClick={() => setShowCart(true)}
            className="flex-1 flex items-center justify-center gap-2 bg-amber-500 text-black font-bold px-5 py-3.5 rounded-full shadow-2xl hover:bg-amber-400 transition-colors"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Ver Carrinho ({cartCount})</span>
          </button>
        </div>
      )}

      {(settings?.service_mode ?? 'counter') === 'counter' && cartCount > 0 && (
        <button
          onClick={() => setShowCart(true)}
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-amber-500 text-black font-bold px-5 py-3.5 rounded-full shadow-2xl hover:bg-amber-400 transition-colors"
          style={{ width: 'min(calc(100% - 3rem), 28rem)', maxWidth: '28rem' }}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>Ver Carrinho ({cartCount})</span>
        </button>
      )}


      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-slate-900 border-t border-slate-800 max-w-lg mx-auto lg:left-auto lg:right-auto lg:bottom-6 lg:rounded-2xl lg:border lg:border-slate-700 lg:shadow-2xl lg:w-auto">
        <div className="flex">
          <button onClick={() => setCustomerTab('menu')}
            className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${customerTab === 'menu' ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'}`}>
            <UtensilsCrossed className="w-5 h-5" />
            <span className="text-[10px] font-semibold">Cardápio</span>
          </button>
          <button onClick={() => setCustomerTab('orders')}
            className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${customerTab === 'orders' ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'}`}>
            <ClipboardList className="w-5 h-5" />
            <span className="text-[10px] font-semibold">Meus Pedidos</span>
          </button>
          <button onClick={() => setCustomerTab('profile')}
            className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${customerTab === 'profile' ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'}`}>
            <UserIcon className="w-5 h-5" />
            <span className="text-[10px] font-semibold">Meus Dados</span>
          </button>
        </div>
      </nav>

      {customerTab === 'orders' && (
        <div className="fixed inset-0 top-0 bg-slate-950 z-40 overflow-y-auto">
          <div className="max-w-lg mx-auto px-4 py-6 pb-24 lg:max-w-3xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white font-bold text-lg flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-amber-400" /> Meus Pedidos
              </h2>
              <button onClick={() => setCustomerTab('menu')} className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            {(!loyaltyPhone && !deliveryInfo.whatsapp) ? (
              <div className="py-20 text-center text-slate-500">
                <ClipboardList className="w-12 h-12 mx-auto text-slate-700 mb-3" />
                <p className="text-sm">Faça seu primeiro pedido para ver seu histórico aqui.</p>
              </div>
            ) : myOrders.length === 0 ? (
              <div className="py-20 text-center text-slate-500">
                <ClipboardList className="w-12 h-12 mx-auto text-slate-700 mb-3" />
                <p className="text-sm">Nenhum pedido encontrado.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {myOrders.map(o => (
                  <div key={o.id} className="bg-slate-900 rounded-2xl border border-slate-800 p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-white font-semibold text-sm">
                          {o.delivery_mode === 'delivery' ? 'Delivery' : 'Mesa ' + o.table_number}
                        </p>
                        <p className="text-slate-500 text-xs">
                          {new Date(o.created_at).toLocaleDateString('pt-BR')} às {new Date(o.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <span className={'text-xs font-bold px-2 py-1 rounded-full ' + (
                        o.payment_status === 'pending' && o.payment_method?.startsWith('online_')
                          ? 'bg-amber-500/20 text-amber-400'
                          : o.delivery_mode === 'delivery'
                          ? (o.delivery_status === 'delivered' ? 'bg-green-500/20 text-green-400' : o.delivery_status === 'dispatched' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400')
                          : (o.status === 'closed' ? 'bg-green-500/20 text-green-400' : o.status === 'ready' ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400')
                      )}>
                        {o.payment_status === 'pending' && o.payment_method?.startsWith('online_')
                          ? 'Aguardando Pagamento'
                          : o.delivery_mode === 'delivery'
                          ? (o.delivery_status === 'delivered' ? 'Entregue' : o.delivery_status === 'dispatched' ? 'A caminho' : 'Em preparo')
                          : (o.status === 'closed' ? 'Finalizado' : o.status === 'ready' ? 'Pronto' : 'Em preparo')
                        }
                      </span>
                    </div>
                    <div className="space-y-1 mb-3">
                      {(o.order_items ?? []).map(item => (
                        <div key={item.id} className="flex justify-between text-xs text-slate-400">
                          <span>{item.quantity}× {item.product_name}</span>
                          <span>R$ {(item.unit_price * item.quantity).toFixed(2).replace('.', ',')}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                      <span className="text-white font-bold text-sm">R$ {o.total.toFixed(2).replace('.', ',')}</span>
                      <button onClick={() => repeatOrder(o)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-2 rounded-xl transition-colors">
                        <RotateCcw className="w-3.5 h-3.5" /> Refazer Pedido
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {customerTab === 'profile' && (
        <div className="fixed inset-0 top-0 bg-slate-950 z-40 overflow-y-auto">
          <div className="max-w-lg mx-auto px-4 py-6 pb-24 lg:max-w-3xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white font-bold text-lg flex items-center gap-2">
                <UserIcon className="w-5 h-5 text-amber-400" /> Meus Dados
              </h2>
              <button onClick={() => setCustomerTab('menu')} className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-4">
              {/* Nome */}
              <div>
                <label className="text-xs text-slate-500 font-semibold uppercase">Nome</label>
                <input
                  value={editProfile?.name ?? myProfile?.name ?? ''}
                  onChange={e => setEditProfile(prev => prev ? { ...prev, name: e.target.value } : { name: e.target.value, phone: myProfile?.phone ?? profileLookupPhone ?? '', cep: myProfile?.cep ?? '', street: myProfile?.street ?? '', number: myProfile?.number ?? '', bairro: myProfile?.bairro ?? '', complement: myProfile?.complement ?? '', reference: myProfile?.reference ?? '' })}
                  placeholder="Seu nome"
                  className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>
              {/* Telefone */}
              <div>
                <label className="text-xs text-slate-500 font-semibold uppercase flex items-center gap-1"><Phone className="w-3 h-3" /> Telefone</label>
                <div className="flex gap-2 mt-1">
                  <input
                    type="tel"
                    value={editProfile?.phone ?? myProfile?.phone ?? profileLookupPhone}
                    onChange={e => {
                      const val = e.target.value;
                      setProfileLookupPhone(val);
                      setEditProfile(prev => prev ? { ...prev, phone: val } : { name: myProfile?.name ?? '', phone: val, cep: myProfile?.cep ?? '', street: myProfile?.street ?? '', number: myProfile?.number ?? '', bairro: myProfile?.bairro ?? '', complement: myProfile?.complement ?? '', reference: myProfile?.reference ?? '' });
                    }}
                    onKeyDown={e => { if (e.key === 'Enter' && (editProfile?.phone ?? profileLookupPhone).length >= 10) { setDeliveryInfo(prev => ({ ...prev, whatsapp: editProfile?.phone ?? profileLookupPhone })); setLoyaltyPhone(editProfile?.phone ?? profileLookupPhone); } }}
                    placeholder="(11) 99999-9999"
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                  {!myProfile && (
                    <button
                      onClick={() => {
                        const phone = editProfile?.phone ?? profileLookupPhone;
                        if (phone.length < 10) return;
                        setDeliveryInfo(prev => ({ ...prev, whatsapp: phone }));
                        setLoyaltyPhone(phone);
                      }}
                      disabled={(editProfile?.phone ?? profileLookupPhone).length < 10}
                      className="shrink-0 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-bold text-sm transition-colors flex items-center gap-1.5"
                    >
                      <Search className="w-4 h-4" /> Buscar
                    </button>
                  )}
                </div>
              </div>
              {/* Endereço */}
              <div className="pt-3 border-t border-slate-800">
                <label className="text-xs text-slate-500 font-semibold uppercase flex items-center gap-1"><MapPin className="w-3 h-3" /> Endereço de Entrega</label>
                <div className="mt-2 space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      value={editProfile?.cep ?? myProfile?.cep ?? ''}
                      onChange={e => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 8);
                        setEditProfile(prev => prev ? { ...prev, cep: val } : { name: myProfile?.name ?? '', phone: myProfile?.phone ?? profileLookupPhone, cep: val, street: myProfile?.street ?? '', number: myProfile?.number ?? '', bairro: myProfile?.bairro ?? '', complement: myProfile?.complement ?? '', reference: myProfile?.reference ?? '' });
                        if (val.length === 8) {
                          lookupCep(val).then(cepData => {
                            if (cepData) {
                              setEditProfile(prev => prev ? { ...prev, street: cepData.street ?? prev.street, bairro: cepData.bairro ?? prev.bairro } : null);
                            }
                          });
                        }
                      }}
                      placeholder="CEP"
                      className="col-span-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                    <input
                      value={editProfile?.street ?? myProfile?.street ?? ''}
                      onChange={e => setEditProfile(prev => prev ? { ...prev, street: e.target.value } : { name: myProfile?.name ?? '', phone: myProfile?.phone ?? profileLookupPhone, cep: myProfile?.cep ?? '', street: e.target.value, number: myProfile?.number ?? '', bairro: myProfile?.bairro ?? '', complement: myProfile?.complement ?? '', reference: myProfile?.reference ?? '' })}
                      placeholder="Rua"
                      className="col-span-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={editProfile?.number ?? myProfile?.number ?? ''}
                      onChange={e => setEditProfile(prev => prev ? { ...prev, number: e.target.value } : { name: myProfile?.name ?? '', phone: myProfile?.phone ?? profileLookupPhone, cep: myProfile?.cep ?? '', street: myProfile?.street ?? '', number: e.target.value, bairro: myProfile?.bairro ?? '', complement: myProfile?.complement ?? '', reference: myProfile?.reference ?? '' })}
                      placeholder="Número"
                      className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                    <input
                      value={editProfile?.bairro ?? myProfile?.bairro ?? ''}
                      onChange={e => setEditProfile(prev => prev ? { ...prev, bairro: e.target.value } : { name: myProfile?.name ?? '', phone: myProfile?.phone ?? profileLookupPhone, cep: myProfile?.cep ?? '', street: myProfile?.street ?? '', number: myProfile?.number ?? '', bairro: e.target.value, complement: myProfile?.complement ?? '', reference: myProfile?.reference ?? '' })}
                      placeholder="Bairro"
                      className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <input
                    value={editProfile?.complement ?? myProfile?.complement ?? ''}
                    onChange={e => setEditProfile(prev => prev ? { ...prev, complement: e.target.value } : { name: myProfile?.name ?? '', phone: myProfile?.phone ?? profileLookupPhone, cep: myProfile?.cep ?? '', street: myProfile?.street ?? '', number: myProfile?.number ?? '', bairro: myProfile?.bairro ?? '', complement: e.target.value, reference: myProfile?.reference ?? '' })}
                    placeholder="Complemento (opcional)"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                  <input
                    value={editProfile?.reference ?? myProfile?.reference ?? ''}
                    onChange={e => setEditProfile(prev => prev ? { ...prev, reference: e.target.value } : { name: myProfile?.name ?? '', phone: myProfile?.phone ?? profileLookupPhone, cep: myProfile?.cep ?? '', street: myProfile?.street ?? '', number: myProfile?.number ?? '', bairro: myProfile?.bairro ?? '', complement: myProfile?.complement ?? '', reference: e.target.value })}
                    placeholder="Ponto de referência (opcional)"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
              {/* Save button */}
              <button
                onClick={saveProfile}
                disabled={savingProfile}
                className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-bold py-3 rounded-xl transition-colors text-sm"
              >
                {savingProfile ? 'Salvando...' : profileSaved ? 'Salvo!' : 'Salvar Dados'}
              </button>
              {loyaltyCustomer && loyaltyConfig && (
                <div className="pt-3 border-t border-slate-800">
                  <label className="text-xs text-slate-500 font-semibold uppercase flex items-center gap-1"><Trophy className="w-3 h-3" /> Fidelidade</label>
                  <div className="mt-2 flex gap-2">
                    {loyaltyConfig.tipo_promocao === 'pontos_por_real' ? (
                      <span className="text-sm text-amber-400 font-bold">{loyaltyCustomer.saldo_pontos} pontos</span>
                    ) : (
                      <span className="text-sm text-green-400 font-bold">R$ {Number(loyaltyCustomer.saldo_cashback).toFixed(2)} cashback</span>
                    )}
                  </div>
                </div>
              )}
            </div>
            {loyaltyCustomer && (
              <button
                onClick={handleLogout}
                className="w-full mt-4 flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 font-semibold py-3.5 rounded-xl border border-red-500/20 transition-colors text-sm"
              >
                <LogOut className="w-4 h-4" /> Sair da Conta
              </button>
            )}
          </div>
        </div>
      )}

      {selectedProduct && (
        <ProductDrawer
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAdd={(combos, extras, total, qty, meioAMeio, observations) => addToCart(selectedProduct, combos, extras, total, qty, meioAMeio, observations)}
        />
      )}

      {showCart && (
        <CartDrawer
          items={cart}
          serviceMode={settings?.service_mode ?? 'counter'}
          tableNumber={tableNumber}
          restaurantId={restaurantId}
          settings={settings}
          loyaltyConfig={loyaltyConfig}
          loyaltyCustomer={loyaltyCustomer}
          selectedReward={selectedReward}
          loyaltyPhone={loyaltyPhone}
          discount={loyaltyDiscount}
          deliveryInfo={deliveryInfo}
          onDeliveryChange={setDeliveryInfo}
          forceDelivery={forceDelivery}
          onClose={() => setShowCart(false)}
          onUpdateQty={updateCartQty}
          onRemove={removeFromCart}
          onOpenLoyalty={() => { setShowCart(false); setShowLoyaltyModal(true); }}
          onClearLoyalty={clearLoyalty}
          onCheckout={checkout}
          placing={placingOrder}
          checkoutError={checkoutError}
          onOnlinePaid={(createdOrderId: string) => {
            setCart([]);
            setShowCart(false);
            setCurrentOrderId(createdOrderId || pendingOnlineOrderId);
            setPendingOnlineOrderId(null);
            setShowOnlinePayment(false);
          }}
          pendingOrderId={pendingOnlineOrderId}
          onSetPendingOrderId={setPendingOnlineOrderId}
          onSetShowOnlinePay={setShowOnlinePayment}
          onSetOnlinePayMethod={setOnlinePayMethod}
        />
      )}

      {showLoyaltyModal && (
        <LoyaltyBenefitsModal
          restaurantId={restaurantId}
          cartSubtotal={cart.reduce((s, i) => s + i.itemTotal * i.quantity, 0)}
          onClose={() => { setShowLoyaltyModal(false); setShowCart(true); }}
          onConfirm={(phone, name, rewardId, discount) => {
            handleLoyaltyConfirm(phone, name, rewardId, discount);
            setShowCart(true);
          }}
        />
      )}

      {showLoyaltyAuth && loyaltyConfig && (
        <LoyaltyAuthModal
          restaurantId={restaurantId}
          loyaltyConfig={loyaltyConfig}
          onClose={handleLoyaltyDecline}
          onDecline={handleLoyaltyDecline}
          onSuccess={handleLoyaltyAuthSuccess}
        />
      )}

      {showLoyaltyProfile && loyaltyCustomer && loyaltyConfig && (
        <LoyaltyProfileModal
          customer={loyaltyCustomer}
          config={loyaltyConfig}
          restaurantId={restaurantId}
          onClose={() => setShowLoyaltyProfile(false)}
          onLogout={handleLogout}
        />
      )}

      {reorderOrder && (
        <ReorderReviewModal
          order={reorderOrder}
          products={products}
          onConfirm={confirmReorder}
          onClose={() => setReorderOrder(null)}
        />
      )}

      {showWaiterCall && (
        <WaiterCallModal
          tableNumber={tableNumber}
          restaurantId={restaurantId}
          onClose={() => setShowWaiterCall(false)}
        />
      )}

      {showOnlinePayment && pendingOnlineOrderId && onlinePayMethod && restaurantId && (
        <OnlinePaymentModal
          orderId={pendingOnlineOrderId}
          amount={cart.reduce((s, i) => s + i.itemTotal * i.quantity, 0) + (deliveryInfo.mode === 'delivery' ? deliveryInfo.fee : 0) - loyaltyDiscount}
          restaurantId={restaurantId}
          paymentMethod={onlinePayMethod}
          orderData={onlinePayMethod === 'card' ? ((window as Record<string, unknown>).__pendingOrderData as { orderPayload: Record<string, unknown> })?.orderPayload : undefined}
          orderItems={onlinePayMethod === 'card' ? ((window as Record<string, unknown>).__pendingOrderData as { itemsPayload: Record<string, unknown>[] })?.itemsPayload : undefined}
          onClose={() => { setShowOnlinePayment(false); setPendingOnlineOrderId(null); (window as Record<string, unknown>).__pendingOrderData = undefined; }}
          onPaid={(createdOrderId: string) => {
            setCart([]);
            setShowCart(false);
            setShowOnlinePayment(false);
            setCurrentOrderId(createdOrderId || pendingOnlineOrderId);
            setPendingOnlineOrderId(null);
            (window as Record<string, unknown>).__pendingOrderData = undefined;
          }}
        />
      )}
    </div>
  );
}

function ProductCard({ product, allProducts, onClick }: { product: Product; allProducts: Product[]; onClick: () => void }) {
  const isMeioAMeio = !!product.is_meio_a_meio;

  function startingPrice(): number | null {
    if (!isMeioAMeio) return null;
    const cat1 = allProducts.filter(p => p.category_id === product.meio_a_meio_cat_1_id);
    const cat2 = allProducts.filter(p => p.category_id === product.meio_a_meio_cat_2_id);
    if (!cat1.length || !cat2.length) return null;
    const min1 = Math.min(...cat1.map(p => p.price));
    const min2 = Math.min(...cat2.map(p => p.price));
    const rule = product.meio_a_meio_price_rule ?? 'highest';
    if (rule === 'highest') return Math.max(min1, min2);
    if (rule === 'average') return (min1 + min2) / 2;
    return min1 + min2;
  }

  const from = startingPrice();

  return (
    <button
      onClick={onClick}
      className="w-full flex gap-3 bg-slate-800/60 rounded-xl p-3 border border-slate-700/50 hover:border-amber-500/40 hover:bg-slate-800 transition-all text-left active:scale-[0.98] mt-2 first:mt-0"
    >
      {product.image_url && (
        <img src={product.image_url} alt={product.name} className="w-20 h-20 object-cover rounded-xl shrink-0" />
      )}
      <div className="flex-1 min-w-0 py-0.5">
        <p className="font-semibold text-white text-sm leading-tight">{product.name}</p>
        {product.description && (
          <p className="text-slate-400 text-xs mt-1 line-clamp-2 leading-relaxed">{product.description}</p>
        )}
        <div className="flex items-center justify-between mt-2">
          {isMeioAMeio ? (
            <div>
              <p className="text-[10px] text-slate-500 leading-none mb-0.5">a partir de</p>
              <p className="text-amber-400 font-bold text-sm">
                {from !== null ? 'R$ ' + from.toFixed(2).replace('.', ',') : '-'}
              </p>
            </div>
          ) : (
            <p className="text-amber-400 font-bold text-sm">R$ {product.price.toFixed(2).replace('.', ',')}</p>
          )}
          {isMeioAMeio ? (
            <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-medium">MEIO A MEIO</span>
          ) : product.is_combo ? (
            <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-medium">COMBO</span>
          ) : null}
        </div>
      </div>
    </button>
  );
}
