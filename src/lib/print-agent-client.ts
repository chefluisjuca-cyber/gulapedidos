import { supabase } from './supabase';

export interface PrintAgent {
  id: string;
  restaurant_id: string;
  agent_token: string;
  machine_name: string | null;
  status: 'connected' | 'disconnected';
  last_seen_at: string | null;
  version: string | null;
  created_at: string;
  updated_at: string;
}

export interface Printer {
  id: string;
  restaurant_id: string;
  agent_id: string | null;
  sector: 'caixa' | 'cozinha' | 'bar' | 'expedicao' | 'fritura' | 'delivery' | 'outros';
  printer_name: string;
  is_default: boolean;
  paper_width: number;
  status: 'online' | 'offline' | 'error' | 'unknown';
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface PrintJob {
  id: string;
  restaurant_id: string;
  printer_id: string;
  order_id: string | null;
  sector: string;
  job_type: 'receipt' | 'kitchen' | 'test';
  payload: Record<string, unknown>;
  idempotency_key: string;
  status: 'pending' | 'printing' | 'printed' | 'failed';
  attempts: number;
  max_attempts: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  printed_at: string | null;
}

export interface PrintSettings {
  id: string;
  restaurant_id: string;
  auto_print: boolean;
  auto_print_caixa: boolean;
  auto_print_cozinha: boolean;
  copies: number;
  allow_reprint: boolean;
  same_printer_caixa_cozinha: boolean;
  created_at: string;
  updated_at: string;
}

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/print-agent`;

function getAnonKey(): string {
  return import.meta.env.VITE_SUPABASE_ANON_KEY;
}

async function callAgentApi(action: string, body?: Record<string, unknown>, agentToken?: string): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getAnonKey()}`,
  };
  if (agentToken) headers['X-Agent-Token'] = agentToken;

  const res = await fetch(`${FUNCTION_URL}?action=${action}`, {
    method: 'POST',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchPrintAgents(restaurantId: string): Promise<PrintAgent[]> {
  const { data, error } = await supabase
    .from('print_agents')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as PrintAgent[];
}

export async function fetchPrinters(restaurantId: string): Promise<Printer[]> {
  const { data, error } = await supabase
    .from('printers')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Printer[];
}

export async function fetchPrintSettings(restaurantId: string): Promise<PrintSettings | null> {
  const { data, error } = await supabase
    .from('print_settings')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .maybeSingle();
  if (error) throw error;
  return data as PrintSettings | null;
}

export async function savePrintSettings(restaurantId: string, settings: Partial<PrintSettings>): Promise<void> {
  const payload = {
    restaurant_id: restaurantId,
    auto_print: settings.auto_print ?? true,
    auto_print_caixa: settings.auto_print_caixa ?? true,
    auto_print_cozinha: settings.auto_print_cozinha ?? true,
    copies: settings.copies ?? 1,
    allow_reprint: settings.allow_reprint ?? true,
    same_printer_caixa_cozinha: settings.same_printer_caixa_cozinha ?? false,
    updated_at: new Date().toISOString(),
  };
  const existing = await fetchPrintSettings(restaurantId);
  if (existing) {
    const { error } = await supabase.from('print_settings').update(payload).eq('id', existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('print_settings').insert(payload);
    if (error) throw error;
  }
}

export async function updatePrinter(printerId: string, updates: Partial<Printer>): Promise<void> {
  const { error } = await supabase
    .from('printers')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', printerId);
  if (error) throw error;
}

export async function deletePrinter(printerId: string): Promise<void> {
  const { error } = await supabase.from('printers').delete().eq('id', printerId);
  if (error) throw error;
}

export async function testPrint(printerId: string, sector: string, agentToken: string): Promise<{ jobId: string }> {
  const res = await callAgentApi('test', { printerId, sector }, agentToken);
  return { jobId: res.jobId as string };
}

export async function sendTestPrintFromFrontend(printerId: string, sector: string): Promise<void> {
  const { data: agent } = await supabase
    .from('print_agents')
    .select('agent_token')
    .eq('restaurant_id', (await supabase.from('printers').select('restaurant_id').eq('id', printerId).maybeSingle()).data?.restaurant_id ?? '')
    .eq('status', 'connected')
    .maybeSingle();
  if (!agent?.agent_token) throw new Error('Print Agent offline');
  await testPrint(printerId, sector, agent.agent_token);
}

export function isAgentOnline(agent: PrintAgent | null): boolean {
  if (!agent) return false;
  if (agent.status !== 'connected') return false;
  if (!agent.last_seen_at) return false;
  const age = Date.now() - new Date(agent.last_seen_at).getTime();
  return age < 90_000;
}

export async function dispatchPrintJob(
  restaurantId: string,
  printerId: string,
  sector: string,
  jobType: 'receipt' | 'kitchen',
  orderId: string | null,
  payload: Record<string, unknown>,
): Promise<string | null> {
  const idempotencyKey = `${restaurantId}-${orderId ?? 'noid'}-${printerId}-${jobType}`;
  const { data: existing } = await supabase
    .from('print_jobs')
    .select('id')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();
  if (existing) return existing.id;

  const { data, error } = await supabase
    .from('print_jobs')
    .insert({
      restaurant_id: restaurantId,
      printer_id: printerId,
      order_id: orderId,
      sector,
      job_type: jobType,
      payload,
      idempotency_key: idempotencyKey,
      status: 'pending',
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function fetchPrintJobs(restaurantId: string, limit = 50): Promise<PrintJob[]> {
  const { data, error } = await supabase
    .from('print_jobs')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as PrintJob[];
}
