import { useState, useEffect, useRef } from 'react';
import { Clock, ChefHat, CheckCircle, Package, MapPin, Bike, Home } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Order, OrderStatus, DeliveryOrderStatus } from '../../types';

interface Props {
  orderId: string;
  tableNumber: string;
  serviceMode: 'table' | 'counter';
}

const STATUS_STEPS_TABLE: { key: OrderStatus; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'pending',   label: 'Pedido Recebido', icon: Clock },
  { key: 'preparing', label: 'Em Preparo',       icon: ChefHat },
  { key: 'ready',     label: 'Pronto!',          icon: CheckCircle },
  { key: 'closed',    label: 'Finalizado',       icon: Package },
];

const STATUS_STEPS_DELIVERY: { key: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'pending',    label: 'Pedido Recebido',  icon: Clock },
  { key: 'preparing',  label: 'Em Preparo',        icon: ChefHat },
  { key: 'dispatched', label: 'A Caminho!',        icon: Bike },
  { key: 'delivered',  label: 'Entregue',          icon: Home },
];

export default function OrderTracking({ orderId, tableNumber, serviceMode }: Props) {
  const [order, setOrder] = useState<Order | null>(null);
  const prevDeliveryStatusRef = useRef<string | null>(null);
  const prevStatusRef = useRef<OrderStatus | null>(null);
  const dispatchedAudioRef = useRef<HTMLAudioElement | null>(null);
  const readyAudioRef = useRef<HTMLAudioElement | null>(null);

  const isDelivery = (order: Order | null) => order?.delivery_mode === 'delivery';

  useEffect(() => {
    const audio1 = new Audio('/sounds/notification-new-client-shop-bell-bosnow-1-00-02.mp3');
    audio1.loop = false;
    dispatchedAudioRef.current = audio1;
    const audio2 = new Audio('/sounds/game-ui-level-unlock-om-fx-1-1-00-05.mp3');
    audio2.loop = false;
    readyAudioRef.current = audio2;

    function preUnlock() {
      audio1.play().then(() => { audio1.pause(); audio1.currentTime = 0; }).catch(() => {});
      audio2.play().then(() => { audio2.pause(); audio2.currentTime = 0; }).catch(() => {});
    }
    document.addEventListener('click', preUnlock, { once: true });
    document.addEventListener('touchstart', preUnlock, { once: true });
    return () => {
      document.removeEventListener('click', preUnlock);
      document.removeEventListener('touchstart', preUnlock);
    };
  }, []);

  useEffect(() => {
    if (!order) return;
    const del = isDelivery(order);

    if (del) {
      const currentDelStatus = order.delivery_status ?? 'pending';
      if (currentDelStatus === 'dispatched' && prevDeliveryStatusRef.current !== 'dispatched') {
        const audio = dispatchedAudioRef.current;
        if (audio) {
          audio.currentTime = 0;
          setTimeout(() => {
            audio.play().catch(() => { audio.load(); audio.play().catch(() => {}); });
          }, 50);
        }
      }
      prevDeliveryStatusRef.current = currentDelStatus;
    } else {
      if (order.status === 'ready' && prevStatusRef.current !== 'ready') {
        const audio = readyAudioRef.current;
        if (audio) {
          audio.currentTime = 0;
          setTimeout(() => {
            audio.play().catch(() => { audio.load(); audio.play().catch(() => {}); });
          }, 50);
        }
      }
      prevStatusRef.current = order.status;
    }
  }, [order?.status, order?.delivery_status]);

  useEffect(() => {
    fetchOrder();
    const channel = supabase
      .channel(`order-tracking-${orderId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` }, fetchOrder)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [orderId]);

  async function fetchOrder() {
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', orderId)
      .maybeSingle();
    if (data) setOrder(data as Order);
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const del = isDelivery(order);
  const statusSteps = del ? STATUS_STEPS_DELIVERY : STATUS_STEPS_TABLE;

  let currentStepIdx: number;
  if (del) {
    const delStatus = order.delivery_status ?? 'pending';
    currentStepIdx = statusSteps.findIndex(s => s.key === delStatus);
    if (currentStepIdx === -1) currentStepIdx = 0;
  } else {
    currentStepIdx = (statusSteps as typeof STATUS_STEPS_TABLE).findIndex(s => s.key === order.status);
  }

  const isDispatched = del && order.delivery_status === 'dispatched';
  const isDelivered = del && order.delivery_status === 'delivered';
  const isReady = !del && order.status === 'ready';
  const isClosed = !del && order.status === 'closed';

  const bannerColor = isDispatched ? 'bg-blue-500' : isDelivered ? 'bg-green-500' : isReady ? 'bg-green-500' : isClosed ? 'bg-slate-700' : 'bg-amber-500';
  const bannerIcon = isDispatched ? <Bike className="w-8 h-8 text-white" /> : isDelivered ? <Home className="w-8 h-8 text-white" /> : isReady ? <CheckCircle className="w-8 h-8 text-white" /> : isClosed ? <Package className="w-8 h-8 text-white" /> : <ChefHat className="w-8 h-8 text-white animate-pulse" />;
  const bannerTitle = isDispatched ? 'Pedido a Caminho!' : isDelivered ? 'Pedido Entregue!' : isReady ? (serviceMode === 'table' ? 'Pedido Pronto!' : 'Retire no Balcão!') : isClosed ? 'Pedido Finalizado' : 'Pedido em Andamento...';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Status Banner */}
      <div className={`px-5 py-10 text-center transition-colors ${bannerColor}`}>
        <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4">
          {bannerIcon}
        </div>
        <h1 className="text-2xl font-bold text-white">{bannerTitle}</h1>
        <p className="text-white/80 text-sm mt-2 flex items-center justify-center gap-1">
          {del ? (
            <>
              <MapPin className="w-3.5 h-3.5" /> Delivery · {order.delivery_street ?? ''}, {order.delivery_number ?? ''}
            </>
          ) : (
            <>
              <MapPin className="w-3.5 h-3.5" /> Mesa {tableNumber}
            </>
          )}
        </p>
      </div>

      {/* Message box */}
      <div className="mx-5 mt-5">
        {order.status === 'pending' && !del && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 text-center">
            <p className="text-yellow-800 text-sm font-medium">Aguardando confirmação da cozinha...</p>
          </div>
        )}
        {order.status === 'preparing' && !del && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-center">
            <p className="text-blue-800 text-sm font-medium">A cozinha está preparando seu pedido!</p>
          </div>
        )}
        {del && order.delivery_status === 'pending' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 text-center">
            <p className="text-yellow-800 text-sm font-medium">Aguardando confirmação do restaurante...</p>
          </div>
        )}
        {del && order.delivery_status === 'preparing' && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-center">
            <p className="text-blue-800 text-sm font-medium">A cozinha está preparando seu pedido!</p>
          </div>
        )}
        {isDispatched && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-center">
            <p className="text-blue-800 text-sm font-semibold">Seu pedido saiu para entrega! Acompanhe pelo telefone.</p>
          </div>
        )}
        {isDelivered && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
            <p className="text-green-800 text-sm font-semibold">Pedido entregue! Obrigado pela preferencia.</p>
          </div>
        )}
        {isReady && serviceMode === 'table' && !del && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
            <p className="text-green-800 text-sm font-semibold">Conta solicitada, aguarde o garcom para efetuar o pagamento.</p>
          </div>
        )}
        {isReady && serviceMode === 'counter' && !del && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
            <p className="text-green-800 text-sm font-semibold">Conta solicitada, compareca ao caixa para efetuar o pagamento.</p>
          </div>
        )}
      </div>

      {/* Progress Steps */}
      <div className="mx-5 mt-5 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Acompanhamento</h3>
        <div className="space-y-4">
          {statusSteps.map((step, idx) => {
            const done = idx <= currentStepIdx;
            const active = idx === currentStepIdx;
            const Icon = step.icon;
            return (
              <div key={step.key} className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                  done ? (active ? 'bg-amber-500' : 'bg-green-500') : 'bg-gray-100'
                }`}>
                  <Icon className={`w-4 h-4 ${done ? 'text-white' : 'text-gray-400'}`} />
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${done ? 'text-gray-900' : 'text-gray-400'}`}>{step.label}</p>
                  {active && <p className="text-xs text-amber-500 animate-pulse">Etapa atual</p>}
                </div>
                {done && !active && <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Order Summary */}
      <div className="mx-5 mt-4 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Resumo do Pedido</h3>
        <div className="space-y-2">
          {(order.order_items ?? []).map(item => (
            <div key={item.id} className="flex justify-between text-sm">
              <span className="text-gray-700">{item.quantity}x {item.product_name}</span>
              <span className="text-gray-500">R$ {(item.unit_price * item.quantity).toFixed(2).replace('.', ',')}</span>
            </div>
          ))}
        </div>
        {del && (order.delivery_fee ?? 0) > 0 && (
          <div className="flex justify-between text-sm mt-2 pt-2 border-t border-gray-100">
            <span className="text-gray-500">Taxa de entrega</span>
            <span className="text-gray-500">R$ {(order.delivery_fee ?? 0).toFixed(2).replace('.', ',')}</span>
          </div>
        )}
        <div className="border-t border-gray-100 mt-3 pt-3 flex justify-between font-bold">
          <span>Total</span>
          <span className="text-amber-600">R$ {order.total.toFixed(2).replace('.', ',')}</span>
        </div>
      </div>

      <div className="flex-1" />
      <div className="h-8" />
    </div>
  );
}
