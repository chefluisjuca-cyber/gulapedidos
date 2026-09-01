import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import SoroBlogEmbed from './SoroBlogEmbed';

export default function BlogListPage() {
  useEffect(() => {
    document.title = 'Blog | Gula Pedidos — Dicas de Gestão para Restaurantes';
  }, []);

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/gula-pedidos-digial.png" alt="Gula Pedidos" className="w-8 h-8 object-contain" />
            <span className="font-bold text-slate-900">Gula Pedidos</span>
          </Link>
          <Link
            to="/cadastrar"
            className="px-4 py-2 rounded-full bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 transition-colors"
          >
            Testar 7 Dias Grátis
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-orange-50 via-white to-amber-50 py-12 sm:py-16">
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

      {/* Soro blog embed */}
      <section className="py-8 sm:py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <SoroBlogEmbed />
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
