import { useState, useEffect, useRef } from 'react';
import { X, Phone, Check, Trophy, Coins, Percent, Gift, Star, ChevronRight, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { LoyaltyConfig, LoyaltyReward, LoyaltyCustomer } from '../../types';

interface Props {
  restaurantId: string | null;
  cartSubtotal: number;
  onClose: () => void;
  onConfirm: (phone: string, name: string, rewardId?: string, discount?: number) => void;
}

type Step = 'benefits' | 'phone' | 'dashboard';

function formatPhone(raw: string) {
  const digits = raw.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export default function LoyaltyBenefitsModal({ restaurantId, cartSubtotal, onClose, onConfirm }: Props) {
  const [step, setStep] = useState<Step>('benefits');
  const [config, setConfig] = useState<LoyaltyConfig | null>(null);
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);

  // phone step
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [looking, setLooking] = useState(false);
  const [customer, setCustomer] = useState<LoyaltyCustomer | null>(null);
  const [isNewCustomer, setIsNewCustomer] = useState<boolean | null>(null);
  const [availableRewards, setAvailableRewards] = useState<LoyaltyReward[]>([]);
  const [selectedReward, setSelectedReward] = useState<LoyaltyReward | null>(null);
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    async function load() {
      const cfgQ = supabase.from('loyalty_configs').select('*').eq('ativo', true);
      const rwdQ = supabase.from('loyalty_rewards').select('*').eq('ativo', true).order('pontos_necessarios');
      const [cfgRes, rwdRes] = await Promise.all([
        restaurantId ? cfgQ.eq('restaurant_id', restaurantId).maybeSingle() : cfgQ.is('restaurant_id', null).maybeSingle(),
        restaurantId ? rwdQ.eq('restaurant_id', restaurantId) : rwdQ.is('restaurant_id', null),
      ]);
      if (cfgRes.data) setConfig(cfgRes.data as LoyaltyConfig);
      setRewards((rwdRes.data ?? []) as LoyaltyReward[]);
    }
    load();
  }, [restaurantId]);

  function handlePhoneChange(raw: string) {
    const formatted = formatPhone(raw);
    setPhone(formatted);
    setCustomer(null);
    setIsNewCustomer(null);
    setAvailableRewards([]);
    setSelectedReward(null);
    const digits = formatted.replace(/\D/g, '');
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    if (digits.length >= 10) {
      lookupTimer.current = setTimeout(() => lookupCustomer(formatted), 600);
    }
  }

  async function lookupCustomer(formattedPhone: string) {
    if (!config) return;
    setLooking(true);
    const q = supabase.from('loyalty_customers').select('*').eq('phone', formattedPhone);
    const { data } = await (restaurantId ? q.eq('restaurant_id', restaurantId) : q.is('restaurant_id', null)).maybeSingle();
    setLooking(false);
    if (data) {
      const c = data as LoyaltyCustomer;
      setCustomer(c);
      setIsNewCustomer(false);
      if (c.nome) setName(c.nome);
      // filter eligible rewards
      const eligible = rewards.filter(r => {
        if (config.tipo_promocao === 'pontos_por_real') return c.saldo_pontos >= r.pontos_necessarios;
        if (config.tipo_promocao === 'cashback') return Number(c.saldo_cashback) >= r.pontos_necessarios;
        return false;
      });
      setAvailableRewards(eligible);
    } else {
      setIsNewCustomer(true);
      setCustomer(null);
    }
  }

  function computeDiscount(reward: LoyaltyReward): number {
    if (reward.tipo_recompensa === 'desconto_fixo') return Number(reward.valor_recompensa);
    if (reward.tipo_recompensa === 'desconto_percentual') return (cartSubtotal * Number(reward.valor_recompensa)) / 100;
    if (reward.tipo_recompensa === 'produto_gratis') return Number(reward.valor_recompensa);
    return 0;
  }

  const discount = selectedReward ? Math.min(computeDiscount(selectedReward), cartSubtotal) : 0;
  const phoneDigits = phone.replace(/\D/g, '');
  const phoneValid = phoneDigits.length >= 10;

  function handleConfirm() {
    if (!phoneValid) return;
    onConfirm(phone, name.trim(), selectedReward?.id, discount > 0 ? discount : undefined);
  }

  const pointsToEarn = config?.tipo_promocao === 'pontos_por_real'
    ? Math.floor((cartSubtotal - discount) * Number(config.valor_conversao))
    : 0;
  const cashbackToEarn = config?.tipo_promocao === 'cashback'
    ? (cartSubtotal - discount) * Number(config.valor_conversao) / 100
    : 0;

  if (!config) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Gula Fidelidade</h2>
              <p className="text-xs text-gray-500">Acumule e resgate benefícios</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {/* ── STEP 1: Benefits overview ── */}
          {step === 'benefits' && (
            <div className="px-5 py-5 space-y-4">
              {/* Benefit highlight */}
              <div className={`rounded-2xl p-4 flex items-center gap-4 ${config.tipo_promocao === 'pontos_por_real' ? 'bg-amber-50 border border-amber-200' : 'bg-green-50 border border-green-200'}`}>
                {config.tipo_promocao === 'pontos_por_real' ? (
                  <Coins className="w-8 h-8 text-amber-500 shrink-0" />
                ) : (
                  <Percent className="w-8 h-8 text-green-500 shrink-0" />
                )}
                <div>
                  {config.tipo_promocao === 'pontos_por_real' && (
                    <>
                      <p className="font-bold text-gray-900 text-sm">Acumule Pontos</p>
                      <p className="text-xs text-gray-600 mt-0.5">
                        A cada R$ 1,00 você ganha <strong>{config.valor_conversao} ponto{Number(config.valor_conversao) !== 1 ? 's' : ''}</strong>.{' '}
                        Este pedido vale <strong>{pointsToEarn} pontos</strong>.
                      </p>
                    </>
                  )}
                  {config.tipo_promocao === 'cashback' && (
                    <>
                      <p className="font-bold text-gray-900 text-sm">Cashback Direto</p>
                      <p className="text-xs text-gray-600 mt-0.5">
                        <strong>{config.valor_conversao}%</strong> do valor volta como saldo.{' '}
                        Este pedido gera <strong>R$ {cashbackToEarn.toFixed(2)}</strong> de cashback.
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Rewards preview */}
              {rewards.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Gift className="w-3.5 h-3.5" /> Recompensas disponíveis
                  </p>
                  <div className="space-y-2">
                    {rewards.slice(0, 3).map(r => (
                      <div key={r.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100">
                        <Star className="w-4 h-4 text-amber-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">{r.nome_recompensa}</p>
                          <p className="text-[11px] text-gray-400">
                            {r.pontos_necessarios} {config.tipo_promocao === 'cashback' ? 'R$ de cashback' : 'pontos'}
                          </p>
                        </div>
                        <span className="text-xs font-bold text-green-600 shrink-0">
                          {r.tipo_recompensa === 'desconto_fixo' && `-R$ ${Number(r.valor_recompensa).toFixed(2)}`}
                          {r.tipo_recompensa === 'desconto_percentual' && `-${r.valor_recompensa}%`}
                          {r.tipo_recompensa === 'produto_gratis' && 'Grátis'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {config.termos && (
                <p className="text-[11px] text-gray-400 leading-relaxed">{config.termos}</p>
              )}
            </div>
          )}

          {/* ── STEP 2: Phone input ── */}
          {step === 'phone' && (
            <div className="px-5 py-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">Seu telefone</label>
                <p className="text-xs text-gray-500 mb-3">Usamos o telefone para identificar sua conta.</p>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    autoFocus
                    value={phone}
                    onChange={e => handlePhoneChange(e.target.value)}
                    placeholder="(99) 99999-9999"
                    className="w-full pl-10 pr-10 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-amber-400 transition-colors"
                  />
                  {looking && (
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                  )}
                  {!looking && isNewCustomer === false && (
                    <Check className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                  )}
                </div>
              </div>

              {/* New customer: ask for name */}
              {isNewCustomer === true && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-amber-600" />
                    <p className="text-sm font-semibold text-amber-800">Novo cadastro</p>
                  </div>
                  <p className="text-xs text-amber-700">Bem-vindo! Informe seu nome para criar sua conta fidelidade.</p>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Seu nome (opcional)"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-amber-200 text-sm text-gray-900 bg-white focus:outline-none focus:border-amber-400 transition-colors"
                  />
                  <div className="bg-amber-100 rounded-xl px-3 py-2 text-xs text-amber-700 flex items-center gap-1.5">
                    {config.tipo_promocao === 'pontos_por_real' ? <Coins className="w-3.5 h-3.5 shrink-0" /> : <Percent className="w-3.5 h-3.5 shrink-0" />}
                    {config.tipo_promocao === 'pontos_por_real' && `Este pedido valerá ${pointsToEarn} pontos.`}
                    {config.tipo_promocao === 'cashback' && `Você receberá R$ ${cashbackToEarn.toFixed(2)} de cashback.`}
                  </div>
                </div>
              )}

              {/* Returning customer: show dashboard */}
              {customer && (
                <div className="space-y-3">
                  <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-gray-900">
                        Olá{customer.nome ? `, ${customer.nome}` : ''}!
                      </p>
                      <span className="text-xs text-gray-400">{customer.total_visitas} visitas</span>
                    </div>

                    <div className="flex gap-3">
                      {config.tipo_promocao === 'pontos_por_real' && (
                        <div className="flex-1 bg-amber-50 rounded-xl px-3 py-2.5 text-center border border-amber-100">
                          <p className="text-xl font-black text-amber-600">{customer.saldo_pontos.toLocaleString('pt-BR')}</p>
                          <p className="text-[11px] text-amber-700 mt-0.5">pontos</p>
                        </div>
                      )}
                      {config.tipo_promocao === 'cashback' && (
                        <div className="flex-1 bg-green-50 rounded-xl px-3 py-2.5 text-center border border-green-100">
                          <p className="text-xl font-black text-green-600">R$ {Number(customer.saldo_cashback).toFixed(2)}</p>
                          <p className="text-[11px] text-green-700 mt-0.5">de cashback</p>
                        </div>
                      )}
                      <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2.5 text-center border border-gray-100">
                        <p className="text-xl font-black text-gray-700">
                          {config.tipo_promocao === 'pontos_por_real' ? `+${pointsToEarn}` : `+R$ ${cashbackToEarn.toFixed(2)}`}
                        </p>
                        <p className="text-[11px] text-gray-500 mt-0.5">neste pedido</p>
                      </div>
                    </div>
                  </div>

                  {/* Available rewards */}
                  {availableRewards.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1.5">
                        <Gift className="w-3.5 h-3.5 text-amber-500" /> Resgatar recompensa
                      </p>
                      <div className="space-y-2">
                        {availableRewards.map(r => {
                          const disc = Math.min(computeDiscount(r), cartSubtotal);
                          const isSelected = selectedReward?.id === r.id;
                          return (
                            <button
                              key={r.id}
                              onClick={() => setSelectedReward(isSelected ? null : r)}
                              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl border-2 text-left transition-all ${
                                isSelected
                                  ? 'border-green-400 bg-green-50'
                                  : 'border-gray-200 bg-white hover:border-amber-300'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'border-green-500 bg-green-500' : 'border-gray-300'}`}>
                                  {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-gray-800 truncate">{r.nome_recompensa}</p>
                                  <p className="text-xs text-gray-400">
                                    {r.pontos_necessarios} {config.tipo_promocao === 'cashback' ? 'R$ de cashback' : 'pontos'}
                                  </p>
                                </div>
                              </div>
                              <span className="text-sm font-bold text-green-600 shrink-0 ml-2">-R$ {disc.toFixed(2)}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {availableRewards.length === 0 && (
                    <p className="text-xs text-gray-400 italic text-center py-2">
                      {config.tipo_promocao === 'pontos_por_real' && 'Continue acumulando pontos para desbloquear recompensas.'}
                      {config.tipo_promocao === 'cashback' && 'Acumule mais cashback para resgatar na próxima visita.'}
                    </p>
                  )}

                  {discount > 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 flex items-center justify-between">
                      <span className="text-sm text-green-700 flex items-center gap-1.5">
                        <Gift className="w-3.5 h-3.5" /> Desconto aplicado
                      </span>
                      <span className="text-sm font-bold text-green-700">-R$ {discount.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 pb-6 pt-3 border-t border-gray-100 space-y-2 bg-white">
          {step === 'benefits' && (
            <>
              <button
                onClick={() => setStep('phone')}
                className="w-full bg-amber-500 hover:bg-amber-400 text-white font-bold py-4 rounded-2xl transition-colors flex items-center justify-center gap-2"
              >
                <Trophy className="w-4 h-4" />
                Participar do programa
                <ChevronRight className="w-4 h-4" />
              </button>
              <button onClick={onClose} className="w-full text-sm text-gray-400 hover:text-gray-600 py-2 transition-colors">
                Continuar sem participar
              </button>
            </>
          )}

          {step === 'phone' && (
            <>
              {discount > 0 && (
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-500">Total após desconto</span>
                  <span className="font-bold text-gray-900">R$ {(cartSubtotal - discount).toFixed(2).replace('.', ',')}</span>
                </div>
              )}
              <button
                disabled={!phoneValid}
                onClick={handleConfirm}
                className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white font-bold py-4 rounded-2xl transition-colors"
              >
                {isNewCustomer === true ? 'Cadastrar e confirmar' : isNewCustomer === false ? 'Confirmar' : 'Confirmar'}
              </button>
              <button onClick={() => setStep('benefits')} className="w-full text-sm text-gray-400 hover:text-gray-600 py-2 transition-colors">
                Voltar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
