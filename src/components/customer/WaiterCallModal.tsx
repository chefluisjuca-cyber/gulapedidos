import { useState } from 'react';
import { X, Bell } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { WaiterCallType } from '../../types';

interface Props {
  tableNumber: string;
  restaurantId?: string | null;
  onClose: () => void;
}

const CALL_OPTIONS: { type: WaiterCallType; label: string; desc: string; emoji: string }[] = [
  { type: 'attention', label: 'Chamar Atendimento', desc: 'Solicite a presença do garçom.', emoji: '🛎️' },
  { type: 'request',   label: 'Solicitar Algo',     desc: 'Cubiertos, guardanapos, etc.', emoji: '📋' },
  { type: 'bill',      label: 'Pedir a Conta',      desc: 'Solicitar a conta para pagamento.', emoji: '💳' },
];

export default function WaiterCallModal({ tableNumber, restaurantId, onClose }: Props) {
  const [selected, setSelected] = useState<WaiterCallType | null>(null);
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  async function sendCall() {
    if (!selected) return;
    setSending(true);
    await supabase.from('waiter_calls').insert({
      table_number: tableNumber,
      call_type: selected,
      message: message.trim() || null,
      ...(restaurantId ? { restaurant_id: restaurantId } : {}),
    });
    setSending(false);
    setSent(true);
  }

  if (sent) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col justify-end">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white rounded-t-3xl p-8 text-center shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <Bell className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Chamado enviado!</h2>
          <p className="text-gray-500 text-sm mt-2">O garçom foi notificado. Aguarde um instante.</p>
          <button onClick={onClose} className="mt-6 w-full bg-amber-500 text-white font-bold py-3 rounded-2xl hover:bg-amber-400 transition-colors">
            Fechar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Chamar Garçom</h2>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          {CALL_OPTIONS.map(opt => (
            <button
              key={opt.type}
              onClick={() => setSelected(opt.type)}
              className={`w-full flex items-start gap-4 p-4 rounded-xl border-2 transition-all text-left ${
                selected === opt.type ? 'border-amber-500 bg-amber-50' : 'border-gray-100 hover:border-gray-200'
              }`}
            >
              <span className="text-2xl">{opt.emoji}</span>
              <div>
                <p className="font-semibold text-gray-900 text-sm">{opt.label}</p>
                <p className="text-gray-400 text-xs mt-0.5">{opt.desc}</p>
              </div>
            </button>
          ))}
          {selected === 'request' && (
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Descreva o que precisa..."
              rows={2}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-400 resize-none"
            />
          )}
        </div>
        <div className="px-5 pb-6">
          <button
            disabled={!selected || sending}
            onClick={sendCall}
            className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white font-bold py-4 rounded-2xl transition-colors"
          >
            {sending ? 'Enviando...' : 'Enviar Chamado'}
          </button>
        </div>
      </div>
    </div>
  );
}
