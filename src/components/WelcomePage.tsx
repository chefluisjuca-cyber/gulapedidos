import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { LogIn, KeyRound, Eye, EyeOff, CheckCircle2, AlertCircle, Mail, ArrowLeft } from 'lucide-react';

type Mode = 'welcome' | 'login' | 'forgot' | 'recovery';

export default function WelcomePage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('login');

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('type=recovery') || hash.includes('access_token=')) {
      setMode('recovery');
    }
  }, []);

  if (mode === 'recovery') {
    return <RecoveryForm onDone={() => setMode('login')} />;
  }

  if (mode === 'forgot') {
    return <ForgotForm onBack={() => setMode('login')} />;
  }

  return (
    <LoginForm
      onBack={() => navigate('/')}
      onForgot={() => setMode('forgot')}
      onSuccess={() => navigate(0)}
    />
  );
}

function LoginForm({ onBack, onForgot, onSuccess }: { onBack: () => void; onForgot: () => void; onSuccess: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });

    if (signInError) {
      setError('Email ou senha incorretos.');
      setPassword('');
      setIsLoading(false);
      return;
    }

    // Find the restaurant this user owns
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('slug')
      .eq('owner_email', email.trim().toLowerCase())
      .maybeSingle();

    setIsLoading(false);

    if (restaurant?.slug) {
      navigate(`/${restaurant.slug}/admin`);
    } else {
      // Not a restaurant owner — check if super admin
      const { data: sa } = await supabase
        .from('super_admins')
        .select('id')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();

      if (sa) {
        navigate('/super-adm');
      } else {
        setError('Usuário não vinculado a nenhum restaurante.');
        await supabase.auth.signOut();
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-white backdrop-blur-sm border border-slate-200 rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <img src="/gula-pedidos-digial.png" alt="Gula Pedidos Digital" className="w-24 h-24 object-contain" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-1">Painel Admin</h1>
            <p className="text-slate-500 text-sm">Gula Pedidos Digital</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-slate-600 mb-2">Email</label>
              <input
                type="email"
                id="login-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-all"
                placeholder="admin@restaurante.com"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-slate-600 mb-2">Senha</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  id="login-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 pr-11 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 disabled:from-slate-300 disabled:to-slate-300 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 disabled:shadow-none"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  <span>Entrar</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onForgot}
              className="w-full text-sm text-slate-500 hover:text-amber-600 transition-colors text-center"
            >
              Esqueceu sua senha?
            </button>
          </form>

          <div className="mt-6">
            <button
              onClick={onBack}
              className="w-full flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-amber-600 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ForgotForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const redirectTo = `${window.location.origin}/entrar`;

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });

    setLoading(false);

    if (resetError) {
      setError(resetError.message);
    } else {
      setSent(true);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-white backdrop-blur-sm border border-slate-200 rounded-2xl shadow-xl p-8">
          <div className="text-center mb-6">
            <div className="flex justify-center mb-4">
              <img src="/gula-pedidos-digial.png" alt="Gula Pedidos Digital" className="w-20 h-20 object-contain" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 mb-1">Recuperar Senha</h1>
            <p className="text-slate-500 text-sm">Enviaremos um link para redefinir sua senha</p>
          </div>

          {sent ? (
            <div className="space-y-5">
              <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-emerald-700 text-sm">
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                <span>Enviamos um e-mail com o link de recuperação. Verifique sua caixa de entrada.</span>
              </div>
              <button
                onClick={onBack}
                className="w-full flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-amber-600 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Voltar para o login
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-600 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label htmlFor="forgot-email" className="block text-sm font-medium text-slate-600 mb-2">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    id="forgot-email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    autoFocus
                    className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-all"
                    placeholder="admin@restaurante.com"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 disabled:from-slate-300 disabled:to-slate-300 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 disabled:shadow-none"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <KeyRound className="w-5 h-5" />
                    <span>Enviar Link</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onBack}
                className="w-full flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-amber-600 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Voltar para o login
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function RecoveryForm({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
    } else {
      setDone(true);
      setTimeout(onDone, 3000);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-white backdrop-blur-sm border border-slate-200 rounded-2xl shadow-xl p-8">
          <div className="text-center mb-6">
            <div className="flex justify-center mb-4">
              <img src="/gula-pedidos-digial.png" alt="Gula Pedidos Digital" className="w-20 h-20 object-contain" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 mb-1">Redefinir Senha</h1>
            <p className="text-slate-500 text-sm">Defina uma nova senha para sua conta</p>
          </div>

          {done ? (
            <div className="space-y-5">
              <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-emerald-700 text-sm">
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                <span>Senha redefinida com sucesso! Redirecionando...</span>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-600 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">Nova Senha</label>
                <div className="relative">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    autoFocus
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 pr-11 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-all"
                    placeholder="Mínimo 6 caracteres"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                  >
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">Confirmar Senha</label>
                <div className="relative">
                  <input
                    type={showConfirmPwd ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 pr-11 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-all"
                    placeholder="Repita a senha"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPwd(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                  >
                    {showConfirmPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 disabled:from-slate-300 disabled:to-slate-300 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 disabled:shadow-none"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <KeyRound className="w-5 h-5" />
                    <span>Redefinir Senha</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
