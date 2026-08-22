import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Store, Mail, Phone, KeyRound, Eye, EyeOff, ArrowLeft, ArrowRight,
  CheckCircle2, AlertCircle, Loader2, Copy, ExternalLink, Sparkles,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { RestaurantPlan } from '../types';

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

interface SignupResult {
  slug: string;
  name: string;
}

export default function SelfSignup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialPlan = (searchParams.get('plan') as RestaurantPlan | null);
  const [mode, setMode] = useState<'form' | 'login' | 'success'>('form');
  const [result, setResult] = useState<SignupResult | null>(null);

  if (mode === 'login') {
    return <LoginView onBack={() => setMode('form')} onSuccess={() => navigate(0)} />;
  }
  if (mode === 'success' && result) {
    return <SuccessView slug={result.slug} name={result.name} plan={initialPlan ?? 'essencial'} onGoAdmin={() => navigate(initialPlan === 'gula_etiquetas_standalone' ? `/${result.slug}/etiquetas` : `/${result.slug}/admin`)} />;
  }
  return <SignupForm initialPlan={initialPlan ?? 'essencial'} onBack={() => navigate('/')} onGoLogin={() => setMode('login')} onDone={(r) => { setResult(r); setMode('success'); }} />;
}

// ── Signup Form ──────────────────────────────────────────────────────────────
function SignupForm({ initialPlan, onBack, onGoLogin, onDone }: {
  initialPlan: RestaurantPlan;
  onBack: () => void;
  onGoLogin: () => void;
  onDone: (r: SignupResult) => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManual, setSlugManual] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan] = useState<RestaurantPlan>(initialPlan);

  function handleNameChange(v: string) {
    setName(v);
    if (!slugManual) setSlug(slugify(v));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !email.trim() || !slug.trim()) { setError('Preencha todos os campos obrigatórios.'); return; }
    if (password.length < 6) { setError('A senha deve ter pelo menos 6 caracteres.'); return; }
    if (password !== confirm) { setError('As senhas não coincidem.'); return; }

    setLoading(true);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/restaurant-signup`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password, phone: phone.trim(), slug: slug.trim(), plan }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? 'Erro ao cadastrar. Tente novamente.');
        setLoading(false);
        return;
      }
      onDone({ slug: data.restaurant.slug, name: data.restaurant.name });
    } catch {
      setError('Erro de conexão. Tente novamente.');
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-40 -left-40 w-96 h-96 bg-amber-200/40 rounded-full blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 w-96 h-96 bg-orange-200/40 rounded-full blur-3xl" />

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <img src="/gula-pedidos-digial.png" alt="Gula Pedidos Digital" className="w-16 h-16 object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Crie sua conta</h1>
          <p className="text-slate-500 text-sm mt-1">7 dias grátis, sem cartão de crédito</p>
          <p className="text-amber-600 text-xs mt-2 font-medium">
            Plano selecionado: {plan === 'essencial' ? 'Essencial' : plan === 'pedidos_fidelidade' ? 'Profissional' : 'Premium'}
          </p>
        </div>

        <div className="bg-white backdrop-blur-sm border border-slate-200 rounded-2xl shadow-xl p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <Field label="Nome do Restaurante *" icon={Store}>
              <input
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                required
                autoFocus
                className={inputCls('pl-10')}
                placeholder="Ex: Pizzaria do Zé"
              />
            </Field>

            <Field label="E-mail do Responsável *" icon={Mail}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className={inputCls('pl-10')}
                placeholder="dono@restaurante.com"
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Telefone / WhatsApp" icon={Phone}>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={inputCls('pl-10')}
                  placeholder="(11) 99999-9999"
                />
              </Field>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Endereço de acesso (slug) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">/</span>
                  <input
                    value={slug}
                    onChange={(e) => { setSlug(e.target.value); setSlugManual(true); }}
                    required
                    className={inputCls('pl-6')}
                    placeholder="pizzaria-do-ze"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Senha *</label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    className={inputCls('pl-10 pr-10')}
                    placeholder="Mín. 6 caracteres"
                  />
                  <button type="button" onClick={() => setShowPwd((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors">
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Confirmar Senha *</label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    className={inputCls('pl-10')}
                    placeholder="Repita a senha"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 disabled:from-slate-300 disabled:to-slate-300 text-white font-semibold py-3.5 px-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 disabled:shadow-none"
            >
              {loading ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Criando conta...</>
              ) : (
                <><Sparkles className="w-5 h-5" /> Comece Agora — 7 Dias Grátis</>
              )}
            </button>
          </form>

          <div className="mt-5 pt-5 border-t border-slate-200 space-y-3">
            <button onClick={onGoLogin} className="w-full text-sm text-slate-500 hover:text-amber-600 transition-colors text-center">
              Já tem uma conta? Acessar painel
            </button>
            <button onClick={onBack} className="w-full flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Voltar para a página inicial
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Success View ─────────────────────────────────────────────────────────────
function SuccessView({ slug, name, plan, onGoAdmin }: { slug: string; name: string; plan: RestaurantPlan; onGoAdmin: () => void }) {
  const isAdminEtiquetas = plan === 'gula_etiquetas_standalone';
  const adminUrl = `${window.location.origin}/${slug}/${isAdminEtiquetas ? 'etiquetas' : 'admin'}`;
  const menuUrl = `${window.location.origin}/${slug}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-40 -left-40 w-96 h-96 bg-emerald-200/40 rounded-full blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 w-96 h-96 bg-amber-200/40 rounded-full blur-3xl" />

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Conta criada com sucesso!</h1>
          <p className="text-slate-500 text-sm mt-1">
            Bem-vindo, <span className="text-slate-900 font-medium">{name}</span>! Seus 7 dias de teste já estão ativos.
          </p>
        </div>

        <div className="bg-white backdrop-blur-sm border border-slate-200 rounded-2xl shadow-xl p-6 space-y-5">
          <CopyUrlField label="URL do Painel de Etiquetas" url={adminUrl} />
          {!isAdminEtiquetas && <CopyUrlField label="URL do Cardápio Público" url={menuUrl} />}

          <button
            onClick={onGoAdmin}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold py-3.5 px-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25"
          >
            Acessar meu painel de etiquetas <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function CopyUrlField({ label, url }: { label: string; url: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1.5">{label}</label>
      <div className="flex gap-2">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-amber-500 transition-colors"
        />
        <button
          onClick={copy}
          className={`shrink-0 inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2.5 rounded-xl border transition-all ${
            copied
              ? 'bg-emerald-50 border-emerald-300 text-emerald-600'
              : 'bg-white border-slate-300 text-slate-600 hover:border-amber-500 hover:text-amber-600'
          }`}
        >
          {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? 'Copiado!' : 'Copiar'}
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2.5 rounded-xl border bg-white border-slate-300 text-slate-600 hover:border-amber-500 hover:text-amber-600 transition-all"
          title="Abrir em nova aba"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}

// ── Login View ───────────────────────────────────────────────────────────────
function LoginView({ onBack, onSuccess }: { onBack: () => void; onSuccess: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (signInError) { setError('Email ou senha incorretos.'); setPassword(''); setLoading(false); return; }

    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('slug')
      .eq('owner_email', email.trim().toLowerCase())
      .maybeSingle();
    setLoading(false);
    if (restaurant?.slug) { navigate(`/${restaurant.slug}/admin`); return; }

    const { data: sa } = await supabase.from('super_admins').select('id').eq('email', email.trim().toLowerCase()).maybeSingle();
    if (sa) { navigate('/super-adm'); return; }

    setError('Usuário não vinculado a nenhum restaurante.');
    await supabase.auth.signOut();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-40 -left-40 w-96 h-96 bg-amber-200/40 rounded-full blur-3xl" />
      <div className="relative z-10 w-full max-w-sm">
        <div className="bg-white backdrop-blur-sm border border-slate-200 rounded-2xl shadow-xl p-8">
          <div className="text-center mb-6">
            <div className="flex justify-center mb-4">
              <img src="/gula-pedidos-digial.png" alt="Gula Pedidos Digital" className="w-20 h-20 object-contain" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Acessar Painel</h1>
            <p className="text-slate-500 text-sm mt-1">Gula Pedidos Digital</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
              </div>
            )}
            <Field label="E-mail" icon={Mail}>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus autoComplete="email" className={inputCls('pl-10')} placeholder="dono@restaurante.com" />
            </Field>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Senha</label>
              <div className="relative">
                <input type={showPwd ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" className={inputCls('pr-10')} placeholder="••••••••" />
                <button type="button" onClick={() => setShowPwd((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors">
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Entrar</>}
            </button>
          </form>
          <button onClick={onBack} className="mt-5 w-full flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-amber-600 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Shared ───────────────────────────────────────────────────────────────────
function inputCls(extra = '') {
  return `w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-all text-sm ${extra}`;
}

function Field({ label, icon: Icon, children }: { label: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1.5">{label}</label>
      <div className="relative">{children}<Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" /></div>
    </div>
  );
}
