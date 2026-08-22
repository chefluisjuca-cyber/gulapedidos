import { useState, useEffect } from 'react';
import { Download, X, Smartphone, Monitor } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'gula-pwa-install-dismissed';

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOS, setShowIOS] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (sessionStorage.getItem(DISMISS_KEY)) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    if (isIOS() && !isStandalone()) {
      const t = setTimeout(() => {
        setShowIOS(true);
        setVisible(true);
      }, 3000);
      return () => {
        clearTimeout(t);
        window.removeEventListener('beforeinstallprompt', handler);
      };
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setVisible(false);
    setDeferredPrompt(null);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[9999] flex justify-center pointer-events-none">
      <div className="pointer-events-auto max-w-md w-full bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 animate-in slide-in-from-bottom duration-300">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white">
            {isIOS() ? <Smartphone className="w-6 h-6" /> : <Download className="w-6 h-6" />}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-slate-900">Adicionar à tela inicial</h3>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              {showIOS ? (
                <>Toque no botão <Download className="inline w-3 h-3" /> "Compartilhar" do Safari e depois em "Adicionar à Tela de Início".</>
              ) : (
                <>Instale o Gula como app para acesso rápido e funcionamento offline.</>
              )}
            </p>
          </div>
          <button
            onClick={dismiss}
            className="flex-shrink-0 text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {!showIOS && (
          <button
            onClick={handleInstall}
            className="mt-3 w-full bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {isIOS() ? <Smartphone className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
            Instalar aplicativo
          </button>
        )}
      </div>
    </div>
  );
}
