import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Save, Send, AlertCircle, CheckCircle2, Image as ImageIcon,
  FileText, Eye, X,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { BlogPost } from '../../types/blog';
import { BLOG_CATEGORIES } from '../../types/blog';

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

function renderMarkdownPreview(md: string): string {
  let html = md;
  html = html.replace(/^### (.*$)/gm, '<h3 class="text-lg font-bold text-slate-900 mt-6 mb-2">$1</h3>');
  html = html.replace(/^## (.*$)/gm, '<h2 class="text-xl font-bold text-slate-900 mt-8 mb-3">$1</h2>');
  html = html.replace(/^> (.*$)/gm, '<blockquote class="border-l-4 border-orange-400 pl-4 italic text-slate-600 my-4">$1</blockquote>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-slate-900">$1</strong>');
  html = html.replace(/^- (.*$)/gm, '<li class="text-slate-600 ml-6 list-disc">$1</li>');
  html = html.replace(/\n\n/g, '</p><p class="text-slate-600 leading-relaxed mb-3">');
  html = html.replace(/\n/g, '<br>');
  html = `<p class="text-slate-600 leading-relaxed mb-3">${html}</p>`;
  return html;
}

export default function BlogAdminEditor() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [category, setCategory] = useState<string>(BLOG_CATEGORIES[0]);
  const [excerpt, setExcerpt] = useState('');
  const [content, setContent] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [readTime, setReadTime] = useState('5 min');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('blog_posts')
      .select('*')
      .eq('id', id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) {
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
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    if (!slugEdited) {
      setSlug(slugify(title));
    }
  }, [title, slugEdited]);

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

    let result;
    if (isEdit) {
      result = await supabase.from('blog_posts').update(payload).eq('id', id!);
    } else {
      result = await supabase.from('blog_posts').insert(payload);
    }

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
    } else {
      setSuccess(saveStatus === 'published' ? 'Artigo publicado com sucesso!' : 'Rascunho salvo!');
      setSaving(false);
      setTimeout(() => navigate('/admin/dashboard'), 1200);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/admin/dashboard" className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-sm font-bold text-slate-900">
              {isEdit ? 'Editar Postagem' : 'Nova Postagem'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPreview(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <Eye className="w-4 h-4" /> {showPreview ? 'Editar' : 'Preview'}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {error && (
          <div className="mb-6 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}
        {success && (
          <div className="mb-6 flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-green-600 text-sm">
            <CheckCircle2 className="w-4 h-4 shrink-0" /> {success}
          </div>
        )}

        {showPreview ? (
          /* Preview mode */
          <div className="max-w-3xl mx-auto bg-white rounded-2xl border border-slate-200 p-8">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 mb-4">{category}</span>
            <h1 className="text-3xl font-bold text-slate-900 mb-4">{title || 'Sem título'}</h1>
            {coverImageUrl && (
              <div className="aspect-[16/9] rounded-xl overflow-hidden mb-6 bg-slate-100">
                <img src={coverImageUrl} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            {excerpt && <p className="text-lg text-slate-600 font-medium mb-6">{excerpt}</p>}
            <div dangerouslySetInnerHTML={{ __html: renderMarkdownPreview(content) }} />
          </div>
        ) : (
          /* Edit mode */
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Main column */}
            <div className="lg:col-span-2 space-y-5">
              {/* Title */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <label className="block text-sm font-medium text-slate-700 mb-2">Título do artigo</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Digite o título do artigo…"
                  className="w-full text-lg font-semibold text-slate-900 placeholder-slate-300 border-0 border-b-2 border-transparent focus:border-orange-400 focus:outline-none pb-1 transition-colors"
                />
                <div className="mt-4">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Slug (URL)</label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-400">/blog/</span>
                    <input
                      type="text"
                      value={slug}
                      onChange={e => { setSlug(slugify(e.target.value)); setSlugEdited(true); }}
                      placeholder="slug-do-artigo"
                      className="flex-1 text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Content editor */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <label className="block text-sm font-medium text-slate-700 mb-2">Conteúdo (Markdown)</label>
                <textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="## Título da seção&#10;&#10;Escreva seu conteúdo em Markdown…"
                  rows={20}
                  className="w-full font-mono text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition-all resize-y leading-relaxed"
                />
                <p className="text-xs text-slate-400 mt-2 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  Use Markdown: ## para títulos, **negrito**, - para listas, {'>'} para citações
                </p>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-5">
              {/* Publish actions */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-4">Publicação</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => save('published')}
                    disabled={saving}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 disabled:bg-slate-400 transition-colors"
                  >
                    <Send className="w-4 h-4" /> Publicar Artigo
                  </button>
                  <button
                    onClick={() => save('draft')}
                    disabled={saving}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 disabled:bg-slate-100 transition-colors"
                  >
                    <Save className="w-4 h-4" /> Salvar Rascunho
                  </button>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="text-xs text-slate-400">Status atual:</p>
                  <p className="text-sm font-medium text-slate-700 mt-0.5">
                    {status === 'published' ? 'Publicado' : 'Rascunho'}
                  </p>
                </div>
              </div>

              {/* Category */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <label className="block text-sm font-medium text-slate-700 mb-2">Categoria</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition-all"
                >
                  {BLOG_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Cover image */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <label className="block text-sm font-medium text-slate-700 mb-2">Imagem de capa (URL)</label>
                <div className="relative">
                  <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="url"
                    value={coverImageUrl}
                    onChange={e => setCoverImageUrl(e.target.value)}
                    placeholder="https://…"
                    className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition-all"
                  />
                </div>
                {coverImageUrl && (
                  <div className="mt-3 aspect-[16/9] rounded-lg overflow-hidden bg-slate-100">
                    <img src={coverImageUrl} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>

              {/* Excerpt */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <label className="block text-sm font-medium text-slate-700 mb-2">Resumo (Excerpt)</label>
                <textarea
                  value={excerpt}
                  onChange={e => setExcerpt(e.target.value)}
                  placeholder="Resumo curto para os cards…"
                  rows={3}
                  className="w-full text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition-all resize-y"
                />
              </div>

              {/* Read time */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <label className="block text-sm font-medium text-slate-700 mb-2">Tempo de leitura</label>
                <input
                  type="text"
                  value={readTime}
                  onChange={e => setReadTime(e.target.value)}
                  placeholder="5 min"
                  className="w-full text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition-all"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
