import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ArrowLeft, Search, FileText, Home } from 'lucide-react';
import SoroBlogEmbed from './SoroBlogEmbed';

const SORO_EMBED_ID = 'soro-blog';

export default function BlogListPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [noResults, setNoResults] = useState(false);

  useEffect(() => {
    document.title = 'Blog | Gula Pedidos — Dicas de Gestão para Restaurantes';
  }, []);

  // Filtering logic: observe the Soro embed, filter cards by query
  useEffect(() => {
    const embed = document.getElementById(SORO_EMBED_ID);
    if (!embed) return;

    function filterPosts() {
      const el = document.getElementById(SORO_EMBED_ID);
      if (!el) return;

      const posts = el.querySelectorAll('article, [data-soro-post], .soro-post, a[href*="/blog/"]');
      if (posts.length === 0) return;

      const term = query.trim().toLowerCase();
      let visibleCount = 0;

      posts.forEach((post) => {
        const pe = post as HTMLElement;
        if (!term) {
          pe.style.display = '';
          visibleCount++;
          return;
        }
        const text = (pe.textContent ?? '').toLowerCase();
        if (text.includes(term)) {
          pe.style.display = '';
          visibleCount++;
        } else {
          pe.style.display = 'none';
        }
      });

      setNoResults(visibleCount === 0);
    }

    filterPosts();

    const observer = new MutationObserver(() => filterPosts());
    observer.observe(embed, { childList: true, subtree: true });

    const timeouts = [setTimeout(filterPosts, 1500), setTimeout(filterPosts, 3000), setTimeout(filterPosts, 5000)];

    return () => {
      observer.disconnect();
      timeouts.forEach(clearTimeout);
    };
  }, [query]);

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/gula-pedidos-digial.png" alt="Gula Pedidos" className="w-8 h-8 object-contain" />
            <span className="font-bold text-slate-900">Gula Pedidos</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
            >
              <Home className="w-4 h-4" />
              <span className="hidden sm:inline">Voltar para o Início</span>
              <span className="sm:hidden">Início</span>
            </Link>
            <Link
              to="/cadastrar"
              className="px-4 py-2 rounded-full bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 transition-colors"
            >
              Testar 7 Dias Grátis
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-orange-50 via-white to-amber-50 py-12 sm:py-16 border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-100 text-orange-700 text-sm font-medium mb-4">
            <Sparkles className="w-4 h-4" />
            Blog Gula Pedidos
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-4">
            Dicas de Gestão para Restaurantes
          </h1>
          <p className="text-slate-500 text-lg max-w-2xl mx-auto">
            Conteúdos práticos escritos por quem entende a rotina real de um restaurante.
          </p>
        </div>
      </section>

      {/* Search bar */}
      <section className="sticky top-16 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 py-4">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pesquisar artigos..."
              className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-slate-100 border border-slate-200 text-slate-900 placeholder-slate-400 text-sm font-medium focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
            />
          </div>
        </div>
      </section>

      {/* Blog embed + no-results message */}
      <section className="py-8 sm:py-12 min-h-[400px]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          {/* Navigation buttons: left = home, right = trial */}
          <div className="flex items-center justify-between gap-3 mb-8">
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white border border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-colors"
            >
              <Home className="w-4 h-4" />
              Voltar para o Início
            </Link>
            <Link
              to="/cadastrar"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-orange-600 text-white font-semibold text-sm hover:bg-orange-700 transition-colors"
            >
              Testar 7 Dias Grátis
            </Link>
          </div>

          {noResults && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-5">
                <FileText className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-lg font-semibold text-slate-700 mb-1">Nenhum artigo encontrado para a sua busca.</p>
              <p className="text-sm text-slate-500">Tente outro termo ou remova o filtro.</p>
            </div>
          )}
          <div ref={containerRef}>
            <SoroBlogEmbed />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-gradient-to-br from-orange-600 to-orange-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Pronto para modernizar seu restaurante?
          </h2>
          <p className="text-orange-100 text-lg mb-8">
            Teste o Gula Pedidos por 7 dias grátis. Sem cartão de crédito.
          </p>
          <Link
            to="/cadastrar"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-white text-orange-600 font-bold hover:bg-orange-50 transition-colors shadow-xl"
          >
            Começar Agora
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <img src="/gula-pedidos-digial.png" alt="Gula" className="w-7 h-7 object-contain" />
            <span className="text-sm font-semibold text-slate-700">Gula Pedidos Digital</span>
          </div>
          <span className="text-xs text-slate-500">© {new Date().getFullYear()} Gula Pedidos. Todos os direitos reservados.</span>
        </div>
      </footer>
    </div>
  );
}
