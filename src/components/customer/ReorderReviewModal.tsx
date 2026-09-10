import { useState, useEffect } from 'react';
import { X, Minus, Plus, Trash2, RotateCcw, ShoppingBag, AlertCircle, Loader2 } from 'lucide-react';
import { Order, CartItem, Product } from '../../types';
import { supabase } from '../../lib/supabase';

interface Props {
  order: Order;
  products: Product[];
  onConfirm: (items: CartItem[]) => void;
  onClose: () => void;
}

export default function ReorderReviewModal({ order, products, onConfirm, onClose }: Props) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [missingNames, setMissingNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const orderItems = order.order_items ?? [];
      if (orderItems.length === 0) { setLoading(false); return; }

      // Build a quick lookup from the in-memory products list
      const localById = new Map(products.map(p => [p.id, p]));
      // Also build a name-based lookup for fallback matching
      const localByName = new Map<string, Product>();
      for (const p of products) {
        const key = p.name.toLowerCase().trim();
        if (!localByName.has(key)) localByName.set(key, p);
      }

      // Collect product_ids that are NOT found in the local list
      const missingIds = orderItems
        .filter(oi => !localById.has(oi.product_id))
        .map(oi => oi.product_id);

      // Fetch missing products from Supabase by product_id + restaurant_id
      let fetchedById = new Map<string, Product>();
      if (missingIds.length > 0 && order.restaurant_id) {
        const { data } = await supabase
          .from('products')
          .select('*, combo_groups(*, combo_group_items(*, combo_item_extras(*))), product_extras(*)')
          .eq('restaurant_id', order.restaurant_id)
          .eq('active', true)
          .in('id', missingIds);
        if (data) {
          for (const p of data as Product[]) fetchedById.set(p.id, p);
        }
      }

      const allProducts = new Map<string, Product>();
      for (const [id, p] of localById) allProducts.set(id, p);
      for (const [id, p] of fetchedById) allProducts.set(id, p);

      const rebuilt: CartItem[] = [];
      const missing: string[] = [];

      for (const oi of orderItems) {
        let product = allProducts.get(oi.product_id);
        // Fallback: match by product name if ID not found
        if (!product && oi.product_name) {
          const nameKey = oi.product_name.toLowerCase().trim();
          product = localByName.get(nameKey);
        }
        if (!product) {
          missing.push(oi.product_name);
          continue;
        }
        rebuilt.push({
          cartId: crypto.randomUUID(),
          product,
          quantity: oi.quantity,
          comboSelections: (oi.customizations?.combos ?? []).map((c: { groupName: string; items: { name: string; qty: number; observations?: string | null }[] }) => ({
            groupId: '', groupName: c.groupName,
            items: c.items.map((i: { name: string; qty: number; observations?: string | null }) => ({
              id: '', name: i.name, qty: i.qty, priceDelta: 0, observations: i.observations ?? null,
            })),
          })),
          extraSelections: (oi.customizations?.extras ?? []).map((e: { name: string; price: number; qty: number }) => ({
            extraId: '', name: e.name, price: e.price, qty: e.qty,
          })),
          meioAMeioSelection: oi.customizations?.meio_a_meio ?? undefined,
          itemTotal: oi.unit_price,
          observations: oi.customizations?.observations ?? undefined,
        });
      }

      setItems(rebuilt);
      setMissingNames(missing);
      setLoading(false);
    })();
  }, [order.id]);

  function updateQty(cartId: string, delta: number) {
    setItems(prev => prev.map(i =>
      i.cartId === cartId ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i
    ));
  }

  function removeItem(cartId: string) {
    setItems(prev => prev.filter(i => i.cartId !== cartId));
  }

  const total = items.reduce((s, i) => s + i.itemTotal * i.quantity, 0);

  return (
    <div className="fixed inset-0 z-[70] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center">
              <RotateCcw className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Refazer Pedido</h2>
              <p className="text-xs text-gray-400">Revise e edite antes de confirmar</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Order meta */}
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 shrink-0">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">
              {new Date(order.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })} às {new Date(order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className="font-semibold text-gray-700">
              {order.delivery_mode === 'delivery' ? 'Delivery' : `Mesa ${order.table_number}`}
            </span>
          </div>
        </div>

        {/* Missing items warning */}
        {missingNames.length > 0 && (
          <div className="mx-5 mt-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              Alguns itens antigos não estão mais disponíveis e foram ignorados: {missingNames.join(', ')}.
            </p>
          </div>
        )}

        {/* Items list */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 mx-auto mb-3 text-amber-500 animate-spin" />
              <p className="text-sm text-gray-400">Buscando produtos do cardápio...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">Nenhum item disponível para refazer</p>
              <p className="text-xs mt-1">Os produtos deste pedido não estão mais no cardápio.</p>
            </div>
          ) : (
            items.map(item => (
              <div key={item.cartId} className="bg-gray-50 rounded-2xl p-3 border border-gray-100">
                <div className="flex items-start gap-3">
                  {item.product.image_url && (
                    <img src={item.product.image_url} alt={item.product.name} className="w-14 h-14 object-cover rounded-xl shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 leading-tight">{item.product.name}</p>
                    {item.observations && (
                      <p className="text-xs text-gray-400 mt-0.5 italic line-clamp-1">"{item.observations}"</p>
                    )}
                    {item.comboSelections.some(c => c.items.some(i => i.qty > 0)) && (
                      <div className="mt-1 space-y-0.5">
                        {item.comboSelections.map((c, ci) => (
                          <div key={ci}>
                            {c.items.filter(i => i.qty > 0).map((i, ii) => (
                              <div key={ii}>
                                <p className="text-[11px] text-gray-500">{i.qty}× {i.name}</p>
                                {(i.extras ?? []).filter(e => e.qty > 0).map((ex, ei) => (
                                  <p key={ei} className="text-[11px] text-gray-400 ml-3">+{ex.qty}× {ex.name}</p>
                                ))}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                    {item.extraSelections.filter(e => e.qty > 0).length > 0 && (
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        + {item.extraSelections.filter(e => e.qty > 0).map(e => e.name).join(', ')}
                      </p>
                    )}
                    <p className="text-sm font-bold text-amber-600 mt-1">
                      R$ {(item.itemTotal * item.quantity).toFixed(2).replace('.', ',')}
                    </p>
                  </div>
                  <button
                    onClick={() => removeItem(item.cartId)}
                    className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:text-red-500 hover:border-red-300 transition-colors shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                {/* Quantity */}
                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-200/60">
                  <button
                    onClick={() => updateQty(item.cartId, -1)}
                    disabled={item.quantity <= 1}
                    className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="text-base font-bold text-gray-900 w-8 text-center tabular-nums">{item.quantity}</span>
                  <button
                    onClick={() => updateQty(item.cartId, 1)}
                    className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="shrink-0 px-5 pb-8 pt-3 border-t border-gray-100 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 font-medium">Total</span>
              <span className="text-2xl font-black text-gray-900">R$ {total.toFixed(2).replace('.', ',')}</span>
            </div>
            <button
              onClick={() => onConfirm(items)}
              className="w-full bg-amber-500 hover:bg-amber-400 text-white font-bold py-4 rounded-2xl transition-colors flex items-center justify-center gap-2"
            >
              <ShoppingBag className="w-5 h-5" />
              Adicionar ao Carrinho
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
