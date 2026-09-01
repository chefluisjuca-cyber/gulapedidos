import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';

const SORO_EMBED_ID = 'soro-blog';
const SORO_SCRIPT_SRC = 'https://app.trysoro.com/api/embed/e633213f-35fd-4a83-b615-3184e9f084d1';

function GulaCta() {
  return (
    <div className="mt-10">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-600 to-orange-700 px-6 py-10 sm:px-12 sm:py-14 text-center shadow-xl shadow-orange-600/20">
        {/* Decorative background dots */}
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

export default function SoroBlogEmbed() {
  const containerRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const isArticlePage = /^\/blog\/[^/]+/.test(location.pathname);

  useEffect(() => {
    // Avoid duplicate script injection in dev / re-renders
    if (document.getElementById('soro-embed-script')) return;

    const script = document.createElement('script');
    script.id = 'soro-embed-script';
    script.src = SORO_SCRIPT_SRC;
    script.defer = true;
    document.body.appendChild(script);

    return () => {
      // Clean up the injected script and rendered content on unmount
      const existing = document.getElementById('soro-embed-script');
      if (existing) existing.remove();
      const embed = document.getElementById(SORO_EMBED_ID);
      if (embed) embed.innerHTML = '';
    };
  }, []);

  return (
    <div>
      <div id={SORO_EMBED_ID} ref={containerRef} />
      {isArticlePage && <GulaCta />}
    </div>
  );
}
