export interface PrinterInfo {
  name: string;
  isDefault: boolean;
  isVirtual: boolean;
}

export interface PrintJobData {
  jobId: string;
  sector: string;
  jobType: 'receipt' | 'kitchen' | 'test';
  payload: Record<string, unknown>;
  printerName: string;
  paperWidth: number;
  attempts: number;
  maxAttempts: number;
}

export interface PrinterConfig {
  caixaPrinter: string;
  cozinhaPrinter: string;
  samePrinter: boolean;
}

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
