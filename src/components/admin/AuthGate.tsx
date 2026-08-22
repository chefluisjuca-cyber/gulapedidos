import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../lib/tenant-context';
import { User, Session } from '@supabase/supabase-js';
import { LogIn, LogOut, AlertCircle, UserPlus, KeyRound, Eye, EyeOff, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

function SetupForm({ onSuccess, ownerEmail }: { onSuccess: () => void; ownerEmail?: string }) {
  const [email, setEmail] = useState(ownerEmail ?? '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (ownerEmail && email.trim().toLowerCase() !== ownerEmail.toLowerCase()) {
      setError(`Use o e-mail cadastrado para este restaurante: ${ownerEmail}`);
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setIsLoading(true);

    const { error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (signUpError) {
      setError(signUpError.message);
    } else {
      onSuccess();
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-800 rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <img src="/gula-pedidos-digial.png" alt="Gula Pedidos Digital" className="w-24 h-24 object-contain" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">Primeiro Acesso</h1>
            <p className="text-slate-400 text-sm">Crie o usuário administrador</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="setup-email" className="block text-sm font-medium text-slate-300 mb-2">
                Email do Administrador
              </label>
              <input
                type="email"
                id="setup-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                readOnly={!!ownerEmail}
                autoComplete="email"
                className={`w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all ${ownerEmail ? 'opacity-70 cursor-default' : ''}`}
                placeholder="admin@restaurante.com"
              />
              {ownerEmail && (
                <p className="text-xs text-slate-500 mt-1">E-mail definido pelo administrador da plataforma.</p>
              )}
            </div>

            <div>
              <label htmlFor="setup-password" className="block text-sm font-medium text-slate-300 mb-2">
                Senha
              </label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  id="setup-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  minLength={6}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 pr-11 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                  placeholder="Mínimo 6 caracteres"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="setup-confirm" className="block text-sm font-medium text-slate-300 mb-2">
                Confirmar Senha
              </label>
              <div className="relative">
                <input
                  type={showConfirmPwd ? 'text' : 'password'}
                  id="setup-confirm"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 pr-11 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                  placeholder="Repita a senha"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  {showConfirmPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:from-slate-600 disabled:to-slate-600 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 disabled:shadow-none"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <UserPlus className="w-5 h-5" />
                  <span>Criar Admin</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

type LoginView = 'login' | 'forgot';

function LoginForm({ onLogin, onCreateAccount }: { onLogin: () => void; onCreateAccount: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [view, setView] = useState<LoginView>('login');

  // Forgot password state
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError('Email ou senha incorretos');
      setPassword('');
    } else {
      onLogin();
    }
    setIsLoading(false);
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);
    setResetLoading(true);

    const redirectTo = `${window.location.origin}/entrar`;

    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
      redirectTo,
    });

    setResetLoading(false);

    if (error) {
      setResetError(error.message);
    } else {
      setResetSent(true);
    }
  };

  // ── Forgot password view ──
  if (view === 'forgot') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-800 rounded-2xl shadow-2xl p-8">
            <div className="text-center mb-6">
              <div className="flex justify-center mb-4">
                <img src="/gula-pedidos-digial.png" alt="Gula Pedidos Digital" className="w-20 h-20 object-contain" />
              </div>
              <h1 className="text-xl font-bold text-white mb-1">Recuperar Senha</h1>
              <p className="text-slate-400 text-sm">Enviaremos um link para redefinir sua senha</p>
            </div>

            {resetSent ? (
              <div className="space-y-5">
                <div className="flex items-start gap-3 bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3 text-green-400 text-sm">
                  <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                  <span>Enviamos um e-mail com o link de recuperação. Verifique sua caixa de entrada.</span>
                </div>
                <button
                  onClick={() => { setView('login'); setResetSent(false); setResetEmail(''); }}
                  className="w-full flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-amber-400 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Voltar para o login
                </button>
              </div>
            ) : (
              <form onSubmit={handleReset} className="space-y-5">
                {resetError && (
                  <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{resetError}</span>
                  </div>
                )}

                <div>
                  <label htmlFor="reset-email" className="block text-sm font-medium text-slate-300 mb-2">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="email"
                      id="reset-email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      required
                      autoComplete="email"
                      autoFocus
                      className="w-full bg-slate-800/50 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all"
                      placeholder="admin@restaurante.com"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 disabled:from-slate-600 disabled:to-slate-600 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 disabled:shadow-none"
                >
                  {resetLoading ? (
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
                  onClick={() => { setView('login'); setResetError(null); }}
                  className="w-full flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-amber-400 transition-colors"
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

  // ── Login view ──
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-800 rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <img src="/gula-pedidos-digial.png" alt="Gula Pedidos Digital" className="w-24 h-24 object-contain" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">Painel Admin</h1>
            <p className="text-slate-400 text-sm">Gula Pedidos Digital</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all"
                placeholder="admin@restaurante.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
                Senha
              </label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 pr-11 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 disabled:from-slate-600 disabled:to-slate-600 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 disabled:shadow-none"
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
              onClick={() => { setView('forgot'); setResetEmail(email); setResetError(null); }}
              className="w-full text-sm text-slate-400 hover:text-amber-400 transition-colors text-center"
            >
              Esqueceu sua senha?
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={onCreateAccount}
              className="text-sm text-slate-400 hover:text-amber-400 transition-colors"
            >
              Primeiro acesso? Criar conta admin
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const { restaurant } = useTenant();
  const [showLogin, setShowLogin] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (needsSetup) {
    return <SetupForm onSuccess={() => setNeedsSetup(false)} ownerEmail={restaurant?.owner_email} />;
  }

  if (!user || showLogin) {
    return (
      <LoginForm
        onLogin={() => setShowLogin(false)}
        onCreateAccount={() => setNeedsSetup(true)}
      />
    );
  }

  return <>{children}</>;
}
