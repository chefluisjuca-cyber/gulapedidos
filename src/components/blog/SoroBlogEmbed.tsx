import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';

const SORO_EMBED_ID = 'soro-blog';
const SORO_SCRIPT_SRC = 'https://app.trysoro.com/api/embed/e633213f-35fd-4a83-b615-3184e9f084d1';

function GulaCta() {
  return (
    <div className="mt-10">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-600 to-orange-700 px-6 py-10 sm:px-12 sm:py-14 text-center shadow-xl shadow-orange-600/20">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="relative">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/15 text-white text-sm font-medium mb-5">
            <Sparkles className="w-4 h-4" />
            Sistema para Restaurantes
          </div>
          <h3 className="text-2xl sm:text-3xl font-bold text-white mb-3 leading-tight">
            Conheça o Gula Pedidos
          </h3>
          <p className="text-orange-50 text-base sm:text-lg max-w-2xl mx-auto mb-7 leading-relaxed">
            O sistema completo para gerenciar pedidos, cardápio digital, fila de espera, fidelidade e muito mais. Teste grátis por 7 dias, sem cartão de crédito.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-white text-orange-600 font-bold text-base hover:bg-orange-50 transition-colors shadow-lg"
          >
            Começar Teste Grátis de 7 Dias
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

interface Props {
  /** When set, hides posts beyond this count and shows a "ver todos" link */
  maxPosts?: number;
}

export default function SoroBlogEmbed({ maxPosts }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const isArticlePage = /^\/blog\/[^/]+/.test(location.pathname);

  useEffect(() => {
    if (document.getElementById('soro-embed-script')) return;

    const script = document.createElement('script');
    script.id = 'soro-embed-script';
    script.src = SORO_SCRIPT_SRC;
    script.defer = true;
    document.body.appendChild(script);

    return () => {
      const existing = document.getElementById('soro-embed-script');
      if (existing) existing.remove();
      const embed = document.getElementById(SORO_EMBED_ID);
      if (embed) embed.innerHTML = '';
    };
  }, []);

  // When maxPosts is set, observe the embed container and hide excess posts
  useEffect(() => {
    if (!maxPosts) return;
    const container = containerRef.current;
    if (!container) return;

    let linkAdded = false;

    function applyLimit() {
      const embed = document.getElementById(SORO_EMBED_ID);
      if (!embed) return;

      // Soro renders post cards as <article> or <a> elements inside the embed
      const posts = embed.querySelectorAll('article, [data-soro-post], .soro-post, a[href*="/blog/"]');
      if (posts.length === 0) return;

      posts.forEach((post, idx) => {
        const el = post as HTMLElement;
        if (idx >= maxPosts!) {
          el.style.display = 'none';
        } else {
          el.style.display = '';
        }
      });

      if (!linkAdded) {
        linkAdded = true;
        const wrapper = document.createElement('div');
        wrapper.style.textAlign = 'center';
        wrapper.style.marginTop = '2.5rem';
        wrapper.innerHTML = `<a href="/blog" style="display:inline-flex;align-items:center;gap:0.5rem;padding:0.875rem 2rem;border-radius:9999px;background:#ea580c;color:white;font-weight:700;font-size:0.95rem;text-decoration:none;transition:background 0.2s;">Ver todos os artigos →</a>`;
        embed.appendChild(wrapper);
      }
    }

    // Run immediately in case content is already there
    applyLimit();

    const observer = new MutationObserver(() => applyLimit());
    observer.observe(container, { childList: true, subtree: true });

    // Also re-check after a delay (script loads async)
    const timeout = setTimeout(applyLimit, 2000);
    const timeout2 = setTimeout(applyLimit, 4000);

    return () => {
      observer.disconnect();
      clearTimeout(timeout);
      clearTimeout(timeout2);
    };
  }, [maxPosts]);

  return (
    <div>
      <div id={SORO_EMBED_ID} ref={containerRef} />
      {isArticlePage && <GulaCta />}
    </div>
  );
}
