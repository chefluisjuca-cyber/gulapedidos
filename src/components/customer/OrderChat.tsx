import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { OrderMessage } from '../../types';

interface Props {
  orderId: string;
  senderType: 'client' | 'restaurant';
  variant: 'floating' | 'embedded';
  title?: string;
}

export default function OrderChat({ orderId, senderType, variant, title = 'Chat do Pedido' }: Props) {
  const [messages, setMessages] = useState<OrderMessage[]>([]);
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(variant === 'embedded');
  const [unreadCount, setUnreadCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async () => {
    const { data } = await supabase
      .from('order_messages')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });
    if (data) {
      setMessages(data as OrderMessage[]);
      const unread = (data as OrderMessage[]).filter(m => !m.read && m.sender_type !== senderType).length;
      setUnreadCount(unread);
    }
  }, [orderId, senderType]);

  useEffect(() => {
    fetchMessages();
    const channel = supabase
      .channel(`order-chat-${orderId}-${senderType}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_messages', filter: `order_id=eq.${orderId}` }, fetchMessages)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchMessages, orderId, senderType]);

  // Mark messages from the other party as read when chat is open
  useEffect(() => {
    if (!isOpen) return;
    const unreadFromOther = messages.filter(m => !m.read && m.sender_type !== senderType);
    if (unreadFromOther.length === 0) return;
    unreadFromOther.forEach(m => {
      supabase.from('order_messages').update({ read: true }).eq('id', m.id);
    });
  }, [isOpen, messages, senderType]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput('');
    await supabase.from('order_messages').insert({
      order_id: orderId,
      sender_type: senderType,
      message: text,
      read: false,
    });
  }

  const chatContent = (
    <div className="flex flex-col h-full">
      {variant === 'floating' && (
        <div className="flex items-center justify-between px-4 py-3 bg-amber-500 text-white rounded-t-2xl">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4" />
            <span className="font-bold text-sm">{title}</span>
          </div>
          <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 rounded-lg p-1 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50">
        {messages.length === 0 && (
          <p className="text-center text-gray-400 text-xs py-6">Nenhuma mensagem ainda. Inicie a conversa!</p>
        )}
        {messages.map(m => {
          const isMine = m.sender_type === senderType;
          return (
            <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                isMine
                  ? 'bg-amber-500 text-white rounded-br-md'
                  : 'bg-white text-gray-800 border border-gray-200 rounded-bl-md'
              }`}>
                <p className="whitespace-pre-wrap break-words">{m.message}</p>
                <p className={`text-[10px] mt-0.5 ${isMine ? 'text-white/60' : 'text-gray-400'}`}>
                  {new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      <form onSubmit={sendMessage} className="flex items-center gap-2 p-3 bg-white border-t border-gray-200 rounded-b-2xl">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Digite sua mensagem..."
          className="flex-1 px-3 py-2 rounded-full bg-gray-100 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="w-9 h-9 rounded-full bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );

  if (variant === 'embedded') {
    return <div className="flex flex-col h-full min-h-[300px]">{chatContent}</div>;
  }

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/30 flex items-center justify-center transition-all hover:scale-105"
        >
          <MessageCircle className="w-6 h-6" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      )}
      {/* Floating chat panel */}
      {isOpen && (
        <div className="fixed bottom-5 right-5 z-40 w-[min(360px,calc(100vw-2rem))] h-[min(480px,calc(100vh-6rem))] rounded-2xl shadow-2xl overflow-hidden border border-gray-200 bg-white">
          {chatContent}
        </div>
      )}
    </>
  );
}
