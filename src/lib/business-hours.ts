import type { BusinessHoursMap, BusinessDay, BusinessShift } from '../types';

export const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
export const DAY_NAMES_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function getDefaultBusinessHours(): BusinessHoursMap {
  const map: BusinessHoursMap = {};
  for (let i = 0; i < 7; i++) {
    map[String(i)] = { active: i >= 1 && i <= 6, shifts: [{ open: '11:00', close: '23:00' }] };
  }
  return map;
}

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function isCurrentlyOpen(
  businessHours: BusinessHoursMap | null | undefined,
  now: Date = new Date()
): boolean {
  if (!businessHours) return true; // null = always open (backward compat)

  const dayKey = String(now.getDay());
  const day = businessHours[dayKey];
  if (!day || !day.active || !day.shifts.length) return false;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  return day.shifts.some((shift: BusinessShift) => {
    const open = parseTimeToMinutes(shift.open);
    const close = parseTimeToMinutes(shift.close);
    if (close > open) {
      return currentMinutes >= open && currentMinutes < close;
    }
    // Overnight shift (close <= open): e.g. 22:00–02:00
    return currentMinutes >= open || currentMinutes < close;
  });
}

export function getTodayHours(
  businessHours: BusinessHoursMap | null | undefined,
  now: Date = new Date()
): BusinessDay | null {
  if (!businessHours) return null;
  return businessHours[String(now.getDay())] ?? null;
}

export function getNextOpenTime(
  businessHours: BusinessHoursMap | null | undefined,
  now: Date = new Date()
): { dayName: string; shifts: BusinessShift[] } | null {
  if (!businessHours) return null;

  for (let offset = 0; offset < 7; offset++) {
    const checkDate = new Date(now);
    checkDate.setDate(checkDate.getDate() + offset);
    const dayKey = String(checkDate.getDay());
    const day = businessHours[dayKey];

    if (day && day.active && day.shifts.length) {
      if (offset === 0) {
        // Today: find next shift that hasn't closed yet
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const upcoming = day.shifts.filter(s => parseTimeToMinutes(s.open) > currentMinutes);
        if (upcoming.length) return { dayName: DAY_NAMES[checkDate.getDay()], shifts: upcoming };
      } else {
        return { dayName: DAY_NAMES[checkDate.getDay()], shifts: day.shifts };
      }
    }
  }
  return null;
}

export function formatShifts(shifts: BusinessShift[]): string {
  return shifts.map(s => `${s.open} às ${s.close}`).join(' / ');
}
