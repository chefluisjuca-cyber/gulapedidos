import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('agentAPI', {
  connect: (token: string) => ipcRenderer.invoke('connect', token),
  disconnect: () => ipcRenderer.invoke('disconnect'),
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  saveConfig: (config: { caixaPrinter: string; cozinhaPrinter: string; samePrinter: boolean }) =>
    ipcRenderer.invoke('save-config', config),
  loadConfig: () => ipcRenderer.invoke('load-config'),
  testPrint: (printerName: string) => ipcRenderer.invoke('test-print', printerName),
  minimizeToTray: () => ipcRenderer.invoke('minimize-to-tray'),
  onStatusChange: (callback: (connected: boolean) => void) =>
    ipcRenderer.on('status-change', (_e, connected) => callback(connected)),
  onPrintResult: (callback: (result: { jobId: string; success: boolean; error?: string }) => void) =>
    ipcRenderer.on('print-result', (_e, result) => callback(result)),
});
