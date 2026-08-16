import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { PrinterInfo, PrintJobData, PrinterConfig } from './types';

const execAsync = promisify(exec);

const VIRTUAL_PRINTER_PATTERNS = [
  /microsoft.*print.*to.*pdf/i,
  /microsoft.*xps/i,
  /onenote/i,
  /fax/i,
  /cutepdf/i,
  /bullzip/i,
  /dopdf/i,
  /pdf24/i,
  /nitro/i,
  /foxit/i,
];

function isVirtualPrinter(name: string): boolean {
  return VIRTUAL_PRINTER_PATTERNS.some((p) => p.test(name));
}

export class PrinterService {
  listPrinters(): PrinterInfo[] {
    // Synchronous fallback for IPC — uses PowerShell Get-Printer
    try {
      const result = require('child_process').execSync(
        'powershell -NoProfile -Command "Get-Printer | Select-Object Name,Default | ConvertTo-Json -Compress"',
        { encoding: 'utf-8', timeout: 10000 }
      );
      const raw = JSON.parse(result);
      const arr = Array.isArray(raw) ? raw : [raw];
      return arr.map((p: { Name: string; Default?: boolean }) => ({
        name: p.Name,
        isDefault: p.Default ?? false,
        isVirtual: isVirtualPrinter(p.Name),
      }));
    } catch {
      return [];
    }
  }

  private resolvePrinter(job: PrintJobData, config: PrinterConfig): string | null {
    if (config.samePrinter && config.caixaPrinter) {
      return config.caixaPrinter;
    }
    if (job.sector === 'cozinha' && config.cozinhaPrinter) {
      return config.cozinhaPrinter;
    }
    if (job.sector === 'caixa' && config.caixaPrinter) {
      return config.caixaPrinter;
    }
    if (job.printerName) {
      return job.printerName;
    }
    return null;
  }

  async printJob(job: PrintJobData, config?: PrinterConfig): Promise<void> {
    const printerName = config
      ? this.resolvePrinter(job, config)
      : job.printerName || null;

    if (!printerName) {
      throw new Error(`Nenhuma impressora configurada para o setor: ${job.sector}`);
    }

    const escposData = buildEscPos(job);
    await this.sendRaw(printerName, escposData);
  }

  async printTestPage(printerName: string): Promise<void> {
    const escposData = buildTestPage();
    await this.sendRaw(printerName, escposData);
  }

  private async sendRaw(printerName: string, data: Buffer): Promise<void> {
    const tmpDir = os.tmpdir();
    const tmpFile = path.join(tmpDir, `gula-print-${Date.now()}.bin`);
    fs.writeFileSync(tmpFile, data);

    try {
      const escapedName = printerName.replace(/'/g, "''");
      const escapedPath = tmpFile.replace(/'/g, "''");
      const script = `
$bytes = [System.IO.File]::ReadAllBytes('${escapedPath}')
$printerName = '${escapedName}'
$printServer = New-Object System.Printing.PrintServer
$printQueue = $printServer.GetPrintQueues() | Where-Object { $_.Name -eq $printerName }
if (-not $printQueue) {
  $printQueue = New-Object System.Printing.PrintQueue($printServer, $printerName)
}
$job = $printQueue.AddJob('GulaPrintJob')
$stream = $job.JobStream
$stream.Write($bytes, 0, $bytes.Length)
$stream.Close()
`.trim();

      await execAsync(`powershell -NoProfile -Command "${script.replace(/"/g, '\\"')}"`, {
        timeout: 30000,
        maxBuffer: 10 * 1024 * 1024,
      });
    } catch (err) {
      throw new Error(`Falha ao enviar para ${printerName}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
    }
  }
}

// ── ESC/POS command builder ─────────────────────────────────────
import { buildEscPos, buildTestPage } from './escpos';
