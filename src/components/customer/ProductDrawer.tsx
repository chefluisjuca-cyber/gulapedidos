import { useState, useEffect, useRef } from 'react';
import { X, Minus, Plus, ShoppingCart, AlertCircle, Check, Scissors, StickyNote, ArrowLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Product, CartComboSelection, CartExtraSelection, CartMeioAMeioSelection, MeioAMeioHalf, ProductExtra } from '../../types';

interface Props {
  product: Product;
  onClose: () => void;
  inline?: boolean;
  onAdd: (
    combo: CartComboSelection[],
    extras: CartExtraSelection[],
    total: number,
    quantity: number,
    meioAMeio?: CartMeioAMeioSelection,
    observations?: string,
  ) => void;
}

export default function ProductDrawer({ product, onClose, inline = false, onAdd }: Props) {
  const [quantity, setQuantity] = useState<number>(1);
  const [comboSelections, setComboSelections] = useState<CartComboSelection[]>([]);
  const [extraSelections, setExtraSelections] = useState<CartExtraSelection[]>([]);
  const [comboItemExtras, setComboItemExtras] = useState<Record<string, { id: string; name: string; price: number; qty: number }[]>>({});

  // Meio a meio state
  const [cat1Products, setCat1Products] = useState<Product[]>([]);
  const [cat2Products, setCat2Products] = useState<Product[]>([]);
  const [half1, setHalf1] = useState<MeioAMeioHalf | null>(null);
  const [half2, setHalf2] = useState<MeioAMeioHalf | null>(null);
  const [loadingHalves, setLoadingHalves] = useState(false);
  const [half1Extras, setHalf1Extras] = useState<CartExtraSelection[]>([]);
  const [half2Extras, setHalf2Extras] = useState<CartExtraSelection[]>([]);
  const [observations, setObservations] = useState('');

  type HalfId = 'half1' | 'half2';

  function adjustComboItemExtra(itemId: string, extraId: string, delta: number) {
    setComboItemExtras(prev => ({
      ...prev,
      [itemId]: (prev[itemId] ?? []).map(ex =>
        ex.id === extraId ? { ...ex, qty: Math.max(0, ex.qty + delta) } : ex
      ),
    }));
  }

  function comboItemExtraTotal(itemId: string): number {
    return (comboItemExtras[itemId] ?? []).reduce((s, ex) => s + ex.qty * ex.price, 0);
  }

  const drawerRef = useRef<HTMLDivElement>(null);
  const isMeioAMeio = !!product.is_meio_a_meio;

  useEffect(() => {
    setQuantity(1);
    setHalf1(null);
    setHalf2(null);
    setCat1Products([]);
    setCat2Products([]);
    setHalf1Extras([]);
    setHalf2Extras([]);
    setObservations('');
    setComboItemExtras({});

    if (!isMeioAMeio) {
      const initial: CartComboSelection[] = (product.combo_groups ?? []).map(cg => ({
        groupId: cg.id,
        groupName: cg.name,
        items: (cg.combo_group_items ?? []).map(ci => ({
          id: ci.id,
          name: ci.name,
          qty: 0,
          priceDelta: ci.price_delta,
          observations: ci.observations ?? null,
        })),
      }));
      setComboSelections(initial);
      const extrasMap: Record<string, { id: string; name: string; price: number; qty: number }[]> = {};
      (product.combo_groups ?? []).forEach(cg => {
        (cg.combo_group_items ?? []).forEach(ci => {
          if ((ci.combo_item_extras ?? []).length > 0) {
            extrasMap[ci.id] = (ci.combo_item_extras ?? []).map(ex => ({ id: ex.id, name: ex.name, price: ex.price, qty: 0 }));
          }
        });
      });
      setComboItemExtras(extrasMap);
      setExtraSelections((product.product_extras ?? []).map(ex => ({
        extraId: ex.id,
        name: ex.name,
        price: ex.price,
        qty: 0,
      })));
      return;
    }

    async function loadHalfProducts() {
      setLoadingHalves(true);
      try {
        const [r1, r2] = await Promise.all([
          product.meio_a_meio_cat_1_id
            ? supabase.from('products').select('id, name, description, price, image_url, active, category_id, restaurant_id, is_combo, is_meio_a_meio, meio_a_meio_cat_1_id, meio_a_meio_cat_2_id, meio_a_meio_price_rule, sort_order, created_at, product_extras(*)').eq('category_id', product.meio_a_meio_cat_1_id).order('sort_order').order('name')
            : Promise.resolve({ data: [], error: null }),
          product.meio_a_meio_cat_2_id
            ? supabase.from('products').select('id, name, description, price, image_url, active, category_id, restaurant_id, is_combo, is_meio_a_meio, meio_a_meio_cat_1_id, meio_a_meio_cat_2_id, meio_a_meio_price_rule, sort_order, created_at, product_extras(*)').eq('category_id', product.meio_a_meio_cat_2_id).order('sort_order').order('name')
            : Promise.resolve({ data: [], error: null }),
        ]);
        if (r1.data) setCat1Products(r1.data as Product[]);
        if (r2.data) setCat2Products(r2.data as Product[]);
      } finally {
        setLoadingHalves(false);
      }
    }
    loadHalfProducts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id, isMeioAMeio, product.meio_a_meio_cat_1_id, product.meio_a_meio_cat_2_id]);

  // ── Regular product helpers ─────────────────────────────────────────────────

  function getGroupTotal(groupId: string) {
    return comboSelections.find(cs => cs.groupId === groupId)?.items.reduce((s, i) => s + i.qty, 0) ?? 0;
  }

  function toggleComboItem(groupId: string, itemId: string) {
    const group = product.combo_groups?.find(g => g.id === groupId);
    if (!group) return;
    const isRadio = group.max_qty === 1;
    setComboSelections(prev => prev.map(cs => {
      if (cs.groupId !== groupId) return cs;
      const currentTotal = cs.items.reduce((s, i) => s + i.qty, 0);
      const isSelected = (cs.items.find(i => i.id === itemId)?.qty ?? 0) > 0;
      return {
        ...cs,
        items: cs.items.map(item => {
          if (isRadio) return { ...item, qty: item.id === itemId ? 1 : 0 };
          if (item.id !== itemId) return item;
          if (isSelected) return { ...item, qty: 0 };
          if (currentTotal >= group.max_qty) return item;
          return { ...item, qty: 1 };
        }),
      };
    }));
  }

  function adjustExtra(extraId: string, delta: number) {
    setExtraSelections(prev => prev.map(ex =>
      ex.extraId === extraId ? { ...ex, qty: Math.max(0, ex.qty + delta) } : ex
    ));
  }

  function adjustHalfExtra(halfId: HalfId, extraId: string, delta: number) {
    const setter = halfId === 'half1' ? setHalf1Extras : setHalf2Extras;
    setter(prev => prev.map(ex =>
      ex.extraId === extraId ? { ...ex, qty: Math.max(0, ex.qty + delta) } : ex
    ));
  }

  function selectHalf(halfId: HalfId, half: MeioAMeioHalf) {
    const productExtras = (halfId === 'half1' ? cat1Products : cat2Products).find(p => p.id === half.productId)?.product_extras ?? [];
    const initialExtras: CartExtraSelection[] = productExtras.map(ex => ({
      extraId: ex.id,
      name: ex.name,
      price: ex.price,
      qty: 0,
    }));
    if (halfId === 'half1') {
      setHalf1(half);
      setHalf1Extras(initialExtras);
    } else {
      setHalf2(half);
      setHalf2Extras(initialExtras);
    }
  }

  function halfExtraTotal(halfId: HalfId): number {
    const extras = halfId === 'half1' ? half1Extras : half2Extras;
    return extras.reduce((s, ex) => s + ex.qty * ex.price, 0);
  }

  function isRegularValid() {
    for (const cs of comboSelections) {
      const group = product.combo_groups?.find(g => g.id === cs.groupId);
      if (!group || !group.is_required) continue;
      const visible = cs.items.filter(i => i.name.trim() !== '');
      if (visible.length === 0) continue;
      if (cs.items.reduce((s, i) => s + i.qty, 0) < group.min_qty) return false;
    }
    return true;
  }

  function computeRegularUnitTotal() {
    let total = product.price;
    comboSelections.forEach(cs => cs.items.forEach(i => {
      total += i.qty * i.priceDelta;
      if (i.qty > 0) total += comboItemExtraTotal(i.id);
    }));
    extraSelections.forEach(ex => { total += ex.qty * ex.price; });
    return total;
  }

  // ── Meio a meio helpers ─────────────────────────────────────────────────────

  function computeMeioTotal(): number {
    if (!half1 || !half2) return 0;
    const rule = product.meio_a_meio_price_rule ?? 'highest';
    const base = rule === 'highest'
      ? Math.max(half1.price, half2.price)
      : rule === 'average'
      ? (half1.price + half2.price) / 2
      : half1.price + half2.price;
    return base + halfExtraTotal('half1') + halfExtraTotal('half2');
  }

  function meioIsValid() {
    return !!half1 && !!half2;
  }

  function priceRuleLabel() {
    const rule = product.meio_a_meio_price_rule ?? 'highest';
    if (rule === 'highest') return 'maior das metades';
    if (rule === 'average') return 'média das metades';
    return 'soma das metades';
  }

  // ── Unified values ──────────────────────────────────────────────────────────
  const unitTotal = isMeioAMeio ? computeMeioTotal() : computeRegularUnitTotal();
  const valid = isMeioAMeio ? meioIsValid() : isRegularValid();
  const hasComboGroups = (product.combo_groups ?? []).length > 0;
  const hasExtras = (product.product_extras ?? []).length > 0;

  function handleAdd() {
    if (isMeioAMeio) {
      const h1 = half1 ? { ...half1, extras: half1Extras.filter(e => e.qty > 0).map(e => ({ name: e.name, price: e.price, qty: e.qty })) } : null;
      const h2 = half2 ? { ...half2, extras: half2Extras.filter(e => e.qty > 0).map(e => ({ name: e.name, price: e.price, qty: e.qty })) } : null;
      onAdd([], [], unitTotal, quantity, { half1: h1, half2: h2 }, observations.trim() || undefined);
    } else {
      const combosWithExtras = comboSelections.map(cs => ({
        ...cs,
        items: cs.items.map(i => ({
          ...i,
          extras: i.qty > 0 ? (comboItemExtras[i.id] ?? []).filter(e => e.qty > 0).map(e => ({ id: e.id, name: e.name, price: e.price, qty: e.qty })) : undefined,
        })),
      }));
      onAdd(combosWithExtras, extraSelections, unitTotal, quantity, undefined, observations.trim() || undefined);
    }
  }

  // ── Shared UI helper for half picker ───────────────────────────────────────
  function HalfPicker({
    label,
    products: prods,
    selected,
    halfId,
    extraState,
  }: {
    label: string;
    products: Product[];
    selected: MeioAMeioHalf | null;
    halfId: HalfId;
    extraState: CartExtraSelection[];
  }) {
    const hasExtras = extraState.length > 0;
    return (
      <section className="border-t border-slate-800 px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-white">{label}</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Escolha 1 opção · <span className="text-red-400">Obrigatório</span></p>
          </div>
          <div className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
            selected ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-slate-800 text-slate-500 border-slate-700'
          }`}>
            {selected && <Check className="w-3 h-3" />}
            {selected ? '1/1' : '0/1'}
          </div>
        </div>
        {prods.length === 0 ? (
          <p className="text-xs text-slate-500 italic">Nenhum produto nesta categoria.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {prods.map(p => {
              const isSelected = selected?.productId === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => selectHalf(halfId, { productId: p.id, productName: p.name, price: p.price })}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left ${
                    isSelected ? 'border-amber-500 bg-amber-500/10' : 'border-slate-700 bg-slate-800/60 hover:border-slate-600'
                  }`}
                >
                  {p.image_url && (
                    <img src={p.image_url} alt={p.name} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${isSelected ? 'text-amber-300' : 'text-slate-200'}`}>{p.name}</p>
                    {p.description && <p className="text-xs text-slate-500 mt-0.5 truncate">{p.description}</p>}
                    <p className="text-xs text-amber-400 font-medium mt-0.5">R$ {p.price.toFixed(2).replace('.', ',')}</p>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                    isSelected ? 'border-amber-500 bg-amber-500' : 'border-slate-600'
                  }`}>
                    {isSelected && <Check className="w-3.5 h-3.5 text-black" strokeWidth={3} />}
                  </div>
                </button>
              );
            })}
          </div>
        )}
        {hasExtras && (
          <div className="mt-4 pl-2 border-l-2 border-amber-500/30">
            <p className="text-[11px] font-semibold text-amber-400 mb-2">Adicionais para {selected?.productName ?? 'esta metade'}:</p>
            <div className="space-y-2">
              {extraState.map(ex => (
                <div key={ex.extraId} className="flex items-center justify-between py-1">
                  <div>
                    <p className="text-xs text-slate-200">{ex.name}</p>
                    <p className="text-[11px] text-amber-400 font-medium">+R$ {ex.price.toFixed(2).replace('.', ',')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => adjustHalfExtra(halfId, ex.extraId, -1)}
                      disabled={ex.qty === 0}
                      className="w-7 h-7 rounded-full border-2 border-slate-700 flex items-center justify-center text-slate-400 disabled:opacity-30 hover:border-amber-500 hover:text-amber-400 transition-colors"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-5 text-center font-semibold text-white text-xs">{ex.qty}</span>
                    <button
                      onClick={() => adjustHalfExtra(halfId, ex.extraId, 1)}
                      className="w-7 h-7 rounded-full border-2 border-slate-700 flex items-center justify-center text-slate-400 hover:border-amber-500 hover:text-amber-400 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    );
  }

  const wrapperClass = inline
    ? 'flex flex-col h-full overflow-hidden'
    : 'fixed inset-0 z-50 flex flex-col justify-end';
  const panelClass = inline
    ? 'relative bg-slate-900 flex flex-col overflow-hidden h-full'
    : 'relative bg-slate-900 rounded-t-3xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl border-t border-slate-700';

  return (
    <div className={wrapperClass}>
      {!inline && <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />}
      <div ref={drawerRef} className={panelClass}>

        {inline && (
          <div className="shrink-0 flex items-center gap-3 px-5 py-3.5 border-b border-slate-800 bg-slate-900">
            <button onClick={onClose} className="flex items-center gap-1.5 text-sm font-semibold text-slate-300 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </button>
          </div>
        )}

        {product.image_url ? (
          <div className="relative h-40 shrink-0 overflow-hidden">
            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 to-transparent" />
            {!inline && (
              <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/60 transition-colors">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          !inline && (
            <div className="flex items-center justify-end px-5 pt-5 shrink-0">
              <button onClick={onClose} className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 hover:bg-slate-700 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          )
        )}

        <div className="overflow-y-auto flex-1">
          <div className="px-5 py-4">
            <div className="flex items-center gap-2">
              {isMeioAMeio && (
                <span className="flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full">
                  <Scissors className="w-3 h-3" />
                  MEIO A MEIO
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-white mt-1">{product.name}</h2>
            {product.description && <p className="text-slate-400 text-sm mt-1">{product.description}</p>}
            {isMeioAMeio ? (
              <p className="text-xs text-slate-500 mt-2">
                Preço calculado pelo {priceRuleLabel()}
              </p>
            ) : (
              <p className="text-amber-400 font-bold text-lg mt-2">R$ {product.price.toFixed(2).replace('.', ',')}</p>
            )}
          </div>

          {/* Meio a Meio half pickers */}
          {isMeioAMeio && (
            <>
              {loadingHalves ? (
                <div className="border-t border-slate-800 px-5 py-8 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  <HalfPicker
                    label="1ª Metade"
                    products={cat1Products}
                    selected={half1}
                    halfId="half1"
                    extraState={half1Extras}
                  />
                  <HalfPicker
                    label="2ª Metade"
                    products={cat2Products}
                    selected={half2}
                    halfId="half2"
                    extraState={half2Extras}
                  />
                </>
              )}
            </>
          )}

          {/* Regular combo groups */}
          {!isMeioAMeio && hasComboGroups && comboSelections.map(cs => {
            const group = product.combo_groups?.find(g => g.id === cs.groupId);
            if (!group) return null;
            const groupTotal = getGroupTotal(cs.groupId);
            const isRadio = group.max_qty === 1;
            const fulfilled = !group.is_required || groupTotal >= group.min_qty;
            const visibleItems = cs.items.filter(item => item.name.trim() !== '');
            if (visibleItems.length === 0) return null;
            return (
              <section key={cs.groupId} className="border-t border-slate-800 px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white">{group.name}</h3>
                    {group.is_required && (
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {isRadio ? 'Escolha 1 opção' : `Escolha entre ${group.min_qty} e ${group.max_qty}`}
                        {' · '}<span className="text-red-400">Obrigatório</span>
                      </p>
                    )}
                  </div>
                  <div className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                    fulfilled ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-slate-800 text-slate-500 border-slate-700'
                  }`}>
                    {fulfilled && <Check className="w-3 h-3" />}
                    {isRadio ? (groupTotal > 0 ? '1/1' : '0/1') : `${groupTotal}/${group.max_qty}`}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {visibleItems.map(item => {
                    const selected = item.qty > 0;
                    const itemExtras = comboItemExtras[item.id] ?? [];
                    return (
                      <div key={item.id}>
                        <button
                          onClick={() => toggleComboItem(cs.groupId, item.id)}
                          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all text-left ${
                            selected ? 'border-amber-500 bg-amber-500/10' : 'border-slate-700 bg-slate-800/60 hover:border-slate-600'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${selected ? 'text-amber-300' : 'text-slate-200'}`}>{item.name}</p>
                            {item.priceDelta > 0 && (
                              <p className="text-xs text-amber-500 mt-0.5">+R$ {item.priceDelta.toFixed(2).replace('.', ',')}</p>
                            )}
                            {item.observations && (
                              <p className="text-xs text-slate-500 italic mt-0.5">{item.observations}</p>
                            )}
                          </div>
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ml-3 transition-all ${
                            selected ? 'border-amber-500 bg-amber-500' : 'border-slate-600'
                          }`}>
                            {selected && <Check className="w-3.5 h-3.5 text-black" strokeWidth={3} />}
                          </div>
                        </button>
                        {selected && itemExtras.length > 0 && (
                          <div className="ml-4 mt-1.5 pl-2 border-l-2 border-amber-500/30 space-y-1.5">
                            <p className="text-[11px] text-amber-400/80 font-medium">Adicionais para {item.name}:</p>
                            {itemExtras.map(ex => (
                              <div key={ex.id} className="flex items-center justify-between py-1">
                                <div>
                                  <p className="text-xs text-slate-200">{ex.name}</p>
                                  <p className="text-[11px] text-amber-400 font-medium">+R$ {ex.price.toFixed(2).replace('.', ',')}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => adjustComboItemExtra(item.id, ex.id, -1)}
                                    disabled={ex.qty === 0}
                                    className="w-6 h-6 rounded-full border-2 border-slate-700 flex items-center justify-center text-slate-400 disabled:opacity-30 hover:border-amber-500 hover:text-amber-400 transition-colors"
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>
                                  <span className="w-4 text-center font-semibold text-white text-xs">{ex.qty}</span>
                                  <button
                                    onClick={() => adjustComboItemExtra(item.id, ex.id, 1)}
                                    className="w-6 h-6 rounded-full border-2 border-slate-700 flex items-center justify-center text-slate-400 hover:border-amber-500 hover:text-amber-400 transition-colors"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}

          {/* Extras */}
          {!isMeioAMeio && hasExtras && (
            <section className="border-t border-slate-800 px-5 py-4">
              <div className="mb-3">
                <h3 className="font-semibold text-white text-sm">Adicionais</h3>
                <p className="text-xs text-slate-500 mt-0.5">Sem limite — adicione quantos quiser!</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {extraSelections.map(ex => (
                  <div key={ex.extraId} className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm text-slate-200">{ex.name}</p>
                      <p className="text-xs text-amber-400 font-medium">+R$ {ex.price.toFixed(2).replace('.', ',')}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => adjustExtra(ex.extraId, -1)}
                        disabled={ex.qty === 0}
                        className="w-8 h-8 rounded-full border-2 border-slate-700 flex items-center justify-center text-slate-400 disabled:opacity-30 hover:border-amber-500 hover:text-amber-400 transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-5 text-center font-semibold text-white text-sm">{ex.qty}</span>
                      <button
                        onClick={() => adjustExtra(ex.extraId, 1)}
                        className="w-8 h-8 rounded-full border-2 border-slate-700 flex items-center justify-center text-slate-400 hover:border-amber-500 hover:text-amber-400 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
          {/* Observations */}
          <section className="border-t border-slate-800 px-5 py-4">
            <div className="mb-2 flex items-center gap-2">
              <StickyNote className="w-4 h-4 text-slate-400" />
              <h3 className="font-semibold text-white text-sm">Observações</h3>
            </div>
            <textarea
              value={observations}
              onChange={e => setObservations(e.target.value)}
              placeholder="Ex: sem cebola, ponto da carne, etc."
              rows={2}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-all resize-none"
            />
          </section>
          <div className="h-4" />
        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 py-4 border-t border-slate-800 bg-slate-900">
          {!valid && (
            <p className="flex items-center gap-1.5 text-xs text-red-400 mb-3">
              <AlertCircle className="w-3.5 h-3.5" />
              {isMeioAMeio ? 'Escolha as duas metades para continuar.' : 'Preencha todos os grupos obrigatórios para continuar.'}
            </p>
          )}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-slate-800 rounded-2xl p-1.5 border border-slate-700">
              <button
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                className="w-9 h-9 rounded-xl bg-slate-700 flex items-center justify-center text-slate-300 disabled:opacity-30 hover:text-amber-400 transition-colors"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-8 text-center font-bold text-white text-base">{quantity}</span>
              <button
                onClick={() => setQuantity(q => q + 1)}
                className="w-9 h-9 rounded-xl bg-slate-700 flex items-center justify-center text-slate-300 hover:text-amber-400 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <button
              disabled={!valid}
              onClick={handleAdd}
              className="flex-1 flex items-center justify-between bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-500 text-black font-bold px-5 py-3.5 rounded-2xl transition-colors"
            >
              <span className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" />
                Adicionar
              </span>
              <span>{valid ? `R$ ${(unitTotal * quantity).toFixed(2).replace('.', ',')}` : '--'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
