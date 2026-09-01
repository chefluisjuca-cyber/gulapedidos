import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Minus, Send, Bot } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface GulaEspecialistaWidgetProps {
  restaurantId?: string;
}

const DAILY_LIMIT = 10;

export default function GulaEspecialistaWidget({ restaurantId }: GulaEspecialistaWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Olá! Sou o Gula Especialista. Digite o nome de um alimento (ex: "maionese caseira", "carne moída") e eu te direi o prazo de validade, armazenamento e temperatura ideais.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [usageToday, setUsageToday] = useState(0);
  const [limitReached, setLimitReached] = useState(false);
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

  // Fetch today's usage count when opening the widget
  useEffect(() => {
    if (isOpen && restaurantId) {
      fetchUsageCount();
    }
  }, [isOpen, restaurantId]);

  async function fetchUsageCount() {
    if (!restaurantId) return;
    try {
      const today = new Date().toISOString().slice(0, 10);
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/ai_validade_usage?restaurant_id=eq.${restaurantId}&usage_date=eq.${today}&select=count`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
      });
      if (res.ok) {
        const data = await res.json();
        const count = data?.[0]?.count ?? 0;
        setUsageToday(count);
        setLimitReached(count >= DAILY_LIMIT);
      }
    } catch {
      // silently ignore — non-critical
    }
  }

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || loading || limitReached) return;

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
          restaurant_id: restaurantId,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        if (errBody.limit_reached) {
          setUsageToday(errBody.usage_today ?? DAILY_LIMIT);
          setLimitReached(true);
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: errBody.error ?? 'Você atingiu seu limite diário de 10 consultas de IA hoje. Utilize seus insumos salvos no cadastro para imprimir normalmente!',
          }]);
          return;
        }
        throw new Error(errBody.error ?? `Erro ${res.status}`);
      }

      const data = await res.json();
      if (data.usage_today !== undefined) {
        setUsageToday(data.usage_today);
        setLimitReached(data.usage_today >= DAILY_LIMIT);
      }
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

  const remaining = DAILY_LIMIT - usageToday;

  return (
    <>
      {!isOpen && (
        <button
          onClick={handleToggle}
          className="fixed bottom-20 right-4 sm:bottom-5 sm:right-5 z-[9999] flex items-center gap-3 group"
          aria-label="Consultar Gula Especialista"
        >
          <div className="hidden sm:flex items-center px-4 py-2.5 rounded-full bg-[#0f2040] border border-amber-500/30 shadow-lg group-hover:border-amber-500/50 transition-colors">
            <span className="text-sm font-medium text-amber-200 whitespace-nowrap">
              Dúvidas? Consulte o Gula Especialista
            </span>
          </div>
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-xl group-hover:scale-105 transition-transform">
            <MessageCircle className="w-6 h-6 text-black" />
          </div>
        </button>
      )}

      {/* Chat window */}
      {isOpen && (
        <div
          className={`fixed bottom-20 right-4 sm:bottom-5 sm:right-5 z-[9999] bg-[#0f2040] border border-[#1e3868] rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${
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
                <h3 className="text-sm font-bold text-white truncate">Gula Especialista</h3>
                <p className="text-[11px] text-slate-400 truncate">Seu agente de IA para validade de alimentos</p>
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

          {/* Chat body — hidden when minimized */}
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

              {/* Usage counter */}
              {restaurantId && (
                <div className="px-4 py-1.5 border-t border-[#1e3868] flex items-center justify-center">
                  <span className={`text-[11px] font-medium ${
                    limitReached
                      ? 'text-red-400'
                      : remaining <= 3
                        ? 'text-amber-400'
                        : 'text-slate-500'
                  }`}>
                    {limitReached
                      ? 'Limite diário atingido'
                      : `Consultas de IA hoje: ${usageToday}/${DAILY_LIMIT}`}
                  </span>
                </div>
              )}

              {/* Input area */}
              <div className="p-3 border-t border-[#1e3868]">
                {limitReached ? (
                  <div className="px-3.5 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs text-center">
                    Você atingiu seu limite diário de 10 consultas de IA hoje. Utilize seus insumos salvos no cadastro para imprimir normalmente!
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      ref={inputRef}
                      type="text"
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Digite um alimento…"
                      disabled={loading}
                      className="flex-1 bg-[#0a1830] border border-[#1e3868] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none transition-colors disabled:opacity-50"
                    />
                    <button
                      onClick={handleSend}
                      disabled={!input.trim() || loading}
                      className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-[#1a3260] disabled:text-slate-500 text-black transition-colors shrink-0"
                      aria-label="Enviar"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
