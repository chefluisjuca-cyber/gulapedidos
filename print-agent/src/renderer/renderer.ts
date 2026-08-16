// ── Renderer process: handles UI state and IPC ─────────────────
type StepId = 'connect' | 'configure' | 'test';

interface AgentAPI {
  connect: (token: string) => Promise<{ ok: boolean; error?: string }>;
  disconnect: () => Promise<{ ok: boolean }>;
  getPrinters: () => Promise<Array<{ name: string; isDefault: boolean; isVirtual: boolean }>>;
  saveConfig: (config: { caixaPrinter: string; cozinhaPrinter: string; samePrinter: boolean }) => Promise<{ ok: boolean }>;
  loadConfig: () => Promise<{ caixaPrinter: string; cozinhaPrinter: string; samePrinter: boolean } | null>;
  testPrint: (printerName: string) => Promise<{ ok: boolean; error?: string }>;
  minimizeToTray: () => Promise<{ ok: boolean }>;
  onStatusChange: (cb: (connected: boolean) => void) => void;
  onPrintResult: (cb: (r: { jobId: string; success: boolean; error?: string }) => void) => void;
}

interface Window { agentAPI: AgentAPI }

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;

function showStep(step: StepId) {
  document.querySelectorAll('.step').forEach(el => el.classList.remove('active'));
  $(`step-${step}`).classList.add('active');
}

function setError(msg: string) {
  const el = $('connect-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function addLogEntry(success: boolean, text: string) {
  const logList = $('print-log');
  const empty = logList.querySelector('.log-empty');
  if (empty) empty.remove();

  const entry = document.createElement('div');
  entry.className = `log-entry ${success ? 'success' : 'error'}`;

  const time = document.createElement('span');
  time.className = 'log-time';
  time.textContent = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const textEl = document.createElement('span');
  textEl.className = 'log-text';
  textEl.textContent = text;

  entry.appendChild(time);
  entry.appendChild(textEl);
  logList.insertBefore(entry, logList.firstChild);

  while (logList.children.length > 20) {
    logList.removeChild(logList.lastChild!);
  }
}

// ── Step 1: Connect ────────────────────────────────────────────
$('btn-connect').addEventListener('click', async () => {
  const token = ($('token-input') as HTMLTextAreaElement).value.trim();
  if (!token) {
    setError('Cole o código de vinculação primeiro.');
    return;
  }

  const btn = $('btn-connect') as HTMLButtonElement;
  btn.disabled = true;
  btn.textContent = 'Conectando...';
  $('connect-error').classList.add('hidden');

  try {
    const result = await window.agentAPI.connect(token);
    if (result.ok) {
      showStep('configure');
      await loadPrintersAndConfig();
    } else {
      setError(result.error ?? 'Falha ao conectar. Verifique o código.');
      btn.disabled = false;
      btn.textContent = 'Conectar';
    }
  } catch {
    setError('Erro inesperado ao conectar.');
    btn.disabled = false;
    btn.textContent = 'Conectar';
  }
});

// ── Step 2: Configure ──────────────────────────────────────────
const samePrinterToggle = $('same-printer') as HTMLInputElement;
const cozinhaGroup = $('cozinha-group');

samePrinterToggle.addEventListener('change', () => {
  if (samePrinterToggle.checked) {
    cozinhaGroup.classList.add('hidden');
  } else {
    cozinhaGroup.classList.remove('hidden');
  }
});

$('btn-save-config').addEventListener('click', async () => {
  const caixaSelect = $('caixa-select') as HTMLSelectElement;
  const cozinhaSelect = $('cozinha-select') as HTMLSelectElement;
  const samePrinter = samePrinterToggle.checked;

  const caixaPrinter = caixaSelect.value;
  const cozinhaPrinter = samePrinter ? caixaPrinter : cozinhaSelect.value;

  if (!caixaPrinter) {
    $('save-success').textContent = 'Selecione a impressora do caixa.';
    $('save-success').className = 'error-msg';
    $('save-success').classList.remove('hidden');
    return;
  }

  await window.agentAPI.saveConfig({ caixaPrinter, cozinhaPrinter, samePrinter });

  $('save-success').textContent = 'Configuração salva!';
  $('save-success').className = 'success-msg';
  $('save-success').classList.remove('hidden');
  setTimeout(() => $('save-success').classList.add('hidden'), 2500);

  // Show step 3
  $('info-caixa').textContent = caixaPrinter;
  $('info-cozinha').textContent = samePrinter ? caixaPrinter : cozinhaPrinter;
  showStep('test');
});

async function loadPrintersAndConfig() {
  const printers = await window.agentAPI.getPrinters();

  // Sort: real printers first, virtual last
  printers.sort((a, b) => {
    if (a.isVirtual && !b.isVirtual) return 1;
    if (!a.isVirtual && b.isVirtual) return -1;
    return a.name.localeCompare(b.name);
  });

  const caixaSelect = $('caixa-select') as HTMLSelectElement;
  const cozinhaSelect = $('cozinha-select') as HTMLSelectElement;

  caixaSelect.innerHTML = '<option value="">— Selecione —</option>';
  cozinhaSelect.innerHTML = '<option value="">— Selecione —</option>';

  for (const p of printers) {
    const opt1 = document.createElement('option');
    opt1.value = p.name;
    opt1.textContent = p.isVirtual ? `${p.name} (virtual)` : p.name;
    caixaSelect.appendChild(opt1);

    const opt2 = opt1.cloneNode(true) as HTMLOptionElement;
    cozinhaSelect.appendChild(opt2);
  }

  // Load saved config
  const saved = await window.agentAPI.loadConfig();
  if (saved) {
    if (saved.caixaPrinter) caixaSelect.value = saved.caixaPrinter;
    if (saved.cozinhaPrinter) cozinhaSelect.value = saved.cozinhaPrinter;
    if (saved.samePrinter) {
      samePrinterToggle.checked = true;
      cozinhaGroup.classList.add('hidden');
    }
  }
}

// ── Step 3: Test & status ──────────────────────────────────────
$('btn-test-print').addEventListener('click', async () => {
  const btn = $('btn-test-print') as HTMLButtonElement;
  btn.disabled = true;
  btn.textContent = 'Imprimindo...';
  $('test-result').classList.add('hidden');

  // Use the caixa printer for test
  const config = await window.agentAPI.loadConfig();
  const printerName = config?.caixaPrinter ?? '';

  if (!printerName) {
    $('test-result').textContent = 'Nenhuma impressora configurada.';
    $('test-result').className = 'result-msg error';
    $('test-result').classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = 'Imprimir Página de Teste';
    return;
  }

  const result = await window.agentAPI.testPrint(printerName);

  if (result.ok) {
    $('test-result').textContent = 'Teste enviado com sucesso!';
    $('test-result').className = 'result-msg success';
    addLogEntry(true, `Teste impresso em ${printerName}`);
  } else {
    $('test-result').textContent = result.error ?? 'Erro ao imprimir.';
    $('test-result').className = 'result-msg error';
    addLogEntry(false, `Erro no teste: ${result.error ?? 'falha'}`);
  }
  $('test-result').classList.remove('hidden');
  btn.disabled = false;
  btn.textContent = 'Imprimir Página de Teste';
});

$('btn-disconnect').addEventListener('click', async () => {
  await window.agentAPI.disconnect();
  showStep('connect');
  const btn = $('btn-connect') as HTMLButtonElement;
  btn.disabled = false;
  btn.textContent = 'Conectar';
});

// ── Title bar buttons ──────────────────────────────────────────
$('btn-minimize').addEventListener('click', () => {
  window.agentAPI.minimizeToTray();
});

$('btn-close').addEventListener('click', () => {
  window.agentAPI.minimizeToTray();
});

// ── Status change listener ────────────────────────────────────
window.agentAPI.onStatusChange((connected) => {
  const badge = $('agent-status');
  const text = $('status-text');
  if (connected) {
    badge.className = 'status-badge status-connected';
    text.textContent = 'Conectado ao SaaS';
  } else {
    badge.className = 'status-badge status-disconnected';
    text.textContent = 'Desconectado — tentando reconectar...';
  }
});

window.agentAPI.onPrintResult((result) => {
  if (result.success) {
    addLogEntry(true, `Pedido impresso (Job: ${result.jobId.slice(0, 8)})`);
  } else {
    addLogEntry(false, `Falha na impressão: ${result.error ?? 'erro'}`);
  }
});

// ── Check if already connected (app restart) ───────────────────
(async () => {
  const config = await window.agentAPI.loadConfig();
  if (config && config.caixaPrinter) {
    // Already configured — skip to test step
    // But we need the agent to reconnect first
    $('info-caixa').textContent = config.caixaPrinter;
    $('info-cozinha').textContent = config.samePrinter ? config.caixaPrinter : config.cozinhaPrinter;
  }
})();
