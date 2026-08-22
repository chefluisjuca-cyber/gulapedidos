import { useState, useEffect, ReactNode } from 'react';
import { useParams, Navigate, Link } from 'react-router-dom';
import { AlertTriangle, ShieldOff, Package, ShieldX, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { TenantContext } from '../lib/tenant-context';
import { Restaurant } from '../types';

interface Props {
  children: ReactNode;
  requiredModule?: string;
  requireOwnership?: boolean;
  bypassPaywall?: boolean;
}

type ErrorType = 'not_found' | 'suspended' | 'no_module' | 'forbidden';

interface ErrorScreenProps {
  type: ErrorType;
  moduleName?: string;
  onSignedOut?: () => void;
}

function ErrorScreen({ type, moduleName, onSignedOut }: ErrorScreenProps) {
  const config = {
    not_found: {
      icon: AlertTriangle,
      iconColor: 'text-red-400',
      bg: 'bg-red-500/10',
      border: 'border-red-500/20',
      title: 'Restaurante não encontrado',
      desc: 'O endereço acessado não corresponde a nenhum estabelecimento cadastrado.',
    },
    suspended: {
      icon: ShieldOff,
      iconColor: 'text-orange-400',
      bg: 'bg-orange-500/10',
      border: 'border-orange-500/20',
      title: 'Acesso suspenso',
      desc: 'O acesso deste estabelecimento está temporariamente suspenso. Entre em contato com o suporte.',
    },
    no_module: {
      icon: Package,
      iconColor: 'text-slate-400',
      bg: 'bg-slate-800',
      border: 'border-slate-700',
      title: 'Módulo não disponível',
      desc: moduleName
        ? `Este estabelecimento não possui o módulo "${moduleName}" ativo. Entre em contato para contratar.`
        : 'Este estabelecimento não possui o módulo solicitado.',
    },
    forbidden: {
      icon: ShieldX,
      iconColor: 'text-red-400',
      bg: 'bg-red-500/10',
      border: 'border-red-500/20',
      title: 'Acesso negado — 403',
      desc: 'Você não tem permissão para acessar o painel deste estabelecimento. Verifique se está logado com a conta correta.',
    },
  }[type];

  const Icon = config.icon;

  async function handleSignOut() {
    await supabase.auth.signOut();
    onSignedOut?.();
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className={`max-w-md w-full ${config.bg} border ${config.border} rounded-2xl p-8 text-center`}>
        <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-5">
          <Icon className={`w-8 h-8 ${config.iconColor}`} />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">{config.title}</h1>
        <p className="text-slate-400 text-sm leading-relaxed">{config.desc}</p>
        {type === 'forbidden' && (
          <button
            onClick={handleSignOut}
            className="mt-6 px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-xl transition-colors"
          >
            Sair e usar outra conta
          </button>
        )}
        <div className="mt-6 flex items-center justify-center gap-2">
          <img src="/gula-pedidos-digial.png" alt="Gula" className="w-6 h-6 object-contain opacity-40" />
          <span className="text-xs text-slate-600">Gula Pedidos Digital</span>
        </div>
      </div>
    </div>
  );
}

const MODULE_LABELS: Record<string, string> = {
  gula_pedidos:    'Gula Pedidos',
  gula_fidelidade: 'Gula Fidelidade',
  gula_etiquetas:  'Gula Etiquetas',
};

export default function TenantGuard({ children, requiredModule, requireOwnership = false, bypassPaywall = false }: Props) {
  const { slug } = useParams<{ slug: string }>();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ErrorType | null>(null);
  const [authTick, setAuthTick] = useState(0);

  // Re-run ownership check whenever auth state changes (login/logout)
  useEffect(() => {
    if (!requireOwnership) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      setAuthTick(n => n + 1);
    });
    return () => subscription.unsubscribe();
  }, [requireOwnership]);

  useEffect(() => {
    if (!slug) { setError('not_found'); setLoading(false); return; }
    let cancelled = false;

    setLoading(true);
    setError(null);
    setRestaurant(null);

    async function load() {
      try {
        const { data } = await supabase
          .from('restaurants')
          .select('*')
          .eq('slug', slug)
          .maybeSingle();

        if (cancelled) return;
        if (!data) { setError('not_found'); setLoading(false); return; }

        const r = data as Restaurant;
        if (r.status === 'suspended') { setError('suspended'); setLoading(false); return; }

        // Paywall: trial expired and not active → redirect to billing
        if (!bypassPaywall && r.status === 'trial' && r.trial_ends_at && new Date() > new Date(r.trial_ends_at)) {
          window.location.href = `/${slug}/etiquetas/faturamento`;
          return;
        }

        // During active trial, all modules are unlocked
        const trialUnlocked =
          r.status === 'trial' && (!r.trial_ends_at || new Date() < new Date(r.trial_ends_at));

        if (requiredModule && !trialUnlocked && !r.modules.includes(requiredModule as never)) {
          setError('no_module'); setLoading(false); return;
        }

        if (requireOwnership) {
          const { data: { user } } = await supabase.auth.getUser();
          if (cancelled) return;
          if (user && user.email !== r.owner_email) {
            // Allow super admins to access any restaurant panel
            const { data: sa } = await supabase.from('super_admins').select('id').eq('email', user.email).maybeSingle();
            if (!sa) {
              setError('forbidden'); setLoading(false); return;
            }
          }
        }

        if (cancelled) return;
        setRestaurant(r);
        setLoading(false);
      } catch {
        if (cancelled) return;
        setError('not_found');
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [slug, requiredModule, requireOwnership, authTick]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorScreen
        type={error}
        moduleName={requiredModule ? MODULE_LABELS[requiredModule] : undefined}
        onSignedOut={() => setAuthTick((n) => n + 1)}
      />
    );
  }

  const trialActive =
    restaurant?.status === 'trial' &&
    (!restaurant?.trial_ends_at || new Date() < new Date(restaurant.trial_ends_at));
  const daysLeft = trialActive && restaurant?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(restaurant!.trial_ends_at!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  return (
    <TenantContext.Provider
      value={{
        restaurant,
        hasModule: (m) => !restaurant || trialActive || restaurant.modules.includes(m as never),
      }}
    >
      {trialActive && !bypassPaywall && (
        <div className="sticky top-0 z-50 bg-amber-500 text-slate-950 px-4 py-2.5 text-sm font-medium flex items-center justify-center gap-2 shadow-md">
          <Clock className="w-4 h-4 flex-shrink-0" />
          <span>
            Atenção: Restam <strong>{daysLeft}</strong> {daysLeft === 1 ? 'dia' : 'dias'} de avaliação do seu sistema. Faça já a ativação do seu produto para não perder o acesso!
          </span>
          <Link
            to={`/${slug}/etiquetas/faturamento`}
            className="ml-2 inline-flex items-center gap-1 bg-slate-950 text-amber-400 px-3 py-1 rounded-md text-xs font-semibold hover:bg-slate-800 transition-colors"
          >
            Ativar agora
          </Link>
        </div>
      )}
      {children}
    </TenantContext.Provider>
  );
}
