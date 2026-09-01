import { useState } from 'react';
import { X, Mail, Lock, User, Trophy, Coins, Percent, Eye, EyeOff, ChevronRight, ArrowLeft, Gift } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { LoyaltyConfig, LoyaltyCustomer, LoyaltyReward } from '../../types';

interface Props {
  restaurantId: string | null;
  loyaltyConfig: LoyaltyConfig;
  rewards?: LoyaltyReward[];
  onClose: () => void;
  onDecline: () => void;
  onSuccess: (customer: LoyaltyCustomer) => void;
}

type Step = 'welcome' | 'form' | 'forgot';
type Mode = 'signup' | 'login';

export default function LoyaltyAuthModal({ restaurantId, loyaltyConfig, rewards = [], onClose, onDecline, onSuccess }: Props) {
  const [step, setStep] = useState<Step>('welcome');
  const [mode, setMode] = useState<Mode>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);

  const isPoints = loyaltyConfig.tipo_promocao === 'pontos_por_real';

  async function createOrLoadCustomer(authUserId: string, userEmail: string, displayName?: string) {
    const q = supabase.from('loyalty_customers').select('*').eq('auth_user_id', authUserId);
    const { data: existing } = await (restaurantId
      ? q.eq('restaurant_id', restaurantId)
      : q.is('restaurant_id', null)
    ).maybeSingle();

    if (existing) { onSuccess(existing as LoyaltyCustomer); return; }

    const { data: created, error: insertErr } = await supabase
      .from('loyalty_customers')
      .insert({
        nome: displayName?.trim() || null,
        email: userEmail.toLowerCase(),
        auth_user_id: authUserId,
        phone: null,
        saldo_pontos: 0,
        saldo_cashback: 0,
        total_visitas: 0,
        historico_transacoes: [],
        ...(restaurantId ? { restaurant_id: restaurantId } : {}),
      })
      .select()
      .maybeSingle();

    if (insertErr) { setError(`Erro ao criar perfil: ${insertErr.message}`); return; }
    if (created) onSuccess(created as LoyaltyCustomer);
    else setError('Conta criada! Faça login para continuar.');
  }

  async function handleSubmit() {
    setError('');
    if (!email.trim() || !password) { setError('Preencha e-mail e senha.'); return; }
    if (mode === 'signup' && !name.trim()) { setError('Informe seu nome.'); return; }
    if (password.length < 6) { setError('A senha deve ter pelo menos 6 caracteres.'); return; }
    setLoading(true);

    if (mode === 'signup') {
      const { data, error: authErr } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
      });
      if (authErr || !data.user) {
        setError(
          authErr?.message?.toLowerCase().includes('already')
            ? 'E-mail já cadastrado. Use a aba "Já tenho conta".'
            : (authErr?.message ?? 'Erro ao criar conta.')
        );
        setLoading(false);
        return;
      }
      await createOrLoadCustomer(data.user.id, data.user.email!, name);
    } else {
      const { data, error: authErr } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (authErr || !data.user) {
        setError('E-mail ou senha incorretos.');
        setLoading(false);
        return;
      }
      await createOrLoadCustomer(data.user.id, data.user.email!);
    }
    setLoading(false);
  }

  // ─── Shared bottom-sheet shell ────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onDecline} />

      <div className="relative bg-white rounded-t-3xl shadow-2xl overflow-hidden">

        {/* Top accent bar */}
        <div className={`h-1.5 w-full ${isPoints ? 'bg-gradient-to-r from-amber-400 to-orange-500' : 'bg-gradient-to-r from-green-400 to-emerald-500'}`} />

        {/* ── WELCOME STEP ─────────────────────────────────────────────────── */}
        {step === 'welcome' && (
          <>
            <div className="flex items-start justify-between px-5 pt-5 pb-1">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isPoints ? 'bg-amber-100' : 'bg-green-100'}`}>
                  <Trophy className={`w-5 h-5 ${isPoints ? 'text-amber-600' : 'text-green-600'}`} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Programa de Fidelidade</h2>
                  <p className="text-xs text-gray-500">Deseja participar?</p>
                </div>
              </div>
              <button
                onClick={onDecline}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors mt-0.5 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-3">
              {/* Benefit card */}
              <div className={`rounded-2xl p-4 flex items-center gap-3 ${isPoints ? 'bg-amber-50 border border-amber-200' : 'bg-green-50 border border-green-200'}`}>
                {isPoints
                  ? <Coins className="w-8 h-8 text-amber-500 shrink-0" />
                  : <Percent className="w-8 h-8 text-green-500 shrink-0" />
                }
                <div>
                  <p className="font-bold text-gray-900 text-sm">
                    {isPoints
                      ? `${loyaltyConfig.valor_conversao} ponto${Number(loyaltyConfig.valor_conversao) !== 1 ? 's' : ''} por R$ 1,00 gasto`
                      : `${loyaltyConfig.valor_conversao}% de cashback em cada pedido`
                    }
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">Cadastro gratuito, troca por descontos</p>
                </div>
              </div>

              {rewards.length > 0 && (
                <p className="text-xs text-gray-400 flex items-center gap-1.5">
                  <Gift className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  {rewards.length} recompensa{rewards.length > 1 ? 's' : ''} disponível{rewards.length > 1 ? 'is' : ''} para resgate
                </p>
              )}
            </div>

            <div className="px-5 pb-8 space-y-2">
              <button
                onClick={() => setStep('form')}
                className={`w-full font-bold py-4 rounded-2xl transition-colors text-white flex items-center justify-center gap-2 ${isPoints ? 'bg-amber-500 hover:bg-amber-400' : 'bg-green-500 hover:bg-green-400'}`}
              >
                Sim, quero participar!
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={onDecline}
                className="w-full text-sm text-gray-400 hover:text-gray-600 py-2.5 transition-colors"
              >
                Não, obrigado — continuar sem participar
              </button>
            </div>
          </>
        )}

        {/* ── FORM STEP ────────────────────────────────────────────────────── */}
        {step === 'form' && (
          <div className="max-h-[85vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setStep('welcome')}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isPoints ? 'bg-amber-100' : 'bg-green-100'}`}>
                  <Trophy className={`w-4 h-4 ${isPoints ? 'text-amber-600' : 'text-green-600'}`} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-900">Criar sua conta</h2>
                  <p className="text-[11px] text-gray-500">Gratuito • leva menos de 1 minuto</p>
                </div>
              </div>
              <button onClick={onDecline} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex mx-5 mt-4 bg-gray-100 rounded-xl p-1">
              <button
                onClick={() => { setMode('signup'); setError(''); }}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${mode === 'signup' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
              >
                Criar conta
              </button>
              <button
                onClick={() => { setMode('login'); setError(''); }}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${mode === 'login' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
              >
                Já tenho conta
              </button>
            </div>

            {/* Fields */}
            <div className="px-5 py-4 space-y-3">
              {mode === 'signup' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Nome completo</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      autoFocus
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Seu nome"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-amber-400 transition-colors"
                    />
                  </div>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">E-mail</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    autoFocus={mode === 'login'}
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-amber-400 transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Senha</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                    placeholder={mode === 'signup' ? 'Mínimo 6 caracteres' : 'Sua senha'}
                    className="w-full pl-10 pr-10 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-amber-400 transition-colors"
                  />
                  <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">{error}</p>
              )}
              {mode === 'login' && (
                <button
                  onClick={() => { setStep('forgot'); setError(''); setResetSent(false); }}
                  className="text-xs text-amber-500 hover:text-amber-600 font-semibold transition-colors w-full text-right"
                >
                  Esqueci minha senha
                </button>
              )}
            </div>

            <div className="px-5 pb-8 pt-2">
              <button
                disabled={loading}
                onClick={handleSubmit}
                className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-white font-bold py-4 rounded-2xl transition-colors flex items-center justify-center gap-2"
              >
                {loading
                  ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : (<>{mode === 'signup' ? 'Criar minha conta' : 'Entrar'}<ChevronRight className="w-4 h-4" /></>)
                }
              </button>
            </div>
          </div>
        )}

        {/* ── FORGOT PASSWORD STEP ─────────────────────────────────────────────── */}
        {step === 'forgot' && (
          <div className="max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setStep('form'); setError(''); }}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <h2 className="text-sm font-bold text-gray-900">Redefinir Senha</h2>
                  <p className="text-[11px] text-gray-500">Enviaremos um link para seu e-mail</p>
                </div>
              </div>
              <button onClick={onDecline} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-3">
              {resetSent ? (
                <div className="text-center py-6 space-y-3">
                  <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                    <Mail className="w-7 h-7 text-green-600" />
                  </div>
                  <p className="text-sm font-semibold text-gray-900">Verifique seu e-mail</p>
                  <p className="text-xs text-gray-500">Enviamos um link de redefinição de senha para <span className="font-semibold text-gray-700">{resetEmail}</span>. Clique no link recebido para criar uma nova senha.</p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">E-mail cadastrado</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="email"
                        autoFocus
                        value={resetEmail}
                        onChange={e => setResetEmail(e.target.value)}
                        placeholder="seu@email.com"
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-amber-400 transition-colors"
                      />
                    </div>
                  </div>
                  {error && (
                    <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">{error}</p>
                  )}
                </>
              )}
            </div>

            {!resetSent && (
              <div className="px-5 pb-8 pt-2">
                <button
                  disabled={loading}
                  onClick={async () => {
                    setError('');
                    if (!resetEmail.trim()) { setError('Informe seu e-mail.'); return; }
                    setLoading(true);
                    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(resetEmail.trim().toLowerCase());
                    setLoading(false);
                    if (resetErr) { setError('Erro ao enviar e-mail. Verifique o endereço.'); return; }
                    setResetSent(true);
                  }}
                  className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-white font-bold py-4 rounded-2xl transition-colors flex items-center justify-center gap-2"
                >
                  {loading
                    ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <>Enviar Link de Redefinição<ChevronRight className="w-4 h-4" /></>
                  }
                </button>
              </div>
            )}
            {resetSent && (
              <div className="px-5 pb-8">
                <button
                  onClick={() => { setStep('form'); setResetSent(false); }}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-4 rounded-2xl transition-colors"
                >
                  Voltar para Login
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
