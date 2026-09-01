import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, PlayCircle, Share2, Youtube, CheckCircle2, LogIn } from 'lucide-react';

interface Tutorial {
  id: number;
  title: string;
  videoId: string;
  url: string;
}

const TUTORIALS: Tutorial[] = [
  { id: 1, title: 'Tutorial Completo', videoId: 'J9pNQwQe3C8', url: 'https://youtu.be/J9pNQwQe3C8' },
  { id: 2, title: 'Primeiros Passos', videoId: '84ZzKzTXnM8', url: 'https://youtu.be/84ZzKzTXnM8' },
  { id: 3, title: 'Configurando o Cardápio', videoId: '9qRrC3ny05U', url: 'https://youtu.be/9qRrC3ny05U' },
  { id: 4, title: 'Sistema de Fidelidade', videoId: 'Fjq9tQnzySY', url: 'https://youtu.be/Fjq9tQnzySY' },
  { id: 5, title: 'Operação de Pedidos e Canais de Vendas', videoId: 'TFpHH5C_8cw', url: 'https://youtu.be/TFpHH5C_8cw' },
  { id: 6, title: 'Gestão de Etiquetas', videoId: 'hiIZb8QV-LA', url: 'https://youtu.be/hiIZb8QV-LA' },
  { id: 7, title: 'Gestão e Indicadores', videoId: 'UBceIK2xaKI', url: 'https://youtu.be/UBceIK2xaKI' },
];

function VideoCard({ tutorial }: { tutorial: Tutorial }) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const shareData = {
      title: `Gula Pedidos — ${tutorial.title}`,
      text: `Confira este tutorial: ${tutorial.title}`,
      url: tutorial.url,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // user cancelled — no action needed
      }
    } else {
      try {
        await navigator.clipboard.writeText(tutorial.url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // fallback failed — no action needed
      }
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Title bar */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
        <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white text-sm font-bold shrink-0">
          {tutorial.id}
        </span>
        <h3 className="font-bold text-slate-900 text-base sm:text-lg leading-tight">{tutorial.title}</h3>
      </div>

      {/* Responsive YouTube embed — 16:9 aspect ratio, visible on all devices */}
      <div className="relative w-full" style={{ aspectRatio: '16 / 9' }}>
        <iframe
          className="absolute inset-0 w-full h-full"
          src={`https://www.youtube.com/embed/${tutorial.videoId}`}
          title={tutorial.title}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-3 px-5 py-4 border-t border-slate-100">
        <button
          onClick={handleShare}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-amber-600 px-4 py-2 rounded-lg border border-slate-200 hover:border-amber-300 transition-all"
        >
          {copied ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Link copiado!</span>
            </>
          ) : (
            <>
              <Share2 className="w-4 h-4" />
              <span>Compartilhar</span>
            </>
          )}
        </button>
        <a
          href={tutorial.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg transition-all"
        >
          <Youtube className="w-4 h-4" />
          <span>Assistir no YouTube</span>
        </a>
      </div>
    </div>
  );
}

export default function TutorialsPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Nav */}
      <nav className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/gula-pedidos-digial.png" alt="Gula" className="w-8 h-8 object-contain" />
            <span className="font-bold text-lg tracking-tight text-slate-900">Gula Pedidos</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 px-3 py-2 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Início
            </button>
            <button
              onClick={() => navigate('/entrar')}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 px-3 py-2 transition-colors"
            >
              <LogIn className="w-4 h-4" /> Entrar
            </button>
            <button
              onClick={() => navigate('/cadastrar')}
              className="text-sm font-semibold px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white transition-all shadow-lg shadow-amber-500/20"
            >
              Teste grátis
            </button>
          </div>
        </div>
      </nav>

      {/* Header */}
      <section className="relative overflow-hidden bg-gradient-to-b from-amber-50 to-white">
        <div className="pointer-events-none absolute -top-40 -left-40 w-[28rem] h-[28rem] bg-amber-200/40 rounded-full blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -right-40 w-[28rem] h-[28rem] bg-orange-200/40 rounded-full blur-3xl" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 pt-16 sm:pt-20 pb-10 text-center">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
              <PlayCircle className="w-9 h-9 text-white" />
            </div>
          </div>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-100 border border-amber-300 text-amber-700 text-sm font-medium mb-5">
            <PlayCircle className="w-4 h-4" />
            Central de Tutoriais
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold leading-[1.1] tracking-tight text-slate-900">
            Aprenda a usar o{' '}
            <span className="bg-gradient-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent">
              Gula Pedidos
            </span>{' '}
            do zero ao avançado
          </h1>
          <p className="mt-5 text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto">
            Sete vídeos passo a passo para você dominar todas as funcionalidades do sistema.
            Assista no YouTube ou compartilhe com sua equipe.
          </p>
        </div>
      </section>

      {/* Videos grid */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          {TUTORIALS.map((t) => (
            <VideoCard key={t.id} tutorial={t} />
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-16">
        <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 sm:p-12 text-center shadow-xl">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Pronto para colocar em prática?</h2>
          <p className="text-white/80 max-w-md mx-auto mb-7">
            Crie sua conta agora e tenha 7 dias de acesso completo a todas as funcionalidades.
          </p>
          <button
            onClick={() => navigate('/cadastrar')}
            className="inline-flex items-center gap-2 text-base font-semibold px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white transition-all shadow-xl shadow-amber-500/25 hover:-translate-y-0.5"
          >
            Comece Agora — 7 Dias Grátis
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <img src="/gula-pedidos-digial.png" alt="Gula" className="w-7 h-7 object-contain" />
            <span className="text-sm font-semibold text-slate-700">Gula Pedidos Digital</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span>contato@vertexapps.com.br</span>
            <span>© {new Date().getFullYear()} Gula Pedidos. Todos os direitos reservados.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
