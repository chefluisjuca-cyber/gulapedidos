import type { PrintJobData } from './types';

// ── ESC/POS command constants ──────────────────────────────────
const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

const INIT = Buffer.from([ESC, 0x40]);
const CUT = Buffer.from([GS, 0x56, 0x00]);
const FEED = (n: number) => Buffer.from([ESC, 0x4a, n]);

function text(str: string): Buffer {
  return Buffer.from(str, 'latin1');
}

function center(): Buffer {
  return Buffer.from([ESC, 0x61, 0x01]);
}

function left(): Buffer {
  return Buffer.from([ESC, 0x61, 0x00]);
}

function bold(on: boolean): Buffer {
  return Buffer.from([ESC, 0x45, on ? 0x01 : 0x00]);
}

function size(n: number): Buffer {
  return Buffer.from([GS, 0x21, n]);
}

function line(str = ''): Buffer {
  return Buffer.concat([text(str), Buffer.from([LF])]);
}

function separator(width: number): Buffer {
  return line('-'.repeat(width === 58 ? 32 : 48));
}

function doubleHeight(str: string): Buffer {
  return Buffer.concat([size(0x11), text(str), Buffer.from([LF]), size(0x00)]);
}

export function buildEscPos(job: PrintJobData): Buffer {
  const width = job.paperWidth === 58 ? 32 : 48;
  const parts: Buffer[] = [INIT];

  if (job.jobType === 'test') {
    parts.push(buildTestPage());
    parts.push(Buffer.concat([FEED(5), CUT]));
    return Buffer.concat(parts);
  }

  const payload = job.payload;
  const restaurantName = String(payload.restaurant_name ?? 'Restaurante');
  const orderNumber = String(payload.order_number ?? payload.order_id ?? '');
  const tableNumber = payload.table_number != null ? String(payload.table_number) : null;
  const customerName = String(payload.customer_name ?? '');
  const paymentMethod = String(payload.payment_method ?? '');
  const total = Number(payload.total ?? 0);
  const items = Array.isArray(payload.items) ? payload.items : [];
  const observations = Array.isArray(payload.observations) ? payload.observations : [];
  const receiptFooter = String(payload.receipt_footer ?? '');
  const cnpj = String(payload.cnpj ?? '');
  const address = String(payload.address ?? '');
  const createdAt = String(payload.created_at ?? '');

  if (job.jobType === 'receipt') {
    // ── Caixa / Cupom ──────────────────────────────────────────
    parts.push(center(), bold(true), size(0x11), text(restaurantName), Buffer.from([LF]), size(0x00), bold(false), left());

    if (cnpj) parts.push(line(`CNPJ: ${cnpj}`));
    if (address) {
      const addrLines = wrapText(address, width);
      for (const a of addrLines) parts.push(line(a));
    }
    parts.push(separator(width));

    parts.push(bold(true), line(`PEDIDO #${orderNumber}`), bold(false));
    if (tableNumber) parts.push(line(`Mesa: ${tableNumber}`));
    if (customerName) parts.push(line(`Cliente: ${customerName}`));
    if (createdAt) {
      try {
        parts.push(line(`Data: ${new Date(createdAt).toLocaleString('pt-BR')}`));
      } catch { /* skip */ }
    }
    parts.push(separator(width));

    // Items
    for (const item of items as Array<Record<string, unknown>>) {
      const qty = Number(item.quantity ?? 1);
      const name = String(item.product_name ?? item.name ?? '');
      const unitPrice = Number(item.unit_price ?? 0);
      const lineTotal = (qty * unitPrice).toFixed(2).replace('.', ',');

      parts.push(bold(true), line(`${qty}x ${name}`), bold(false));
      parts.push(line(`    R$ ${lineTotal}`));

      // Extras / combos
      const combos = item.customizations as Record<string, unknown> | undefined;
      if (combos && Array.isArray(combos.combos)) {
        for (const c of combos.combos as Array<Record<string, unknown>>) {
          const groupName = String(c.groupName ?? '');
          const cItems = Array.isArray(c.items) ? (c.items as Array<Record<string, unknown>>).filter((x) => Number(x.qty) > 0) : [];
          if (cItems.length > 0) {
            parts.push(line(`  ${groupName}: ${cItems.map((x) => x.name).join(', ')}`));
          }
        }
      }
      if (combos && Array.isArray(combos.extras)) {
        for (const e of combos.extras as Array<Record<string, unknown>>) {
          const eq = Number(e.qty ?? 0);
          if (eq > 0) parts.push(line(`  +${eq}x ${e.name}`));
        }
      }
      const obs = String(item.observations ?? '');
      if (obs) parts.push(line(`  Obs: ${obs}`));
    }

    parts.push(separator(width));
    parts.push(bold(true), line(`TOTAL: R$ ${total.toFixed(2).replace('.', ',')}`), bold(false));
    if (paymentMethod) parts.push(line(`Pagamento: ${paymentMethod}`));
    parts.push(separator(width));

    if (receiptFooter) {
      const footerLines = wrapText(receiptFooter, width);
      parts.push(center());
      for (const f of footerLines) parts.push(line(f));
      parts.push(left());
    }
  } else if (job.jobType === 'kitchen') {
    // ── Cozinha ────────────────────────────────────────────────
    parts.push(center(), bold(true), doubleHeight(`PEDIDO #${orderNumber}`), bold(false), left());

    if (tableNumber) parts.push(bold(true), line(`Mesa: ${tableNumber}`), bold(false));
    if (customerName) parts.push(line(`Cliente: ${customerName}`));
    if (createdAt) {
      try {
        parts.push(line(`Hora: ${new Date(createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`));
      } catch { /* skip */ }
    }
    parts.push(separator(width));

    for (const item of items as Array<Record<string, unknown>>) {
      const qty = Number(item.quantity ?? 1);
      const name = String(item.product_name ?? item.name ?? '');
      parts.push(bold(true), line(`${qty}x ${name}`), bold(false));

      const combos = item.customizations as Record<string, unknown> | undefined;
      if (combos && Array.isArray(combos.combos)) {
        for (const c of combos.combos as Array<Record<string, unknown>>) {
          const groupName = String(c.groupName ?? '');
          const cItems = Array.isArray(c.items) ? (c.items as Array<Record<string, unknown>>).filter((x) => Number(x.qty) > 0) : [];
          if (cItems.length > 0) {
            parts.push(line(`  ${groupName}: ${cItems.map((x) => x.name).join(', ')}`));
          }
        }
      }
      if (combos && Array.isArray(combos.extras)) {
        for (const e of combos.extras as Array<Record<string, unknown>>) {
          const eq = Number(e.qty ?? 0);
          if (eq > 0) parts.push(line(`  +${eq}x ${e.name}`));
        }
      }
      const obs = String(item.observations ?? '');
      if (obs) parts.push(line(`  >> ${obs}`));
    }

    if (observations.length > 0) {
      parts.push(separator(width));
      parts.push(bold(true), line('OBSERVACOES:'), bold(false));
      for (const o of observations) parts.push(line(String(o)));
    }
  }

  parts.push(FEED(5), CUT);
  return Buffer.concat(parts);
}

export function buildTestPage(): Buffer {
  const parts: Buffer[] = [INIT];
  parts.push(center(), bold(true), size(0x11), text('GULA PRINT AGENT'), Buffer.from([LF]), size(0x00), bold(false), left());
  parts.push(separator(48));
  parts.push(line('Teste de impressao bem-sucedido!'));
  parts.push(line(''));
  parts.push(line(`Data: ${new Date().toLocaleString('pt-BR')}`));
  parts.push(line(''));
  parts.push(center(), line('*** CONECTADO E FUNCIONANDO ***'), left());
  parts.push(FEED(5), CUT);
  return Buffer.concat(parts);
}

function wrapText(str: string, width: number): string[] {
  const lines: string[] = [];
  const words = str.split(' ');
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word).trim().length > width) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = (current + ' ' + word).trim();
    }
  }
  if (current) lines.push(current);
  return lines;
}
