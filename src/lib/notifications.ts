import { supabase } from './supabase';

const CHECK_KEY = 'gula-validade-check-date';
const LAST_ALERT_KEY = 'gula-validade-last-alert';

export interface ValidadeAlertConfig {
  responsavelNome: string;
  responsavelTelefone: string;
  horarioNotificacao: string;
  notificacoesAtivas: boolean;
}

export const DEFAULT_ALERT_CONFIG: ValidadeAlertConfig = {
  responsavelNome: '',
  responsavelTelefone: '',
  horarioNotificacao: '08:00',
  notificacoesAtivas: false,
};

export async function loadAlertConfig(restaurantId: string | null): Promise<ValidadeAlertConfig> {
  if (!restaurantId) return DEFAULT_ALERT_CONFIG;
  try {
    const { data } = await supabase
      .from('restaurant_settings')
      .select('validade_responsavel_nome, validade_responsavel_telefone, validade_horario_notificacao, validade_notificacoes_ativas')
      .eq('restaurant_id', restaurantId)
      .maybeSingle();
    const s = data as {
      validade_responsavel_nome?: string | null;
      validade_responsavel_telefone?: string | null;
      validade_horario_notificacao?: string | null;
      validade_notificacoes_ativas?: boolean | null;
    } | null;
    return {
      responsavelNome: s?.validade_responsavel_nome ?? '',
      responsavelTelefone: s?.validade_responsavel_telefone ?? '',
      horarioNotificacao: s?.validade_horario_notificacao ?? '08:00',
      notificacoesAtivas: s?.validade_notificacoes_ativas ?? false,
    };
  } catch {
    return DEFAULT_ALERT_CONFIG;
  }
}

export async function saveAlertConfig(restaurantId: string | null, cfg: ValidadeAlertConfig): Promise<void> {
  if (!restaurantId) return;
  await supabase
    .from('restaurant_settings')
    .update({
      validade_responsavel_nome: cfg.responsavelNome || null,
      validade_responsavel_telefone: cfg.responsavelTelefone || null,
      validade_horario_notificacao: cfg.horarioNotificacao || '08:00',
      validade_notificacoes_ativas: cfg.notificacoesAtivas,
      updated_at: new Date().toISOString(),
    })
    .eq('restaurant_id', restaurantId);
}

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermission | null {
  return isNotificationSupported() ? Notification.permission : null;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | null> {
  if (!isNotificationSupported()) return null;
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try {
    return await Notification.requestPermission();
  } catch {
    return null;
  }
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function hasAlertedToday(): boolean {
  try {
    return localStorage.getItem(LAST_ALERT_KEY) === todayStr();
  } catch {
    return false;
  }
}

function markAlertedToday(): void {
  try {
    localStorage.setItem(LAST_ALERT_KEY, todayStr());
  } catch { /* ignore */ }
}

function hasCheckedToday(): boolean {
  try {
    return localStorage.getItem(CHECK_KEY) === todayStr();
  } catch {
    return false;
  }
}

function markCheckedToday(): void {
  try {
    localStorage.setItem(CHECK_KEY, todayStr());
  } catch { /* ignore */ }
}

async function countVenceHoje(restaurantId: string): Promise<number> {
  const today = todayStr();
  const { count } = await supabase
    .from('etiqueta_registros')
    .select('id', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId)
    .eq('status', 'ativo')
    .eq('data_validade', today);
  return count ?? 0;
}

function sendPersonalizedNotification(nome: string, count: number): void {
  if (!isNotificationSupported() || Notification.permission !== 'granted') return;
  try {
    const primeiroNome = nome.trim().split(/\s+/)[0] || 'Responsável';
    const n = new Notification(`Gula Etiquetas - Alerta para ${nome}`, {
      body: `${primeiroNome}, temos ${count} produto${count !== 1 ? 's' : ''} que vence${count !== 1 ? 'm' : ''} HOJE no estoque! Clique para conferir a lista.`,
      icon: '/gula-pedidos-digial.png',
      tag: 'gula-validade-alert',
    });
    n.onclick = () => {
      window.focus();
      try { sessionStorage.setItem('gula-etiquetas-goto-controle', '1'); } catch { /* ignore */ }
      try { history.replaceState(null, '', '#etiquetas'); } catch { /* ignore */ }
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      n.close();
    };
  } catch { /* ignore */ }
}

export async function checkValidadeAlerts(restaurantId: string | null): Promise<void> {
  if (!restaurantId) return;
  if (hasCheckedToday()) return;
  markCheckedToday();
  try {
    const cfg = await loadAlertConfig(restaurantId);
    if (!cfg.notificacoesAtivas) return;
    const count = await countVenceHoje(restaurantId);
    if (count > 0) {
      sendPersonalizedNotification(cfg.responsavelNome || 'Responsável', count);
      markAlertedToday();
    }
  } catch { /* ignore */ }
}

export function startValidadeScheduler(
  restaurantId: string | null,
  getConfig: () => ValidadeAlertConfig,
): () => void {
  if (!restaurantId) return () => {};

  const interval = setInterval(async () => {
    const cfg = getConfig();
    if (!cfg.notificacoesAtivas) return;
    if (hasAlertedToday()) return;

    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const currentTime = `${hh}:${mm}`;
    if (currentTime !== cfg.horarioNotificacao) return;

    try {
      const count = await countVenceHoje(restaurantId);
      if (count > 0) {
        sendPersonalizedNotification(cfg.responsavelNome || 'Responsável', count);
        markAlertedToday();
      }
    } catch { /* ignore */ }
  }, 30_000);

  return () => clearInterval(interval);
}
