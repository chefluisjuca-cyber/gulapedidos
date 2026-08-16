import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Check, Clock, Lock, Loader2, ArrowLeft, Sparkles, Zap } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { PLANS, Restaurant, RestaurantPlan, PlanVariant } from '../../types';

const MODULE_LABELS: Record<string, string> = {
  gula_pedidos: 'Gula Pedidos',
  gula_fidelidade: 'Gula Fidelidade',
  gula_etiquetas: 'Gula Etiquetas',
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

  async function handleSubscribe(planId: RestaurantPlan, priceId: string) {
    if (!slug) return;
    setRedirecting(priceId);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-checkout`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ price_id: priceId, slug, customer_email: restaurant?.owner_email }),
      });
      if (!res.ok) throw new Error(`Falha ao iniciar checkout (${res.status})`);
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error('URL de checkout não retornada');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao redirecionar para o pagamento');
      setRedirecting(null);
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
                  {variant?.prices.map((price) => (
                    <button
                      key={price.stripe_price_id}
                      disabled={isCurrent || redirecting !== null}
                      onClick={() => handleSubscribe(plan.id, price.stripe_price_id)}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                        isCurrent
                          ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          : redirecting === price.stripe_price_id
                          ? 'bg-amber-500/20 text-amber-300 cursor-wait'
                          : 'bg-amber-500 hover:bg-amber-400 text-slate-950 hover:shadow-lg hover:shadow-amber-500/20'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {redirecting === price.stripe_price_id ? (
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
                  ))}
                </div>
                {isCurrent && (
                  <p className="text-center text-xs text-emerald-400 mt-3">Plano atualmente ativo</p>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-center text-xs text-slate-600 mt-8">
          Pagamento processado com segurança via Stripe. Cancele quando quiser.
        </p>
      </div>
    </div>
  );
}
