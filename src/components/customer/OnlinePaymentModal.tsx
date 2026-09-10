import { useState, useEffect, useRef } from 'react';
import { X, QrCode, CreditCard, Check, Loader2, Copy, Lock, AlertCircle, Info } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Props {
  orderId: string;
  amount: number;
  restaurantId: string;
  paymentMethod: 'pix' | 'card';
  orderData?: Record<string, unknown>;
  orderItems?: Record<string, unknown>[];
  onClose: () => void;
  onPaid: (createdOrderId: string) => void;
}

// Mercado Pago SDK v2 global
interface MPTokenResponse {
  id: string;
}
interface MPInstance {
  tokens: {
    create: (cardData: {
      cardNumber: string;
      cardholderName: string;
      cardExpirationMonth: string;
      cardExpirationYear: string;
      securityCode: string;
      identificationType: string;
      identificationNumber: string;
    }) => Promise<MPTokenResponse>;
  };
  getPaymentMethods: (data: { bin: string }) => Promise<{ results: Array<{ id: string; issuer?: { id: string } }> }>;
}
declare global {
  interface Window {
    MercadoPago?: new (publicKey: string) => MPInstance;
  }
}

// Human-readable Portuguese translations for common MP rejection codes
const MP_ERROR_MAP: Record<string, string> = {
  cc_rejected_high_risk: 'Pagamento recusado por análise de risco. Tente outro cartão ou forma de pagamento.',
  cc_rejected_card_disabled: 'Cartão desativado. Contate seu banco.',
  cc_rejected_insufficient_amount: 'Saldo insuficiente no cartão.',
  cc_rejected_invalid_installments: 'Parcelamento não permitido para este cartão.',
  cc_rejected_max_attempts: 'Muitas tentativas. Tente novamente mais tarde.',
  cc_rejected_duplicated_payment: 'Pagamento duplicado. Você já pagou este pedido.',
  cc_rejected_other_reason: 'Pagamento recusado pelo banco. Verifique os dados ou tente outro cartão.',
  collector_equals_payer: 'Não é possível pagar com um cartão da mesma conta do proprietário das credenciais do Mercado Pago.',
  invalid_card_data: 'Dados do cartão inválidos. Verifique número, validade e CVV.',
  invalid_card_number: 'Número do cartão inválido.',
  invalid_cardholder_name: 'Nome no cartão inválido.',
  invalid_expiration_date: 'Data de validade inválida.',
  invalid_security_code: 'CVV inválido.',
  invalid_identification_number: 'CPF inválido.',
};

function translateError(code: string | undefined, fallback: string): string {
  if (!code) return fallback;
  return MP_ERROR_MAP[code] || `${code}: ${fallback}`;
}

export default function OnlinePaymentModal({ orderId, amount, restaurantId, paymentMethod, orderData, orderItems, onClose, onPaid }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pixQrCode, setPixQrCode] = useState('');
  const [pixCopyPaste, setPixCopyPaste] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<string>('pending');
  const [copied, setCopied] = useState(false);

  // Card form state
  const [cardNumber, setCardNumber] = useState('');
  const [cardExp, setCardExp] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardCpf, setCardCpf] = useState('');
  const [cardProcessing, setCardProcessing] = useState(false);
  const [cardResult, setCardResult] = useState<'success' | 'error' | null>(null);
  const [mpPublicKey, setMpPublicKey] = useState<string | null>(null);
  const [cardBrand, setCardBrand] = useState<string>('');
  const [issuerId, setIssuerId] = useState<string>('');

  const onPaidRef = useRef(onPaid);
  onPaidRef.current = onPaid;
  const confirmedOrderIdRef = useRef<string>(orderId);

  useEffect(() => {
    if (paymentMethod === 'pix') {
      createPixPayment();
    } else {
      setLoading(false);
    }
  }, []);

  // Fetch public key when card payment
  useEffect(() => {
    if (paymentMethod !== 'card' || !restaurantId) return;
    supabase
      .from('restaurant_payments')
      .select('mp_public_key')
      .eq('restaurant_id', restaurantId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.mp_public_key) setMpPublicKey(data.mp_public_key);
      });
  }, [paymentMethod, restaurantId]);

  // Realtime subscription for payment status — fires immediately when webhook updates the order
  useEffect(() => {
    if (paymentStatus !== 'pending') return;
    const channel = supabase
      .channel(`payment-watch-${orderId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` }, (payload: { new: { payment_status?: string } }) => {
        const ps = payload.new?.payment_status;
        if (ps === 'paid') setPaymentStatus('paid');
        else if (ps === 'rejected') setPaymentStatus('rejected');
      })
      .subscribe();
    // Also poll as fallback every 3s in case the realtime event is missed
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('orders')
        .select('payment_status')
        .eq('id', orderId)
        .maybeSingle();
      if (data?.payment_status === 'paid') {
        setPaymentStatus('paid');
        clearInterval(interval);
      } else if (data?.payment_status === 'rejected') {
        setPaymentStatus('rejected');
        clearInterval(interval);
      }
    }, 3000);
    return () => { supabase.removeChannel(channel); clearInterval(interval); };
  }, [paymentStatus, orderId]);

  function handleGoToTracking() {
    onPaidRef.current(confirmedOrderIdRef.current);
  }

  async function createPixPayment() {
    setLoading(true);
    setError('');
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('mercadopago-create-payment', {
        body: { restaurant_id: restaurantId, order_id: orderId, amount, payment_method: 'pix' },
      });
      // PIX still uses pre-created order — no order_data needed
      if (fnErr || data?.error) {
        setError(data?.error || fnErr?.message || 'Erro ao gerar Pix');
        return;
      }
      if (data?.qr_code) setPixCopyPaste(data.qr_code);
      if (data?.qr_code_base64) setPixQrCode(data.qr_code_base64);
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  // Detect card brand and issuer using SDK when card number changes
  useEffect(() => {
    if (paymentMethod !== 'card' || !mpPublicKey) return;
    const bin = cardNumber.replace(/\s/g, '').slice(0, 6);
    if (bin.length < 6) { setCardBrand(''); setIssuerId(''); return; }
    const w = window;
    if (!w.MercadoPago) return;
    try {
      const mp = new w.MercadoPago(mpPublicKey);
      mp.getPaymentMethods({ bin }).then((res) => {
        if (res.results && res.results.length > 0) {
          setCardBrand(res.results[0].id);
          if (res.results[0].issuer) setIssuerId(String(res.results[0].issuer.id));
        }
      }).catch(() => {});
    } catch { /* ignore */ }
  }, [cardNumber, mpPublicKey, paymentMethod]);

  async function processCardPayment() {
    setCardProcessing(true);
    setError('');
    setCardResult(null);

    if (!mpPublicKey) {
      setError('Configuração de pagamento incompleta. Contate o restaurante.');
      setCardProcessing(false);
      return;
    }

    const w = window;
    if (!w.MercadoPago) {
      setError('SDK de pagamento não carregou. Recarregue a página e tente novamente.');
      setCardProcessing(false);
      return;
    }

    try {
      const mp = new w.MercadoPago(mpPublicKey);
      const [month, year] = cardExp.split('/');

      // Step 1: Tokenize card securely in the browser using the official SDK
      let cardToken: string;
      try {
        const tokenRes = await mp.tokens.create({
          cardNumber: cardNumber.replace(/\s/g, ''),
          cardholderName: cardName,
          cardExpirationMonth: month?.trim() || '',
          cardExpirationYear: year?.trim() || '',
          securityCode: cardCvv,
          identificationType: 'CPF',
          identificationNumber: cardCpf.replace(/\D/g, ''),
        });
        cardToken = tokenRes.id;
      } catch (tokenErr) {
        const errObj = tokenErr as { cause?: Array<{ code: string; description: string }>; message?: string };
        const firstCause = errObj?.cause?.[0];
        const errMsg = firstCause
          ? translateError(firstCause.code, firstCause.description)
          : 'Erro ao tokenizar cartão. Verifique os dados.';
        setError(errMsg);
        setCardResult('error');
        setCardProcessing(false);
        return;
      }

      // Step 2: Send token + payment data to our edge function
      const { data, error: fnErr } = await supabase.functions.invoke('mercadopago-create-payment', {
        body: {
          restaurant_id: restaurantId,
          order_id: orderId,
          amount,
          payment_method: 'card',
          customer: {
            name: cardName,
            cpf: cardCpf.replace(/\D/g, ''),
            card_token: cardToken,
            card_brand: cardBrand,
            issuer_id: issuerId || undefined,
          },
          order_data: orderData,
          order_items: orderItems,
        },
      });

      if (fnErr || data?.error) {
        const rawError = data?.error || fnErr?.message || 'Erro ao processar pagamento';
        const statusCode = data?.status_detail || data?.raw?.status_detail;
        setError(translateError(statusCode, rawError));
        setCardResult('error');
        return;
      }

      if (data?.status === 'approved') {
        setCardResult('success');
        setPaymentStatus('paid');
        const createdId = (data.order_id as string) || orderId;
        confirmedOrderIdRef.current = createdId;
      } else if (data?.status === 'rejected' || data?.status === 'cancelled' || data?.status === 'in_process') {
        setCardResult('error');
        const errMsg = data?.status === 'in_process'
          ? 'Pagamento em análise. Não foi possível aprovar automaticamente.'
          : translateError(data?.status_detail, 'Pagamento recusado.');
        setError(errMsg);
      } else {
        // Pending — poll for status updates
        setPaymentStatus('pending');
      }
    } catch {
      setError('Erro de conexão. Tente novamente.');
      setCardResult('error');
    } finally {
      setCardProcessing(false);
    }
  }

  function formatCardNumber(v: string): string {
    return v.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ');
  }

  function formatExp(v: string): string {
    const d = v.replace(/\D/g, '').slice(0, 4);
    return d.length >= 3 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  }

  function formatCpf(v: string): string {
    const d = v.replace(/\D/g, '').slice(0, 11);
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, (_, a, b, c, d2) => d2 ? `${a}.${b}.${c}-${d2}` : c ? `${a}.${b}.${c}` : b ? `${a}.${b}` : a);
  }

  function copyPixCode() {
    navigator.clipboard.writeText(pixCopyPaste);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            {paymentMethod === 'pix' ? <QrCode className="w-5 h-5 text-cyan-500" /> : <CreditCard className="w-5 h-5 text-cyan-500" />}
            <h3 className="font-bold text-gray-900">
              {paymentMethod === 'pix' ? 'Pagamento via Pix' : 'Pagamento via Cartão'}
            </h3>
          </div>
          <button onClick={() => paymentStatus === 'paid' || cardResult === 'success' ? handleGoToTracking() : onClose()} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Unified success screen for both PIX and card */}
          {paymentStatus === 'paid' || cardResult === 'success' ? (
            <div className="flex flex-col items-center py-8 gap-4">
              <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center animate-pulse">
                <Check className="w-10 h-10 text-green-600" />
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-green-600">Pagamento Confirmado com Sucesso!</p>
                <p className="text-sm text-gray-500 mt-1">Seu pedido foi enviado para a cozinha.</p>
              </div>
              <button
                onClick={handleGoToTracking}
                className="w-full bg-amber-500 hover:bg-amber-400 text-white font-bold py-3.5 rounded-2xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 mt-2"
              >
                Acompanhar Seu Pedido
              </button>
            </div>
          ) : (
          <>
          {/* Amount */}
          <div className="text-center">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Valor a pagar</p>
            <p className="text-3xl font-bold text-gray-900">R$ {amount.toFixed(2).replace('.', ',')}</p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="flex-1">{error}</span>
            </div>
          )}

          {/* PIX */}
          {paymentMethod === 'pix' && (
            <>
              {loading ? (
                <div className="flex flex-col items-center py-8 gap-3">
                  <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
                  <p className="text-sm text-gray-500">Gerando Pix...</p>
                </div>
              ) : pixQrCode ? (
                <div className="space-y-4">
                  <div className="flex flex-col items-center">
                    <div className="bg-white p-3 rounded-2xl border-2 border-gray-100">
                      <img src={`data:image/png;base64,${pixQrCode}`} alt="QR Code Pix" className="w-52 h-52" />
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Escaneie o QR Code com seu app de banco</p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Ou copie o código Pix:</p>
                    <div className="flex gap-2">
                      <input
                        readOnly
                        value={pixCopyPaste}
                        className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-gray-600 font-mono truncate"
                      />
                      <button
                        onClick={copyPixCode}
                        className={`shrink-0 px-4 rounded-xl text-sm font-semibold transition-colors ${
                          copied ? 'bg-green-500 text-white' : 'bg-cyan-500 text-white hover:bg-cyan-400'
                        }`}
                      >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Aguardando pagamento...
                  </div>

                  <button
                    onClick={() => setPaymentStatus('paid')}
                    className="w-full text-sm font-semibold text-cyan-600 hover:text-cyan-500 py-2 transition-colors"
                  >
                    Já fiz o pagamento
                  </button>
                </div>
              ) : null}
            </>
          )}

          {/* CARD */}
          {paymentMethod === 'card' && (
            <>
              {cardResult === 'error' && error && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-red-600 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="flex-1">{error}</span>
                </div>
              )}
              <div className="space-y-3">
                  {/* Auto-payment warning */}
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-amber-700 text-xs">
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>Aviso: não é possível pagar com um cartão pertencente à mesma conta do Mercado Pago do restaurante (auto-pagamento). Use um cartão de terceiro.</span>
                  </div>

                  <div>
                    <label className="text-xs text-gray-500 font-medium">Número do Cartão</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={cardNumber}
                      onChange={e => setCardNumber(formatCardNumber(e.target.value))}
                      placeholder="0000 0000 0000 0000"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-cyan-400 transition-colors"
                    />
                    {cardBrand && (
                      <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-wide">{cardBrand}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 font-medium">Validade</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={cardExp}
                        onChange={e => setCardExp(formatExp(e.target.value))}
                        placeholder="MM/AA"
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-cyan-400 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 font-medium">CVV</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={cardCvv}
                        onChange={e => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="123"
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-cyan-400 transition-colors"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium">Nome no Cartão</label>
                    <input
                      type="text"
                      value={cardName}
                      onChange={e => setCardName(e.target.value)}
                      placeholder="Como impresso no cartão"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-cyan-400 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium">CPF do Titular</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={cardCpf}
                      onChange={e => setCardCpf(formatCpf(e.target.value))}
                      placeholder="000.000.000-00"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-cyan-400 transition-colors"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                    <Lock className="w-3 h-3" />
                    Seus dados são criptografados via SDK oficial do Mercado Pago antes do envio.
                  </div>

                  <button
                    onClick={processCardPayment}
                    disabled={cardProcessing || !cardNumber || !cardExp || !cardCvv || !cardName || !cardCpf}
                    className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-white font-bold py-3.5 rounded-2xl transition-colors flex items-center justify-center gap-2"
                  >
                    {cardProcessing ? <><Loader2 className="w-4 h-4 animate-spin" /> Processando...</> : <>Pagar R$ {amount.toFixed(2).replace('.', ',')}</>}
                  </button>
                </div>
            </>
          )}
          </>
          )}
        </div>
      </div>
    </div>
  );
}
