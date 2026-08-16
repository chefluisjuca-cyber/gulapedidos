// WebUSB thermal printer management
// Stores the paired device in module scope so it persists across renders

let pairedDevice: USBDevice | null = null;

export function hasPairedPrinter(): boolean {
  return pairedDevice !== null;
}

export async function pairPrinter(): Promise<string> {
  const usb = (navigator as { usb?: USB }).usb;
  if (!usb) throw new Error('WebUSB não suportado neste navegador. Use Chrome ou Edge.');

  const device = await usb.requestDevice({ filters: [] });
  pairedDevice = device;
  return device.productName ?? device.manufacturerName ?? 'Impressora USB';
}

export function unpairPrinter(): void {
  pairedDevice = null;
}

export async function sendToUsbPrinter(buffer: Uint8Array): Promise<void> {
  if (!pairedDevice) throw new Error('Nenhuma impressora pareada. Vá em Configurações > Impressão.');

  const device = pairedDevice;

  await device.open();
  try {
    if (device.configuration === null) await device.selectConfiguration(1);
    await device.claimInterface(0);

    const iface = device.configuration!.interfaces[0];
    const alt = iface.alternates[0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ep = alt.endpoints.find((e: any) => e.direction === 'out');
    const epNum: number = ep ? (ep as { endpointNumber: number }).endpointNumber : 1;

    await device.transferOut(epNum, buffer);
  } finally {
    try { await device.releaseInterface(0); } catch {}
    try { await device.close(); } catch {}
  }
}
