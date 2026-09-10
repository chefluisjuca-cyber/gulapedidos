import { useState, useEffect, useMemo } from 'react';
import {
  X, Search, Plus, Minus, ShoppingCart, Check, Loader2, UtensilsCrossed,
} from 'lucide-react';
import { supabase, sortProductComboGroups } from '../../lib/supabase';
import { useTenant } from '../../lib/tenant-context';
import {
  Product, Category, CartItem, CartComboSelection, CartExtraSelection, Order,
} from '../../types';
import ProductDrawer from '../customer/ProductDrawer';

const inputCls = 'w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500 transition-colors';

interface Props {
  order: Order;
  onClose: () => void;
  onItemsAdded: () => void;
}

export default function AddOrderItemsModal({ order, onClose, onItemsAdded }: Props) {
  const { restaurant } = useTenant();
  const restaurantId = restaurant?.id ?? null;
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [adding, setAdding] = useState(false);
  const [success, setSuccess] = useState(false);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!restaurantId) return;
    async function load() {
      const [catRes, prodRes] = await Promise.all([
        supabase.from('categories').select('*').eq('restaurant_id', restaurantId).eq('active', true).order('sort_order').order('name'),
        supabase.from('products').select('*, combo_groups(*, combo_group_items(*, combo_item_extras(*))), product_extras(*)').eq('restaurant_id', restaurantId).eq('active', true).order('sort_order').order('name'),
      ]);
      const cats = (catRes.data ?? []) as Category[];
      setCategories(cats);
      setProducts(sortProductComboGroups((prodRes.data ?? []) as Product[]));
      if (cats.length > 0) setExpandedCats(new Set([cats[0].id]));
    }
    load();
  }, [restaurantId]);

  function addToCart(product: Product, combos: CartComboSelection[], extras: CartExtraSelection[], total: number, quantity: number) {
    setCart(prev => {
      const existing = prev.find(i =>
        i.product.id === product.id &&
        JSON.stringify(i.comboSelections) === JSON.stringify(combos) &&
        JSON.stringify(i.extraSelections) === JSON.stringify(extras)
      );
      if (existing) {
        return prev.map(i => i.cartId === existing.cartId ? { ...i, quantity: i.quantity + quantity } : i);
      }
      return [...prev, { cartId: crypto.randomUUID(), product, quantity, comboSelections: combos, extraSelections: extras, itemTotal: total }];
    });
    setSelectedProduct(null);
  }

  function updateCartQty(cartId: string, delta: number) {
    setCart(prev => prev.map(i => i.cartId === cartId ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i));
  }

  function removeFromCart(cartId: string) {
    setCart(prev => prev.filter(i => i.cartId !== cartId));
  }

  async function confirmAddItems() {
    if (cart.length === 0 || !restaurantId) return;
    setAdding(true);

    const newItems = cart.map(ci => ({
      order_id: order.id,
      restaurant_id: restaurantId,
      product_id: ci.product.id,
      product_name: ci.product.name,
      quantity: ci.quantity,
      unit_price: ci.itemTotal,
      customizations: {
        combos: ci.comboSelections.map(cs => ({
          groupName: cs.groupName,
          items: cs.items.filter(i => i.qty > 0).map(i => ({
            name: i.name,
            qty: i.qty,
            ...(i.extras && i.extras.length > 0 ? { extras: i.extras.filter(e => e.qty > 0).map(e => ({ name: e.name, price: e.price, qty: e.qty })) } : {}),
          })),
        })),
        extras: ci.extraSelections.filter(e => e.qty > 0),
      },
    }));

    const { error: insertError } = await supabase.from('order_items').insert(newItems);
    if (insertError) {
      setAdding(false);
      return;
    }

    // Recalculate total: existing items + new items + delivery fee
    const existingItemsTotal = (order.order_items ?? []).reduce((s, i) => s + i.unit_price * i.quantity, 0);
    const newItemsTotal = cart.reduce((s, i) => s + i.itemTotal * i.quantity, 0);
    const deliveryFee = order.delivery_mode === 'delivery' ? order.delivery_fee : 0;
    const newTotal = existingItemsTotal + newItemsTotal + deliveryFee;

    await supabase.from('orders').update({
      total: newTotal,
      updated_at: new Date().toISOString(),
    }).eq('id', order.id);

    setAdding(false);
    setSuccess(true);
    setCart([]);
    setTimeout(() => {
      setSuccess(false);
      onItemsAdded();
      onClose();
    }, 1200);
  }

  const searchActive = searchQuery.trim().length >= 3;
  const filteredProducts = useMemo(() => {
    if (!searchActive) return products;
    return products.filter(p =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description ?? '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [products, searchQuery, searchActive]);

  const productsByCategory = useMemo(() =>
    categories
      .map(cat => ({ category: cat, products: filteredProducts.filter(p => p.category_id === cat.id) }))
      .filter(g => g.products.length > 0),
    [categories, filteredProducts]
  );

  const uncategorized = filteredProducts.filter(p => !p.category_id);
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cart.reduce((s, i) => s + i.itemTotal * i.quantity, 0);

  function toggleCat(id: string) {
    setExpandedCats(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative ml-auto w-full max-w-5xl h-full bg-slate-950 flex flex-col shadow-2xl animate-[slideInRight_0.25s_ease-out]">
        {/* Header */}
        <header className="shrink-0 flex items-center gap-4 px-6 py-4 bg-slate-900 border-b border-slate-800">
          <div className="w-9 h-9 bg-amber-500 rounded-xl flex items-center justify-center shrink-0">
            <UtensilsCrossed className="w-4 h-4 text-black" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-white font-bold text-base leading-none">Adicionar Itens ao Pedido #{String(order.table_number).padStart(4, '0')}</h2>
            <p className="text-slate-500 text-xs mt-0.5">
              {order.delivery_mode === 'delivery' ? 'Delivery' : order.service_mode === 'table' ? `Mesa ${order.table_number}` : 'Balcão'}
              {' · '}
              {order.status === 'preparing' ? 'Em preparo' : order.status === 'ready' ? 'Pronto' : order.status}
            </p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors shrink-0">
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: catalog */}
          <div className="flex-1 flex flex-col overflow-y-auto">
            {/* Search */}
            <div className="px-5 py-3 border-b border-slate-800 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Buscar produto (mín. 3 caracteres)..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-9 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors" />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Product list or ProductDrawer */}
            {!selectedProduct && (
              <div className="px-5 py-4 space-y-3">
                {searchActive ? (
                  filteredProducts.length === 0 ? (
                    <div className="py-16 text-center text-slate-600">
                      <p className="text-sm">Nenhum resultado para "{searchQuery}".</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-slate-500">{filteredProducts.length} resultado(s)</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {filteredProducts.map(p => (
                          <button key={p.id} onClick={() => setSelectedProduct(p)}
                            className="w-full flex gap-3 bg-slate-800/70 rounded-xl p-3 border border-slate-700/50 hover:border-amber-500/50 hover:bg-slate-800 transition-all text-left active:scale-[0.98]">
                            {p.image_url && <img src={p.image_url} alt={p.name} className="w-16 h-16 object-cover rounded-lg shrink-0" />}
                            <div className="flex-1 min-w-0 py-0.5">
                              <p className="font-semibold text-white text-sm leading-tight">{p.name}</p>
                              {p.description && <p className="text-slate-400 text-xs mt-1 line-clamp-2">{p.description}</p>}
                              <p className="text-amber-400 font-bold text-sm mt-2">R$ {p.price.toFixed(2).replace('.', ',')}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </>
                  )
                ) : (
                  <>
                    {productsByCategory.map(({ category, products: prods }) => (
                      <section key={category.id} className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-800">
                        <button onClick={() => toggleCat(category.id)}
                          className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-slate-800/60 transition-colors">
                          <h3 className="text-sm font-bold text-white">{category.icon && <span className="mr-1">{category.icon}</span>}{category.name} <span className="text-slate-500 font-normal text-xs">({prods.length})</span></h3>
                        </button>
                        {expandedCats.has(category.id) && (
                          <div className="px-3 pb-3 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                            {prods.map(p => (
                              <button key={p.id} onClick={() => setSelectedProduct(p)}
                                className="w-full flex gap-3 bg-slate-800/70 rounded-xl p-3 border border-slate-700/50 hover:border-amber-500/50 hover:bg-slate-800 transition-all text-left active:scale-[0.98]">
                                {p.image_url && <img src={p.image_url} alt={p.name} className="w-14 h-14 object-cover rounded-lg shrink-0" />}
                                <div className="flex-1 min-w-0 py-0.5">
                                  <p className="font-semibold text-white text-sm leading-tight">{p.name}</p>
                                  <p className="text-amber-400 font-bold text-sm mt-1">R$ {p.price.toFixed(2).replace('.', ',')}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </section>
                    ))}
                    {uncategorized.length > 0 && (
                      <section className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-800">
                        <div className="px-4 py-3.5 border-b border-slate-800"><h3 className="text-sm font-bold text-white">Outros</h3></div>
                        <div className="px-3 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                          {uncategorized.map(p => (
                            <button key={p.id} onClick={() => setSelectedProduct(p)}
                              className="w-full flex gap-3 bg-slate-800/70 rounded-xl p-3 border border-slate-700/50 hover:border-amber-500/50 hover:bg-slate-800 transition-all text-left active:scale-[0.98]">
                              {p.image_url && <img src={p.image_url} alt={p.name} className="w-14 h-14 object-cover rounded-lg shrink-0" />}
                              <div className="flex-1 min-w-0 py-0.5">
                                <p className="font-semibold text-white text-sm leading-tight">{p.name}</p>
                                <p className="text-amber-400 font-bold text-sm mt-1">R$ {p.price.toFixed(2).replace('.', ',')}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </section>
                    )}
                  </>
                )}
              </div>
            )}

            {selectedProduct && (
              <ProductDrawer inline product={selectedProduct}
                onClose={() => setSelectedProduct(null)}
                onAdd={(combos, extras, total, qty) => addToCart(selectedProduct, combos, extras, total, qty)} />
            )}
          </div>

          {/* Right: cart panel */}
          <div className="w-72 xl:w-80 shrink-0 hidden lg:flex flex-col bg-slate-900 border-l border-slate-800">
            <div className="px-5 py-4 border-b border-slate-800 shrink-0">
              <h3 className="font-bold text-white flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-amber-400" /> Novos Itens
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">{cartCount} {cartCount === 1 ? 'item' : 'itens'} a adicionar</p>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {cart.length === 0 ? (
                <div className="py-16 text-center">
                  <ShoppingCart className="w-10 h-10 mx-auto text-slate-700 mb-3" />
                  <p className="text-slate-500 text-sm">Selecione produtos ao lado.</p>
                </div>
              ) : cart.map(item => (
                <div key={item.cartId} className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-white leading-tight">{item.product.name}</p>
                    <button onClick={() => removeFromCart(item.cartId)} className="text-slate-600 hover:text-red-400 transition-colors shrink-0 p-0.5">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {item.comboSelections.map(cs => {
                    const chosen = cs.items.filter(i => i.qty > 0);
                    if (!chosen.length) return null;
                    return (
                      <div key={cs.groupId} className="mt-0.5">
                        {cs.groupName && <p className="text-xs text-slate-500">{cs.groupName}</p>}
                        {chosen.map(i => <p key={i.id} className="text-xs text-slate-300 ml-2">{i.qty > 1 ? `${i.qty}x ` : ''}{i.name}</p>)}
                      </div>
                    );
                  })}
                  {item.extraSelections.filter(e => e.qty > 0).map(ex => (
                    <p key={ex.extraId} className="text-xs text-slate-500 mt-0.5">+{ex.qty}x {ex.name}</p>
                  ))}
                  <div className="flex items-center justify-between mt-2.5">
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateCartQty(item.cartId, -1)} className="w-6 h-6 rounded-full border border-slate-600 flex items-center justify-center text-slate-400 hover:border-amber-500 hover:text-amber-400 transition-colors">
                        <Minus className="w-2.5 h-2.5" />
                      </button>
                      <span className="text-sm font-bold text-white w-4 text-center">{item.quantity}</span>
                      <button onClick={() => updateCartQty(item.cartId, 1)} className="w-6 h-6 rounded-full border border-slate-600 flex items-center justify-center text-slate-400 hover:border-amber-500 hover:text-amber-400 transition-colors">
                        <Plus className="w-2.5 h-2.5" />
                      </button>
                    </div>
                    <p className="text-sm font-bold text-amber-400">R$ {(item.itemTotal * item.quantity).toFixed(2).replace('.', ',')}</p>
                  </div>
                </div>
              ))}
            </div>

            {cart.length > 0 && (
              <div className="shrink-0 px-4 py-4 border-t border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">Subtotal dos novos itens</span>
                  <span className="text-lg font-black text-white">R$ {cartTotal.toFixed(2).replace('.', ',')}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Total atual do pedido</span>
                  <span>R$ {order.total.toFixed(2).replace('.', ',')}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-amber-400 font-semibold">
                  <span>Novo total</span>
                  <span>R$ {(order.total + cartTotal).toFixed(2).replace('.', ',')}</span>
                </div>
                <button disabled={adding} onClick={confirmAddItems}
                  className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 disabled:cursor-not-allowed text-black font-bold py-3.5 rounded-xl transition-colors text-sm">
                  {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {adding ? 'Adicionando...' : 'Adicionar Itens'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile cart FAB */}
        {cartCount > 0 && (
          <button onClick={confirmAddItems} disabled={adding}
            className="lg:hidden absolute bottom-5 right-5 z-10 flex items-center gap-3 bg-amber-500 hover:bg-amber-400 text-black font-bold px-5 py-3.5 rounded-2xl shadow-2xl transition-all hover:scale-105 active:scale-95 disabled:opacity-60">
            {adding ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
            <span className="text-sm">{cartCount} {cartCount === 1 ? 'item' : 'itens'}</span>
            <span className="text-sm">R$ {cartTotal.toFixed(2).replace('.', ',')}</span>
          </button>
        )}

        {/* Success overlay */}
        {success && (
          <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center z-40 pointer-events-none">
            <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center mb-4 animate-bounce">
              <Check className="w-10 h-10 text-white" strokeWidth={3} />
            </div>
            <p className="text-white font-bold text-xl">Itens adicionados!</p>
            <p className="text-slate-400 text-sm mt-1">O pedido foi atualizado.</p>
          </div>
        )}
      </div>
    </div>
  );
}
