import type { PrintJobData, PrinterConfig } from './types';

const SUPABASE_URL = 'https://sslcpewhqsznhikqbrua.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzbGNwZXdocXN6bmhpa3FicnVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MzA3MTIsImV4cCI6MjA5NzMwNjcxMn0.nrzhyssHnw3-_I2Tyt9oYExofhFxwUGotGBPID2bbBw';
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/print-agent`;

const POLL_INTERVAL_MS = 5_000;
const HEARTBEAT_INTERVAL_MS = 30_000;
const RECONNECT_DELAY_MS = 10_000;

type StatusCallback = (connected: boolean) => void;
type JobCallback = (job: PrintJobData) => void;

export class SaaSPoller {
  private apiKey: string;
  private restaurantId: string | null = null;
  private polling = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private statusCallback: StatusCallback | null = null;
  private jobCallback: JobCallback | null = null;
  private printerConfig: PrinterConfig = { caixaPrinter: '', cozinhaPrinter: '', samePrinter: false };
  private connected = false;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  getRestaurantId(): string | null {
    return this.restaurantId;
  }

  static async link(apiKey: string): Promise<{ ok: boolean; restaurantId?: string; restaurantName?: string; error?: string }> {
    try {
      const trimmed = apiKey.trim();
      console.log('[SaaSPoller] Validando chave de API... chave:', trimmed.slice(0, 8) + '...');
      const res = await fetch(`${FUNCTION_URL}?action=link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ apiKey: trimmed }),
      });
      const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      if (!res.ok) {
        const errorMsg = (data as Record<string, string>).error ?? `HTTP ${res.status}`;
        console.error('[SaaSPoller] Falha ao validar chave:', {
          status: res.status,
          statusText: res.statusText,
          error: errorMsg,
          responseData: data,
        });
        return { ok: false, error: errorMsg };
      }
      const d = data as Record<string, string>;
      if (!d.restaurantId) {
        console.error('[SaaSPoller] Resposta sem restaurantId:', data);
        return { ok: false, error: 'Resposta inválida do servidor.' };
      }
      console.log('[SaaSPoller] Chave validada! Restaurante:', d.restaurantName ?? d.restaurantId);
      return { ok: true, restaurantId: d.restaurantId, restaurantName: d.restaurantName };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'erro de rede';
      console.error('[SaaSPoller] Erro de rede ao validar chave:', errMsg, err);
      return { ok: false, error: errMsg };
    }
  }

  onStatusChange(cb: StatusCallback) {
    this.statusCallback = cb;
  }

  onJob(cb: JobCallback) {
    this.jobCallback = cb;
  }

  updatePrinterConfig(config: PrinterConfig) {
    this.printerConfig = config;
  }

  setRestaurantId(id: string) {
    this.restaurantId = id;
  }

  async start(restaurantId?: string): Promise<{ ok: boolean; error?: string }> {
    if (restaurantId) this.restaurantId = restaurantId;
    console.log('[SaaSPoller] Iniciando conexão com SaaS...');
    const result = await this.heartbeat();
    console.log('[SaaSPoller] Resultado do heartbeat:', result);
    if (!result.ok) {
      console.error('[SaaSPoller] Falha no heartbeat inicial:', result.error);
      return result;
    }

    this.connected = true;
    this.statusCallback?.(true);
    this.startPolling();
    this.startHeartbeat();
    return { ok: true };
  }

  stop() {
    this.polling = false;
    if (this.pollTimer) { clearTimeout(this.pollTimer); this.pollTimer = null; }
    if (this.heartbeatTimer) { clearTimeout(this.heartbeatTimer); this.heartbeatTimer = null; }
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    this.connected = false;
    this.statusCallback?.(false);
  }

  private startPolling() {
    this.polling = true;
    const poll = async () => {
      if (!this.polling) return;
      try {
        const res = await fetch(`${FUNCTION_URL}?action=poll`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'X-Agent-Token': this.apiKey,
          },
          body: JSON.stringify({}),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json() as { jobs?: PrintJobData[] };
        if (data.jobs && data.jobs.length > 0) {
          for (const job of data.jobs) {
            this.jobCallback?.(job);
          }
        }
      } catch {
        this.handleDisconnect();
        return;
      }
      this.pollTimer = setTimeout(poll, POLL_INTERVAL_MS);
    };
    poll();
  }

  private startHeartbeat() {
    const beat = async () => {
      try {
        await this.heartbeat();
        if (!this.connected) {
          this.connected = true;
          this.statusCallback?.(true);
          this.startPolling();
        }
      } catch {
        this.handleDisconnect();
      }
    };
    this.heartbeatTimer = setTimeout(beat, HEARTBEAT_INTERVAL_MS);
  }

  private handleDisconnect() {
    if (!this.connected) return;
    this.connected = false;
    this.statusCallback?.(false);
    if (this.pollTimer) { clearTimeout(this.pollTimer); this.pollTimer = null; }
    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.heartbeat();
        this.connected = true;
        this.statusCallback?.(true);
        this.startPolling();
        this.startHeartbeat();
      } catch {
        this.reconnectTimer = setTimeout(() => this.handleDisconnect(), RECONNECT_DELAY_MS);
      }
    }, RECONNECT_DELAY_MS);
  }

  private async heartbeat(): Promise<{ ok: boolean; error?: string }> {
    try {
      const os = await import('os');
      const machineName = os.hostname();
      console.log('[SaaSPoller] Enviando heartbeat para:', FUNCTION_URL);
      const res = await fetch(`${FUNCTION_URL}?action=heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'X-Agent-Token': this.apiKey,
        },
        body: JSON.stringify({ machineName, version: '1.0.1' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        const errorMsg = (err as Record<string, string>).error ?? `HTTP ${res.status}`;
        console.error('[SaaSPoller] Heartbeat falhou - HTTP', res.status, errorMsg);
        return { ok: false, error: errorMsg };
      }
      const data = await res.json().catch(() => ({})) as Record<string, unknown>;
      if (typeof data.restaurantId === 'string' && !this.restaurantId) {
        this.restaurantId = data.restaurantId;
      }
      console.log('[SaaSPoller] Heartbeat OK');
      return { ok: true };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'erro de rede';
      console.error('[SaaSPoller] Erro de rede no heartbeat:', errMsg);
      return { ok: false, error: errMsg };
    }
  }

  async ackJob(jobId: string, success: boolean, error?: string): Promise<void> {
    try {
      await fetch(`${FUNCTION_URL}?action=ack`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'X-Agent-Token': this.apiKey,
        },
        body: JSON.stringify({ jobId, success, error: error ?? null }),
      });
    } catch {
      // Non-critical — job will be retried on next poll if not acked
    }
  }

  async saveConfig(config: { caixaPrinter: string; cozinhaPrinter: string; samePrinter: boolean }): Promise<{ ok: boolean; error?: string }> {
    try {
      console.log('[SaaSPoller] Enviando configuração de impressoras para o SaaS...');
      const res = await fetch(`${FUNCTION_URL}?action=save-config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'X-Agent-Token': this.apiKey,
        },
        body: JSON.stringify({
          caixaPrinter: config.caixaPrinter,
          cozinhaPrinter: config.cozinhaPrinter,
          samePrinter: config.samePrinter,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        const errorMsg = (err as Record<string, string>).error ?? `HTTP ${res.status}`;
        console.error('[SaaSPoller] Falha ao salvar config:', errorMsg);
        return { ok: false, error: errorMsg };
      }
      console.log('[SaaSPoller] Configuração salva no SaaS com sucesso');
      return { ok: true };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'erro de rede';
      console.error('[SaaSPoller] Erro de rede ao salvar config:', errMsg);
      return { ok: false, error: errMsg };
    }
  }
}
