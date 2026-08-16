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
  private token: string;
  private polling = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private statusCallback: StatusCallback | null = null;
  private jobCallback: JobCallback | null = null;
  private printerConfig: PrinterConfig = { caixaPrinter: '', cozinhaPrinter: '', samePrinter: false };
  private connected = false;

  constructor(token: string) {
    this.token = token;
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

  async start(): Promise<{ ok: boolean; error?: string }> {
    const result = await this.heartbeat();
    if (!result.ok) return result;

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
            'X-Agent-Token': this.token,
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
        // Network error — will retry next cycle
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
    // Try to reconnect after delay
    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.heartbeat();
        this.connected = true;
        this.statusCallback?.(true);
        this.startPolling();
        this.startHeartbeat();
      } catch {
        // Schedule another attempt
        this.reconnectTimer = setTimeout(() => this.handleDisconnect(), RECONNECT_DELAY_MS);
      }
    }, RECONNECT_DELAY_MS);
  }

  private async heartbeat(): Promise<{ ok: boolean; error?: string }> {
    try {
      const os = await import('os');
      const machineName = os.hostname();
      const res = await fetch(`${FUNCTION_URL}?action=heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'X-Agent-Token': this.token,
        },
        body: JSON.stringify({ machineName, version: '1.0.0' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        return { ok: false, error: (err as Record<string, string>).error ?? `HTTP ${res.status}` };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'erro de rede' };
    }
  }

  async ackJob(jobId: string, success: boolean, error?: string): Promise<void> {
    try {
      await fetch(`${FUNCTION_URL}?action=ack`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'X-Agent-Token': this.token,
        },
        body: JSON.stringify({ jobId, success, error: error ?? null }),
      });
    } catch {
      // Non-critical — job will be retried on next poll if not acked
    }
  }
}
