import { useState, useEffect, useCallback } from 'react';
import {
  X, Trophy, Coins, Percent, LogOut, Clock, TrendingUp, User, MapPin, Plus, Trash2, Pencil, Check, Loader2, Lock, Eye, EyeOff, Home, Briefcase, Star,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { LoyaltyConfig, LoyaltyCustomer, SavedAddress } from '../../types';

interface Props {
  customer: LoyaltyCustomer;
  config: LoyaltyConfig;
  restaurantId: string | null;
  onClose: () => void;
  onLogout: () => void;
}

type Section = 'overview' | 'addresses' | 'security';

export default function LoyaltyProfileModal({ customer, config, restaurantId, onClose, onLogout }: Props) {
  const [section, setSection] = useState<Section>('overview');
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loadingAddr, setLoadingAddr] = useState(false);
  const [editingAddr, setEditingAddr] = useState<SavedAddress | null>(null);
  const [showAddrForm, setShowAddrForm] = useState(false);

  const fetchAddresses = useCallback(async () => {
    if (!restaurantId) return;
    setLoadingAddr(true);
    const phone = customer.phone ?? customer.email ?? '';
    if (!phone) { setAddresses([]); setLoadingAddr(false); return; }
    const { data } = await supabase
      .from('delivery_customer_addresses')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('phone', phone)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true });
    setAddresses((data ?? []) as SavedAddress[]);
    setLoadingAddr(false);
  }, [restaurantId, customer.phone, customer.email]);

  useEffect(() => {
    if (section === 'addresses') fetchAddresses();
  }, [section, fetchAddresses]);

  const transactions = [...(customer.historico_transacoes ?? [])].reverse().slice(0, 15);
  const isPoints = config.tipo_promocao === 'pontos_por_real';

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">{customer.nome || 'Meu Perfil'}</h2>
              <p className="text-xs text-gray-400">{customer.email || customer.phone}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Section tabs */}
        <div className="flex gap-1 px-5 pt-3 pb-2 shrink-0">
          {([
            { id: 'overview' as Section, label: 'Visão Geral', icon: User },
            { id: 'addresses' as Section, label: 'Endereços', icon: MapPin },
            { id: 'security' as Section, label: 'Segurança', icon: Lock },
          ]).map(t => (
            <button
              key={t.id}
              onClick={() => setSection(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                section === t.id ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-500 hover:text-gray-700'
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">

          {/* ── OVERVIEW ── */}
          {section === 'overview' && (
            <>
              {/* Balance card */}
              <div className={`rounded-2xl p-5 text-center ${isPoints ? 'bg-amber-50 border border-amber-200' : 'bg-green-50 border border-green-200'}`}>
                {isPoints
                  ? <Coins className="w-9 h-9 text-amber-500 mx-auto mb-2" />
                  : <Percent className="w-9 h-9 text-green-500 mx-auto mb-2" />
                }
                <p className={`text-5xl font-black tabular-nums ${isPoints ? 'text-amber-600' : 'text-green-600'}`}>
                  {isPoints
                    ? customer.saldo_pontos.toLocaleString('pt-BR')
                    : `R$ ${Number(customer.saldo_cashback).toFixed(2).replace('.', ',')}`
                  }
                </p>
                <p className={`text-sm mt-1 ${isPoints ? 'text-amber-700' : 'text-green-700'}`}>
                  {isPoints ? 'pontos acumulados' : 'de cashback disponível'}
                </p>
                <div className={`mt-4 pt-4 flex justify-center gap-8 border-t ${isPoints ? 'border-amber-200/60' : 'border-green-200/60'}`}>
                  <div className="text-center">
                    <p className="text-xl font-black text-gray-700">{customer.total_visitas}</p>
                    <p className="text-xs text-gray-500 mt-0.5">pedidos</p>
                  </div>
                  {isPoints && (
                    <div className="text-center">
                      <p className="text-xl font-black text-gray-700">{config.valor_conversao}</p>
                      <p className="text-xs text-gray-500 mt-0.5">pts / R$1</p>
                    </div>
                  )}
                  {!isPoints && (
                    <div className="text-center">
                      <p className="text-xl font-black text-gray-700">{config.valor_conversao}%</p>
                      <p className="text-xs text-gray-500 mt-0.5">cashback</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Account info */}
              <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400" /> Dados da Conta
                </h3>
                <div className="space-y-2">
                  <InfoRow label="Nome" value={customer.nome || '—'} />
                  <InfoRow label="E-mail" value={customer.email || '—'} />
                  <InfoRow label="Telefone" value={customer.phone || '—'} />
                </div>
              </div>

              {/* Transaction history */}
              {transactions.length > 0 ? (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-400" /> Histórico de transações
                  </h3>
                  <div className="space-y-0 divide-y divide-gray-50">
                    {transactions.map((tx, i) => (
                      <div key={i} className="flex items-center justify-between py-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-800 leading-snug">{tx.descricao}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{new Date(tx.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                        </div>
                        <div className="shrink-0 ml-3 text-right">
                          {isPoints && tx.pontos !== undefined && tx.pontos !== 0 && (
                            <span className={`text-xs font-bold ${tx.tipo === 'ganho' ? 'text-green-600' : 'text-red-500'}`}>
                              {tx.tipo === 'ganho' ? '+' : ''}{tx.pontos} pts
                            </span>
                          )}
                          {!isPoints && tx.cashback !== undefined && Number(tx.cashback) !== 0 && (
                            <span className={`text-xs font-bold ${tx.tipo === 'ganho' ? 'text-green-600' : 'text-red-500'}`}>
                              {tx.tipo === 'ganho' ? '+' : ''}R$ {Number(tx.cashback).toFixed(2).replace('.', ',')}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-medium">Nenhuma transação ainda</p>
                  <p className="text-xs mt-1">Faça seu primeiro pedido para começar a acumular!</p>
                </div>
              )}
            </>
          )}

          {/* ── ADDRESSES ── */}
          {section === 'addresses' && (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-gray-400" /> Meus Endereços
                </h3>
                <button
                  onClick={() => { setEditingAddr(null); setShowAddrForm(true); }}
                  className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 bg-amber-50 hover:bg-amber-100 px-3 py-2 rounded-xl transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar
                </button>
              </div>

              {showAddrForm && (
                <AddressForm
                  restaurantId={restaurantId}
                  phone={customer.phone ?? customer.email ?? ''}
                  existing={editingAddr}
                  onSave={async () => { setShowAddrForm(false); setEditingAddr(null); await fetchAddresses(); }}
                  onCancel={() => { setShowAddrForm(false); setEditingAddr(null); }}
                />
              )}

              {loadingAddr ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
                </div>
              ) : addresses.length === 0 && !showAddrForm ? (
                <div className="text-center py-10 text-gray-400">
                  <MapPin className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">Nenhum endereço salvo</p>
                  <p className="text-xs mt-1">Adicione um endereço para agilizar seus pedidos de delivery.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {addresses.map(addr => (
                    <div key={addr.id} className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                            {addr.nickname.toLowerCase().includes('trabalho') || addr.nickname.toLowerCase().includes('work')
                              ? <Briefcase className="w-4 h-4 text-amber-600" />
                              : <Home className="w-4 h-4 text-amber-600" />
                            }
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold text-gray-900">{addr.nickname}</p>
                              {addr.is_default && (
                                <span className="text-[10px] bg-amber-500/20 text-amber-600 px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-0.5">
                                  <Star className="w-2.5 h-2.5" /> Padrão
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-1 leading-snug">
                              {addr.street}, {addr.number}
                              {addr.complement ? ` - ${addr.complement}` : ''}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {addr.bairro}{addr.cep ? ` - CEP ${addr.cep}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => { setEditingAddr(addr); setShowAddrForm(true); }}
                            className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:text-amber-500 hover:border-amber-300 transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={async () => {
                              await supabase.from('delivery_customer_addresses').delete().eq('id', addr.id);
                              fetchAddresses();
                            }}
                            className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:text-red-500 hover:border-red-300 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── SECURITY ── */}
          {section === 'security' && (
            <PasswordResetSection email={customer.email ?? ''} />
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 pb-8 pt-3 border-t border-gray-100">
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            <LogOut className="w-4 h-4" />
            Sair da conta
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-400 font-medium">{label}</span>
      <span className="text-xs text-gray-700 font-semibold truncate ml-3">{value}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ADDRESS FORM
// ═══════════════════════════════════════════════════════════════════════════

function AddressForm({
  restaurantId, phone, existing, onSave, onCancel,
}: {
  restaurantId: string | null;
  phone: string;
  existing: SavedAddress | null;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [nickname, setNickname] = useState(existing?.nickname ?? '');
  const [cep, setCep] = useState(existing?.cep ?? '');
  const [street, setStreet] = useState(existing?.street ?? '');
  const [number, setNumber] = useState(existing?.number ?? '');
  const [bairro, setBairro] = useState(existing?.bairro ?? '');
  const [complement, setComplement] = useState(existing?.complement ?? '');
  const [reference, setReference] = useState(existing?.reference ?? '');
  const [isDefault, setIsDefault] = useState(existing?.is_default ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const inputCls = 'w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-amber-400 transition-colors placeholder:text-gray-400';

  async function handleSave() {
    setError('');
    if (!nickname.trim()) { setError('Dê um apelido ao endereço (ex: Casa, Trabalho).'); return; }
    if (!street.trim() || !number.trim() || !bairro.trim()) { setError('Preencha rua, número e bairro.'); return; }
    setSaving(true);

    const payload = {
      restaurant_id: restaurantId,
      phone,
      nickname: nickname.trim(),
      cep: cep.trim() || null,
      street: street.trim(),
      number: number.trim(),
      bairro: bairro.trim(),
      complement: complement.trim() || null,
      reference: reference.trim() || null,
      is_default: isDefault,
      updated_at: new Date().toISOString(),
    };

    try {
      if (existing) {
        await supabase.from('delivery_customer_addresses').update(payload).eq('id', existing.id);
      } else {
        await supabase.from('delivery_customer_addresses').insert({ ...payload, created_at: new Date().toISOString() });
      }
      // If this is set as default, unset others
      if (isDefault && restaurantId && phone) {
        await supabase
          .from('delivery_customer_addresses')
          .update({ is_default: false })
          .eq('restaurant_id', restaurantId)
          .eq('phone', phone)
          .neq('nickname', nickname.trim());
      }
      onSave();
    } catch {
      setError('Erro ao salvar endereço. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 space-y-3">
      <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">
        {existing ? 'Editar Endereço' : 'Novo Endereço'}
      </p>
      <div>
        <label className="block text-xs text-gray-500 font-semibold mb-1">Apelido *</label>
        <input className={inputCls} placeholder="Ex: Casa, Trabalho" value={nickname} onChange={e => setNickname(e.target.value)} maxLength={30} />
      </div>
      <div>
        <label className="block text-xs text-gray-500 font-semibold mb-1">CEP</label>
        <input className={inputCls} placeholder="00000-000" value={cep} onChange={e => setCep(e.target.value)} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2">
          <label className="block text-xs text-gray-500 font-semibold mb-1">Rua *</label>
          <input className={inputCls} placeholder="Nome da rua" value={street} onChange={e => setStreet(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 font-semibold mb-1">Nº *</label>
          <input className={inputCls} placeholder="123" value={number} onChange={e => setNumber(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="block text-xs text-gray-500 font-semibold mb-1">Bairro *</label>
        <input className={inputCls} placeholder="Bairro" value={bairro} onChange={e => setBairro(e.target.value)} />
      </div>
      <div>
        <label className="block text-xs text-gray-500 font-semibold mb-1">Complemento</label>
        <input className={inputCls} placeholder="Apto, bloco, etc." value={complement} onChange={e => setComplement(e.target.value)} />
      </div>
      <div>
        <label className="block text-xs text-gray-500 font-semibold mb-1">Referência</label>
        <input className={inputCls} placeholder="Próximo a..." value={reference} onChange={e => setReference(e.target.value)} />
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={isDefault} onChange={e => setIsDefault(e.target.checked)} className="w-4 h-4 rounded accent-amber-500" />
        <span className="text-xs text-gray-600 font-medium">Usar como endereço padrão</span>
      </label>
      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm font-semibold hover:bg-gray-50 transition-colors">Cancelar</button>
        <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-400 disabled:opacity-60 transition-colors flex items-center justify-center gap-1.5">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> Salvar</>}
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PASSWORD RESET
// ═══════════════════════════════════════════════════════════════════════════

function PasswordResetSection({ email }: { email: string }) {
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  async function handleChangePassword() {
    setError('');
    setMsg('');
    if (newPass.length < 6) { setError('A senha deve ter pelo menos 6 caracteres.'); return; }
    if (newPass !== confirmPass) { setError('As senhas não coincidem.'); return; }
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password: newPass });
    setLoading(false);
    if (updateError) {
      setError(updateError.message ?? 'Erro ao redefinir senha.');
      return;
    }
    setMsg('Senha redefinida com sucesso!');
    setNewPass('');
    setConfirmPass('');
  }

  const inputCls = 'w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-amber-400 transition-colors placeholder:text-gray-400';

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Lock className="w-4 h-4 text-gray-400" /> Redefinir Senha
        </h3>
        <p className="text-xs text-gray-400">Digite sua nova senha. Ela será usada para entrar na sua conta.</p>
        <div>
          <label className="block text-xs text-gray-500 font-semibold mb-1">Nova Senha</label>
          <div className="relative">
            <input
              type={showPass ? 'text' : 'password'}
              value={newPass}
              onChange={e => setNewPass(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className={inputCls + ' pr-10'}
            />
            <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-500 font-semibold mb-1">Confirmar Nova Senha</label>
          <input
            type={showPass ? 'text' : 'password'}
            value={confirmPass}
            onChange={e => setConfirmPass(e.target.value)}
            placeholder="Repita a nova senha"
            className={inputCls}
          />
        </div>
        {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}
        {msg && <p className="text-xs text-green-600 bg-green-50 border border-green-200 rounded-xl px-3 py-2">{msg}</p>}
        <button
          onClick={handleChangePassword}
          disabled={loading}
          className="w-full py-3 rounded-xl bg-amber-500 text-white font-bold text-sm hover:bg-amber-400 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Lock className="w-4 h-4" /> Redefinir Senha</>}
        </button>
      </div>
    </div>
  );
}
