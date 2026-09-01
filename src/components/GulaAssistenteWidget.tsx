import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Minus, Send, Bot, Sparkles } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  'Como funciona o cardápio digital?',
  'Quais planos estão disponíveis?',
  'O sistema cobra comissão por pedido?',
  'Como funciona o delivery próprio?',
];

export default function GulaAssistenteWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Olá! Sou o Assistente Gula. Posso responder sobre o cardápio digital, delivery, fidelidade, etiquetas de validade, planos e muito mais. Como posso ajudar?',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [footerVisible, setFooterVisible] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      inputRef.current?.focus();
    }
  }, [isOpen, isMinimized]);

  // Lift the floating button above the footer when it's visible so it doesn't cover social links
  useEffect(() => {
    const footer = document.querySelector('footer');
    if (!footer) return;
    const observer = new IntersectionObserver(
      ([entry]) => setFooterVisible(entry.isIntersecting),
      { rootMargin: '0px 0px -90% 0px' },
    );
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  async function handleSend(text?: string) {
    const trimmed = (text ?? input).trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: trimmed };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/knowledge-base-chat`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          message: trimmed,
          agent: 'geral',
          history: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error ?? `Erro ${res.status}`);
      }

      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao consultar a IA';
      const isRateLimit = msg.includes('429') || msg.includes('Limite') || msg.includes('instantes');
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: isRateLimit
          ? 'O sistema recebeu muitas consultas em pouco tempo. Aguarde alguns segundos e tente enviar novamente.'
          : `Desculpe, não consegui responder agora: ${msg}. Tente novamente em instantes.`,
      }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleToggle() {
    setIsOpen(prev => !prev);
    setIsMinimized(false);
  }

  return (
    <>
      {!isOpen && (
        <button
          onClick={handleToggle}
          className={`fixed right-4 sm:right-5 z-[9999] flex items-center gap-3 group transition-all duration-300 ${
            footerVisible ? 'bottom-40 sm:bottom-28' : 'bottom-20 sm:bottom-5'
          }`}
          aria-label="Conversar com o Assistente Gula"
        >
          <div className="hidden sm:flex items-center px-4 py-2.5 rounded-full bg-[#0f2040] border border-amber-500/30 shadow-lg group-hover:border-amber-500/50 transition-colors">
            <span className="text-sm font-medium text-amber-200 whitespace-nowrap">
              Tire suas dúvidas com o Assistente Gula
            </span>
          </div>
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-xl group-hover:scale-105 transition-transform">
            <MessageCircle className="w-6 h-6 text-black" />
          </div>
        </button>
      )}

      {isOpen && (
        <div
          className={`fixed right-4 sm:right-5 z-[9999] bg-[#0f2040] border border-[#1e3868] rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${
            footerVisible ? 'bottom-40 sm:bottom-28' : 'bottom-20 sm:bottom-5'
          } ${
            isMinimized ? 'w-72 h-14' : 'w-[calc(100vw-2rem)] sm:w-96 h-[min(600px,calc(100vh-2.5rem))]'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-[#1e3868] bg-gradient-to-r from-[#0f2040] to-[#13284f]">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shrink-0">
                <Bot className="w-5 h-5 text-black" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-white truncate">Assistente Gula</h3>
                <p className="text-[11px] text-slate-400 truncate">Tire suas dúvidas sobre a plataforma</p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setIsMinimized(prev => !prev)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1a3260] transition-colors"
                aria-label="Minimizar"
              >
                <Minus className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1a3260] transition-colors"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 p-4">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'assistant' ? 'justify-start' : 'justify-end'}`}>
                    <div className={`flex gap-2 max-w-[85%] ${msg.role === 'assistant' ? 'flex-row' : 'flex-row-reverse'}`}>
                      {msg.role === 'assistant' && (
                        <div className="shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                          <Bot className="w-4 h-4 text-black" />
                        </div>
                      )}
                      <div className={`px-3.5 py-2.5 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed ${
                        msg.role === 'assistant'
                          ? 'bg-[#0a1830] border border-[#1e3868] text-slate-200 rounded-tl-sm'
                          : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-100 rounded-tr-sm'
                      }`}>
                        {msg.content}
                      </div>
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex justify-start">
                    <div className="flex gap-2">
                      <div className="shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                        <Bot className="w-4 h-4 text-black" />
                      </div>
                      <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-[#0a1830] border border-[#1e3868] flex items-center gap-1.5">
                        <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Suggestion chips — only show when conversation is just the greeting */}
              {messages.length === 1 && !loading && (
                <div className="px-4 pb-2 flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleSend(s)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1a3260] border border-[#2a4878] text-xs font-medium text-slate-300 hover:border-amber-500/50 hover:text-amber-200 transition-colors"
                    >
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {/* Input area */}
              <div className="p-3 border-t border-[#1e3868]">
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Digite sua pergunta…"
                    disabled={loading}
                    className="flex-1 bg-[#0a1830] border border-[#1e3868] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none transition-colors disabled:opacity-50"
                  />
                  <button
                    onClick={() => handleSend()}
                    disabled={!input.trim() || loading}
                    className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-[#1a3260] disabled:text-slate-500 text-black transition-colors shrink-0"
                    aria-label="Enviar"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
