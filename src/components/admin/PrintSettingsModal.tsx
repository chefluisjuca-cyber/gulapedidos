import { useState, useEffect, useCallback } from 'react';
import { X, Printer, Plus, Trash2, Check, RefreshCw, Loader2, Wifi, WifiOff, Settings2, FileText, CheckCircle2, AlertCircle, Copy, Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  fetchPrintAgents, fetchPrinters, fetchPrintSettings, savePrintSettings,
  updatePrinter, deletePrinter, testPrint, isAgentOnline,
  type PrintAgent, type Printer as PrinterType, type PrintSettings,
} from '../../lib/print-agent-client';

const SECTORS: { value: string; label: string }[] = [
  { value: 'caixa', label: 'Caixa' },
  { value: 'cozinha', label: 'Cozinha' },
  { value: 'bar', label: 'Bar' },
  { value: 'expedicao', label: 'Expedição' },
  { value: 'fritura', label: 'Fritura' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'outros', label: 'Outros' },
];

const SECTOR_LABEL: Record<string, string> = Object.fromEntries(SECTORS.map(s => [s.value, s.label]));

const inputCls = 'w-full bg-[#1a3260] border border-[#1e3868] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors';

export default function PrintSettingsModal({ restaurantId, onClose }: { restaurantId: string; onClose: () => void }) {
  const [agents, setAgents] = useState<PrintAgent[]>([]);
  const [printers, setPrinters] = useState<PrinterType[]>([]);
  const [settings, setSettings] = useState<PrintSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testingPrinter, setTestingPrinter] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; msg: string }>>({});
  const [showAddPrinter, setShowAddPrinter] = useState(false);
  const [newPrinterName, setNewPrinterName] = useState('');
  const [newPrinterSector, setNewPrinterSector] = useState('caixa');
  const [newPrinterWidth, setNewPrinterWidth] = useState(80);
  const [linkCode, setLinkCode] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkSuccess, setLinkSuccess] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, p, s] = await Promise.all([
        fetchPrintAgents(restaurantId),
        fetchPrinters(restaurantId),
        fetchPrintSettings(restaurantId),
      ]);
      setAgents(a);
      setPrinters(p);
      setSettings(s);
    } catch {
      // ignore
    }
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => { load(); }, [load]);

  // Poll agent status every 15s
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const a = await fetchPrintAgents(restaurantId);
        setAgents(a);
      } catch { /* ignore */ }
    }, 15_000);
    return () => clearInterval(interval);
  }, [restaurantId]);

  const activeAgent = agents.find(a => isAgentOnline(a)) ?? null;

  async function handleSaveSettings() {
    setSaving(true);
    try {
      await savePrintSettings(restaurantId, {
        auto_print: settings?.auto_print ?? true,
        auto_print_caixa: settings?.auto_print_caixa ?? true,
        auto_print_cozinha: settings?.auto_print_cozinha ?? true,
        copies: settings?.copies ?? 1,
        allow_reprint: settings?.allow_reprint ?? true,
        same_printer_caixa_cozinha: settings?.same_printer_caixa_cozinha ?? false,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      load();
    } catch {
      // ignore
    }
    setSaving(false);
  }

  async function handleTestPrint(printer: PrinterType) {
    if (!activeAgent) return;
    setTestingPrinter(printer.id);
    setTestResult(prev => ({ ...prev, [printer.id]: { ok: false, msg: 'Enviando...' } }));
    try {
      await testPrint(printer.id, printer.sector, activeAgent.agent_token);
      setTestResult(prev => ({ ...prev, [printer.id]: { ok: true, msg: 'Teste enviado com sucesso!' } }));
    } catch (err) {
      setTestResult(prev => ({ ...prev, [printer.id]: { ok: false, msg: err instanceof Error ? err.message : 'Erro ao enviar teste' } }));
    }
    setTestingPrinter(null);
  }

  async function handleAddPrinter() {
    if (!newPrinterName.trim() || !activeAgent) return;
    try {
      await supabase.from('printers').insert({
        restaurant_id: restaurantId,
        agent_id: activeAgent.id,
        sector: newPrinterSector,
        printer_name: newPrinterName.trim(),
        paper_width: newPrinterWidth,
        status: 'online',
      });
      setNewPrinterName('');
      setShowAddPrinter(false);
      load();
    } catch { /* ignore */ }
  }

  async function handleDeletePrinter(id: string) {
    await deletePrinter(id);
    load();
  }

  async function handleUpdatePrinterSector(printer: PrinterType, sector: string) {
    await updatePrinter(printer.id, { sector: sector as PrinterType['sector'] });
    load();
  }

  async function handleLinkAgent() {
    setLinkError(null);
    setLinkSuccess(false);
    if (!linkCode.trim()) {
      setLinkError('Digite o código de vinculação.');
      return;
    }
    try {
      // The link code IS the agent_token generated by the Electron app on first run
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/print-agent?action=heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'X-Agent-Token': linkCode.trim(),
        },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Código inválido' }));
        throw new Error(err.error ?? 'Código inválido');
      }
      setLinkSuccess(true);
      setLinkCode('');
      load();
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : 'Erro ao vincular');
    }
  }

  function copyToken(token: string) {
    navigator.clipboard.writeText(token);
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#0f2040] border border-[#1e3868] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#1e3868] sticky top-0 bg-[#0f2040] z-10">
          <h3 className="font-bold text-white flex items-center gap-2">
            <Printer className="w-5 h-5 text-amber-400" /> Impressão Térmica
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
          </div>
        ) : (
          <div className="px-5 py-5 space-y-6">
            {/* Print Agent Status */}
            <section className="bg-[#1a3260]/60 border border-[#1e3868] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {activeAgent ? (
                    <Wifi className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <WifiOff className="w-5 h-5 text-red-400" />
                  )}
                  <div>
                    <p className="text-sm font-semibold text-white">Print Agent</p>
                    <p className="text-xs text-slate-400">
                      {activeAgent ? (
                        <>Conectado{activeAgent.machine_name ? ` · ${activeAgent.machine_name}` : ''}</>
                      ) : (
                        'Desconectado'
                      )}
                    </p>
                  </div>
                </div>
                <button
                  onClick={load}
                  className="p-2 text-slate-400 hover:text-white bg-[#1e3868] rounded-lg transition-colors"
                  title="Atualizar"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              {/* Agent token display for existing agents */}
              {agents.length > 0 && (
                <div className="space-y-2">
                  {agents.map(a => (
                    <div key={a.id} className="flex items-center gap-2 bg-[#0f2040] border border-[#1e3868] rounded-lg px-3 py-2">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${isAgentOnline(a) ? 'bg-emerald-400' : 'bg-red-400'}`} />
                      <code className="flex-1 text-xs text-slate-400 truncate">{a.agent_token.slice(0, 20)}...</code>
                      <button
                        onClick={() => copyToken(a.agent_token)}
                        className="p-1 text-slate-500 hover:text-amber-400 transition-colors"
                        title="Copiar código"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Link new agent */}
              {!activeAgent && (
                <div className="space-y-2 pt-2 border-t border-[#1e3868]">
                  <p className="text-xs text-slate-400">Vincular um novo Print Agent usando o código gerado no aplicativo:</p>
                  <div className="flex gap-2">
                    <input
                      value={linkCode}
                      onChange={e => setLinkCode(e.target.value)}
                      className={inputCls}
                      placeholder="Cole o código aqui..."
                    />
                    <button
                      onClick={handleLinkAgent}
                      className="shrink-0 bg-amber-500 hover:bg-amber-400 text-black font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors"
                    >
                      Vincular
                    </button>
                  </div>
                  {linkError && <p className="text-xs text-red-400">{linkError}</p>}
                  {linkSuccess && <p className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Agent vinculado com sucesso!</p>}
                </div>
              )}
            </section>

            {/* Download Print Agent */}
            <section className="bg-gradient-to-r from-amber-500/10 to-amber-600/5 border border-amber-500/30 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
                  <Download className="w-5 h-5 text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">Baixar Print Agent para Windows</p>
                  <p className="text-xs text-slate-400 mt-0.5">Instale no computador do restaurante para impressão automática.</p>
                </div>
                <a
                  href="https://github.com/chefluisjuca-cyber/gulapedidos/releases/latest"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Baixar .exe
                </a>
              </div>
            </section>

            {/* Printers List */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-white uppercase tracking-wider">Impressoras</h4>
                <button
                  onClick={() => setShowAddPrinter(v => !v)}
                  disabled={!activeAgent}
                  className="flex items-center gap-1.5 text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar
                </button>
              </div>

              {/* Add printer form */}
              {showAddPrinter && activeAgent && (
                <div className="bg-[#1a3260]/60 border border-amber-500/20 rounded-xl p-4 space-y-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Nome da impressora (como aparece no Windows)</label>
                    <input
                      value={newPrinterName}
                      onChange={e => setNewPrinterName(e.target.value)}
                      className={inputCls}
                      placeholder="Ex: Bematech MP-4200"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Setor</label>
                      <select
                        value={newPrinterSector}
                        onChange={e => setNewPrinterSector(e.target.value)}
                        className={inputCls}
                      >
                        {SECTORS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Largura do papel</label>
                      <select
                        value={newPrinterWidth}
                        onChange={e => setNewPrinterWidth(Number(e.target.value))}
                        className={inputCls}
                      >
                        <option value={80}>80 mm</option>
                        <option value={58}>58 mm</option>
                      </select>
                    </div>
                  </div>
                  <button
                    onClick={handleAddPrinter}
                    disabled={!newPrinterName.trim()}
                    className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-semibold py-2.5 rounded-xl text-sm transition-colors"
                  >
                    Adicionar impressora
                  </button>
                </div>
              )}

              {/* Printer cards */}
              {printers.length === 0 && !showAddPrinter ? (
                <div className="text-center py-8 bg-[#1a3260]/30 rounded-xl border border-dashed border-[#1e3868]">
                  <Printer className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">Nenhuma impressora configurada.</p>
                  <p className="text-xs text-slate-500 mt-1">{activeAgent ? 'Clique em "Adicionar" para configurar.' : 'Vincule o Print Agent primeiro.'}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {printers.map(p => (
                    <div key={p.id} className="bg-[#1a3260]/60 border border-[#1e3868] rounded-xl p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${p.status === 'online' ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                            <Printer className={`w-5 h-5 ${p.status === 'online' ? 'text-emerald-400' : 'text-red-400'}`} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-white text-sm truncate">{p.printer_name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <select
                                value={p.sector}
                                onChange={e => handleUpdatePrinterSector(p, e.target.value)}
                                className="text-xs bg-[#0f2040] border border-[#1e3868] rounded-lg px-2 py-1 text-slate-300 focus:outline-none focus:border-amber-500"
                              >
                                {SECTORS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                              </select>
                              <span className="text-xs text-slate-500">{p.paper_width}mm</span>
                              <span className={`text-xs ${p.status === 'online' ? 'text-emerald-400' : 'text-red-400'}`}>
                                {p.status === 'online' ? 'Online' : p.status === 'error' ? 'Erro' : 'Offline'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeletePrinter(p.id)}
                          className="p-2 text-slate-500 hover:text-red-400 transition-colors shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Test print result */}
                      {testResult[p.id] && (
                        <div className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${testResult[p.id].ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                          {testResult[p.id].ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                          {testResult[p.id].msg}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleTestPrint(p)}
                          disabled={!activeAgent || testingPrinter === p.id}
                          className="flex-1 flex items-center justify-center gap-1.5 bg-[#0f2040] hover:bg-[#1e3868] border border-[#1e3868] text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {testingPrinter === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                          Imprimir Teste
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Same printer toggle */}
            <section className="bg-[#1a3260]/60 border border-[#1e3868] rounded-xl p-4">
              <button
                onClick={() => setSettings(s => ({ ...(s ?? {}), same_printer_caixa_cozinha: !(s?.same_printer_caixa_cozinha ?? false) } as PrintSettings))}
                className="w-full flex items-center justify-between text-left"
              >
                <div>
                  <p className="text-sm font-semibold text-white">Usar a mesma impressora para Caixa e Cozinha</p>
                  <p className="text-xs text-slate-400 mt-0.5">Quando ativado, ambos os setores usam a mesma impressora.</p>
                </div>
                <div className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${settings?.same_printer_caixa_cozinha ? 'bg-amber-500' : 'bg-[#1e3868]'}`}>
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${settings?.same_printer_caixa_cozinha ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                </div>
              </button>
            </section>

            {/* Print behavior settings */}
            <section className="bg-[#1a3260]/60 border border-[#1e3868] rounded-xl p-4 space-y-4">
              <h4 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-amber-400" /> Comportamento
              </h4>

              <ToggleRow
                label="Imprimir automaticamente"
                desc="Imprime assim que um pedido é criado/confirmado"
                value={settings?.auto_print ?? true}
                onChange={v => setSettings(s => ({ ...(s ?? {}), auto_print: v } as PrintSettings))}
              />
              <ToggleRow
                label="Imprimir no Caixa"
                desc="Envia cupom para a impressora do caixa"
                value={settings?.auto_print_caixa ?? true}
                onChange={v => setSettings(s => ({ ...(s ?? {}), auto_print_caixa: v } as PrintSettings))}
              />
              <ToggleRow
                label="Imprimir na Cozinha"
                desc="Envia cupom para a impressora da cozinha"
                value={settings?.auto_print_cozinha ?? true}
                onChange={v => setSettings(s => ({ ...(s ?? {}), auto_print_cozinha: v } as PrintSettings))}
              />
              <ToggleRow
                label="Permitir reimpressão"
                desc="Permite reimprimir pedidos manualmente"
                value={settings?.allow_reprint ?? true}
                onChange={v => setSettings(s => ({ ...(s ?? {}), allow_reprint: v } as PrintSettings))}
              />

              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Número de cópias</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={settings?.copies ?? 1}
                  onChange={e => setSettings(s => ({ ...(s ?? {}), copies: Math.max(1, Math.min(5, parseInt(e.target.value) || 1)) } as PrintSettings))}
                  className={`${inputCls} w-24 text-center`}
                />
              </div>
            </section>

            {/* Save button */}
            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black font-semibold py-3 rounded-xl transition-colors"
            >
              {saved ? <Check className="w-4 h-4" /> : saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Settings2 className="w-4 h-4" />}
              {saved ? 'Salvo!' : saving ? 'Salvando...' : 'Salvar Configurações'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ToggleRow({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="w-full flex items-center justify-between text-left"
    >
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
      </div>
      <div className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${value ? 'bg-amber-500' : 'bg-[#1e3868]'}`}>
        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
      </div>
    </button>
  );
}
