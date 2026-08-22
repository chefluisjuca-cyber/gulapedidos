export type BillingCycle = 'mensal' | 'semestral' | 'anual';

export interface ProductPricing {
  mensal: { price: number; stripe_price_id: string };
  semestral: { price: number; stripe_price_id: string };
  anual: { price: number; stripe_price_id: string };
}

export const STRIPE_PRICES: Record<string, ProductPricing> = {
  gula_etiquetas: {
    mensal:    { price:  39.99, stripe_price_id: 'price_1U1XvRRNhmPZU507MjkznLVg' },
    semestral: { price: 215.90, stripe_price_id: 'price_1U1XvRRNhmPZU507ZKGFYQJx' },
    anual:     { price: 383.90, stripe_price_id: 'price_1U1XvRRNhmPZU5079ladqUWN' },
  },
  gula_fila: {
    mensal:    { price:  39.99, stripe_price_id: 'price_1U1XvRRNhmPZU507MjkznLVg' },
    semestral: { price: 215.90, stripe_price_id: 'price_1U1XvRRNhmPZU507ZKGFYQJx' },
    anual:     { price: 383.90, stripe_price_id: 'price_1U1XvRRNhmPZU5079ladqUWN' },
  },
  gula_feedback: {
    mensal:    { price:  29.99, stripe_price_id: 'price_1U55mzRNhmPZU5073LPQtsDa' },
    semestral: { price: 161.99, stripe_price_id: 'price_1U55mzRNhmPZU507N8aN2qpz' },
    anual:     { price: 287.99, stripe_price_id: 'price_1U55mzRNhmPZU507N3TFXMl1' },
  },
};

export function getPriceForCycle(product: string, cycle: BillingCycle) {
  return STRIPE_PRICES[product]?.[cycle] ?? STRIPE_PRICES[product]?.mensal;
}
