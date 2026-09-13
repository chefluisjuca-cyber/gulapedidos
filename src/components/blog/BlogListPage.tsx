import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ArrowLeft, Search, FileText } from 'lucide-react';
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
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/gula-pedidos-digial.png" alt="Gula Pedidos" className="w-8 h-8 object-contain" />
            <span className="font-bold text-white">Gula Pedidos</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="flex items-center gap-1.5 text-sm font-semibold text-slate-300 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </Link>
            <Link
              to="/cadastrar"
              className="px-4 py-2 rounded-full bg-amber-500 text-black text-sm font-bold hover:bg-amber-400 transition-colors"
            >
              Testar 7 Dias Grátis
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 py-12 sm:py-16 border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm font-medium mb-4">
            <Sparkles className="w-4 h-4" />
            Blog Gula Pedidos
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Dicas de Gesto para Restaurantes
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            Contedos prticos escritos por quem entende a rotina real de um restaurante.
          </p>
        </div>
      </section>

      {/* Search bar */}
      <section className="sticky top-16 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 py-4">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pesquisar artigos..."
              className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-sm font-medium focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all"
            />
          </div>
        </div>
      </section>

      {/* Blog embed + no-results message */}
      <section className="py-8 sm:py-12 min-h-[400px]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          {noResults && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mb-5">
                <FileText className="w-8 h-8 text-slate-500" />
              </div>
              <p className="text-lg font-semibold text-slate-300 mb-1">Nenhum artigo encontrado para a sua busca.</p>
              <p className="text-sm text-slate-500">Tente outro termo ou remova o filtro.</p>
            </div>
          )}
          <div ref={containerRef}>
            <SoroBlogEmbed />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-gradient-to-br from-amber-500 to-orange-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Pronto para modernizar seu restaurante?
          </h2>
          <p className="text-amber-50 text-lg mb-8">
            Teste o Gula Pedidos por 7 dias grtis. Sem carto de crdito.
          </p>
          <Link
            to="/cadastrar"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-slate-900 text-white font-bold hover:bg-slate-800 transition-colors shadow-xl"
          >
            Comear Agora
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <img src="/gula-pedidos-digial.png" alt="Gula" className="w-7 h-7 object-contain" />
            <span className="text-sm font-semibold text-slate-300">Gula Pedidos Digital</span>
          </div>
          <span className="text-xs text-slate-500">© {new Date().getFullYear()} Gula Pedidos. Todos os direitos reservados.</span>
        </div>
      </footer>
    </div>
  );
}
