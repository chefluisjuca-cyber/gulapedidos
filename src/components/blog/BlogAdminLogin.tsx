import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LogIn, AlertCircle, Eye, EyeOff, ArrowLeft, ShieldCheck } from 'lucide-react';
import { useAuth } from '../admin/AuthGate';
import { supabase } from '../../lib/supabase';

export default function BlogAdminLogin() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await signIn(email.trim(), password);
    if (error) {
      setError('Email ou senha incorretos');
      setPassword('');
      setLoading(false);
      return;
    }
    // Verify super admin access
    const { data: sa } = await supabase.from('super_admins').select('id').eq('email', email.trim().toLowerCase()).maybeSingle();
    if (!sa) {
      await supabase.auth.signOut();
      setError('Você não tem permissão de administrador master.');
      setLoading(false);
      return;
    }
    navigate('/admin/dashboard');
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-800 rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <img src="/gula-pedidos-digial.png" alt="Gula Pedidos" className="w-20 h-20 object-contain" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">Blog CMS</h1>
            <p className="text-slate-400 text-sm flex items-center justify-center gap-1.5"><ShieldCheck className="w-4 h-4 text-orange-400" /> Acesso restrito ao administrador master</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">Email</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
                autoComplete="email"
                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all"
                placeholder="admin@gulapedidos.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">Senha</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  id="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 pr-11 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all"
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
              disabled={loading}
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:from-slate-600 disabled:to-slate-600 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25 disabled:shadow-none"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <><LogIn className="w-5 h-5" /><span>Entrar</span></>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link to="/blog" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-orange-400 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Voltar para o Blog
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
