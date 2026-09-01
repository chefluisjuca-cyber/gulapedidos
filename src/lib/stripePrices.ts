export type BillingCycle = 'mensal' | 'semestral' | 'anual';

export interface ProductPricing {
  mensal: { price: number; stripe_price_id: string };
  semestral: { price: number; stripe_price_id: string };
  anual: { price: number; stripe_price_id: string };
}

export const STRIPE_PRICES: Record<string, ProductPricing> = {
  gula_etiquetas: {
    mensal:    { price:  39.99, stripe_price_id: 'price_1U1XvRRNhmPZU507MjkznLVg' },
    semestral: { price:  35.99, stripe_price_id: 'price_1UAZFMRNhmPZU507EQN9orkH' },
    anual:     { price:  31.99, stripe_price_id: 'price_1UAZGHRNhmPZU507BxrR98yR' },
  },
  gula_fila: {
    mensal:    { price:  49.99, stripe_price_id: 'price_1TxU1ERNhmPZU507Ev3MmGbz' },
    semestral: { price:  44.99, stripe_price_id: 'price_1UAZACRNhmPZU507qmwmBOWT' },
    anual:     { price:  39.99, stripe_price_id: 'price_1UAZAyRNhmPZU507jloLrvru' },
  },
  gula_feedback: {
    mensal:    { price:  29.99, stripe_price_id: 'price_1U55mzRNhmPZU5073LPQtsDa' },
    semestral: { price:  26.99, stripe_price_id: 'price_1UAYXbRNhmPZU507Qyitws9F' },
    anual:     { price:  23.99, stripe_price_id: 'price_1UAYUNRNhmPZU507lcGxypJM' },
  },
};

export function getPriceForCycle(product: string, cycle: BillingCycle) {
  return STRIPE_PRICES[product]?.[cycle] ?? STRIPE_PRICES[product]?.mensal;
}
