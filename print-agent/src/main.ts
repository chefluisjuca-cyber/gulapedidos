import { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { SaaSPoller } from './saas-client';
import { PrinterService } from './printer-service';

let tray: Tray | null = null;
let mainWindow: BrowserWindow | null = null;
let poller: SaaSPoller | null = null;
let printerService: PrinterService | null = null;

const isDev = !app.isPackaged;
const assetsPath = path.join(__dirname, '..', 'assets');

function getIcon(): Electron.NativeImage {
  const iconPng = path.join(assetsPath, 'icon.png');
  if (fs.existsSync(iconPng)) return nativeImage.createFromPath(iconPng);
  return nativeImage.createEmpty();
}

function getTrayIconConnected(): Electron.NativeImage {
  const p = path.join(assetsPath, 'tray-connected.png');
  if (fs.existsSync(p)) return nativeImage.createFromPath(p);
  return getIcon();
}

function getTrayIconDisconnected(): Electron.NativeImage {
  const p = path.join(assetsPath, 'tray-disconnected.png');
  if (fs.existsSync(p)) return nativeImage.createFromPath(p);
  return getIcon();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 680,
    resizable: false,
    maximizable: false,
    frame: false,
    transparent: false,
    show: false,
    icon: getIcon(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('close', (e) => {
    e.preventDefault();
    mainWindow?.hide();
  });
}

function createTray() {
  tray = new Tray(getTrayIconDisconnected());
  updateTrayMenu(false);

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
      }
    }
  });
}

function updateTrayMenu(connected: boolean) {
  if (!tray) return;
  const menu = Menu.buildFromTemplate([
    { label: connected ? '🟢 Conectado ao SaaS' : '🔴 Desconectado', enabled: false },
    { type: 'separator' },
    {
      label: 'Abrir Configurações',
      click: () => mainWindow?.show(),
    },
    {
      label: 'Sair',
      click: () => {
        poller?.stop();
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(menu);
  tray.setToolTip(connected ? 'Gula Print Agent — Conectado' : 'Gula Print Agent — Desconectado');
  tray.setImage(connected ? getTrayIconConnected() : getTrayIconDisconnected());
}

// ── IPC handlers ──────────────────────────────────────────────
ipcMain.handle('connect', async (_event, apiKey: string) => {
  console.log('[Print Agent Main] Recebido pedido de conexão, chave:', apiKey?.slice(0, 8) + '...');
  if (!apiKey || apiKey.trim().length < 10) {
    console.error('[Print Agent Main] Chave inválida ou muito curta');
    return { ok: false, error: 'Chave de API inválida. Verifique a chave no painel web.' };
  }
  try {
    // Validate the API key against the restaurants table
    console.log('[Print Agent Main] Validando chave de API...');
    const linkResult = await SaaSPoller.link(apiKey.trim());
    console.log('[Print Agent Main] Resultado da validação:', { ok: linkResult.ok, error: linkResult.error });
    if (!linkResult.ok || !linkResult.restaurantId) {
      return { ok: false, error: linkResult.error ?? 'Falha ao validar chave.' };
    }

    // Save the API key and restaurant ID locally so the agent reconnects automatically
    const linkInfoPath = path.join(app.getPath('userData'), 'agent-link.json');
    fs.writeFileSync(linkInfoPath, JSON.stringify({
      apiKey: apiKey.trim(),
      restaurantId: linkResult.restaurantId,
      restaurantName: linkResult.restaurantName ?? null,
      linkedAt: new Date().toISOString(),
    }, null, 2), 'utf-8');
    console.log('[Print Agent Main] Informações de vinculação salvas em', linkInfoPath);

    console.log('[Print Agent Main] Criando SaaSPoller com a chave de API...');
    poller = new SaaSPoller(apiKey.trim());
    poller.setRestaurantId(linkResult.restaurantId);
    const result = await poller.start(linkResult.restaurantId);
    console.log('[Print Agent Main] Resultado do start:', result);
    if (!result.ok) {
      console.error('[Print Agent Main] Falha ao iniciar poller:', result.error);
      poller = null;
      return result;
    }

    poller!.onStatusChange((connected) => {
      updateTrayMenu(connected);
      mainWindow?.webContents.send('status-change', connected);
    });

    poller!.onJob(async (job) => {
      if (!printerService) return;
      try {
        await printerService.printJob(job);
        await poller!.ackJob(job.jobId, true);
        mainWindow?.webContents.send('print-result', { jobId: job.jobId, success: true });
      } catch (err) {
        await poller!.ackJob(job.jobId, false, err instanceof Error ? err.message : 'print error');
        mainWindow?.webContents.send('print-result', { jobId: job.jobId, success: false, error: err instanceof Error ? err.message : 'erro' });
      }
    });

    return { ok: true };
  } catch (err) {
    console.error('[Print Agent Main] Erro inesperado ao conectar:', err);
    return { ok: false, error: err instanceof Error ? err.message : 'erro ao conectar' };
  }
});

ipcMain.handle('get-printers', async () => {
  if (!printerService) return [];
  return printerService.listPrinters();
});

ipcMain.handle('save-config', async (_event, config: { caixaPrinter: string; cozinhaPrinter: string; samePrinter: boolean }) => {
  const configPath = path.join(app.getPath('userData'), 'agent-config.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
  if (poller) {
    poller.updatePrinterConfig(config);
    // Persist to Supabase so the web panel can display the printers
    const result = await poller.saveConfig(config);
    if (!result.ok) {
      console.error('[Print Agent Main] Falha ao salvar config no SaaS:', result.error);
    }
    return { ok: result.ok, error: result.error };
  }
  return { ok: true };
});

ipcMain.handle('load-config', async () => {
  const configPath = path.join(app.getPath('userData'), 'agent-config.json');
  if (fs.existsSync(configPath)) {
    try {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch {
      return null;
    }
  }
  return null;
});

ipcMain.handle('test-print', async (_event, printerName: string) => {
  if (!printerService) return { ok: false, error: 'serviço não inicializado' };
  try {
    await printerService.printTestPage(printerName);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'erro' };
  }
});

ipcMain.handle('disconnect', async () => {
  poller?.stop();
  poller = null;
  updateTrayMenu(false);
  return { ok: true };
});

ipcMain.handle('minimize-to-tray', async () => {
  mainWindow?.hide();
  return { ok: true };
});

// ── App lifecycle ─────────────────────────────────────────────
app.whenReady().then(() => {
  printerService = new PrinterService();
  createWindow();
  createTray();

  // Set auto-launch on Windows
  if (!isDev) {
    app.setLoginItemSettings({
      openAtLogin: true,
      args: ['--hidden'],
    });
  }
});

app.on('window-all-closed', () => {
  // Prevent app from quitting when window closes — keep running in tray
});

app.on('before-quit', () => {
  poller?.stop();
});
