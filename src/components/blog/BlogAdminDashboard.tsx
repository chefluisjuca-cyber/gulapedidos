import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus, Search, Pencil, Trash2, Eye, EyeOff, LogOut, FileText,
  CheckCircle2, Clock, ArrowRight, Newspaper,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../admin/AuthGate';
import type { BlogPost } from '../../types/blog';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function BlogAdminDashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'published'>('all');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetchPosts();
  }, []);

  async function fetchPosts() {
    setLoading(true);
    const { data, error } = await supabase
      .from('blog_posts')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setPosts(data as BlogPost[]);
    setLoading(false);
  }

  async function toggleStatus(post: BlogPost) {
    const newStatus = post.status === 'published' ? 'draft' : 'published';
    const updates: Partial<BlogPost> = { status: newStatus };
    if (newStatus === 'published' && !post.published_at) {
      updates.published_at = new Date().toISOString();
    }
    const { error } = await supabase.from('blog_posts').update(updates).eq('id', post.id);
    if (error) {
      alert('Erro ao atualizar status: ' + error.message);
    } else {
      fetchPosts();
    }
  }

  async function deletePost(id: string) {
    const { error } = await supabase.from('blog_posts').delete().eq('id', id);
    if (error) {
      alert('Erro ao excluir: ' + error.message);
    } else {
      setDeleteId(null);
      fetchPosts();
    }
  }

  const filtered = posts.filter(p => {
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    const q = search.toLowerCase().trim();
    const matchesSearch = !q || p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const publishedCount = posts.filter(p => p.status === 'published').length;
  const draftCount = posts.filter(p => p.status === 'draft').length;

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/gula-pedidos-digial.png" alt="Gula" className="w-8 h-8 object-contain" />
            <div>
              <h1 className="text-sm font-bold text-slate-900">Blog CMS</h1>
              <p className="text-xs text-slate-400">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/blog" className="text-sm text-slate-500 hover:text-orange-600 transition-colors hidden sm:inline">
              Ver Blog
            </Link>
            <button
              onClick={async () => { await signOut(); navigate('/admin/login'); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <LogOut className="w-4 h-4" /> Sair
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                <FileText className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{posts.length}</p>
                <p className="text-xs text-slate-400">Total de posts</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{publishedCount}</p>
                <p className="text-xs text-slate-400">Publicados</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{draftCount}</p>
                <p className="text-xs text-slate-400">Rascunhos</p>
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar postagens…"
              className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
            {(['all', 'published', 'draft'] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3.5 py-2 rounded-full text-sm font-medium transition-colors ${
                  statusFilter === s
                    ? 'bg-orange-600 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:border-orange-300'
                }`}
              >
                {s === 'all' ? 'Todos' : s === 'published' ? 'Publicados' : 'Rascunhos'}
              </button>
            ))}
          </div>
          <Link
            to="/admin/posts/novo"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 transition-colors shadow-lg shadow-orange-600/20"
          >
            <Plus className="w-4 h-4" /> Criar Novo Post
          </Link>
        </div>

        {/* Posts list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 animate-pulse">
                <div className="flex gap-4">
                  <div className="w-20 h-14 bg-slate-200 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="h-5 bg-slate-200 rounded w-2/3" />
                    <div className="h-4 bg-slate-200 rounded w-1/3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
            <Newspaper className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-400 text-lg mb-4">Nenhuma postagem encontrada.</p>
            <Link to="/admin/posts/novo" className="inline-flex items-center gap-2 text-orange-600 font-semibold hover:text-orange-700">
              <Plus className="w-4 h-4" /> Criar primeira postagem
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(post => (
              <div key={post.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4 hover:shadow-md transition-shadow">
                {/* Thumbnail */}
                <div className="w-20 h-14 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                  {post.cover_image_url ? (
                    <img src={post.cover_image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Newspaper className="w-6 h-6 text-slate-300" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      post.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {post.status === 'published' ? 'Publicado' : 'Rascunho'}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">{post.category}</span>
                  </div>
                  <h3 className="font-semibold text-slate-900 truncate">{post.title}</h3>
                  <p className="text-xs text-slate-400">/blog/{post.slug} · {formatDate(post.published_at ?? post.created_at)}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => toggleStatus(post)}
                    className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                    title={post.status === 'published' ? 'Despublicar' : 'Publicar'}
                  >
                    {post.status === 'published' ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <Link
                    to={`/admin/posts/editar/${post.id}`}
                    className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-orange-600 transition-colors"
                    title="Editar"
                  >
                    <Pencil className="w-4 h-4" />
                  </Link>
                  <button
                    onClick={() => setDeleteId(post.id)}
                    className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleteId && (
        <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Excluir postagem?</h3>
                <p className="text-sm text-slate-500">Esta ação não pode ser desfeita.</p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => deletePost(deleteId)}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
