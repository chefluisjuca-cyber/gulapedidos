import { useState, useEffect } from 'react';
import { Package, Settings, BarChart3, ArrowLeft, LogIn } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../lib/tenant-context';
import { useAuth } from '../admin/AuthGate';
import { DeliveryMotoboy, DeliveryOrder, DeliverySettings, IfoodOrderIntegration } from '../../types';
import ExpedicaoTab from './ExpedicaoTab';
import ConfigTab from './ConfigTab';
import FechamentoTab from './FechamentoTab';

type Tab = 'expedicao' | 'config' | 'fechamento';

export default function EntregasPanel() {
  const { restaurant } = useTenant();
  const { user, loading: authLoading, signIn } = useAuth();
  const navigate = useNavigate();
  const restaurantId = restaurant?.id ?? null;

  const [tab, setTab] = useState<Tab>('expedicao');
  const [motoboys, setMotoboys] = useState<DeliveryMotoboy[]>([]);
  const [dsettings, setDsettings] = useState<DeliverySettings | null>(null);
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [ifoodOrders, setIfoodOrders] = useState<IfoodOrderIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPwd, setLoginPwd] = useState('');
  const [loginErr, setLoginErr] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  useEffect(() => {
    if (!restaurantId || !user) return;
    loadAll();
    const ordersChannel = supabase.channel('delivery-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_orders',
        filter: `restaurant_id=eq.${restaurantId}` }, loadOrders)
      .subscribe();
    const motoboysChannel = supabase.channel('delivery-motoboys')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'delivery_motoboys',
        filter: `restaurant_id=eq.${restaurantId}` }, loadMotoboys)
      .subscribe();
    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(motoboysChannel);
    };
  }, [restaurantId, user]);

  async function loadAll() {
    setLoading(true);
    await Promise.all([loadOrders(), loadMotoboys(), loadSettings(), loadIfoodOrders()]);
    setLoading(false);
  }

  async function loadOrders() {
    if (!restaurantId) return;
    // Operational day starts at 07:00 — only show orders from today's session
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setHours(7, 0, 0, 0);
    if (now < cutoff) cutoff.setDate(cutoff.getDate() - 1); // before 7AM → use yesterday's 7AM
    const cutoffIso = cutoff.toISOString();

    const { data } = await supabase
      .from('delivery_orders')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .or(`status.in.(pending,dispatched),and(status.eq.delivered,created_at.gte.${cutoffIso})`)
      .order('created_at', { ascending: false });
    if (data) setOrders(data as DeliveryOrder[]);
  }

  async function loadMotoboys() {
    if (!restaurantId) return;
    const { data } = await supabase
      .from('delivery_motoboys')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('active', true)
      .order('name');
    if (data) setMotoboys(data as DeliveryMotoboy[]);
  }

  async function loadSettings() {
    if (!restaurantId) return;
    const { data } = await supabase
      .from('delivery_settings')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .maybeSingle();
    if (data) setDsettings(data as DeliverySettings);
  }

  async function loadIfoodOrders() {
    if (!restaurantId) return;
    const { data } = await supabase
      .from('ifood_orders_integration')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .not('status', 'in', '("DELIVERED","CANCELLED")')
      .order('created_at', { ascending: false });
    if (data) setIfoodOrders(data as IfoodOrderIntegration[]);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginLoading(true);
    setLoginErr('');
    const { error } = await signIn(loginEmail, loginPwd);
    if (error) setLoginErr('E-mail ou senha incorretos.');
    setLoginLoading(false);
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center">
              <Package className="w-5 h-5 text-black" />
            </div>
            <div>
              <h1 className="font-bold text-white">Gula Entregas</h1>
              <p className="text-xs text-slate-400">Acesso restrito ao administrador</p>
            </div>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="email"
              value={loginEmail}
              onChange={e => setLoginEmail(e.target.value)}
              placeholder="E-mail"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
            <input
              type="password"
              value={loginPwd}
              onChange={e => setLoginPwd(e.target.value)}
              placeholder="Senha"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
            {loginErr && <p className="text-xs text-red-400">{loginErr}</p>}
            <button
              type="submit"
              disabled={loginLoading}
              className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              <LogIn className="w-4 h-4" />
              {loginLoading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  const TABS: { id: Tab; label: string; icon: typeof Package }[] = [
    { id: 'expedicao', label: 'Expedição', icon: Package },
    { id: 'config',    label: 'Configurações', icon: Settings },
    { id: 'fechamento', label: 'Fechamento', icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="sticky top-0 z-30 bg-slate-900 border-b border-slate-800 shadow-lg">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => navigate(`/${restaurant?.slug}/admin`)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center">
              <Package className="w-3.5 h-3.5 text-black" />
            </div>
            <span className="font-bold text-white text-sm">Gula Entregas</span>
            <span className="text-[10px] font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded-full">BETA</span>
          </div>
          <nav className="ml-auto flex gap-1">
            {TABS.map(t => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    tab === t.id
                      ? 'bg-amber-500 text-black'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {tab === 'expedicao' && (
          <ExpedicaoTab
            restaurantId={restaurantId}
            orders={orders}
            motoboys={motoboys}
            dsettings={dsettings}
            ifoodOrders={ifoodOrders}
            onRefresh={loadAll}
          />
        )}
        {tab === 'config' && (
          <ConfigTab
            restaurantId={restaurantId}
            motoboys={motoboys}
            dsettings={dsettings}
            onRefresh={loadAll}
          />
        )}
        {tab === 'fechamento' && (
          <FechamentoTab
            restaurantId={restaurantId}
            motoboys={motoboys}
          />
        )}
      </main>
    </div>
  );
}
