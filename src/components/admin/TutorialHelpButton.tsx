import { useState } from 'react';
import { HelpCircle, X, Youtube, Share2, CheckCircle2 } from 'lucide-react';

interface Props {
  videoId: string;
  title: string;
}

export default function TutorialHelpButton({ videoId, title }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const url = `https://youtu.be/${videoId}`;

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title: `Gula Pedidos — ${title}`, url });
      } catch {
        // cancelled
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // fallback failed
      }
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 border border-amber-500/40 hover:bg-amber-500/10 rounded-lg px-3 py-1.5 transition-all mt-2"
      >
        <HelpCircle className="w-3.5 h-3.5" />
        Dúvidas sobre este módulo? Clique aqui.
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-[#0f2040] border border-[#1e3868] rounded-2xl w-full max-w-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e3868]">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-amber-400" />
                {title}
              </h3>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative w-full bg-black" style={{ aspectRatio: '16 / 9' }}>
              <iframe
                className="absolute inset-0 w-full h-full"
                src={`https://www.youtube.com/embed/${videoId}`}
                title={title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>

            <div className="flex items-center gap-3 px-5 py-4 border-t border-[#1e3868]">
              <button
                onClick={handleShare}
                className="inline-flex items-center gap-2 text-xs font-medium text-slate-300 hover:text-amber-400 px-3 py-2 rounded-lg border border-[#1e3868] hover:border-amber-500/30 transition-all"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Link copiado!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Compartilhar</span>
                  </>
                )}
              </button>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs font-medium text-white bg-red-600 hover:bg-red-700 px-3 py-2 rounded-lg transition-all"
              >
                <Youtube className="w-3.5 h-3.5" />
                <span>Assistir no YouTube</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
