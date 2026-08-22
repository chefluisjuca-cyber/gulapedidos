import { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, Store, Plus, LogOut, Shield, Check, X,
  Copy, ExternalLink, Trash2, Edit3, AlertTriangle, TrendingUp,
  Users, Package, Activity, ChevronRight, Search, Eye, EyeOff,
  UserPlus, KeyRound, Mail, ShieldCheck, ChevronLeft, Bike, Phone,
  BookOpen, Bot, Save,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Restaurant, MODULES } from '../../types';
import KnowledgeBaseTab from './KnowledgeBaseTab';

// ── Auth ──────────────────────────────────────────────────────────────────────
function SuperAdminLogin({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signInErr } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (signInErr) {
      setError('E-mail ou senha incorretos.');
      setLoading(false);
      return;
    }

    // Verify user is in super_admins table
    const { data: sa } = await supabase.from('super_admins').select('id').eq('email', email.trim().toLowerCase()).maybeSingle();
    if (!sa) {
      await supabase.auth.signOut();
      setError('Você não tem permissão de super administrador.');
      setLoading(false);
      return;
    }

    setLoading(false);
    onLogin();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-amber-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">Gula Master Admin</h1>
            <p className="text-slate-500 text-sm mt-1">Acesso restrito</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={e => { setEmail(e.target.value); setError(null); }}
                placeholder="E-mail"
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-amber-500 transition-colors"
                autoFocus
              />
            </div>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                required
                value={password}
                onChange={e => { setPassword(e.target.value); setError(null); }}
                placeholder="Senha"
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 pr-11 focus:outline-none focus:border-amber-500 transition-colors"
              />
              <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {loading && <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />}
              {loading ? 'Verificando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────
const MODULE_DEFS = [
  { id: MODULES.GULA_PEDIDOS,    label: 'Gula Pedidos Digital', color: 'amber',  desc: 'Cardápio digital + KDS + caixa' },
  { id: MODULES.GULA_FIDELIDADE, label: 'Gula Fidelidade',      color: 'teal',   desc: 'Pontos, cashback e recompensas' },
  { id: MODULES.GULA_ETIQUETAS,  label: 'Gula Etiquetas',       color: 'emerald', desc: 'Etiquetas de validade para segurança alimentar' },
] as const;

const STATUS_META = {
  active:    { label: 'Ativo',    bg: 'bg-green-500/15',  text: 'text-green-400',  border: 'border-green-500/30' },
  trial:     { label: 'Trial',    bg: 'bg-blue-500/15',   text: 'text-blue-400',   border: 'border-blue-500/30' },
  suspended: { label: 'Suspenso', bg: 'bg-red-500/15',    text: 'text-red-400',    border: 'border-red-500/30' },
};

const MODULE_COLOR: Record<string, { bg: string; text: string }> = {
  amber: { bg: 'bg-amber-500/15',  text: 'text-amber-400'  },
  teal:  { bg: 'bg-teal-500/15',   text: 'text-teal-400'   },
  blue:    { bg: 'bg-blue-500/15',    text: 'text-blue-400'    },
  emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
};

function moduleBadgeStyle(moduleId: string) {
  const def = MODULE_DEFS.find(m => m.id === moduleId);
  return def ? MODULE_COLOR[def.color] : { bg: 'bg-slate-700', text: 'text-slate-400' };
}

function moduleLabel(moduleId: string) {
  return MODULE_DEFS.find(m => m.id === moduleId)?.label ?? moduleId;
}

// Computes the effective status of a restaurant, treating expired trials as suspended
// even if the cron job hasn't flipped the DB row yet.
function effectiveStatus(r: Restaurant): Restaurant['status'] {
  if (r.status === 'trial' && r.trial_ends_at) {
    return new Date(r.trial_ends_at) < new Date() ? 'suspended' : 'trial';
  }
  return r.status;
}

function slugify(text: string) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function inputCls(extra = '') {
  return `w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-500 transition-colors placeholder-slate-500 ${extra}`;
}

function UrlField({ label, url }: { label: string; url: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>
      <div className="flex gap-2">
        <input
          readOnly
          value={url}
          onFocus={e => e.currentTarget.select()}
          className="flex-1 bg-slate-800/60 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-amber-500/50 transition-colors"
        />
        <button
          type="button"
          onClick={copy}
          className={`shrink-0 inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2.5 rounded-xl border transition-all ${
            copied
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
              : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-amber-500/40 hover:text-amber-400'
          }`}
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? 'Copiado!' : 'Copiar'}
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2.5 rounded-xl border bg-slate-800 border-slate-700 text-slate-300 hover:border-amber-500/40 hover:text-amber-400 transition-all"
          title="Abrir em nova aba"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}

// ── Restaurant Form ───────────────────────────────────────────────────────────
interface FormProps {
  initial?: Restaurant;
  onSave: () => void;
  onCancel: () => void;
}

function RestaurantForm({ initial, onSave, onCancel }: FormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [ownerEmail, setOwnerEmail] = useState(initial?.owner_email ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [status, setStatus] = useState<Restaurant['status']>(initial?.status ?? 'trial');
  const [modules, setModules] = useState<string[]>(initial?.modules ?? [MODULES.GULA_PEDIDOS]);
  const [slugManual, setSlugManual] = useState(!!initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleNameChange(v: string) {
    setName(v);
    if (!slugManual) setSlug(slugify(v));
  }

  function toggleModule(m: string) {
    setModules(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !slug.trim() || !ownerEmail.trim()) { setError('Preencha todos os campos obrigatórios.'); return; }
    if (modules.length === 0) { setError('Selecione ao menos um módulo.'); return; }
    setSaving(true);
    setError(null);

    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const payload = { name: name.trim(), slug: slug.trim(), owner_email: ownerEmail.trim(), phone: phone.trim() || null, status, modules };
    const { error: dbErr } = initial
      ? await supabase.from('restaurants').update({ ...payload, updated_at: now.toISOString() }).eq('id', initial.id)
      : await supabase.from('restaurants').insert({ ...payload, status: 'trial', trial_ends_at: trialEndsAt });

    if (dbErr) {
      setError(dbErr.message.includes('unique') ? 'Este slug já está em uso. Escolha outro.' : dbErr.message);
      setSaving(false);
    } else {
      onSave();
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Nome do Restaurante *</label>
          <input value={name} onChange={e => handleNameChange(e.target.value)} className={inputCls()} placeholder="Ex: Pizzaria do Zé" required />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">E-mail do Responsável *</label>
          <input type="email" value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)} className={inputCls()} placeholder="dono@restaurante.com" required />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Telefone / WhatsApp</label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input value={phone} onChange={e => setPhone(e.target.value)} className={inputCls('pl-9')} placeholder="(11) 99999-9999" />
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Slug de acesso *</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs pointer-events-none">/</span>
            <input
              value={slug}
              onChange={e => { setSlug(e.target.value); setSlugManual(true); }}
              className={inputCls('pl-5')}
              placeholder="pizzaria-do-ze"
              required
            />
          </div>
        </div>
        {initial && (
          <div className="sm:col-span-2 space-y-3">
            <UrlField label="URL do Painel ADM" url={`${window.location.origin}/${slug || initial.slug}/admin`} />
            <UrlField label="URL do Cardápio Público" url={`${window.location.origin}/${slug || initial.slug}`} />
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Status</label>
          <select value={status} onChange={e => setStatus(e.target.value as Restaurant['status'])} className={inputCls()}>
            <option value="trial">Trial</option>
            <option value="active">Ativo</option>
            <option value="suspended">Suspenso</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-400 mb-3">Módulos contratados *</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {MODULE_DEFS.map(m => {
            const active = modules.includes(m.id);
            const colors = MODULE_COLOR[m.color];
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => toggleModule(m.id)}
                className={`relative flex flex-col gap-1.5 p-4 rounded-xl border-2 text-left transition-all ${
                  active ? `${colors.bg} border-current ${colors.text}` : 'bg-slate-800/40 border-slate-700 hover:border-slate-600'
                }`}
              >
                {active && <Check className="absolute top-2 right-2 w-3.5 h-3.5" strokeWidth={3} />}
                <span className={`text-sm font-semibold ${active ? '' : 'text-slate-300'}`}>{m.label}</span>
                <span className="text-[11px] text-slate-500">{m.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black transition-colors disabled:opacity-60"
        >
          <Check className="w-4 h-4" />
          {saving ? 'Salvando...' : initial ? 'Salvar Alterações' : 'Criar Restaurante'}
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-slate-400 hover:text-white px-4 py-2 transition-colors">
          Cancelar
        </button>
      </div>
    </form>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────
type View = 'dashboard' | 'restaurants' | 'new' | 'edit' | 'users' | 'knowledge' | 'assistant';

interface AuthUser {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
}

function SuperAdminContent({ onLogout }: { onLogout: () => void }) {
  const [view, setView] = useState<View>('dashboard');
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [editTarget, setEditTarget] = useState<Restaurant | null>(null);
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const [users, setUsers] = useState<AuthUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [showNewUser, setShowNewUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserConfirm, setNewUserConfirm] = useState('');
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [userSaving, setUserSaving] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);
  const [userSuccess, setUserSuccess] = useState<string | null>(null);

  const fetchRestaurants = useCallback(async () => {
    const { data } = await supabase.from('restaurants').select('*').order('created_at', { ascending: false });
    setRestaurants((data ?? []) as Restaurant[]);
  }, []);

  useEffect(() => { fetchRestaurants(); }, [fetchRestaurants]);

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    const { data, error } = await supabase.functions.invoke('create-auth-user', { method: 'GET' });
    if (!error && data?.users) setUsers(data.users as AuthUser[]);
    setUsersLoading(false);
  }, []);

  useEffect(() => { if (view === 'users') fetchUsers(); }, [view, fetchUsers]);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setUserError(null);
    setUserSuccess(null);
    if (newUserPassword !== newUserConfirm) { setUserError('As senhas não coincidem.'); return; }
    if (newUserPassword.length < 6) { setUserError('A senha deve ter pelo menos 6 caracteres.'); return; }
    setUserSaving(true);
    const { data, error } = await supabase.functions.invoke('create-auth-user', {
      body: { email: newUserEmail.trim(), password: newUserPassword },
    });
    setUserSaving(false);
    if (error || data?.error) { setUserError(data?.error ?? error?.message ?? 'Erro ao criar usuário.'); return; }
    setUserSuccess(`Usuário ${newUserEmail.trim()} criado com sucesso!`);
    setNewUserEmail(''); setNewUserPassword(''); setNewUserConfirm('');
    setShowNewUser(false);
    fetchUsers();
  }

  async function toggleStatus(r: Restaurant) {
    const next = effectiveStatus(r) === 'suspended' ? 'active' : 'suspended';
    await supabase.from('restaurants').update({ status: next, updated_at: new Date().toISOString() }).eq('id', r.id);
    setRestaurants(prev => prev.map(x => x.id === r.id ? { ...x, status: next } : x));
  }

  async function deleteRestaurant(id: string) {
    if (!confirm('Remover este restaurante permanentemente?')) return;
    await supabase.from('restaurants').delete().eq('id', id);
    setRestaurants(prev => prev.filter(r => r.id !== id));
  }

  function copySlug(slug: string) {
    navigator.clipboard.writeText(`${window.location.origin}/${slug}/mesa/01`).catch(() => {});
    setCopied(slug);
    setTimeout(() => setCopied(null), 2000);
  }

  function openEdit(r: Restaurant) {
    setEditTarget(r);
    setView('edit');
  }

  const stats = {
    total: restaurants.length,
    active: restaurants.filter(r => effectiveStatus(r) === 'active').length,
    trial: restaurants.filter(r => effectiveStatus(r) === 'trial').length,
    suspended: restaurants.filter(r => effectiveStatus(r) === 'suspended').length,
  };

  const filtered = search
    ? restaurants.filter(r =>
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.slug.includes(search.toLowerCase()) ||
        r.owner_email.includes(search.toLowerCase()))
    : restaurants;

  const navItems = [
    { id: 'dashboard' as View,   icon: LayoutDashboard, label: 'Dashboard', labelShort: 'Home' },
    { id: 'restaurants' as View, icon: Store,            label: 'Restaurantes', labelShort: 'Restau.' },
    { id: 'users' as View,       icon: ShieldCheck,      label: 'Usuários Admin', labelShort: 'Usuários' },
    { id: 'knowledge' as View,   icon: BookOpen,         label: 'Base de Conhecimento', labelShort: 'Base' },
    { id: 'assistant' as View,   icon: Bot,              label: 'Assistente Virtual', labelShort: 'IA' },
  ];

  // Which bottom-nav item is "active" (new/edit belong to restaurants)
  const activeNav = (view === 'new' || view === 'edit') ? 'restaurants' : view;

  // ── Virtual Assistant toggle state ─────────────────────────────────────────
  const [vaEnabled, setVaEnabled] = useState(false);
  const [vaSaving, setVaSaving] = useState(false);
  const [vaSaved, setVaSaved] = useState(false);

  useEffect(() => {
    if (view === 'assistant') {
      supabase
        .from('restaurant_settings')
        .select('show_virtual_assistant')
        .is('restaurant_id', null)
        .maybeSingle()
        .then(({ data }) => {
          setVaEnabled(data?.show_virtual_assistant ?? false);
        });
    }
  }, [view]);

  async function toggleVirtualAssistant() {
    const next = !vaEnabled;
    setVaEnabled(next);
    setVaSaving(true);
    const { data: existing } = await supabase
      .from('restaurant_settings')
      .select('id')
      .is('restaurant_id', null)
      .maybeSingle();
    if (existing?.id) {
      await supabase
        .from('restaurant_settings')
        .update({ show_virtual_assistant: next, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('restaurant_settings')
        .insert({ show_virtual_assistant: next });
    }
    setVaSaving(false);
    setVaSaved(true);
    setTimeout(() => setVaSaved(false), 2500);
  }

  // Sub-views (new/edit) show a back-button header on mobile
  const isSubView = view === 'new' || view === 'edit';

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col sm:flex-row">

      {/* ── Desktop Sidebar ─────────────────────────────────────────────── */}
      <aside className="hidden sm:flex w-56 shrink-0 bg-slate-900 border-r border-slate-800 flex-col">
        <div className="px-5 py-5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4 text-amber-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate">Gula Master Admin</p>
              <p className="text-[10px] text-slate-500">Super administrador</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                activeNav === item.id
                  ? 'bg-amber-500/10 text-amber-400'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-slate-800">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-slate-500 hover:text-red-400 transition-colors"
          >
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      </aside>

      {/* ── Mobile Header ───────────────────────────────────────────────── */}
      <header className="sm:hidden bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between shrink-0">
        {isSubView ? (
          <button
            onClick={() => setView('restaurants')}
            className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="text-sm font-medium">Voltar</span>
          </button>
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-tight">Gula Master Admin</p>
              <p className="text-[10px] text-slate-500">Super administrador</p>
            </div>
          </div>
        )}
        <button
          onClick={onLogout}
          className="p-2 text-slate-400 hover:text-red-400 transition-colors rounded-xl hover:bg-slate-800"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </header>

      {/* ── Main Content ────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-auto pb-20 sm:pb-0">

        {/* Dashboard */}
        {view === 'dashboard' && (
          <div className="p-4 sm:p-8 space-y-6 sm:space-y-8 max-w-5xl">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">Dashboard</h1>
              <p className="text-slate-500 text-sm mt-1">Visão geral da plataforma Gula</p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {[
                { label: 'Total de Clientes', value: stats.total,     icon: Users,          color: 'text-slate-300', bg: 'bg-slate-800' },
                { label: 'Ativos',            value: stats.active,    icon: Activity,       color: 'text-green-400', bg: 'bg-green-500/10' },
                { label: 'Em Trial',          value: stats.trial,     icon: TrendingUp,     color: 'text-blue-400',  bg: 'bg-blue-500/10' },
                { label: 'Suspensos',         value: stats.suspended, icon: AlertTriangle,  color: 'text-red-400',   bg: 'bg-red-500/10' },
              ].map(s => (
                <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
                  <div className={`w-8 h-8 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>
                    <s.icon className={`w-4 h-4 ${s.color}`} />
                  </div>
                  <p className="text-2xl font-bold text-white">{s.value}</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-tight">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6">
              <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-400" /> Distribuição de Módulos
              </h3>
              <div className="space-y-3">
                {MODULE_DEFS.map(m => {
                  const count = restaurants.filter(r => r.modules.includes(m.id as never)).length;
                  const pct = stats.total ? (count / stats.total) * 100 : 0;
                  const colors = MODULE_COLOR[m.color];
                  return (
                    <div key={m.id} className="flex items-center gap-3">
                      <span className={`text-xs font-medium w-28 sm:w-40 shrink-0 truncate ${colors.text}`}>{m.label}</span>
                      <div className="flex-1 bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div className={`h-full rounded-full ${colors.bg.replace('/15', '')} transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-slate-500 w-6 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {restaurants.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="px-4 sm:px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-300">Restaurantes Recentes</h3>
                  <button onClick={() => setView('restaurants')} className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1">
                    Ver todos <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="divide-y divide-slate-800">
                  {restaurants.slice(0, 5).map(r => {
                    const sm = STATUS_META[effectiveStatus(r)];
                    return (
                      <div key={r.id} className="flex items-center justify-between px-4 sm:px-6 py-3 gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-amber-400">{r.name.charAt(0).toUpperCase()}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white truncate">{r.name}</p>
                            <p className="text-xs text-slate-500">/{r.slug}</p>
                          </div>
                        </div>
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${sm.bg} ${sm.text} ${sm.border} shrink-0`}>
                          {sm.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Restaurants List */}
        {view === 'restaurants' && (
          <div className="p-4 sm:p-8 space-y-4 sm:space-y-6 max-w-6xl">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white">Restaurantes</h1>
                <p className="text-slate-500 text-sm mt-1">{restaurants.length} estabelecimento(s)</p>
              </div>
              <button
                onClick={() => setView('new')}
                className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black transition-colors"
              >
                <Plus className="w-4 h-4" /> Novo
              </button>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nome, slug ou e-mail..."
                className="w-full bg-slate-900 border border-slate-800 text-white text-sm rounded-xl pl-9 pr-4 py-2.5 focus:outline-none focus:border-amber-500 transition-colors placeholder-slate-500"
              />
            </div>

            {filtered.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl py-16 text-center text-slate-500">
                <Store className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">{search ? 'Nenhum resultado encontrado.' : 'Nenhum restaurante cadastrado ainda.'}</p>
              </div>
            ) : (
              <>
                {/* Mobile card list */}
                <div className="sm:hidden space-y-3">
                  {filtered.map(r => {
                    const sm = STATUS_META[effectiveStatus(r)];
                    return (
                      <div key={r.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
                            <span className="text-sm font-bold text-amber-400">{r.name.charAt(0).toUpperCase()}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-white truncate">{r.name}</p>
                            <p className="text-xs text-slate-500 truncate">{r.owner_email}</p>
                          </div>
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${sm.bg} ${sm.text} ${sm.border} shrink-0`}>
                            {sm.label}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 mb-3">
                          <code className="text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg">/{r.slug}</code>
                          <button onClick={() => copySlug(r.slug)} className="text-slate-500 hover:text-white p-1 transition-colors">
                            {copied === r.slug ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                          <a href={`/${r.slug}/mesa/01`} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-white p-1 transition-colors" title="Cardápio">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                          <a href={`/${r.slug}/admin`} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-amber-400 p-1 transition-colors" title="Painel Admin">
                            <LayoutDashboard className="w-3.5 h-3.5" />
                          </a>
                          <a href={`/${r.slug}/entregas`} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-orange-400 p-1 transition-colors" title="Gula Entregas">
                            <Bike className="w-3.5 h-3.5" />
                          </a>
                        </div>

                        <div className="flex flex-wrap gap-1 mb-3">
                          {r.modules.map(m => {
                            const style = moduleBadgeStyle(m);
                            return (
                              <span key={m} className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>
                                {moduleLabel(m)}
                              </span>
                            );
                          })}
                        </div>

                        <div className="flex gap-2 border-t border-slate-800 pt-3">
                          <button
                            onClick={() => openEdit(r)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-amber-400 bg-amber-500/10 rounded-xl hover:bg-amber-500/20 transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5" /> Editar
                          </button>
                          <button
                            onClick={() => toggleStatus(r)}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-xl transition-colors ${
                              effectiveStatus(r) === 'suspended'
                                ? 'text-green-400 bg-green-500/10 hover:bg-green-500/20'
                                : 'text-orange-400 bg-orange-500/10 hover:bg-orange-500/20'
                            }`}
                          >
                            {effectiveStatus(r) === 'suspended' ? <Activity className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                            {effectiveStatus(r) === 'suspended' ? 'Reativar' : 'Suspender'}
                          </button>
                          <button
                            onClick={() => deleteRestaurant(r.id)}
                            className="p-2 text-slate-500 hover:text-red-400 bg-slate-800 hover:bg-red-500/10 rounded-xl transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop table */}
                <div className="hidden sm:block bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-800 text-xs text-slate-500 uppercase tracking-wider">
                          <th className="px-5 py-3 text-left font-medium">Restaurante</th>
                          <th className="px-5 py-3 text-left font-medium">Slug / URL</th>
                          <th className="px-5 py-3 text-left font-medium">Status</th>
                          <th className="px-5 py-3 text-left font-medium">Módulos</th>
                          <th className="px-5 py-3 text-right font-medium">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {filtered.map(r => {
                          const sm = STATUS_META[effectiveStatus(r)];
                          return (
                            <tr key={r.id} className="hover:bg-slate-800/40 transition-colors">
                              <td className="px-5 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
                                    <span className="text-xs font-bold text-amber-400">{r.name.charAt(0).toUpperCase()}</span>
                                  </div>
                                  <div>
                                    <p className="font-medium text-white">{r.name}</p>
                                    <p className="text-xs text-slate-500">{r.owner_email}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-5 py-4">
                                <div className="flex items-center gap-2">
                                  <code className="text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg">/{r.slug}</code>
                                  <button onClick={() => copySlug(r.slug)} className="text-slate-500 hover:text-white p-1 transition-colors" title="Copiar URL">
                                    {copied === r.slug ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                                  </button>
                                  <a href={`/${r.slug}/mesa/01`} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-white p-1 transition-colors" title="Cardápio">
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                  <a href={`/${r.slug}/admin`} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-amber-400 p-1 transition-colors" title="Painel Admin">
                                    <LayoutDashboard className="w-3.5 h-3.5" />
                                  </a>
                                  <a href={`/${r.slug}/entregas`} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-orange-400 p-1 transition-colors" title="Gula Entregas">
                                    <Bike className="w-3.5 h-3.5" />
                                  </a>
                                </div>
                              </td>
                              <td className="px-5 py-4">
                                <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${sm.bg} ${sm.text} ${sm.border}`}>
                                  {sm.label}
                                </span>
                              </td>
                              <td className="px-5 py-4">
                                <div className="flex flex-wrap gap-1.5">
                                  {r.modules.map(m => {
                                    const style = moduleBadgeStyle(m);
                                    return (
                                      <span key={m} className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>
                                        {moduleLabel(m)}
                                      </span>
                                    );
                                  })}
                                </div>
                              </td>
                              <td className="px-5 py-4">
                                <div className="flex items-center justify-end gap-1">
                                  <button onClick={() => openEdit(r)} className="p-1.5 text-slate-400 hover:text-amber-400 transition-colors rounded-lg hover:bg-amber-500/10" title="Editar">
                                    <Edit3 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => toggleStatus(r)}
                                    className={`p-1.5 transition-colors rounded-lg ${
                                      effectiveStatus(r) === 'suspended'
                                        ? 'text-slate-400 hover:text-green-400 hover:bg-green-500/10'
                                        : 'text-slate-400 hover:text-orange-400 hover:bg-orange-500/10'
                                    }`}
                                    title={effectiveStatus(r) === 'suspended' ? 'Reativar' : 'Suspender'}
                                  >
                                    {effectiveStatus(r) === 'suspended' ? <Activity className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                                  </button>
                                  <button onClick={() => deleteRestaurant(r.id)} className="p-1.5 text-slate-500 hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/10" title="Remover">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* New Restaurant */}
        {view === 'new' && (
          <div className="p-4 sm:p-8 max-w-2xl">
            <div className="hidden sm:flex items-center gap-3 mb-6">
              <button onClick={() => setView('restaurants')} className="text-slate-400 hover:text-white transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-white">Novo Restaurante</h1>
                <p className="text-slate-500 text-sm">Cadastre um novo estabelecimento na plataforma</p>
              </div>
            </div>
            <div className="sm:hidden mb-4">
              <h1 className="text-lg font-bold text-white">Novo Restaurante</h1>
              <p className="text-slate-500 text-xs mt-0.5">Cadastre um novo estabelecimento</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6">
              <RestaurantForm
                onSave={() => { fetchRestaurants(); setView('restaurants'); }}
                onCancel={() => setView('restaurants')}
              />
            </div>
          </div>
        )}

        {/* Edit Restaurant */}
        {view === 'edit' && editTarget && (
          <div className="p-4 sm:p-8 max-w-2xl">
            <div className="hidden sm:flex items-center gap-3 mb-6">
              <button onClick={() => setView('restaurants')} className="text-slate-400 hover:text-white transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-white">Editar Restaurante</h1>
                <p className="text-slate-500 text-sm">{editTarget.name}</p>
              </div>
            </div>
            <div className="sm:hidden mb-4">
              <h1 className="text-lg font-bold text-white">Editar Restaurante</h1>
              <p className="text-slate-500 text-xs mt-0.5 truncate">{editTarget.name}</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6">
              <RestaurantForm
                initial={editTarget}
                onSave={() => { fetchRestaurants(); setView('restaurants'); }}
                onCancel={() => setView('restaurants')}
              />
            </div>
          </div>
        )}

        {/* Users Admin */}
        {view === 'users' && (
          <div className="p-4 sm:p-8 space-y-4 sm:space-y-6 max-w-3xl">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white">Usuários Admin</h1>
                <p className="text-slate-500 text-sm mt-1">Contas com acesso ao painel master</p>
              </div>
              <button
                onClick={() => { setShowNewUser(v => !v); setUserError(null); setUserSuccess(null); }}
                className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black transition-colors"
              >
                <UserPlus className="w-4 h-4" /> Novo Usuário
              </button>
            </div>

            {userSuccess && (
              <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 text-green-400 text-sm">
                <Check className="w-4 h-4 shrink-0" /> {userSuccess}
              </div>
            )}

            {showNewUser && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="px-4 sm:px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-amber-400" /> Criar novo super admin
                  </h3>
                  <button onClick={() => { setShowNewUser(false); setUserError(null); }} className="text-slate-400 hover:text-white transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <form onSubmit={createUser} className="p-4 sm:p-6 space-y-4">
                  {userError && (
                    <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
                      <AlertTriangle className="w-4 h-4 shrink-0" /> {userError}
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">E-mail *</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                        <input type="email" required value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} className={inputCls('pl-9')} placeholder="admin@exemplo.com" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">Senha *</label>
                      <div className="relative">
                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                        <input type={showNewPwd ? 'text' : 'password'} required value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} className={inputCls('pl-9 pr-9')} placeholder="Mínimo 6 caracteres" minLength={6} />
                        <button type="button" onClick={() => setShowNewPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors">
                          {showNewPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">Confirmar senha *</label>
                      <div className="relative">
                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                        <input type={showNewPwd ? 'text' : 'password'} required value={newUserConfirm} onChange={e => setNewUserConfirm(e.target.value)} className={inputCls('pl-9')} placeholder="Repita a senha" />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3 pt-1">
                    <button type="submit" disabled={userSaving} className="flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black transition-colors disabled:opacity-60">
                      {userSaving ? <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : <UserPlus className="w-4 h-4" />}
                      {userSaving ? 'Criando...' : 'Criar usuário'}
                    </button>
                    <button type="button" onClick={() => { setShowNewUser(false); setUserError(null); }} className="text-sm text-slate-400 hover:text-white px-4 py-2 transition-colors">
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="px-4 sm:px-6 py-4 border-b border-slate-800">
                <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-400" /> Contas cadastradas
                </h3>
              </div>
              {usersLoading ? (
                <div className="py-12 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                </div>
              ) : users.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  <ShieldCheck className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhum usuário super admin cadastrado.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-800">
                  {users.map(u => (
                    <div key={u.id} className="flex items-center justify-between px-4 sm:px-6 py-4 gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
                          <ShieldCheck className="w-4 h-4 text-amber-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">{u.email}</p>
                          <p className="text-xs text-slate-500">
                            {new Date(u.created_at).toLocaleDateString('pt-BR')}
                            {u.last_sign_in_at && ` · ${new Date(u.last_sign_in_at).toLocaleDateString('pt-BR')}`}
                          </p>
                        </div>
                      </div>
                      <span className="text-[11px] font-medium px-2.5 py-1 rounded-full border bg-amber-500/15 text-amber-400 border-amber-500/30 shrink-0">
                        Super Admin
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'knowledge' && (
          <KnowledgeBaseTab />
        )}

        {view === 'assistant' && (
          <div className="p-4 sm:p-8 max-w-3xl space-y-6">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                <Bot className="w-5 h-5 text-amber-400" /> Assistente Virtual
              </h1>
              <p className="text-slate-500 text-sm mt-1">
                Controle a visibilidade do assistente de IA na página pública.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${vaEnabled ? 'bg-amber-500' : 'bg-slate-800'}`}>
                    <Bot className={`w-5 h-5 ${vaEnabled ? 'text-black' : 'text-slate-500'}`} />
                  </div>
                  <div>
                    <p className="font-semibold text-white text-sm">Exibir Assistente Virtual na Landing Page</p>
                    <p className="text-xs text-slate-400 mt-0.5 max-w-md">
                      {vaEnabled
                        ? 'Ativado — o widget de chat será exibido publicamente para todos os visitantes da landing page.'
                        : 'Desativado — o widget de chat está oculto para todos os visitantes. Apenas o Super Admin pode testar via Base de Conhecimento.'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={toggleVirtualAssistant}
                  disabled={vaSaving}
                  className={`w-11 h-6 rounded-full transition-colors relative shrink-0 disabled:opacity-50 ${vaEnabled ? 'bg-amber-500' : 'bg-slate-700'}`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${vaEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                </button>
              </div>

              {vaSaved && (
                <div className="flex items-center gap-2 text-green-400 text-xs">
                  <Check className="w-4 h-4" /> Configuração salva!
                </div>
              )}

              <div className="pt-3 border-t border-slate-800">
                <p className="text-xs text-slate-500 leading-relaxed">
                  Quando ativado, o widget do <strong className="text-slate-300">Gula Especialista</strong> aparecerá no canto inferior direito da landing page.
                  Os visitantes poderão fazer perguntas e a IA responderá com base na Base de Conhecimento cadastrada.
                </p>
                <p className="text-xs text-slate-500 leading-relaxed mt-2">
                  Para testar as respostas da IA antes de ativar, use a aba <strong className="text-slate-300">Base de Conhecimento</strong> e clique em <strong className="text-slate-300">Testar IA</strong>.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Mobile Bottom Nav (hidden on desktop, hidden on sub-views) ───── */}
      {!isSubView && (
        <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 flex">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 transition-colors ${
                activeNav === item.id ? 'text-amber-400' : 'text-slate-500'
              }`}
            >
              {activeNav === item.id && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-amber-400 rounded-full" />
              )}
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium leading-none">{item.labelShort}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}

// ── Entry Point ───────────────────────────────────────────────────────────────
export default function SuperAdminPanel() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const { data: sa } = await supabase.from('super_admins').select('id').maybeSingle();
        setAuthed(!!sa);
      }
      setChecking(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) setAuthed(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    setAuthed(false);
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!authed) return <SuperAdminLogin onLogin={() => setAuthed(true)} />;
  return <SuperAdminContent onLogout={handleLogout} />;
}
