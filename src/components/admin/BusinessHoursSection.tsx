import { useState } from 'react';
import { Clock, Plus, Trash2, Copy, Check } from 'lucide-react';
import type { BusinessHoursMap, BusinessDay, BusinessShift } from '../../types';
import { DAY_NAMES, DAY_NAMES_SHORT, getDefaultBusinessHours, formatShifts } from '../../lib/business-hours';

interface BusinessHoursSectionProps {
  value: BusinessHoursMap | null;
  onChange: (v: BusinessHoursMap) => void;
}

export default function BusinessHoursSection({ value, onChange }: BusinessHoursSectionProps) {
  const hours = value ?? getDefaultBusinessHours();
  const [selectedDays, setSelectedDays] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState(false);

  function updateDay(dayKey: string, patch: Partial<BusinessDay>) {
    onChange({ ...hours, [dayKey]: { ...hours[dayKey], ...patch } });
  }

  function toggleDayActive(dayKey: string) {
    const day = hours[dayKey];
    updateDay(dayKey, { active: !day.active });
  }

  function addShift(dayKey: string) {
    const day = hours[dayKey];
    updateDay(dayKey, { shifts: [...day.shifts, { open: '18:00', close: '23:00' }] });
  }

  function updateShift(dayKey: string, idx: number, patch: Partial<BusinessShift>) {
    const day = hours[dayKey];
    const shifts = day.shifts.map((s, i) => i === idx ? { ...s, ...patch } : s);
    updateDay(dayKey, { shifts });
  }

  function removeShift(dayKey: string, idx: number) {
    const day = hours[dayKey];
    updateDay(dayKey, { shifts: day.shifts.filter((_, i) => i !== idx) });
  }

  function copyToAllDays(sourceKey: string) {
    const sourceDay = hours[sourceKey];
    const next = { ...hours };
    for (let i = 0; i < 7; i++) {
      if (String(i) !== sourceKey) {
        next[String(i)] = { active: sourceDay.active, shifts: sourceDay.shifts.map(s => ({ ...s })) };
      }
    }
    onChange(next);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function copyToSelectedDays(sourceKey: string) {
    if (selectedDays.size === 0) return;
    const sourceDay = hours[sourceKey];
    const next = { ...hours };
    selectedDays.forEach(dayIdx => {
      next[String(dayIdx)] = { active: sourceDay.active, shifts: sourceDay.shifts.map(s => ({ ...s })) };
    });
    onChange(next);
    setSelectedDays(new Set());
  }

  function toggleSelectedDay(dayIdx: number) {
    setSelectedDays(prev => {
      const next = new Set(prev);
      if (next.has(dayIdx)) next.delete(dayIdx); else next.add(dayIdx);
      return next;
    });
  }

  return (
    <section className="bg-[#0f2040] rounded-2xl p-6 border border-[#1e3868] space-y-5">
      <div>
        <h3 className="font-semibold text-white text-sm uppercase tracking-wider flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-400" /> Horário de Funcionamento
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Configure os horários por dia da semana. Quando o restaurante estiver fora do horário, o cardápio digital exibirá "Fechado" e bloqueará novos pedidos.
        </p>
      </div>

      {/* Selection mode for batch copy */}
      {selectedDays.size > 0 && (
        <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2.5">
          <span className="text-xs text-amber-300 font-medium">
            {selectedDays.size} dia(s) selecionado(s): {Array.from(selectedDays).map(d => DAY_NAMES_SHORT[d]).join(', ')}
          </span>
          <span className="text-xs text-slate-400 ml-auto">Edite um dia e clique em "Aplicar aos selecionados"</span>
          <button onClick={() => setSelectedDays(new Set())} className="text-xs text-slate-400 hover:text-white">Limpar</button>
        </div>
      )}

      {/* Day cards */}
      <div className="space-y-3">
        {Array.from({ length: 7 }, (_, i) => {
          const dayKey = String(i);
          const day = hours[dayKey];
          const isSelected = selectedDays.has(i);
          return (
            <div
              key={dayKey}
              className={`rounded-xl border-2 transition-all ${
                day.active
                  ? 'border-[#1e3868] bg-[#1a3260]/60'
                  : 'border-[#1e3868]/50 bg-[#0f2040]/50'
              } ${isSelected ? 'ring-2 ring-amber-500/40' : ''}`}
            >
              {/* Day header */}
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleSelectedDay(i)}
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                      isSelected ? 'bg-amber-500 border-amber-500' : 'border-[#2a4d9a] hover:border-amber-500/50'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 text-black" />}
                  </button>
                  <span className={`font-semibold text-sm ${day.active ? 'text-white' : 'text-slate-500'}`}>
                    {DAY_NAMES[i]}
                  </span>
                  {day.active && day.shifts.length > 0 && (
                    <span className="text-xs text-slate-400">{formatShifts(day.shifts)}</span>
                  )}
                </div>
                <button
                  onClick={() => toggleDayActive(dayKey)}
                  className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${day.active ? 'bg-amber-500' : 'bg-[#1e3868]'}`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${day.active ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                </button>
              </div>

              {/* Shifts */}
              {day.active && (
                <div className="px-4 pb-3 space-y-2">
                  {day.shifts.map((shift, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 flex-1">
                        <input
                          type="time"
                          value={shift.open}
                          onChange={e => updateShift(dayKey, idx, { open: e.target.value })}
                          className="bg-[#0f2040] border border-[#1e3868] rounded-lg px-2.5 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
                        />
                        <span className="text-slate-500 text-xs">às</span>
                        <input
                          type="time"
                          value={shift.close}
                          onChange={e => updateShift(dayKey, idx, { close: e.target.value })}
                          className="bg-[#0f2040] border border-[#1e3868] rounded-lg px-2.5 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
                        />
                      </div>
                      {day.shifts.length > 1 && (
                        <button
                          onClick={() => removeShift(dayKey, idx)}
                          className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-red-400 bg-[#1a3260] border border-[#1e3868] rounded-lg transition-colors shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => addShift(dayKey)}
                      className="flex items-center gap-1.5 text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Adicionar outro horário
                    </button>
                    <button
                      onClick={() => copyToAllDays(dayKey)}
                      className="flex items-center gap-1.5 text-xs bg-[#1a3260] hover:bg-[#2a4d9a] text-slate-300 border border-[#1e3868] px-3 py-1.5 rounded-lg transition-colors"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                      Copiar para todos os dias
                    </button>
                    {selectedDays.size > 0 && (
                      <button
                        onClick={() => copyToSelectedDays(dayKey)}
                        className="flex items-center gap-1.5 text-xs bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Aplicar aos selecionados
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-slate-500">
        Dica: marque os dias (checkbox à esquerda) e use "Aplicar aos selecionados" para copiar o horário de um dia para dias específicos.
      </p>
    </section>
  );
}
