import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, X, Check, ChevronDown, ChevronUp, Tag, Package, Layers, Copy, AlertCircle, ArrowUp, ArrowDown } from 'lucide-react';
import TutorialHelpButton from './TutorialHelpButton';
import { supabase, sortProductComboGroups } from '../../lib/supabase';
import { useTenant } from '../../lib/tenant-context';
import { Category, Product, ComboGroup, ComboGroupItem, ProductExtra, ComboItemExtra } from '../../types';
import ImageUpload from './ImageUpload';

type ModalType = 'category' | 'product' | 'combo' | 'extra' | null;

export default function MenuTab() {
  const { restaurant } = useTenant();
  const restaurantId = restaurant?.id ?? null;

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [expandedExtras, setExpandedExtras] = useState<Set<string>>(new Set());
  const [filterCatId, setFilterCatId] = useState<string>('all');
  const [modal, setModal] = useState<ModalType>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingComboGroup, setEditingComboGroup] = useState<{ group: ComboGroup | null; productId: string } | null>(null);
  const [editingExtra, setEditingExtra] = useState<{ extra: ProductExtra | null; productId: string } | null>(null);
  const [comboItems, setComboItems] = useState<ComboGroupItem[]>([]);

  const [catName, setCatName] = useState('');
  const [catIcon, setCatIcon] = useState('');
  const [prodName, setProdName] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodImage, setProdImage] = useState('');
  const [prodCatId, setProdCatId] = useState('');
  const [prodIsCombo, setProdIsCombo] = useState(false);
  const [prodIsMeioAMeio, setProdIsMeioAMeio] = useState(false);
  const [prodMeioACat1Id, setProdMeioACat1Id] = useState('');
  const [prodMeioACat2Id, setProdMeioACat2Id] = useState('');
  const [prodMeioPriceRule, setProdMeioPriceRule] = useState<'highest' | 'average' | 'sum'>('highest');
  const [cgName, setCgName] = useState('');
  const [cgMin, setCgMin] = useState('0');
  const [cgMax, setCgMax] = useState('1');
  const [cgRequired, setCgRequired] = useState(true);
  const [extName, setExtName] = useState('');
  const [extPrice, setExtPrice] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => { fetchAll(); }, [restaurantId]);

  async function fetchAll() {
    const [catRes, prodRes] = await Promise.all([
      restaurantId
        ? supabase.from('categories').select('*').eq('restaurant_id', restaurantId).order('sort_order').order('name')
        : supabase.from('categories').select('*').is('restaurant_id', null).order('sort_order').order('name'),
      restaurantId
        ? supabase.from('products').select('*, combo_groups(*, combo_group_items(*, combo_item_extras(*))), product_extras(*)').eq('restaurant_id', restaurantId).order('sort_order').order('name')
        : supabase.from('products').select('*, combo_groups(*, combo_group_items(*, combo_item_extras(*))), product_extras(*)').is('restaurant_id', null).order('sort_order').order('name'),
    ]);
    if (catRes.data) setCategories(catRes.data);
    if (prodRes.data) setProducts(sortProductComboGroups(prodRes.data as Product[]));
  }

  function openCategoryModal(cat?: Category) {
    setEditingCategory(cat ?? null);
    setCatName(cat?.name ?? '');
    setCatIcon(cat?.icon ?? '');
    setModal('category');
  }

  async function saveCategory() {
    const payload = {
      name: catName,
      icon: catIcon || null,
      ...(restaurantId ? { restaurant_id: restaurantId } : {}),
    };
    const { error } = editingCategory
      ? await supabase.from('categories').update(payload).eq('id', editingCategory.id)
      : await supabase.from('categories').insert({ ...payload, sort_order: categories.length });
    if (error) { setSaveError('Erro ao salvar categoria. Verifique se você tem permissão.'); return; }
    setModal(null);
    fetchAll();
  }

  async function deleteCategory(id: string) {
    if (!confirm('Remover categoria? Os produtos associados ficarão sem categoria.')) return;
    await supabase.from('categories').delete().eq('id', id);
    fetchAll();
  }

  function openProductModal(prod?: Product) {
    setEditingProduct(prod ?? null);
    setProdName(prod?.name ?? '');
    setProdDesc(prod?.description ?? '');
    setProdPrice(prod?.price?.toString() ?? '');
    setProdImage(prod?.image_url ?? '');
    setProdCatId(prod?.category_id ?? '');
    setProdIsCombo(prod?.is_combo ?? false);
    setProdIsMeioAMeio(prod?.is_meio_a_meio ?? false);
    setProdMeioACat1Id(prod?.meio_a_meio_cat_1_id ?? '');
    setProdMeioACat2Id(prod?.meio_a_meio_cat_2_id ?? '');
    setProdMeioPriceRule(prod?.meio_a_meio_price_rule ?? 'highest');
    setModal('product');
  }

  async function saveProduct() {
    const payload = {
      name: prodName,
      description: prodDesc || null,
      price: parseFloat(prodPrice) || 0,
      image_url: prodImage || null,
      category_id: prodCatId || null,
      is_combo: prodIsCombo,
      is_meio_a_meio: prodIsMeioAMeio,
      meio_a_meio_cat_1_id: prodIsMeioAMeio ? (prodMeioACat1Id || null) : null,
      meio_a_meio_cat_2_id: prodIsMeioAMeio ? (prodMeioACat2Id || null) : null,
      meio_a_meio_price_rule: prodIsMeioAMeio ? prodMeioPriceRule : 'highest',
      ...(restaurantId ? { restaurant_id: restaurantId } : {}),
    };
    const { error } = editingProduct
      ? await supabase.from('products').update(payload).eq('id', editingProduct.id)
      : await supabase.from('products').insert({ ...payload, sort_order: products.length });
    if (error) { setSaveError('Erro ao salvar produto. Verifique se você tem permissão.'); return; }
    setModal(null);
    fetchAll();
  }

  async function toggleProductActive(prod: Product) {
    await supabase.from('products').update({ active: !prod.active }).eq('id', prod.id);
    fetchAll();
  }

  async function deleteProduct(id: string) {
    if (!confirm('Remover produto permanentemente?')) return;
    await supabase.from('products').delete().eq('id', id);
    fetchAll();
  }

  const [duplicating, setDuplicating] = useState<string | null>(null);

  async function duplicateProduct(prod: Product) {
    setDuplicating(prod.id);
    const { data: newProd, error } = await supabase
      .from('products')
      .insert({
        category_id: prod.category_id,
        name: `${prod.name} (Cópia)`,
        description: prod.description,
        price: prod.price,
        image_url: prod.image_url,
        active: false,
        is_combo: prod.is_combo,
        sort_order: products.length,
        ...(restaurantId ? { restaurant_id: restaurantId } : {}),
      })
      .select()
      .maybeSingle();

    if (error || !newProd) { setDuplicating(null); return; }

    for (const cg of (prod.combo_groups ?? [])) {
      const { data: newGroup } = await supabase
        .from('combo_groups')
        .insert({ product_id: newProd.id, name: cg.name, min_qty: cg.min_qty, max_qty: cg.max_qty, is_required: cg.is_required, sort_order: cg.sort_order })
        .select()
        .maybeSingle();

      if (newGroup && (cg.combo_group_items ?? []).length > 0) {
        const { data: newItems } = await supabase.from('combo_group_items').insert(
          (cg.combo_group_items ?? []).map(ci => ({
            combo_group_id: newGroup.id,
            name: ci.name,
            price_delta: ci.price_delta,
            observations: ci.observations ?? null,
            sort_order: ci.sort_order,
          }))
        ).select();
        if (newItems) {
          const extrasToInsert: { combo_group_item_id: string; name: string; price: number; sort_order: number }[] = [];
          newItems.forEach((ni, i) => {
            ((cg.combo_group_items ?? [])[i].combo_item_extras ?? []).forEach(ex => {
              extrasToInsert.push({ combo_group_item_id: ni.id, name: ex.name, price: ex.price, sort_order: ex.sort_order });
            });
          });
          if (extrasToInsert.length > 0) {
            await supabase.from('combo_item_extras').insert(extrasToInsert);
          }
        }
      }
    }

    if ((prod.product_extras ?? []).length > 0) {
      await supabase.from('product_extras').insert(
        (prod.product_extras ?? []).map(ex => ({
          product_id: newProd.id,
          name: ex.name,
          price: ex.price,
          sort_order: ex.sort_order,
        }))
      );
    }

    setDuplicating(null);
    fetchAll();
  }

  function openComboModal(productId: string, group?: ComboGroup) {
    setEditingComboGroup({ group: group ?? null, productId });
    setCgName(group?.name ?? '');
    setCgMin(group?.min_qty?.toString() ?? '0');
    setCgMax(group?.max_qty?.toString() ?? '1');
    setCgRequired(group?.is_required ?? true);
    setComboItems(group?.combo_group_items ?? []);
    setModal('combo');
  }

  async function saveComboGroup() {
    if (!editingComboGroup) return;
    const payload = {
      name: cgName,
      min_qty: parseInt(cgMin) || 0,
      max_qty: parseInt(cgMax) || 1,
      is_required: cgRequired,
      product_id: editingComboGroup.productId,
    };
    let groupId = editingComboGroup.group?.id;
    if (groupId) {
      const { error } = await supabase.from('combo_groups').update(payload).eq('id', groupId);
      if (error) { setSaveError('Erro ao salvar grupo de combo.'); return; }
    } else {
      const { data, error } = await supabase.from('combo_groups').insert(payload).select().maybeSingle();
      if (error) { setSaveError('Erro ao salvar grupo de combo.'); return; }
      groupId = data?.id;
    }
    if (groupId) {
      await supabase.from('combo_group_items').delete().eq('combo_group_id', groupId);
      if (comboItems.length > 0) {
        const { data: newItems } = await supabase.from('combo_group_items').insert(
          comboItems.map((ci, i) => ({ combo_group_id: groupId, name: ci.name, price_delta: ci.price_delta, observations: ci.observations || null, sort_order: i }))
        ).select();
        if (newItems) {
          const extrasToInsert: { combo_group_item_id: string; name: string; price: number; sort_order: number }[] = [];
          newItems.forEach((ni, i) => {
            (comboItems[i].combo_item_extras ?? []).forEach(ex => {
              extrasToInsert.push({ combo_group_item_id: ni.id, name: ex.name, price: ex.price, sort_order: ex.sort_order });
            });
          });
          if (extrasToInsert.length > 0) {
            await supabase.from('combo_item_extras').insert(extrasToInsert);
          }
        }
      }
    }
    setModal(null);
    fetchAll();
  }

  async function deleteComboGroup(id: string) {
    await supabase.from('combo_groups').delete().eq('id', id);
    fetchAll();
  }

  function addComboItem() {
    setComboItems(prev => [...prev, { id: crypto.randomUUID(), combo_group_id: '', name: '', price_delta: 0, observations: null, sort_order: prev.length, combo_item_extras: [] }]);
  }

  function updateComboItem(idx: number, field: keyof ComboGroupItem, value: string | number) {
    setComboItems(prev => prev.map((ci, i) => i === idx ? { ...ci, [field]: value } : ci));
  }

  function removeComboItem(idx: number) {
    setComboItems(prev => prev.filter((_, i) => i !== idx));
  }

  function moveComboItem(idx: number, dir: -1 | 1) {
    setComboItems(prev => {
      const ni = idx + dir;
      if (ni < 0 || ni >= prev.length) return prev;
      const arr = [...prev];
      [arr[idx], arr[ni]] = [arr[ni], arr[idx]];
      return arr;
    });
  }

  function addComboItemExtra(itemIdx: number) {
    setComboItems(prev => prev.map((ci, i) => i === itemIdx ? {
      ...ci,
      combo_item_extras: [...(ci.combo_item_extras ?? []), { id: crypto.randomUUID(), combo_group_item_id: ci.id, name: '', price: 0, sort_order: (ci.combo_item_extras ?? []).length }]
    } : ci));
  }

  function updateComboItemExtra(itemIdx: number, extraIdx: number, field: 'name' | 'price', value: string | number) {
    setComboItems(prev => prev.map((ci, i) => i === itemIdx ? {
      ...ci,
      combo_item_extras: (ci.combo_item_extras ?? []).map((ex, j) => j === extraIdx ? { ...ex, [field]: value } : ex)
    } : ci));
  }

  function removeComboItemExtra(itemIdx: number, extraIdx: number) {
    setComboItems(prev => prev.map((ci, i) => i === itemIdx ? {
      ...ci,
      combo_item_extras: (ci.combo_item_extras ?? []).filter((_, j) => j !== extraIdx)
    } : ci));
  }

  function moveComboItemExtra(itemIdx: number, extraIdx: number, dir: -1 | 1) {
    setComboItems(prev => prev.map((ci, i) => {
      if (i !== itemIdx) return ci;
      const extras = [...(ci.combo_item_extras ?? [])];
      const ni = extraIdx + dir;
      if (ni < 0 || ni >= extras.length) return ci;
      [extras[extraIdx], extras[ni]] = [extras[ni], extras[extraIdx]];
      return { ...ci, combo_item_extras: extras };
    }));
  }

  async function moveComboGroup(productId: string, groupId: string, dir: -1 | 1) {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;
    const groups = [...(prod.combo_groups ?? [])].sort((a, b) => a.sort_order - b.sort_order);
    const idx = groups.findIndex(g => g.id === groupId);
    const ni = idx + dir;
    if (ni < 0 || ni >= groups.length) return;
    [groups[idx], groups[ni]] = [groups[ni], groups[idx]];
    await Promise.all(groups.map((g, i) => supabase.from('combo_groups').update({ sort_order: i }).eq('id', g.id)));
    fetchAll();
  }

  function openExtraModal(productId: string, extra?: ProductExtra) {
    setEditingExtra({ extra: extra ?? null, productId });
    setExtName(extra?.name ?? '');
    setExtPrice(extra?.price?.toString() ?? '');
    setModal('extra');
  }

  async function saveExtra() {
    if (!editingExtra) return;
    const payload = { name: extName, price: parseFloat(extPrice) || 0, product_id: editingExtra.productId };
    const { error } = editingExtra.extra
      ? await supabase.from('product_extras').update(payload).eq('id', editingExtra.extra.id)
      : await supabase.from('product_extras').insert(payload);
    if (error) { setSaveError('Erro ao salvar adicional.'); return; }
    setModal(null);
    fetchAll();
  }

  async function deleteExtra(id: string) {
    await supabase.from('product_extras').delete().eq('id', id);
    fetchAll();
  }

  function toggleExtras(prodId: string) {
    setExpandedExtras(prev => {
      const next = new Set(prev);
      if (next.has(prodId)) { next.delete(prodId); } else { next.add(prodId); }
      return next;
    });
  }

  const activeCategories = categories.filter(c => c.active);

  const filteredProducts = filterCatId === 'all'
    ? products
    : filterCatId === 'none'
      ? products.filter(p => !p.category_id)
      : products.filter(p => p.category_id === filterCatId);

  return (
    <div className="p-3 sm:p-6 max-w-6xl mx-auto space-y-6 sm:space-y-8">
      {saveError && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{saveError}</span>
          <button onClick={() => setSaveError(null)} className="text-red-400 hover:text-red-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {/* Categories */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2"><Tag className="w-5 h-5 text-amber-400" /> Categorias</h2>
            <TutorialHelpButton videoId="9qRrC3ny05U" title="Configurando o Cardápio" />
          </div>
          <button onClick={() => openCategoryModal()} className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
            <Plus className="w-4 h-4" /> Nova Categoria
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {categories.map(cat => (
            <div key={cat.id} className="bg-[#0f2040] border border-[#1e3868] rounded-xl p-3 flex items-center justify-between group">
              <span className="text-white text-sm font-medium">{cat.icon && <span className="mr-1">{cat.icon}</span>}{cat.name}</span>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openCategoryModal(cat)} className="p-1 text-slate-400 hover:text-white"><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={() => deleteCategory(cat.id)} className="p-1 text-slate-400 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
          {categories.length === 0 && <p className="col-span-full text-slate-500 text-sm">Nenhuma categoria criada.</p>}
        </div>
      </section>

      {/* Products */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2"><Package className="w-5 h-5 text-amber-400" /> Produtos</h2>
            <p className="text-xs text-slate-400 mt-0.5">{filteredProducts.length} produto(s)</p>
          </div>
          <button onClick={() => openProductModal()} className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
            <Plus className="w-4 h-4" /> Novo Produto
          </button>
        </div>

        {/* Category filter tabs */}
        <div className="flex gap-2 flex-wrap mb-4">
          <button
            onClick={() => setFilterCatId('all')}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${filterCatId === 'all' ? 'bg-amber-500 text-black' : 'bg-[#1a3260] text-slate-300 hover:bg-[#2a4d9a]'}`}
          >
            Todos ({products.length})
          </button>
          {categories.map(cat => {
            const count = products.filter(p => p.category_id === cat.id).length;
            return (
              <button
                key={cat.id}
                onClick={() => setFilterCatId(cat.id)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${filterCatId === cat.id ? 'bg-amber-500 text-black' : 'bg-[#1a3260] text-slate-300 hover:bg-[#2a4d9a]'}`}
              >
                {cat.icon && <span className="mr-1">{cat.icon}</span>}{cat.name} ({count})
              </button>
            );
          })}
          {products.some(p => !p.category_id) && (
            <button
              onClick={() => setFilterCatId('none')}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${filterCatId === 'none' ? 'bg-amber-500 text-black' : 'bg-[#1a3260] text-slate-300 hover:bg-[#2a4d9a]'}`}
            >
              Sem categoria ({products.filter(p => !p.category_id).length})
            </button>
          )}
        </div>

        <div className="space-y-3">
          {filteredProducts.map(prod => (
            <div key={prod.id} className={`bg-[#0f2040] border rounded-xl overflow-hidden transition-all ${prod.active ? 'border-[#1e3868]' : 'border-[#1e3868] opacity-60'}`}>
              <div className="flex items-center gap-3 p-4">
                {prod.image_url ? (
                  <img src={prod.image_url} alt={prod.name} className="w-14 h-14 object-cover rounded-lg shrink-0" />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-[#1a3260] flex items-center justify-center shrink-0">
                    <Package className="w-6 h-6 text-slate-600" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-semibold text-sm truncate">{prod.name}</span>
                    {prod.is_combo && <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full font-medium">COMBO</span>}
                    {!prod.active && <span className="text-[10px] bg-[#1e3868] text-slate-400 px-2 py-0.5 rounded-full font-medium">OCULTO</span>}
                  </div>
                  <p className="text-slate-400 text-xs mt-0.5 truncate">{prod.description}</p>
                  <p className="text-amber-400 text-sm font-bold mt-1">R$ {prod.price.toFixed(2).replace('.', ',')}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => toggleProductActive(prod)} title={prod.active ? 'Ocultar' : 'Exibir'} className={`p-1.5 rounded-lg text-xs transition-colors ${prod.active ? 'bg-green-500/20 text-green-400 hover:bg-red-500/20 hover:text-red-400' : 'bg-[#1a3260] text-slate-500 hover:bg-green-500/20 hover:text-green-400'}`}>
                    {prod.active ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={() => openProductModal(prod)} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-[#1a3260] transition-colors" title="Editar"><Pencil className="w-3.5 h-3.5" /></button>
                  <button
                    onClick={() => duplicateProduct(prod)}
                    disabled={duplicating === prod.id}
                    className="p-1.5 text-slate-400 hover:text-amber-400 rounded-lg hover:bg-amber-500/10 transition-colors disabled:opacity-40"
                    title="Duplicar produto"
                  >
                    {duplicating === prod.id
                      ? <span className="w-3.5 h-3.5 block border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                      : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={() => deleteProduct(prod.id)} className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors" title="Excluir"><Trash2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setExpandedProduct(expandedProduct === prod.id ? null : prod.id)} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-[#1a3260] transition-colors">
                    {expandedProduct === prod.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {expandedProduct === prod.id && (
                <div className="border-t border-[#1e3868] p-4 space-y-4 bg-[#0d1f3c]/50">
                  {/* Combo Groups */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5"><Layers className="w-3.5 h-3.5" /> Grupos de Combo</h4>
                      <button onClick={() => openComboModal(prod.id)} className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1"><Plus className="w-3 h-3" /> Adicionar</button>
                    </div>
                    <div className="space-y-2">
                      {(prod.combo_groups ?? []).slice().sort((a, b) => a.sort_order - b.sort_order).map((cg, cgi, arr) => (
                        <div key={cg.id} className="bg-[#1a3260] rounded-lg p-3 flex items-start justify-between">
                          <div>
                            <p className="text-white text-xs font-medium">{cg.name}</p>
                            <p className="text-slate-400 text-xs mt-0.5">
                              {cg.is_required ? 'Obrigatório' : 'Opcional'} · Min {cg.min_qty} / Max {cg.max_qty}
                            </p>
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {(cg.combo_group_items ?? []).slice().sort((a, b) => a.sort_order - b.sort_order).map(item => (
                                <span key={item.id} className="text-[10px] bg-[#1e3868] text-slate-300 px-2 py-0.5 rounded-full">
                                  {item.name}{item.price_delta > 0 ? ` +R${item.price_delta.toFixed(2)}` : ''}{item.observations ? ` · ${item.observations}` : ''}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0 ml-2 items-center">
                            <button onClick={() => moveComboGroup(prod.id, cg.id, -1)} disabled={cgi === 0} className="p-1 text-slate-400 hover:text-white disabled:opacity-30" title="Subir"><ArrowUp className="w-3 h-3" /></button>
                            <button onClick={() => moveComboGroup(prod.id, cg.id, 1)} disabled={cgi === arr.length - 1} className="p-1 text-slate-400 hover:text-white disabled:opacity-30" title="Descer"><ArrowDown className="w-3 h-3" /></button>
                            <button onClick={() => openComboModal(prod.id, cg)} className="p-1 text-slate-400 hover:text-white"><Pencil className="w-3 h-3" /></button>
                            <button onClick={() => deleteComboGroup(cg.id)} className="p-1 text-slate-400 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                          </div>
                        </div>
                      ))}
                      {(prod.combo_groups ?? []).length === 0 && <p className="text-slate-600 text-xs">Nenhum grupo de combo.</p>}
                    </div>
                  </div>

                  {/* Extras — collapsed by default */}
                  <div className="border border-[#1e3868] rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleExtras(prod.id)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#1a3260]/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Adicionais (Up-sell)</h4>
                        {(prod.product_extras ?? []).length > 0 && (
                          <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-medium">
                            {(prod.product_extras ?? []).length}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={e => { e.stopPropagation(); openExtraModal(prod.id); }}
                          className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> Adicionar
                        </button>
                        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${expandedExtras.has(prod.id) ? 'rotate-180' : ''}`} />
                      </div>
                    </button>

                    {expandedExtras.has(prod.id) && (
                      <div className="px-4 pb-3 border-t border-[#1e3868]">
                        <div className="flex flex-wrap gap-2 pt-3">
                          {(prod.product_extras ?? []).map(ex => (
                            <div key={ex.id} className="bg-[#1a3260] rounded-lg px-3 py-2 flex items-center gap-2">
                              <span className="text-xs text-white">{ex.name}</span>
                              <span className="text-xs text-amber-400 font-medium">+R${ex.price.toFixed(2)}</span>
                              <button onClick={() => openExtraModal(prod.id, ex)} className="text-slate-500 hover:text-white"><Pencil className="w-3 h-3" /></button>
                              <button onClick={() => deleteExtra(ex.id)} className="text-slate-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                            </div>
                          ))}
                          {(prod.product_extras ?? []).length === 0 && <p className="text-slate-600 text-xs">Nenhum adicional cadastrado.</p>}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
          {filteredProducts.length === 0 && <p className="text-slate-500 text-sm">Nenhum produto nesta categoria.</p>}
        </div>
      </section>

      {/* Modals */}
      {modal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0f2040] border border-[#1e3868] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-[#1e3868]">
              <h3 className="font-bold text-white">
                {modal === 'category' && (editingCategory ? 'Editar Categoria' : 'Nova Categoria')}
                {modal === 'product' && (editingProduct ? 'Editar Produto' : 'Novo Produto')}
                {modal === 'combo' && (editingComboGroup?.group ? 'Editar Grupo de Combo' : 'Novo Grupo de Combo')}
                {modal === 'extra' && (editingExtra?.extra ? 'Editar Adicional' : 'Novo Adicional')}
              </h3>
              <button onClick={() => setModal(null)} className="text-slate-400 hover:text-white p-1"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-5 space-y-4">
              {modal === 'category' && (
                <>
                  <Field label="Nome da Categoria">
                    <input value={catName} onChange={e => setCatName(e.target.value)} className={inputCls} placeholder="Ex: Pratos Principais" />
                  </Field>
                  <Field label="Ícone (emoji, opcional)">
                    <input value={catIcon} onChange={e => setCatIcon(e.target.value)} className={inputCls} placeholder="🍔" maxLength={4} />
                  </Field>
                </>
              )}

              {modal === 'product' && (
                <>
                  <Field label="Nome do Produto">
                    <input value={prodName} onChange={e => setProdName(e.target.value)} className={inputCls} placeholder="Ex: X-Burguer Especial" />
                  </Field>
                  <Field label="Descrição">
                    <textarea value={prodDesc} onChange={e => setProdDesc(e.target.value)} className={inputCls + ' resize-none'} rows={2} placeholder="Descreva o produto..." />
                  </Field>
                  <Field label="Preço (R$)">
                    <input type="number" step="0.01" value={prodPrice} onChange={e => setProdPrice(e.target.value)} className={inputCls} placeholder="0.00" />
                  </Field>
                  <Field label="Foto do Produto">
                    <ImageUpload value={prodImage} onChange={setProdImage} />
                  </Field>
                  <Field label="Categoria">
                    <select value={prodCatId} onChange={e => setProdCatId(e.target.value)} className={inputCls}>
                      <option value="">Sem categoria</option>
                      {activeCategories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                    </select>
                  </Field>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={prodIsCombo} onChange={e => setProdIsCombo(e.target.checked)} className="w-4 h-4 accent-amber-500" />
                    <span className="text-sm text-slate-300">Este produto é um combo (permite grupos de escolha)</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={prodIsMeioAMeio} onChange={e => { setProdIsMeioAMeio(e.target.checked); if (e.target.checked) setProdIsCombo(false); }} className="w-4 h-4 accent-amber-500" />
                    <span className="text-sm text-slate-300">Produto Meio a Meio (cliente escolhe 2 sabores)</span>
                  </label>
                  {prodIsMeioAMeio && (
                    <div className="bg-[#1a3260]/60 rounded-xl p-4 space-y-3 border border-[#1e3868]">
                      <p className="text-xs text-amber-400 font-semibold uppercase tracking-wide">Configuração Meio a Meio</p>
                      <Field label="Categoria — 1ª Metade">
                        <select value={prodMeioACat1Id} onChange={e => setProdMeioACat1Id(e.target.value)} className={inputCls}>
                          <option value="">Selecione a categoria</option>
                          {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                        </select>
                      </Field>
                      <Field label="Categoria — 2ª Metade">
                        <select value={prodMeioACat2Id} onChange={e => setProdMeioACat2Id(e.target.value)} className={inputCls}>
                          <option value="">Selecione a categoria</option>
                          {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                        </select>
                      </Field>
                      <Field label="Regra de Preço">
                        <select value={prodMeioPriceRule} onChange={e => setProdMeioPriceRule(e.target.value as 'highest' | 'average' | 'sum')} className={inputCls}>
                          <option value="highest">Maior valor das metades</option>
                          <option value="average">Média dos valores</option>
                          <option value="sum">Soma dos valores</option>
                        </select>
                      </Field>
                      <p className="text-[11px] text-slate-400 leading-relaxed">Os produtos de cada categoria serão as opções disponíveis para cada metade. O preço base do produto não é usado — o valor é calculado conforme a regra acima.</p>
                    </div>
                  )}
                </>
              )}

              {modal === 'combo' && (
                <>
                  <Field label="Nome do Grupo">
                    <input value={cgName} onChange={e => setCgName(e.target.value)} className={inputCls} placeholder="Ex: Escolha o Burguer" />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Mínimo de escolhas">
                      <input type="number" min="0" value={cgMin} onChange={e => setCgMin(e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="Máximo de escolhas">
                      <input type="number" min="1" value={cgMax} onChange={e => setCgMax(e.target.value)} className={inputCls} />
                    </Field>
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={cgRequired} onChange={e => setCgRequired(e.target.checked)} className="w-4 h-4 accent-amber-500" />
                    <span className="text-sm text-slate-300">Grupo obrigatório</span>
                  </label>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs text-slate-400">Opções do grupo</label>
                      <button type="button" onClick={addComboItem} className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1"><Plus className="w-3 h-3" /> Adicionar opção</button>
                    </div>
                    <div className="space-y-3">
                      {comboItems.map((ci, idx) => (
                        <div key={ci.id} className="bg-[#1a3260]/60 rounded-xl p-3 space-y-2">
                          <div className="flex gap-2 items-center">
                            <div className="flex flex-col gap-0.5 shrink-0">
                              <button type="button" onClick={() => moveComboItem(idx, -1)} disabled={idx === 0} className="p-0.5 text-slate-400 hover:text-white disabled:opacity-30" title="Subir"><ArrowUp className="w-3 h-3" /></button>
                              <button type="button" onClick={() => moveComboItem(idx, 1)} disabled={idx === comboItems.length - 1} className="p-0.5 text-slate-400 hover:text-white disabled:opacity-30" title="Descer"><ArrowDown className="w-3 h-3" /></button>
                            </div>
                            <input value={ci.name} onChange={e => updateComboItem(idx, 'name', e.target.value)} className={inputCls + ' flex-1'} placeholder="Nome da opção (ex: Clássico)" />
                            <div className="relative w-28 shrink-0">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">+R$</span>
                              <input type="number" step="0.01" min="0" value={ci.price_delta} onChange={e => updateComboItem(idx, 'price_delta', parseFloat(e.target.value) || 0)} className={inputCls + ' pl-8'} placeholder="0,00" />
                            </div>
                            <button type="button" onClick={() => removeComboItem(idx)} className="text-slate-500 hover:text-red-400 shrink-0 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                          <input
                            value={ci.observations ?? ''}
                            onChange={e => updateComboItem(idx, 'observations', e.target.value)}
                            className={inputCls + ' text-xs'}
                            placeholder="Observação sem cobrança (ex: sem cebola, ponto da carne...)"
                          />
                          <div className="pt-1 border-t border-[#1e3868]/50">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[11px] text-slate-400 font-medium">Adicionais desta opção</span>
                              <button type="button" onClick={() => addComboItemExtra(idx)} className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-0.5"><Plus className="w-2.5 h-2.5" /> Adicionar</button>
                            </div>
                            {(ci.combo_item_extras ?? []).length > 0 && (
                              <div className="space-y-1.5">
                                {(ci.combo_item_extras ?? []).map((ex, eIdx) => (
                                  <div key={ex.id} className="flex gap-1.5 items-center">
                                    <div className="flex flex-col gap-0.5 shrink-0">
                                      <button type="button" onClick={() => moveComboItemExtra(idx, eIdx, -1)} disabled={eIdx === 0} className="p-0.5 text-slate-400 hover:text-white disabled:opacity-30" title="Subir"><ArrowUp className="w-2.5 h-2.5" /></button>
                                      <button type="button" onClick={() => moveComboItemExtra(idx, eIdx, 1)} disabled={eIdx === (ci.combo_item_extras ?? []).length - 1} className="p-0.5 text-slate-400 hover:text-white disabled:opacity-30" title="Descer"><ArrowDown className="w-2.5 h-2.5" /></button>
                                    </div>
                                    <input value={ex.name} onChange={e => updateComboItemExtra(idx, eIdx, 'name', e.target.value)} className={inputCls + ' flex-1 !py-1.5 !text-xs'} placeholder="Nome (ex: Bacon)" />
                                    <div className="relative w-20 shrink-0">
                                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] pointer-events-none">+R$</span>
                                      <input type="number" step="0.01" min="0" value={ex.price} onChange={e => updateComboItemExtra(idx, eIdx, 'price', parseFloat(e.target.value) || 0)} className={inputCls + ' !py-1.5 !pl-7 !text-xs'} placeholder="0,00" />
                                    </div>
                                    <button type="button" onClick={() => removeComboItemExtra(idx, eIdx)} className="text-slate-500 hover:text-red-400 shrink-0 p-0.5"><Trash2 className="w-3 h-3" /></button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {modal === 'extra' && (
                <>
                  <Field label="Nome do Adicional">
                    <input value={extName} onChange={e => setExtName(e.target.value)} className={inputCls} placeholder="Ex: Bacon extra" />
                  </Field>
                  <Field label="Preço (R$)">
                    <input type="number" step="0.01" value={extPrice} onChange={e => setExtPrice(e.target.value)} className={inputCls} placeholder="0.00" />
                  </Field>
                </>
              )}
            </div>

            <div className="flex gap-3 p-5 border-t border-[#1e3868]">
              <button onClick={() => setModal(null)} className="flex-1 bg-[#1a3260] hover:bg-[#2a4d9a] text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">Cancelar</button>
              <button
                onClick={() => {
                  if (modal === 'category') saveCategory();
                  if (modal === 'product') saveProduct();
                  if (modal === 'combo') saveComboGroup();
                  if (modal === 'extra') saveExtra();
                }}
                className="flex-1 bg-amber-500 hover:bg-amber-400 text-black px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

const inputCls = 'w-full bg-[#1a3260] border border-[#1e3868] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors';
