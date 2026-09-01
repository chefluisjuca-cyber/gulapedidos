import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, Search, Pencil, Trash2, Eye, EyeOff, FileText,
  CheckCircle2, Clock, ArrowLeft, Newspaper, Send, Save,
  AlertCircle, Image as ImageIcon, X, Upload, Loader2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { BlogPost } from '../../types/blog';
import { BLOG_CATEGORIES } from '../../types/blog';
import ImageUpload from '../admin/ImageUpload';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function renderMarkdownPreview(md: string): string {
  let html = md;
  html = html.replace(/^### (.*$)/gm, '<h3 class="text-lg font-bold text-slate-900 mt-6 mb-2">$1</h3>');
  html = html.replace(/^## (.*$)/gm, '<h2 class="text-xl font-bold text-slate-900 mt-8 mb-3">$1</h2>');
  html = html.replace(/^> (.*$)/gm, '<blockquote class="border-l-4 border-amber-400 pl-4 italic text-slate-600 my-4">$1</blockquote>');
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="w-full rounded-xl my-4" />');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-slate-900">$1</strong>');
  html = html.replace(/^- (.*$)/gm, '<li class="text-slate-600 ml-6 list-disc">$1</li>');
  html = html.replace(/\n\n/g, '</p><p class="text-slate-600 leading-relaxed mb-3">');
  html = html.replace(/\n/g, '<br>');
  html = `<p class="text-slate-600 leading-relaxed mb-3">${html}</p>`;
  return html;
}

type SubView = 'list' | 'new' | 'edit';

export default function BlogTab() {
  const [subView, setSubView] = useState<SubView>('list');
  const [editId, setEditId] = useState<string | null>(null);

  // ── List state ──
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'published'>('all');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // ── Editor state ──
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [category, setCategory] = useState<string>(BLOG_CATEGORIES[0]);
  const [excerpt, setExcerpt] = useState('');
  const [content, setContent] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [readTime, setReadTime] = useState('5 min');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [editorLoading, setEditorLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // ── In-content image upload state ──
  const [contentUploading, setContentUploading] = useState(false);
  const [contentUploadError, setContentUploadError] = useState<string | null>(null);
  const contentFileRef = useRef<HTMLInputElement>(null);
  const contentDragRef = useRef<HTMLDivElement>(null);
  const [contentDragging, setContentDragging] = useState(false);

  async function uploadContentImage(file: File) {
    setContentUploadError(null);
    if (!file.type.startsWith('image/')) {
      setContentUploadError('Selecione um arquivo de imagem (JPG, PNG, WebP ou GIF).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setContentUploadError('O arquivo deve ter no máximo 5 MB.');
      return;
    }
    setContentUploading(true);
    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `content/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('blog-images')
      .upload(path, file, { upsert: false });
    if (uploadError) {
      setContentUploadError('Erro ao fazer upload. Tente novamente.');
      setContentUploading(false);
      return;
    }
    const { data } = supabase.storage.from('blog-images').getPublicUrl(path);
    const markdown = `\n\n![${file.name.replace(/\.[^.]+$/, '')}](${data.publicUrl})\n\n`;
    setContent(prev => prev + markdown);
    setContentUploading(false);
  }

  function onContentFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadContentImage(file);
    e.target.value = '';
  }

  function onContentDrop(e: React.DragEvent) {
    e.preventDefault();
    setContentDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadContentImage(file);
  }

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('blog_posts')
      .select('*')
      .order('created_at', { ascending: false });
    if (!err && data) setPosts(data as BlogPost[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Load post for editing
  useEffect(() => {
    if (subView !== 'edit' || !editId) return;
    setEditorLoading(true);
    supabase
      .from('blog_posts')
      .select('*')
      .eq('id', editId)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (err || !data) {
          setError('Postagem não encontrada');
        } else {
          const p = data as BlogPost;
          setTitle(p.title);
          setSlug(p.slug);
          setSlugEdited(true);
          setCategory(p.category);
          setExcerpt(p.excerpt ?? '');
          setContent(p.content ?? '');
          setCoverImageUrl(p.cover_image_url ?? '');
          setReadTime(p.read_time ?? '5 min');
          setStatus(p.status);
        }
        setEditorLoading(false);
      });
  }, [subView, editId]);

  // Auto-slug
  useEffect(() => {
    if (!slugEdited) setSlug(slugify(title));
  }, [title, slugEdited]);

  function resetEditor() {
    setTitle(''); setSlug(''); setSlugEdited(false);
    setCategory(BLOG_CATEGORIES[0]); setExcerpt(''); setContent('');
    setCoverImageUrl(''); setReadTime('5 min'); setStatus('draft');
    setError(null); setSuccess(null); setShowPreview(false);
  }

  function openNew() {
    resetEditor();
    setSubView('new');
  }

  function openEdit(id: string) {
    resetEditor();
    setEditId(id);
    setSubView('edit');
  }

  function backToList() {
    setSubView('list');
    setEditId(null);
    resetEditor();
    fetchPosts();
  }

  async function toggleStatus(post: BlogPost) {
    const newStatus = post.status === 'published' ? 'draft' : 'published';
    const updates: Partial<BlogPost> = { status: newStatus };
    if (newStatus === 'published' && !post.published_at) {
      updates.published_at = new Date().toISOString();
    }
    const { error: err } = await supabase.from('blog_posts').update(updates).eq('id', post.id);
    if (err) {
      alert('Erro ao atualizar status: ' + err.message);
    } else {
      fetchPosts();
    }
  }

  async function deletePost(id: string) {
    const { error: err } = await supabase.from('blog_posts').delete().eq('id', id);
    if (err) {
      alert('Erro ao excluir: ' + err.message);
    } else {
      setDeleteId(null);
      fetchPosts();
    }
  }

  async function save(saveStatus: 'draft' | 'published') {
    setError(null);
    setSuccess(null);
    if (!title.trim()) { setError('O título é obrigatório'); return; }
    if (!slug.trim()) { setError('O slug é obrigatório'); return; }
    if (!content.trim()) { setError('O conteúdo é obrigatório'); return; }

    setSaving(true);
    const payload: Partial<BlogPost> = {
      title: title.trim(),
      slug: slug.trim(),
      category,
      excerpt: excerpt.trim() || null,
      content: content.trim(),
      cover_image_url: coverImageUrl.trim() || null,
      read_time: readTime.trim() || '5 min',
      status: saveStatus,
    };
    if (saveStatus === 'published' && status !== 'published') {
      payload.published_at = new Date().toISOString();
    }

    const isEdit = subView === 'edit' && editId;
    const result = isEdit
      ? await supabase.from('blog_posts').update(payload).eq('id', editId!)
      : await supabase.from('blog_posts').insert(payload);

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
    } else {
      setSuccess(saveStatus === 'published' ? 'Artigo publicado com sucesso!' : 'Rascunho salvo!');
      setSaving(false);
      setTimeout(() => backToList(), 1200);
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

  // ── Editor view ──
  if (subView === 'new' || subView === 'edit') {
    if (editorLoading) {
      return (
        <div className="p-4 sm:p-8 flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
        </div>
      );
    }
    return (
      <div className="p-4 sm:p-8 max-w-5xl space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={backToList} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">{subView === 'edit' ? 'Editar Postagem' : 'Nova Postagem'}</h1>
            <p className="text-slate-500 text-sm">Blog Gula Pedidos</p>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 text-green-400 text-sm">
            <CheckCircle2 className="w-4 h-4 shrink-0" /> {success}
          </div>
        )}

        {showPreview ? (
          <div className="max-w-3xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 mb-4">{category}</span>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-4">{title || 'Sem título'}</h1>
            {coverImageUrl && (
              <div className="aspect-[16/9] rounded-xl overflow-hidden mb-6 bg-slate-800">
                <img src={coverImageUrl} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            {excerpt && <p className="text-lg text-slate-400 font-medium mb-6">{excerpt}</p>}
            <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: renderMarkdownPreview(content) }} />
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-5">
            {/* Main column */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <label className="block text-sm font-medium text-slate-400 mb-2">Título do artigo</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Digite o título do artigo…"
                  className="w-full text-lg font-semibold text-white placeholder-slate-600 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 focus:outline-none focus:border-amber-500 transition-colors"
                />
                <div className="mt-4">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Slug (URL)</label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500">/blog/</span>
                    <input
                      type="text"
                      value={slug}
                      onChange={e => { setSlug(slugify(e.target.value)); setSlugEdited(true); }}
                      placeholder="slug-do-artigo"
                      className="flex-1 text-sm text-slate-300 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500/50 transition-colors"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-slate-400">Conteúdo (Markdown)</label>
                  <button
                    type="button"
                    onClick={() => contentFileRef.current?.click()}
                    disabled={contentUploading}
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 transition-colors disabled:opacity-60"
                  >
                    {contentUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    {contentUploading ? 'Enviando...' : 'Inserir imagem'}
                  </button>
                  <input ref={contentFileRef} type="file" accept="image/*" className="hidden" onChange={onContentFileChange} />
                </div>
                <div
                  onDragOver={e => { e.preventDefault(); setContentDragging(true); }}
                  onDragLeave={() => setContentDragging(false)}
                  onDrop={onContentDrop}
                >
                  <textarea
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    placeholder="## Título da seção&#10;&#10;Escreva seu conteúdo em Markdown…&#10;&#10;Arraste imagens para o campo ou clique em 'Inserir imagem'"
                    rows={20}
                    className={`w-full font-mono text-sm text-slate-300 bg-slate-800 border rounded-xl px-4 py-3 focus:outline-none transition-colors resize-y leading-relaxed ${
                      contentDragging ? 'border-amber-400 bg-amber-500/5' : 'border-slate-700 focus:border-amber-500/50'
                    }`}
                  />
                </div>
                {contentUploadError && (
                  <p className="text-xs text-red-400 mt-2 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" /> {contentUploadError}
                  </p>
                )}
                <p className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  Use Markdown: ## para títulos, **negrito**, - para listas, {'>'} para citações · Arraste imagens para o campo
                </p>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-slate-300 mb-4">Publicação</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => save('published')}
                    disabled={saving}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold disabled:opacity-60 transition-colors"
                  >
                    <Send className="w-4 h-4" /> Publicar Artigo
                  </button>
                  <button
                    onClick={() => save('draft')}
                    disabled={saving}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-sm font-semibold hover:bg-slate-800 disabled:opacity-60 transition-colors"
                  >
                    <Save className="w-4 h-4" /> Salvar Rascunho
                  </button>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-800">
                  <p className="text-xs text-slate-500">Status atual:</p>
                  <p className="text-sm font-medium text-slate-300 mt-0.5">
                    {status === 'published' ? 'Publicado' : 'Rascunho'}
                  </p>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-slate-300 mb-3">Visualização</h3>
                <button
                  onClick={() => setShowPreview(v => !v)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-sm font-semibold hover:bg-slate-800 transition-colors"
                >
                  <Eye className="w-4 h-4" /> {showPreview ? 'Editar' : 'Preview'}
                </button>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <label className="block text-sm font-medium text-slate-400 mb-2">Categoria</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-amber-500/50 transition-colors"
                >
                  {BLOG_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <label className="block text-sm font-medium text-slate-400 mb-2">Imagem de capa</label>
                <ImageUpload value={coverImageUrl} onChange={setCoverImageUrl} bucket="blog-images" folder="covers" />
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <label className="block text-sm font-medium text-slate-400 mb-2">Resumo (Excerpt)</label>
                <textarea
                  value={excerpt}
                  onChange={e => setExcerpt(e.target.value)}
                  placeholder="Resumo curto para os cards…"
                  rows={3}
                  className="w-full text-sm text-slate-300 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500/50 transition-colors resize-none"
                />
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <label className="block text-sm font-medium text-slate-400 mb-2">Tempo de leitura</label>
                <input
                  type="text"
                  value={readTime}
                  onChange={e => setReadTime(e.target.value)}
                  placeholder="5 min"
                  className="w-full text-sm text-slate-300 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 focus:outline-none focus:border-amber-500/50 transition-colors"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── List view ──
  return (
    <div className="p-4 sm:p-8 space-y-5 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Newspaper className="w-5 h-5 text-amber-400" /> Blog
          </h1>
          <p className="text-slate-500 text-sm mt-1">Gerencie as postagens do blog Gula</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black transition-colors"
        >
          <Plus className="w-4 h-4" /> Criar Novo Post
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-white">{posts.length}</p>
              <p className="text-[11px] text-slate-500">Total</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-green-500/15 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-white">{publishedCount}</p>
              <p className="text-[11px] text-slate-500">Publicados</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-white">{draftCount}</p>
              <p className="text-[11px] text-slate-500">Rascunhos</p>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar postagens…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>
        <div className="flex items-center gap-2">
          {(['all', 'published', 'draft'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3.5 py-2 rounded-full text-sm font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-amber-500 text-black'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:border-amber-500/30'
              }`}
            >
              {s === 'all' ? 'Todos' : s === 'published' ? 'Publicados' : 'Rascunhos'}
            </button>
          ))}
        </div>
      </div>

      {/* Posts list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 animate-pulse">
              <div className="flex gap-4">
                <div className="w-20 h-14 bg-slate-800 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 bg-slate-800 rounded w-2/3" />
                  <div className="h-4 bg-slate-800 rounded w-1/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-2xl">
          <Newspaper className="w-12 h-12 text-slate-700 mx-auto mb-4" />
          <p className="text-slate-500 text-sm mb-4">Nenhuma postagem encontrada.</p>
          <button onClick={openNew} className="inline-flex items-center gap-2 text-amber-400 font-semibold hover:text-amber-300 text-sm">
            <Plus className="w-4 h-4" /> Criar primeira postagem
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(post => (
            <div key={post.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-4 hover:border-slate-700 transition-colors">
              {/* Thumbnail */}
              <div className="w-20 h-14 rounded-lg overflow-hidden bg-slate-800 shrink-0">
                {post.cover_image_url ? (
                  <img src={post.cover_image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Newspaper className="w-6 h-6 text-slate-700" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    post.status === 'published' ? 'bg-green-500/15 text-green-400' : 'bg-amber-500/15 text-amber-400'
                  }`}>
                    {post.status === 'published' ? 'Publicado' : 'Rascunho'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-400">{post.category}</span>
                </div>
                <h3 className="font-semibold text-white truncate">{post.title}</h3>
                <p className="text-xs text-slate-500">/blog/{post.slug} · {formatDate(post.published_at ?? post.created_at)}</p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => toggleStatus(post)}
                  className="p-2 rounded-lg text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors"
                  title={post.status === 'published' ? 'Despublicar' : 'Publicar'}
                >
                  {post.status === 'published' ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => openEdit(post.id)}
                  className="p-2 rounded-lg text-slate-500 hover:bg-slate-800 hover:text-amber-400 transition-colors"
                  title="Editar"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setDeleteId(post.id)}
                  className="p-2 rounded-lg text-slate-500 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                  title="Excluir"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteId && (
        <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-500/15 flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="font-bold text-white">Excluir postagem?</h3>
                <p className="text-sm text-slate-500">Esta ação não pode ser desfeita.</p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 font-medium hover:bg-slate-800 transition-colors"
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
