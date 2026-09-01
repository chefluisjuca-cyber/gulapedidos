import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams, useNavigate, useLocation } from 'react-router-dom';
import AdminPanel from './components/admin/AdminPanel';
import CustomerPanel from './components/customer/CustomerPanel';
import KitchenKDS from './components/kitchen/KitchenKDS';
import SuperAdminPanel from './components/superadmin/SuperAdminPanel';
import EntregasPanel from './components/entregas/EntregasPanel';
import MotoboyCelularView from './components/motoboy/MotoboyCelularView';
import FeedbackSurvey from './components/feedback/FeedbackSurvey';
import BillingTab from './components/admin/BillingTab';
import LandingPage from './components/LandingPage';
import TutorialsPage from './components/TutorialsPage';
import EtiquetasLanding from './components/EtiquetasLanding';
import SelfSignup from './components/SelfSignup';
import WelcomePage from './components/WelcomePage';
import TenantGuard from './components/TenantGuard';
import PwaInstallPrompt from './components/PwaInstallPrompt';
import BlogListPage from './components/blog/BlogListPage';
import BlogAdminLogin from './components/blog/BlogAdminLogin';
import BlogAdminDashboard from './components/blog/BlogAdminDashboard';
import BlogAdminEditor from './components/blog/BlogAdminEditor';
import { AuthProvider, useAuth } from './components/admin/AuthGate';
import { supabase } from './lib/supabase';
import { MODULES } from './types';
import { AlertCircle } from 'lucide-react';

function getBasename(): string {
  const path = window.location.pathname;
  if (!path.startsWith('/~/')) return '/';
  const thirdSlash = path.indexOf('/', 3);
  return thirdSlash === -1 ? path : path.slice(0, thirdSlash);
}

function PageTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    const p = pathname;
    let title = 'Gula';
    if (p.includes('/admin'))          title = 'Gula Pedidos';
    else if (p.includes('/entregas'))  title = 'Gula Entregas';
    else if (p.includes('/cozinha'))   title = 'Gula Cozinha';
    else if (p.includes('/motoboy'))   title = 'Gula Motoboy';
    else if (p.includes('/etiquetas')) title = 'Gula Etiquetas';
    else if (p.includes('/mesa'))      title = 'Gula — Cardápio';
    else if (p.includes('/feedback'))   title = 'Gula Feedback';
    else if (p.includes('/super-adm')) title = 'Gula Super Admin';
    document.title = title;
  }, [pathname]);
  return null;
}

// Redirects legacy routes (no slug) to the first restaurant's slug-based URL.
function LegacyRedirect({ suffix }: { suffix: string }) {
  const params = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState(false);

  useEffect(() => {
    supabase
      .from('restaurants')
      .select('slug')
      .eq('status', 'active')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) { setError(true); return; }
        // Replace :tableNumber placeholder if present
        const resolvedSuffix = suffix.replace(':tableNumber', params.tableNumber ?? '01');
        navigate(`/${data.slug}${resolvedSuffix}`, { replace: true });
      });
  }, []);

  if (error) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      supabase
        .from('super_admins')
        .select('id')
        .eq('email', user.email)
        .maybeSingle()
        .then(({ data }) => {
          setIsSuperAdmin(!!data);
          setChecking(false);
        });
    } else if (!loading && !user) {
      setChecking(false);
    }
  }, [loading, user]);

  if (loading || checking) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/admin/login" replace />;
  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Acesso restrito</h1>
          <p className="text-slate-500 text-sm mb-6">Apenas administradores master podem acessar o painel do blog.</p>
          <button onClick={() => supabase.auth.signOut().then(() => window.location.href = '/admin/login')} className="px-5 py-2.5 rounded-xl bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 transition-colors">
            Voltar para o login
          </button>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={getBasename()}>
        <PageTitle />
        <Routes>
          {/* Super Admin */}
          <Route path="/super-adm" element={<SuperAdminPanel />} />

          {/* Landing page and public self-signup */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/cadastrar" element={<SelfSignup />} />
          <Route path="/entrar" element={<WelcomePage />} />
          <Route path="/etiquetas" element={<EtiquetasLanding />} />
          <Route path="/tutoriais" element={<TutorialsPage />} />

          {/* Blog — public (powered by Soro) */}
          <Route path="/blog" element={<BlogListPage />} />
          <Route path="/blog/:slug" element={<BlogListPage />} />

          {/* Blog CMS — protected */}
          <Route path="/admin/login" element={<BlogAdminLogin />} />
          <Route path="/admin/dashboard" element={<RequireAuth><BlogAdminDashboard /></RequireAuth>} />
          <Route path="/admin/posts/novo" element={<RequireAuth><BlogAdminEditor /></RequireAuth>} />
          <Route path="/admin/posts/editar/:id" element={<RequireAuth><BlogAdminEditor /></RequireAuth>} />

          {/* Legacy routes: redirect to slug-based equivalents */}
          <Route path="/admin"             element={<LegacyRedirect suffix="/admin" />} />
          <Route path="/cozinha"           element={<LegacyRedirect suffix="/cozinha" />} />
          <Route path="/mesa/:tableNumber" element={<LegacyRedirect suffix="/mesa/:tableNumber" />} />

          {/* Tenant-scoped routes */}
          <Route
            path="/:slug/admin"
            element={
              <TenantGuard requiredModule={MODULES.GULA_PEDIDOS} requireOwnership>
                <AdminPanel />
              </TenantGuard>
            }
          />
          <Route
            path="/:slug/cozinha"
            element={
              <TenantGuard requiredModule={MODULES.GULA_PEDIDOS} requireOwnership>
                <KitchenKDS />
              </TenantGuard>
            }
          />
          <Route
            path="/:slug/mesa/:tableNumber"
            element={
              <TenantGuard requiredModule={MODULES.GULA_PEDIDOS}>
                <CustomerPanel />
              </TenantGuard>
            }
          />
          <Route
            path="/:slug/delivery"
            element={
              <TenantGuard requiredModule={MODULES.GULA_PEDIDOS}>
                <CustomerPanel forceDelivery />
              </TenantGuard>
            }
          />
          <Route
            path="/:slug/feedback"
            element={
              <TenantGuard requiredModule={MODULES.GULA_PEDIDOS}>
                <FeedbackSurvey />
              </TenantGuard>
            }
          />
          <Route
            path="/:slug/etiquetas"
            element={
              <TenantGuard requiredModule={MODULES.GULA_ETIQUETAS} requireOwnership>
                <AdminPanel />
              </TenantGuard>
            }
          />
          <Route
            path="/:slug/etiquetas/faturamento"
            element={
              <TenantGuard requireOwnership bypassPaywall>
                <BillingTab />
              </TenantGuard>
            }
          />

          {/* Gula Entregas — rota privada isolada (feature flag) */}
          <Route
            path="/:slug/entregas"
            element={
              <TenantGuard requireOwnership>
                <EntregasPanel />
              </TenantGuard>
            }
          />

          {/* Motoboy mobile GPS view — público */}
          <Route path="/:slug/motoboy/:motoboyId" element={<MotoboyCelularView />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <PwaInstallPrompt />
    </AuthProvider>
  );
}
