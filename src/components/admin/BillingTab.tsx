import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Check, Clock, Lock, Loader2, ArrowLeft, Sparkles, Zap, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { PLANS, Restaurant, RestaurantPlan, PlanVariant, BillingCycle, PLAN_TYPE_BY_PLAN, MP_CYCLE_BY_BILLING } from '../../types';

const MODULE_LABELS: Record<string, string> = {
  gula_pedidos: 'Gula Pedidos',
  gula_fidelidade: 'Gula Fidelidade',
  gula_etiquetas: 'Gula Etiquetas',
};

const SUBSCRIPTION_STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  trialing: { label: 'Em teste grátis', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  active: { label: 'Ativa', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  past_due: { label: 'Pagamento pendente', cls: 'bg-red-500/15 text-red-300 border-red-500/30' },
  canceled: { label: 'Cancelada', cls: 'bg-slate-500/15 text-slate-300 border-slate-500/30' },
};

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function cycleSuffix(cycle: string) {
  if (cycle === 'mensal') return '/mês';
  if (cycle === 'anual') return '/ano';
  return '';
}

function daysRemaining(trialEndsAt: string | null): number | null {
  if (!trialEndsAt) return null;
  const now = new Date();
  const end = new Date(trialEndsAt);
  const diff = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

type Tier = 'promo' | 'regular';

export default function BillingTab() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState<string | null>(null);
  const [canceling, setCanceling] = useState(false);
  const [tier, setTier] = useState<Tier>('promo');

  useEffect(() => {
    if (!slug) return;
    supabase
      .from('restaurants')
      .select('*')
      .eq('slug', slug)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setRestaurant(data as Restaurant);
        setLoading(false);
      });
  }, [slug]);

  async function handleSubscribe(planId: RestaurantPlan, cycle: BillingCycle) {
    if (!slug || !restaurant) return;
    const key = `${planId}-${cycle}`;
    setRedirecting(key);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-mp-subscription`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          restaurant_id: restaurant.id,
          plan_type: PLAN_TYPE_BY_PLAN[planId],
          billing_cycle: MP_CYCLE_BY_BILLING[cycle],
          payer_email: restaurant.owner_email,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error ?? `Falha ao iniciar checkout (${res.status})`);
      }
      const data = await res.json();
      if (data.init_point) {
        window.location.href = data.init_point;
        return;
      }
      throw new Error('URL de checkout não retornada');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao redirecionar para o pagamento');
      setRedirecting(null);
    }
  }

  async function handleCancelSubscription() {
    if (!restaurant || !slug) return;
    if (!confirm('Deseja realmente cancelar sua assinatura? O acesso ao sistema será encerrado.')) return;
    setCanceling(true);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mp-cancel-subscription`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ restaurant_id: restaurant.id }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error ?? `Falha ao cancelar (${res.status})`);
      }
      setRestaurant({ ...restaurant, subscription_status: 'canceled', status: 'suspended' });
      alert('Assinatura cancelada com sucesso.');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao cancelar assinatura');
    } finally {
      setCanceling(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <p className="text-slate-400">Restaurante não encontrado.</p>
      </div>
    );
  }

  const trialExpired =
    restaurant.status === 'trial' &&
    restaurant.trial_ends_at &&
    new Date() > new Date(restaurant.trial_ends_at);

  const daysLeft = daysRemaining(restaurant.trial_ends_at);
  const isTrialActive = restaurant.status === 'trial' && daysLeft !== null && daysLeft > 0;

  const hasMultipleVariants = PLANS.some((p) => p.variants.length > 1);
  const hasSubscription = !!restaurant.mp_preapproval_id;
  const subStatus = SUBSCRIPTION_STATUS_LABELS[restaurant.subscription_status ?? ''];
  const periodEnd = restaurant.current_period_end
    ? new Date(restaurant.current_period_end).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : null;
  const cycleLabel: Record<string, string> = { monthly: 'Mensal', semiannual: 'Semestral', annual: 'Anual' };

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate(`/${slug}/etiquetas`)}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-white">Faturamento</h1>
            <p className="text-xs text-slate-500">{restaurant.name}</p>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Trial expired warning */}
        {trialExpired && (
          <div className="mb-8 rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-7 h-7 text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Período de teste encerrado</h2>
            <p className="text-slate-400 text-sm max-w-md mx-auto">
              Seus 7 dias de avaliação terminaram. Escolha um plano abaixo para reativar
              o acesso ao sistema e continuar usando o Gula Pedidos.
            </p>
          </div>
        )}

        {/* Trial active info */}
        {isTrialActive && (
          <div className="mb-8 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
              <Clock className="w-7 h-7 text-amber-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">
              Restam {daysLeft} {daysLeft === 1 ? 'dia' : 'dias'} de avaliação
            </h2>
            <p className="text-slate-400 text-sm max-w-md mx-auto">
              Faça já a ativação do seu produto para não perder o acesso ao final do período de teste.
            </p>
          </div>
        )}

        {/* Active plan */}
        {restaurant.status === 'active' && restaurant.plan && (
          <div className="mb-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <Check className="w-7 h-7 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-1">Plano ativo</h2>
            <p className="text-slate-400 text-sm">
              {PLANS.find((p) => p.id === restaurant.plan)?.name ?? 'Plano contratado'}
            </p>
          </div>
        )}

        {/* Mercado Pago subscription status */}
        {hasSubscription && (
          <div className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5 mb-2">
                  <h2 className="text-base font-bold text-white">Assinatura Mercado Pago</h2>
                  {subStatus && (
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${subStatus.cls}`}>
                      {subStatus.label}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  {restaurant.plan_type && `Plano: ${restaurant.plan_type}`}
                  {restaurant.billing_cycle && ` • Ciclo: ${cycleLabel[restaurant.billing_cycle] ?? restaurant.billing_cycle}`}
                  {periodEnd && ` • Próxima renovação: ${periodEnd}`}
                </p>
              </div>
              {restaurant.subscription_status !== 'canceled' && (
                <button
                  onClick={handleCancelSubscription}
                  disabled={canceling}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-500/10 border border-red-500/30 text-red-300 hover:bg-red-500/20 transition-all disabled:opacity-50 shrink-0"
                >
                  {canceling ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                  Cancelar Assinatura
                </button>
              )}
            </div>
          </div>
        )}

        {/* Tier toggle */}
        {hasMultipleVariants && (
          <div className="flex justify-center mb-8">
            <div className="inline-flex rounded-xl border border-slate-800 bg-slate-900/50 p-1">
              <button
                onClick={() => setTier('promo')}
                className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                  tier === 'promo'
                    ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Zap className="w-4 h-4" />
                  Promocional
                </span>
              </button>
              <button
                onClick={() => setTier('regular')}
                className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                  tier === 'regular'
                    ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Regular
              </button>
            </div>
          </div>
        )}

        {/* Plans */}
        <div className="grid gap-6 md:grid-cols-3">
          {PLANS.map((plan) => {
            const isCurrent = restaurant.plan === plan.id && restaurant.status === 'active';
            const variant: PlanVariant | undefined =
              plan.variants.find((v) => v.tier === tier) ?? plan.variants[0];

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl border p-6 flex flex-col ${
                  isCurrent
                    ? 'border-emerald-500/40 bg-emerald-500/5'
                    : 'border-slate-800 bg-slate-900/50'
                }`}
              >
                {tier === 'promo' && variant?.tier === 'promo' && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 text-white text-xs font-bold shadow-lg shadow-amber-500/30">
                      <Zap className="w-3 h-3" />
                      Oferta
                    </span>
                  </div>
                )}

                <h3 className="text-base font-bold text-white mb-1">{plan.name}</h3>
                <p className="text-xs text-slate-500 mb-4">{plan.tagline}</p>

                {/* Features */}
                <ul className="space-y-2 mb-5">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2 text-sm text-slate-300">
                      <Check className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                      {feat}
                    </li>
                  ))}
                </ul>

                {/* Modules */}
                <div className="flex flex-wrap gap-1.5 mb-5">
                  {plan.modules.map((m) => (
                    <span
                      key={m}
                      className="inline-flex items-center gap-1 text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded-md"
                    >
                      <Check className="w-3 h-3 text-emerald-400" />
                      {MODULE_LABELS[m] ?? m}
                    </span>
                  ))}
                </div>

                {/* Prices */}
                <div className="space-y-2.5 mt-auto">
                  {variant?.prices.map((price) => {
                    const key = `${plan.id}-${price.cycle}`;
                    return (
                      <button
                        key={price.cycle}
                        disabled={isCurrent || redirecting !== null}
                        onClick={() => handleSubscribe(plan.id, price.cycle)}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                          isCurrent
                            ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                            : redirecting === key
                            ? 'bg-amber-500/20 text-amber-300 cursor-wait'
                            : 'bg-amber-500 hover:bg-amber-400 text-slate-950 hover:shadow-lg hover:shadow-amber-500/20'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          {redirecting === key ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : isCurrent ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Sparkles className="w-4 h-4" />
                          )}
                          {price.label}
                        </span>
                        <span>
                          {formatBRL(price.price)}
                          {cycleSuffix(price.cycle) && (
                            <span className="text-xs opacity-70">{cycleSuffix(price.cycle)}</span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {isCurrent && (
                  <p className="text-center text-xs text-emerald-400 mt-3">Plano atualmente ativo</p>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-center text-xs text-slate-600 mt-8">
          Pagamento processado com segurança via Mercado Pago. Cancele quando quiser.
        </p>
      </div>
    </div>
  );
}
