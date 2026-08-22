import { createClient } from '@supabase/supabase-js';
import type { Product, OrderItem } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function sortProductComboGroups(products: Product[]): Product[] {
  return products.map(p => ({
    ...p,
    combo_groups: (p.combo_groups ?? [])
      .slice()
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map(cg => ({
        ...cg,
        combo_group_items: (cg.combo_group_items ?? [])
          .slice()
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map(ci => ({
            ...ci,
            combo_item_extras: (ci.combo_item_extras ?? [])
              .slice()
              .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
          })),
      })),
    product_extras: (p.product_extras ?? [])
      .slice()
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
  }));
}

type LegacyCombo = { groupName?: string; items?: { name: string; qty: number; extras?: { name: string; price: number; qty: number }[] }[] };
type LegacyExtra = { name: string; price: number; qty: number };

export function normalizeOrderItemCustomizations(item: OrderItem): OrderItem {
  const c = item.customizations;
  if (!c) return item;
  const combos: LegacyCombo[] = Array.isArray(c.combos) ? c.combos : [];
  const extras: LegacyExtra[] = Array.isArray(c.extras) ? c.extras : [];

  const cleaned = combos
    .map(combo => ({
      groupName: (combo.groupName ?? '').trim(),
      items: (combo.items ?? []).filter(i => i.qty > 0),
    }))
    .filter(combo => combo.items.length > 0);

  if (extras.length > 0) {
    const lastGroup = cleaned[cleaned.length - 1];
    if (lastGroup) {
      const orphanExtras = extras.map(e => ({ name: e.name, price: e.price, qty: e.qty }));
      const lastItem = lastGroup.items[lastGroup.items.length - 1];
      if (lastItem) {
        lastItem.extras = [...(lastItem.extras ?? []), ...orphanExtras];
      }
    }
  }

  return {
    ...item,
    customizations: {
      ...c,
      combos: cleaned.map(c2 => ({
        groupName: c2.groupName,
        items: c2.items.map(i => ({
          name: i.name,
          qty: i.qty,
          ...(i.extras && i.extras.length > 0 ? { extras: i.extras } : {}),
        })),
      })),
      extras: [],
    },
  };
}

export function normalizeOrderItems(items: OrderItem[]): OrderItem[] {
  return items.map(normalizeOrderItemCustomizations);
}
