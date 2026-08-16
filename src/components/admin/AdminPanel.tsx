import { useState, useEffect } from 'react';
import { ClipboardList, UtensilsCrossed, Settings, Trophy, Tag, LogOut, Bike, Lock, ArrowUpRight, BarChart3, Pause, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SettingsTab from './SettingsTab';
import MenuTab from './MenuTab';
import OrdersKDS from './OrdersKDS';
import LoyaltyTab from './LoyaltyTab';
import EtiquetasTab from './EtiquetasTab';
import GestaoTab from './GestaoTab';
import FeedbackTab from './FeedbackTab';
import { AuthGate, useAuth } from './AuthGate';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../lib/tenant-context';
import { MODULES } from '../../types';
import { PauseRestaurantModal, usePauseState, PauseCountdownBadge } from './PauseRestaurantModal';

type Tab = 'orders' | 'menu' | 'settings' | 'loyalty' | 'etiquetas' | 'gestao' | 'feedback';

function AdminContent() {
  const { hasModule, restaurant } = useTenant();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const restaurantId = restaurant?.id ?? null;

  // For an etiquetas-standalone restaurant (only gula_etiquetas), default to etiquetas tab.
  const isEtiquetasOnly = hasModule(MODULES.GULA_ETIQUETAS) && !hasModule(MODULES.GULA_PEDIDOS);

  const [activeTab, setActiveTabRaw] = useState<Tab>(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash.replace('#', '') : '';
    const saved = typeof window !== 'undefined' ? localStorage.getItem('gula-admin-tab') : null;
    const candidate = (hash || saved) as Tab | null;
    const validTabs: Tab[] = ['orders', 'menu', 'settings', 'loyalty', 'etiquetas', 'gestao'];
    if (candidate && validTabs.includes(candidate)) return candidate;
    return isEtiquetasOnly ? 'etiquetas' : 'orders';
  });
  const [pendingOrders, setPendingOrders] = useState(0);
  const [pendingCalls, setPendingCalls] = useState(0);
  const { pausedUntil, isPaused, showPauseModal, setShowPauseModal } = usePauseState(restaurantId);

  const setActiveTab = (tab: Tab) => {
    setActiveTabRaw(tab);
    try { localStorage.setItem('gula-admin-tab', tab); } catch { /* ignore */ }
    try { history.replaceState(null, '', `#${tab}`); } catch { /* ignore */ }
  };

  useEffect(() => {
    const onHash = () => {
      const h = window.location.hash.replace('#', '') as Tab;
      const validTabs: Tab[] = ['orders', 'menu', 'settings', 'loyalty', 'etiquetas', 'gestao'];
      if (h && validTabs.includes(h) && h !== activeTab) setActiveTabRaw(h);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [activeTab]);

  useEffect(() => {
    fetchBadgeCounts();

    const ordersChannel = supabase
      .channel('admin-badge-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchBadgeCounts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'waiter_calls' }, fetchBadgeCounts)
      .subscribe();

    return () => { supabase.removeChannel(ordersChannel); };
  }, [restaurantId]);

  async function fetchBadgeCounts() {
    const baseOrders = supabase.from('orders').select('id', { count: 'exact' }).in('status', ['pending', 'preparing']);
    const baseCalls = supabase.from('waiter_calls').select('id', { count: 'exact' }).eq('status', 'pending');

    const [ordersRes, callsRes] = await Promise.all([
      restaurantId ? baseOrders.eq('restaurant_id', restaurantId) : baseOrders.is('restaurant_id', null),
      restaurantId ? baseCalls.eq('restaurant_id', restaurantId) : baseCalls.is('restaurant_id', null),
    ]);
    setPendingOrders(ordersRes.count ?? 0);
    setPendingCalls(callsRes.count ?? 0);
  }

  const allTabs = [
    { id: 'orders' as Tab,     label: 'Pedidos',     labelShort: 'Pedidos',   icon: ClipboardList,   badge: pendingOrders + pendingCalls, module: MODULES.GULA_PEDIDOS },
    { id: 'menu' as Tab,       label: 'Cardápio',    labelShort: 'Cardápio',  icon: UtensilsCrossed, badge: 0,                            module: MODULES.GULA_PEDIDOS },
    { id: 'settings' as Tab,   label: 'Config.',     labelShort: 'Config',    icon: Settings,        badge: 0,                            module: MODULES.GULA_PEDIDOS },
    { id: 'loyalty' as Tab,    label: 'Fidelidade',  labelShort: 'Fidelid.',  icon: Trophy,          badge: 0,                            module: MODULES.GULA_FIDELIDADE },
    { id: 'etiquetas' as Tab,  label: 'Etiquetas',   labelShort: 'Etiquetas', icon: Tag,             badge: 0,                            module: MODULES.GULA_ETIQUETAS },
    { id: 'gestao' as Tab,    label: 'Gestão',       labelShort: 'Gestão',     icon: BarChart3,       badge: 0,                            module: MODULES.GULA_PEDIDOS },
    { id: 'feedback' as Tab, label: 'Feedback',     labelShort: 'Feedback',  icon: MessageSquare, badge: 0,                            module: MODULES.GULA_PEDIDOS },
  ];
  const tabs = allTabs.filter(t => hasModule(t.module));

  // Tabs the user doesn't have (locked) — shown only for etiquetas-only restaurants as upgrade hints
  const lockedTabs = isEtiquetasOnly
    ? allTabs.filter(t => !hasModule(t.module))
    : [];

  return (
    <div className="min-h-screen bg-[#0d1f3c] text-white flex flex-col">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="bg-[#0f2040] border-b border-[#1e3868] py-3 shrink-0">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <img src="/gula-pedidos-digial.png" alt="Gula" className="w-9 h-9 object-contain rounded-xl shrink-0" />
            <div className="min-w-0">
              <h1 className="text-base font-bold text-white leading-tight">Painel Admin</h1>
              <p className="text-[11px] text-slate-500 truncate max-w-[160px] sm:max-w-none">
                {user?.email ?? 'Gula Pedidos Digital'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isPaused ? (
              <PauseCountdownBadge pausedUntil={pausedUntil} onClick={() => setShowPauseModal(true)} />
            ) : (
              <button
                onClick={() => setShowPauseModal(true)}
                className="flex items-center gap-1.5 text-slate-400 hover:text-amber-400 text-xs px-3 py-2 rounded-xl hover:bg-[#1a3260] transition-colors"
              >
                <Pause className="w-4 h-4" />
                <span className="hidden sm:inline">Pausar</span>
              </button>
            )}
            <button
              onClick={() => navigate(`/${restaurant?.slug}/entregas`)}
              className="flex items-center gap-1.5 text-slate-400 hover:text-amber-400 text-xs px-3 py-2 rounded-xl hover:bg-[#1a3260] transition-colors"
            >
              <Bike className="w-4 h-4" />
              <span className="hidden sm:inline">Entregas</span>
            </button>
            <button
              onClick={signOut}
              className="flex items-center gap-1.5 text-slate-400 hover:text-white text-xs px-3 py-2 rounded-xl hover:bg-[#1a3260] transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Desktop tab nav (hidden on mobile) ─────────────────────────────── */}
      <nav className="hidden sm:block bg-[#0f2040] border-b border-[#1e3868] shrink-0 overflow-x-auto">
        <div className="max-w-6xl mx-auto px-4 flex gap-0">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
                activeTab === tab.id
                  ? 'text-amber-400 border-amber-400'
                  : 'text-slate-400 border-transparent hover:text-slate-200 hover:border-[#2a4d9a]'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.badge > 0 && (
                <span className="min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
                  {tab.badge > 99 ? '99+' : tab.badge}
                </span>
              )}
            </button>
          ))}
          {lockedTabs.map(tab => (
            <a
              key={tab.id}
              href="/#precos"
              title="Fazer upgrade para desbloquear"
              className="relative flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-600 border-b-2 border-transparent opacity-60 hover:opacity-100 hover:text-slate-400 transition-all whitespace-nowrap"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </a>
          ))}
        </div>
      </nav>

      {showPauseModal && (
        <PauseRestaurantModal
          restaurantId={restaurantId}
          pausedUntil={pausedUntil}
          onClose={() => setShowPauseModal(false)}
        />
      )}

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-auto pb-20 sm:pb-0">
          {activeTab === 'orders'     && <OrdersKDS />}
          {activeTab === 'menu'       && <MenuTab />}
          {activeTab === 'settings'   && <SettingsTab />}
          {activeTab === 'loyalty'    && <LoyaltyTab />}
          {activeTab === 'etiquetas'  && <EtiquetasTab />}
          {activeTab === 'gestao'     && <GestaoTab />}
          {activeTab === 'feedback'   && <FeedbackTab />}
        {/* Etiquetas-only upgrade banner */}
        {isEtiquetasOnly && (
          <div className="m-4 p-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 flex items-center justify-between gap-4">
            <div>
              <p className="text-amber-400 font-semibold text-sm">Quer mais recursos?</p>
              <p className="text-slate-400 text-xs mt-0.5">Faça upgrade para o plano Completo e ganhe Cardápio Digital, Gestão de Pedidos e Fidelidade.</p>
            </div>
            <a
              href="/#precos"
              className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-black px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors"
            >
              <ArrowUpRight size={14} />
              Upgrade
            </a>
          </div>
        )}
      </main>

      {/* ── Mobile bottom nav (hidden on desktop) ───────────────────────────── */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0f2040]/95 backdrop-blur-md border-t border-[#1e3868] flex max-w-6xl mx-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 transition-colors ${
              activeTab === tab.id ? 'text-amber-400' : 'text-slate-500'
            }`}
          >
            <div className="relative">
              <tab.icon className="w-5 h-5" />
              {tab.badge > 0 && (
                <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-1 leading-none">
                  {tab.badge > 99 ? '99+' : tab.badge}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium leading-none">{tab.labelShort}</span>
            {activeTab === tab.id && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-amber-400 rounded-full" />
            )}
          </button>
        ))}
          {lockedTabs.map(tab => (
            <a
              key={tab.id}
              href="/#precos"
              title="Fazer upgrade para desbloquear"
              className="relative flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-slate-700 opacity-60"
            >
              <div className="relative">
                <tab.icon className="w-5 h-5" />
                <Lock className="absolute -bottom-1 -right-1 w-2.5 h-2.5 text-slate-600 bg-slate-900 rounded-full" />
              </div>
              <span className="text-[10px] font-medium leading-none">{tab.labelShort}</span>
            </a>
          ))}
      </nav>
    </div>
  );
}

export default function AdminPanel() {
  return (
    <AuthGate>
      <AdminContent />
    </AuthGate>
  );
}
