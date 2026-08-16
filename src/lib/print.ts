import html2canvas from 'html2canvas';
import { Order, RestaurantSettings } from '../types';
import { sendToUsbPrinter, hasPairedPrinter } from './usb-printer';

// ─── Formatting helpers ──────────────────────────────────────────────────────

function fmt(val: number) {
  return `R$ ${val.toFixed(2).replace('.', ',')}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── ESC/POS text helpers (used only by USB path) ────────────────────────────

const WIDTH = 40;
const DIV   = '-'.repeat(WIDTH);
const DIVD  = '- '.repeat(WIDTH / 2);

function center(text: string): string {
  const t = text.substring(0, WIDTH);
  const pad = Math.floor((WIDTH - t.length) / 2);
  return ' '.repeat(pad) + t;
}

function dotLine(left: string, right: string): string {
  const dotsNeeded = WIDTH - left.length - right.length;
  if (dotsNeeded >= 2) return left + ' ' + '.'.repeat(dotsNeeded - 2) + ' ' + right;
  return left + '\n' + '.'.repeat(WIDTH - right.length - 1) + ' ' + right;
}

type OrderItem = NonNullable<Order['order_items']>[number];

type ObsEntry = { type: 'group' | 'choice' | 'extra' | 'obs'; text: string };

function buildObsEntries(item: OrderItem): ObsEntry[] {
  const entries: ObsEntry[] = [];
  const mm = item.customizations?.meio_a_meio;
  if (mm && (mm.half1 || mm.half2)) {
    [mm.half1, mm.half2].forEach((half, i) => {
      if (!half) return;
      entries.push({ type: 'choice', text: `${i === 0 ? '1ª metade' : '2ª metade'}: ${half.productName}` });
      (half.extras ?? []).filter(e => e.qty > 0).forEach(e => {
        entries.push({ type: 'extra', text: `+${e.qty}x ${e.name}${e.price > 0 ? `  ${fmt(e.price * e.qty)}` : ''}` });
      });
    });
  }
  (item.customizations?.combos ?? []).forEach(c => {
    const items = c.items.filter(x => x.qty > 0);
    if (!items.length) return;
    entries.push({ type: 'group', text: `${c.groupName}:` });
    items.forEach(x => {
      entries.push({ type: 'choice', text: `${x.qty > 1 ? `${x.qty}x ` : ''}${x.name}` });
      (x.extras ?? []).filter(e => e.qty > 0).forEach(e => {
        entries.push({ type: 'extra', text: `+${e.qty}x ${e.name}${e.price > 0 ? `  ${fmt(e.price * e.qty)}` : ''}` });
      });
    });
  });
  const extras = (item.customizations?.extras ?? []).filter(e => e.qty > 0);
  if (extras.length) {
    entries.push({ type: 'group', text: 'Adicionais:' });
    extras.forEach(e => {
      entries.push({ type: 'extra', text: `+${e.qty}x ${e.name}${e.price > 0 ? `  ${fmt(e.price * e.qty)}` : ''}` });
    });
  }
  const obs = item.customizations?.observations?.trim();
  if (obs) entries.push({ type: 'obs', text: `Obs: ${obs}` });
  return entries;
}

function buildObsLines(item: OrderItem): string[] {
  return buildObsEntries(item).map(e => e.text);
}

function renderObsHtml(entries: ObsEntry[], up: (s: string) => string): string[] {
  return entries.map(entry => {
    const prefix = entry.type === 'obs' ? '' : '\u21b3 ';
    if (entry.type === 'choice') {
      return `<div class="obs obs-choice" style="font-family:'Arial Black',sans-serif!important;font-weight:900!important;font-size:12px!important;">${prefix}${up(entry.text)}</div>`;
    }
    if (entry.type === 'group') {
      return `<div class="obs obs-group" style="font-family:Arial,sans-serif!important;font-weight:700!important;font-size:12px!important;">${prefix}${up(entry.text)}</div>`;
    }
    return `<div class="obs obs-extra" style="font-family:Arial,sans-serif!important;font-weight:700!important;font-size:11px!important;">${prefix}${up(entry.text)}</div>`;
  });
}

// ─── HTML coupon template (70mm usable area, for html2canvas capture) ─────────

// 70mm @ 96dpi ≈ 264px. Padding 2mm top/bottom (≈8px), 0mm left/right.
const COUPON_W = 264;
const PAD_V = 8;
const PAD_H = 0;

function buildCouponHtml(order: Order, settings: RestaurantSettings | null, mode: 'receipt' | 'kitchen'): string {
  const name = settings?.name ?? 'Restaurante';
  const orderId = order.id.slice(-6).toUpperCase();
  const isDelivery = order.delivery_mode === 'delivery';
  const serviceLabel = isDelivery ? 'DELIVERY' : order.service_mode === 'table' ? 'ENTREGA NA MESA' : 'RETIRADA NO BALCÃO';

  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const up  = (s: string) => esc(s.toUpperCase());

  const SEP  = `<div class="linha-divisoria"></div>`;
  const SEPD = `<div class="linha-divisoria pontilhada"></div>`;

  const rows: string[] = [];

  if (mode === 'receipt') {
    if (settings?.logo_url) {
      rows.push(`<div class="logo-wrap"><img src="${esc(settings.logo_url)}" alt="logo" /></div>`);
    }
    rows.push(`<div class="center big">${up(name)}</div>`);
    if (settings?.cnpj)    rows.push(`<div class="center">CNPJ: ${esc(settings.cnpj)}</div>`);
    if (settings?.address) rows.push(`<div class="center">${esc(settings.address)}</div>`);
    rows.push(SEP);
    rows.push(`<div class="item-linha"><span>MESA:</span><span class="item-preco">${esc(String(order.table_number))}</span></div>`);
    rows.push(`<div class="item-linha"><span>PEDIDO:</span><span class="item-preco">#${orderId}</span></div>`);
    rows.push(`<div class="item-linha"><span>${esc(fmtDate(order.created_at))}</span></div>`);
    rows.push(SEPD);

    (order.order_items ?? []).forEach((item, idx, arr) => {
      const price = fmt(item.unit_price * item.quantity);
      rows.push(`<div class="item-linha produto-nome"><span>${esc(`${item.quantity}X `)}${up(item.product_name)}</span><span class="item-preco">${esc(price)}</span></div>`);
      renderObsHtml(buildObsEntries(item), up).forEach(html => rows.push(html));
      if (idx < arr.length - 1) rows.push(SEPD);
    });

    rows.push(SEP);

    if (order.loyalty_discount > 0) {
      const sub = order.total + order.loyalty_discount;
      rows.push(`<div class="item-linha"><span>SUBTOTAL</span><span class="item-preco">${esc(fmt(sub))}</span></div>`);
      rows.push(`<div class="item-linha"><span>DESC. FIDELIDADE</span><span class="item-preco">-${esc(fmt(order.loyalty_discount))}</span></div>`);
    }
    rows.push(`<div class="item-linha big"><span>TOTAL</span><span class="item-preco">${esc(fmt(order.total))}</span></div>`);

    const hasPts  = order.loyalty_points_earned > 0;
    const hasCash = Number(order.loyalty_cashback_earned) > 0;
    if (hasPts || hasCash) {
      rows.push(SEPD);
      if (hasPts)  rows.push(`<div class="center">NESTE PEDIDO: +${order.loyalty_points_earned} PTS</div>`);
      if (hasCash) rows.push(`<div class="center">NESTE PEDIDO: +${esc(fmt(Number(order.loyalty_cashback_earned)))} CASHBACK</div>`);
    }
    if (order.loyalty_points_total > 0) {
      rows.push(`<div class="center">SALDO ACUMULADO: ${order.loyalty_points_total} PONTOS</div>`);
    }
    if (Number(order.loyalty_cashback_total) > 0) {
      rows.push(`<div class="center">SALDO CASHBACK: ${esc(fmt(Number(order.loyalty_cashback_total)))}</div>`);
    }

    if (isDelivery) {
      rows.push(SEP);
      rows.push(`<div class="center big">*** DELIVERY ***</div>`);
      const addr = [order.delivery_street, order.delivery_number, order.delivery_bairro, order.delivery_complement].filter(Boolean).join(', ');
      if (addr) rows.push(`<div class="center">${esc(addr)}</div>`);
      if (order.delivery_reference) rows.push(`<div class="center">REF: ${esc(order.delivery_reference)}</div>`);
      if (order.delivery_whatsapp) rows.push(`<div class="center">WHATSAPP: ${esc(order.delivery_whatsapp)}</div>`);
      rows.push(SEPD);
      const payMap: Record<string, string> = { card_delivery: 'CARTAO NA ENTREGA', pix_delivery: 'PIX NA ENTREGA', cash_delivery: 'DINHEIRO NA ENTREGA' };
      const payLabel = payMap[order.delivery_payment_method] ?? order.delivery_payment_method;
      rows.push(`<div class="item-linha"><span>PAGAMENTO</span><span class="item-preco">${esc(payLabel)}</span></div>`);
      if (order.delivery_change_for) rows.push(`<div class="item-linha"><span>TROCO PARA</span><span class="item-preco">R$ ${esc(Number(order.delivery_change_for).toFixed(2))}</span></div>`);
      if (order.delivery_fee > 0) rows.push(`<div class="item-linha"><span>TAXA DE ENTREGA</span><span class="item-preco">${esc(fmt(order.delivery_fee))}</span></div>`);
      if (order.delivery_estimated_minutes) rows.push(`<div class="center">TEMPO EST.: ~${order.delivery_estimated_minutes} MIN</div>`);
    } else {
      rows.push(SEP);
      rows.push(`<div class="center">${serviceLabel}</div>`);
    }
    if (settings?.receipt_footer) {
      rows.push(SEPD);
      rows.push(`<div class="center">${esc(settings.receipt_footer)}</div>`);
    }

  } else {
    rows.push(`<div class="center big">*** COZINHA ***</div>`);
    rows.push(SEP);
    rows.push(`<div class="item-linha"><span>MESA:</span><span class="item-preco">${esc(String(order.table_number))}</span></div>`);
    rows.push(`<div class="item-linha"><span>PEDIDO:</span><span class="item-preco">#${orderId}</span></div>`);
    rows.push(`<div class="item-linha"><span>${esc(fmtDate(order.created_at))}</span></div>`);
    rows.push(SEP);

    (order.order_items ?? []).forEach((item, idx, arr) => {
      rows.push(`<div class="item-name produto-nome">${esc(`${item.quantity}X `)}${up(item.product_name)}</div>`);
      renderObsHtml(buildObsEntries(item), up).forEach(html => rows.push(html));
      if (idx < arr.length - 1) rows.push(SEPD);
    });

    rows.push(SEP);
    rows.push(`<div class="center">${serviceLabel}</div>`);
    if (isDelivery && order.delivery_name) rows.push(`<div class="center">${esc(order.delivery_name)}</div>`);
  }

  rows.push(`<div class="trail"></div>`);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: ${COUPON_W}px;
    background: #fff;
    color: #000;
    font-family: 'Arial Black', 'Impact', 'Trebuchet MS', sans-serif;
    font-size: 12px;
    line-height: 1.45;
    font-weight: 900;
    text-transform: uppercase;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  #coupon {
    width: ${COUPON_W}px;
    padding: ${PAD_V}px ${PAD_H}px !important;
    background: #fff;
  }
  .logo-wrap { text-align: center; padding: 4px 0 2px; }
  .logo-wrap img { max-width: 130px; max-height: 55px; object-fit: contain; display: block; margin: 0 auto; }
  .linha-divisoria {
    width: 100% !important;
    border-top: 2px solid #000000 !important;
    margin: 8px 0 !important;
    display: block !important;
  }
  .linha-divisoria.pontilhada {
    border-top: 2px dashed #000000 !important;
  }
  .item-linha {
    display: flex !important;
    justify-content: space-between !important;
    align-items: flex-start !important;
    width: 100% !important;
    padding: 1px 0;
    font-family: 'Arial Black', sans-serif !important;
    font-weight: 900 !important;
  }
  .item-preco {
    white-space: nowrap !important;
    text-align: right !important;
    font-weight: 900 !important;
  }
  .center {
    text-align: center;
    padding: 1px 0;
    font-family: 'Arial Black', sans-serif !important;
    font-weight: 900 !important;
  }
  .big   { font-size: 14px; }
  .produto-nome {
    font-family: 'Arial Black', sans-serif !important;
    font-weight: 900 !important;
    font-size: 13px !important;
    color: #000000 !important;
    text-transform: uppercase;
  }
  .obs {
    padding-left: 4px;
    padding-bottom: 1px;
  }
  .obs-group {
    font-family: Arial, sans-serif !important;
    font-weight: 700 !important;
    font-size: 12px !important;
  }
  .obs-choice {
    font-family: 'Arial Black', sans-serif !important;
    font-weight: 900 !important;
    font-size: 12px !important;
  }
  .obs-extra {
    font-family: Arial, sans-serif !important;
    font-weight: 700 !important;
    font-size: 11px !important;
  }
  .item-name {
    font-size: 13px;
    padding: 2px 0;
    font-family: 'Arial Black', sans-serif !important;
    font-weight: 900 !important;
  }
  .spacer { height: 6px; }
  .trail  { height: 10px; }
</style>
</head>
<body>
<div id="coupon" style="width:${COUPON_W}px!important;margin:0 auto!important;padding:${PAD_V}px 0px!important;box-sizing:border-box!important;">
${rows.join('\n')}
</div>
</body>
</html>`;
}

// ─── Canvas capture + print window ───────────────────────────────────────────

async function captureCouponImage(html: string, logoUrl?: string): Promise<string> {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = `position:fixed;top:-9999px;left:-9999px;width:${COUPON_W}px;border:none;opacity:0;pointer-events:none;`;
  document.body.appendChild(iframe);

  await new Promise<void>(resolve => {
    iframe.onload = () => resolve();
    iframe.srcdoc = html;
  });

  if (logoUrl) {
    const doc = iframe.contentDocument!;
    const imgs = Array.from(doc.images);
    await Promise.all(imgs.map(img =>
      img.complete ? Promise.resolve() :
      new Promise<void>(res => { img.onload = () => res(); img.onerror = () => res(); }),
    ));
  }

  const coupon = iframe.contentDocument!.getElementById('coupon')!;
  const canvas = await html2canvas(coupon, {
    scale: 4,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    logging: false,
    width: COUPON_W,
    windowWidth: COUPON_W,
    onclone: (clonedDoc) => {
      const style = clonedDoc.createElement('style');
      style.innerHTML = `
        * {
          -webkit-font-smoothing: none !important;
          -moz-osx-font-smoothing: unset !important;
          text-rendering: geometricPrecision !important;
          color: #000000 !important;
        }
        .produto-nome, .item-name, .item-linha, .center, .big, .total-rotulo, .total-valor, .titulo-loja, .obs-choice {
          font-family: 'Arial Black', sans-serif !important;
          font-weight: 900 !important;
        }
        .obs-group, .obs-extra, .adicional, .opcao, .observacao, .subtitulo {
          font-family: Arial, sans-serif !important;
          font-weight: 700 !important;
        }
        .obs-extra, .adicional, .opcao, .observacao {
          font-size: 11px !important;
        }
        .obs-group {
          font-size: 12px !important;
        }
      `;
      clonedDoc.head.appendChild(style);
    },
  });

  document.body.removeChild(iframe);
  return canvas.toDataURL('image/png');
}

function openImagePrintWindow(dataUrl: string): void {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:500px;height:700px;border:none;opacity:0;pointer-events:none;';
  document.body.appendChild(iframe);

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: 80mm auto; margin: 0; }
  html, body {
    width: 80mm;
    margin: 0 !important;
    padding: 0 !important;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  img.cupom-print-img {
    width: 70mm !important;
    display: block !important;
    margin: 0 auto !important;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
    filter: contrast(300%) grayscale(100%);
  }
</style>
</head>
<body>
<img class="cupom-print-img" src="${dataUrl}" />
</body>
</html>`;

  iframe.onload = () => {
    const w = iframe.contentWindow!;
    const img = w.document.querySelector('img');
    const doPrint = () => {
      w.focus();
      w.print();
    };
    w.addEventListener('afterprint', () => {
      if (iframe.parentNode) document.body.removeChild(iframe);
    }, { once: true });
    if (img && !img.complete) {
      img.onload = doPrint;
      img.onerror = doPrint;
    } else {
      doPrint();
    }
    setTimeout(() => { if (iframe.parentNode) document.body.removeChild(iframe); }, 60000);
  };

  iframe.srcdoc = html;
}

// ─── Public browser-print API ────────────────────────────────────────────────

export async function printKitchen(order: Order, _settings?: RestaurantSettings | null): Promise<void> {
  const html = buildCouponHtml(order, _settings ?? null, 'kitchen');
  const dataUrl = await captureCouponImage(html);
  openImagePrintWindow(dataUrl);
}

export async function printReceipt(order: Order, settings: RestaurantSettings | null): Promise<void> {
  const html = buildCouponHtml(order, settings, 'receipt');
  const dataUrl = await captureCouponImage(html, settings?.logo_url ?? undefined);
  openImagePrintWindow(dataUrl);
}

// ─── ESC/POS WebUSB printing (unchanged) ─────────────────────────────────────

const ESC = 0x1B;
const GS  = 0x1D;

const INIT        = [ESC, 0x40];
const BOLD_ON     = [ESC, 0x45, 0x01];
const BOLD_OFF    = [ESC, 0x45, 0x00];
const FONT_SMALL  = [ESC, 0x4D, 0x01];
const FONT_NORMAL = [ESC, 0x4D, 0x00];
const ALIGN_CTR   = [ESC, 0x61, 0x01];
const ALIGN_LEFT  = [ESC, 0x61, 0x00];
const FEED_CUT    = [0x0A, 0x0A, 0x0A, GS, 0x56, 0x41, 0x03];

const encoder = new TextEncoder();

function bytes(...parts: Array<number[] | string | Uint8Array>): Uint8Array {
  const arrays = parts.map(p => {
    if (typeof p === 'string')   return encoder.encode(p);
    if (p instanceof Uint8Array) return p;
    return new Uint8Array(p);
  });
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) { out.set(a, offset); offset += a.length; }
  return out;
}

function buildReceiptBuffer(order: Order, settings: RestaurantSettings | null): Uint8Array {
  const name = (settings?.name ?? 'Restaurante').toUpperCase();
  const parts: Array<number[] | string | Uint8Array> = [];

  parts.push(INIT);
  parts.push(ALIGN_CTR, BOLD_ON, `${center(name)}\n`, BOLD_OFF);
  if (settings?.cnpj)    parts.push(FONT_SMALL, `${center(`CNPJ: ${settings.cnpj}`)}\n`, FONT_NORMAL);
  if (settings?.address) parts.push(FONT_SMALL, `${center(settings.address)}\n`, FONT_NORMAL);
  parts.push(ALIGN_LEFT, `${DIV}\n`);
  parts.push(`Mesa: ${order.table_number}\n`);
  parts.push(`Pedido: #${order.id.slice(-6).toUpperCase()}\n`);
  parts.push(`${fmtDate(order.created_at)}\n`);
  parts.push(`${DIVD}\n`);

  (order.order_items ?? []).forEach(item => {
    const label = `${item.quantity}x ${item.product_name}`;
    const price = fmt(item.unit_price * item.quantity);
    parts.push(BOLD_ON, `${dotLine(label, price)}\n`, BOLD_OFF);
    buildObsLines(item).forEach(obs => { parts.push(FONT_SMALL, `${obs}\n`, FONT_NORMAL); });
    parts.push('\n');
  });

  parts.push(`${DIV}\n`);
  if (order.loyalty_discount > 0) {
    const sub = order.total + order.loyalty_discount;
    parts.push(`${dotLine('SUBTOTAL', fmt(sub))}\n`);
    parts.push(FONT_SMALL, `${dotLine('DESC. FIDELIDADE', `-${fmt(order.loyalty_discount)}`)}\n`, FONT_NORMAL);
  }
  parts.push(BOLD_ON, `${dotLine('TOTAL', fmt(order.total))}\n`, BOLD_OFF);
  if (order.loyalty_points_earned > 0 || Number(order.loyalty_cashback_earned) > 0) {
    parts.push(FONT_SMALL, `${DIVD}\n`, FONT_NORMAL);
    if (order.loyalty_points_earned > 0) parts.push(FONT_SMALL, `${center(`Neste pedido: +${order.loyalty_points_earned} pts`)}\n`, FONT_NORMAL);
    if (Number(order.loyalty_cashback_earned) > 0) parts.push(FONT_SMALL, `${center(`Neste pedido: +R$ ${Number(order.loyalty_cashback_earned).toFixed(2).replace('.', ',')} cashback`)}\n`, FONT_NORMAL);
  }
  if (order.loyalty_points_total > 0) parts.push(FONT_SMALL, `${center(`Saldo acumulado: ${order.loyalty_points_total} pontos`)}\n`, FONT_NORMAL);
  if (Number(order.loyalty_cashback_total) > 0) parts.push(FONT_SMALL, `${center(`Saldo cashback: R$ ${Number(order.loyalty_cashback_total).toFixed(2).replace('.', ',')}`)}\n`, FONT_NORMAL);
  parts.push(`${DIV}\n`);
  const mode = order.service_mode === 'table' ? 'ENTREGA NA MESA' : 'RETIRADA NO BALCAO';
  parts.push(ALIGN_CTR, `${center(mode)}\n`);
  if (settings?.receipt_footer) {
    parts.push(`${DIVD}\n`);
    parts.push(FONT_SMALL, `${center(settings.receipt_footer)}\n`, FONT_NORMAL);
  }
  parts.push(ALIGN_LEFT, FEED_CUT);
  return bytes(...parts);
}

function buildKitchenBuffer(order: Order): Uint8Array {
  const parts: Array<number[] | string | Uint8Array> = [];
  parts.push(INIT);
  parts.push(ALIGN_CTR, BOLD_ON, `${center('*** COZINHA ***')}\n`, BOLD_OFF);
  parts.push(ALIGN_LEFT, `${DIV}\n`);
  parts.push(`Mesa: ${order.table_number}\n`);
  parts.push(`Pedido: #${order.id.slice(-6).toUpperCase()}\n`);
  parts.push(`${fmtDate(order.created_at)}\n`);
  parts.push(`${DIV}\n`);
  (order.order_items ?? []).forEach(item => {
    parts.push(BOLD_ON, `${item.quantity}x ${item.product_name}\n`, BOLD_OFF);
    buildObsLines(item).forEach(obs => { parts.push(FONT_SMALL, `${obs}\n`, FONT_NORMAL); });
    parts.push('\n');
  });
  parts.push(`${DIV}\n`);
  const mode = order.service_mode === 'table' ? 'ENTREGA NA MESA' : 'RETIRADA NO BALCAO';
  parts.push(ALIGN_CTR, `${center(mode)}\n`);
  parts.push(ALIGN_LEFT, FEED_CUT);
  return bytes(...parts);
}

export async function printReceiptUSB(order: Order, settings: RestaurantSettings | null): Promise<void> {
  await sendToUsbPrinter(buildReceiptBuffer(order, settings));
}

export async function printKitchenUSB(order: Order): Promise<void> {
  await sendToUsbPrinter(buildKitchenBuffer(order));
}

// ─── Gula Etiquetas — 60×40mm / 50×40mm TSPL + PNG fallback ──────────────────

export type EtiquetaSize = '60x40' | '50x40';

interface EtiquetaDimensions {
  widthMm: number;
  heightMm: number;
  widthPx: number;   // @300dpi for print-quality capture
  heightPx: number;
  padPx: number;     // 4.5mm safety margin in px @300dpi (≈53px)
}

function getEtiquetaDimensions(size: EtiquetaSize): EtiquetaDimensions {
  // 4.5mm @ 300dpi ≈ 53px
  const PAD = 53;
  if (size === '50x40') {
    return { widthMm: 50, heightMm: 40, widthPx: 591, heightPx: 472, padPx: PAD };
  }
  return { widthMm: 60, heightMm: 40, widthPx: 709, heightPx: 472, padPx: PAD };
}

/** Remove acentos/diacríticos para evitar caracteres estranhos na impressão TSPL */
function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Gera comandos TSPL para bobinas de 60×40mm ou 50×40mm com gap de 2mm */
function buildEtiquetaTSPL(opts: {
  estabelecimento: string;
  produto: string;
  colaborador: string;
  categoria: string;
  dataFabricacao: string;
  dataValidade: string;
  copies: number;
  size: EtiquetaSize;
  observacao?: string;
}): string {
  const est = stripAccents((opts.estabelecimento || 'ESTABELECIMENTO').toUpperCase());
  const prod = stripAccents((opts.produto || 'PRODUTO').toUpperCase());
  const colab = stripAccents((opts.colaborador || '—').toUpperCase());
  const fab = stripAccents(opts.dataFabricacao.toUpperCase());
  const val = stripAccents(opts.dataValidade.toUpperCase());
  const n = Math.max(1, opts.copies);

  const sizeCmd = opts.size === '50x40' ? 'SIZE 50 mm, 40 mm' : 'SIZE 60 mm, 40 mm';
  // Margem de segurança 7mm → ~56 dots @203dpi; largura útil varia conforme bobina
  const xMargin = 56; // 7mm in dots
  const rightLimit = opts.size === '50x40' ? 384 - 56 : 432 - 56; // usable width in dots

  return [
    sizeCmd,
    'GAP 2 mm, 0 mm',
    'DIRECTION 1',
    'CLS',
    '; --- MARGEM DE SEGURANCA 7mm (X = 56 dots) ---',
    '; 1. Cabecalho - Estabelecimento (Fonte 3)',
    `TEXT ${xMargin},25,"3",0,1,1,"${est}"`,
    `LINE ${xMargin},58,${rightLimit},58,2`,
    '; 2. Nome do Insumo (Fonte 3 com escala vertical dobrada)',
    `TEXT ${xMargin},70,"3",0,1,2,"${prod}"`,
    '; 3. Data e Hora de Fabricacao/Abertura',
    `TEXT ${xMargin},130,"2",0,1,1,"${opts.categoria === 'industrializado' ? 'ABERTO EM:' : 'FABRICADO:'} ${fab}"`,
    '; 4. Validade em 1 Linha (Fonte Destaque Gigante - Fonte 4)',
    `TEXT ${xMargin},165,"4",0,1,1,"VAL: ${val}"`,
    '; 5. Linha Separadora do Rodape',
    `LINE ${xMargin},225,${rightLimit},225,1`,
    '; 6. Responsavel pela Manipulacao (Fonte 3)',
    `TEXT ${xMargin},240,"3",0,1,1,"RESP: ${colab}"`,
    ...(opts.observacao ? [
      '; 7. Observacao (Fonte 2)',
      `TEXT ${xMargin},275,"2",0,1,1,"${stripAccents(opts.observacao.toUpperCase()).slice(0, 40)}`,
    ] : []),
    `PRINT ${n},1`,
  ].join('\r\n') + '\r\n';
}

function buildEtiquetaHtml(opts: {
  estabelecimento: string;
  produto: string;
  colaborador: string;
  categoria: string;
  dataFabricacao: string;
  dataValidade: string;
  size: EtiquetaSize;
  observacao?: string;
}): string {
  const dim = getEtiquetaDimensions(opts.size);
  const isSmall = opts.size === '50x40';
  const headerFs = isSmall ? '39px' : '46px';
  const produtoFs = isSmall ? '39px' : '46px';
  const fabFs = isSmall ? '30px' : '32px';
  const valFs = isSmall ? '36px' : '38px';
  const rodapeFs = isSmall ? '25px' : '28px';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: ${dim.widthPx}px;
    height: ${dim.heightPx}px;
    background: #ffffff;
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    color: #000000;
    -webkit-font-smoothing: none;
    -moz-osx-font-smoothing: unset;
    text-rendering: geometricPrecision;
  }
  #etiqueta {
    width: ${dim.widthPx}px;
    height: ${dim.heightPx}px;
    padding: ${dim.padPx}px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .etq-header {
    font-size: ${headerFs};
    font-weight: 700;
    line-height: 1.1;
    text-align: left;
    text-transform: uppercase;
    border-bottom: 3px solid #000;
    padding-bottom: 14px;
    margin-bottom: 18px;
    letter-spacing: -0.5px;
  }
  .etq-produto {
    font-size: ${produtoFs};
    font-weight: 700;
    line-height: 1.1;
    text-align: left;
    word-break: break-word;
    text-transform: uppercase;
    margin-bottom: 24px;
    letter-spacing: -0.5px;
  }
  .etq-fab {
    font-size: ${fabFs};
    font-weight: 700;
    line-height: 1.2;
    text-align: left;
    text-transform: uppercase;
    letter-spacing: -0.3px;
  }
  .etq-val {
    font-size: ${valFs};
    font-weight: 700;
    line-height: 1.2;
    text-align: left;
    text-transform: uppercase;
    margin-top: 6px;
    letter-spacing: -0.3px;
  }
  .etq-rodape {
    border-top: 2px solid #000;
    padding-top: 10px;
    margin-top: auto;
  }
  .etq-rodape-linha {
    font-size: ${rodapeFs};
    font-weight: 700;
    line-height: 1.2;
    text-align: left;
    text-transform: uppercase;
    letter-spacing: -0.2px;
  }
</style>
</head>
<body>
<div id="etiqueta">
  <div class="etq-header">${opts.estabelecimento || 'ESTABELECIMENTO'}</div>
  <div class="etq-produto">${opts.produto || 'PRODUTO'}</div>
  <div class="etq-fab">${opts.categoria === 'industrializado' ? 'ABERTO EM:' : 'FABRICADO:'} ${opts.dataFabricacao}</div>
  <div class="etq-val">VAL: ${opts.dataValidade}</div>
  <div class="etq-rodape">
    <div class="etq-rodape-linha">RESPONSAVEL: ${opts.colaborador || '—'}</div>
    ${opts.observacao ? `<div class="etq-rodape-linha" style="font-size:${rodapeFs};margin-top:4px;font-weight:400;text-transform:none;">${opts.observacao}</div>` : ''}
  </div>
</div>
</body>
</html>`;
}

async function captureEtiquetaImage(html: string, size: EtiquetaSize): Promise<string> {
  const dim = getEtiquetaDimensions(size);
  const iframe = document.createElement('iframe');
  iframe.style.cssText = `position:fixed;top:-9999px;left:-9999px;width:${dim.widthPx}px;height:${dim.heightPx}px;border:none;opacity:0;pointer-events:none;`;
  document.body.appendChild(iframe);

  await new Promise<void>(resolve => {
    iframe.onload = () => resolve();
    iframe.srcdoc = html;
  });

  const el = iframe.contentDocument!.getElementById('etiqueta')!;
  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    logging: false,
    width: dim.widthPx,
    height: dim.heightPx,
    windowWidth: dim.widthPx,
    windowHeight: dim.heightPx,
    onclone: (clonedDoc) => {
      const style = clonedDoc.createElement('style');
      style.innerHTML = `
        * {
          -webkit-font-smoothing: none !important;
          -moz-osx-font-smoothing: unset !important;
          text-rendering: geometricPrecision !important;
          color: #000000 !important;
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif !important;
        }
      `;
      clonedDoc.head.appendChild(style);
    },
  });

  document.body.removeChild(iframe);

  // ── Monochrome threshold: convert anti-aliased grayscale pixels to pure B/W ──
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const THRESHOLD = 128;
  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const bw = lum >= THRESHOLD ? 255 : 0;
    data[i] = bw;
    data[i + 1] = bw;
    data[i + 2] = bw;
    data[i + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);

  return canvas.toDataURL('image/png');
}

function openEtiquetaPrintWindow(dataUrl: string, copies: number, size: EtiquetaSize): void {
  const dim = getEtiquetaDimensions(size);
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:400px;height:300px;border:none;opacity:0;pointer-events:none;';
  document.body.appendChild(iframe);

  const imgs = Array.from({ length: copies }, () =>
    `<img class="etiqueta-print-img" src="${dataUrl}" />`,
  ).join('\n');
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: ${dim.widthMm}mm ${dim.heightMm}mm; margin: 0; }
  html, body {
    width: ${dim.widthMm}mm;
    height: ${dim.heightMm}mm;
    margin: 0 !important;
    padding: 0 !important;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  img.etiqueta-print-img {
    width: ${dim.widthMm}mm !important;
    height: ${dim.heightMm}mm !important;
    display: block !important;
    margin: 0 !important;
    padding: 0 !important;
    page-break-after: always;
    break-after: page;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
    filter: contrast(300%) grayscale(100%);
  }
  img.etiqueta-print-img:last-child {
    page-break-after: auto;
    break-after: auto;
  }
</style>
</head>
<body>
${imgs}
</body>
</html>`;

  iframe.onload = () => {
    const w = iframe.contentWindow!;
    const imgs = w.document.querySelectorAll('img');
    const pending = Array.from(imgs).filter(img => !img.complete);
    const doPrint = () => {
      w.focus();
      w.print();
    };
    w.addEventListener('afterprint', () => {
      if (iframe.parentNode) document.body.removeChild(iframe);
    }, { once: true });
    if (pending.length > 0) {
      let remaining = pending.length;
      const onImgDone = () => { remaining--; if (remaining === 0) doPrint(); };
      pending.forEach(img => { img.onload = onImgDone; img.onerror = onImgDone; });
    } else {
      doPrint();
    }
    setTimeout(() => { if (iframe.parentNode) document.body.removeChild(iframe); }, 60000);
  };

  iframe.srcdoc = html;
}

export async function printEtiqueta(opts: {
  estabelecimento: string;
  produto: string;
  colaborador: string;
  categoria: string;
  dataImpressao: string;
  dataVencimento: string;
  copies?: number;
  size?: EtiquetaSize;
  observacao?: string;
}): Promise<void> {
  const copies = Math.max(1, opts.copies ?? 1);
  const size: EtiquetaSize = opts.size ?? '60x40';

  // TSPL path: send raw commands to USB label printer when paired
  if (hasPairedPrinter()) {
    const tspl = buildEtiquetaTSPL({
      estabelecimento: opts.estabelecimento,
      produto: opts.produto,
      colaborador: opts.colaborador,
      categoria: opts.categoria,
      dataFabricacao: opts.dataImpressao,
      dataValidade: opts.dataVencimento,
      copies,
      size,
      observacao: opts.observacao,
    });
    await sendToUsbPrinter(encoder.encode(tspl));
    return;
  }

  // Fallback: HTML → PNG → browser print window
  const html = buildEtiquetaHtml({
    estabelecimento: opts.estabelecimento,
    produto: opts.produto,
    colaborador: opts.colaborador,
    categoria: opts.categoria,
    dataFabricacao: opts.dataImpressao,
    dataValidade: opts.dataVencimento,
    size,
    observacao: opts.observacao,
  });
  const dataUrl = await captureEtiquetaImage(html, size);
  openEtiquetaPrintWindow(dataUrl, copies, size);
}

function buildEtiquetaLivreHtml(opts: {
  texto: string;
  size: EtiquetaSize;
}): string {
  const dim = getEtiquetaDimensions(opts.size);
  const isSmall = opts.size === '50x40';
  const fs = isSmall ? '32px' : '38px';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: ${dim.widthPx}px;
    height: ${dim.heightPx}px;
    background: #ffffff;
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    color: #000000;
    -webkit-font-smoothing: none;
    -moz-osx-font-smoothing: unset;
    text-rendering: geometricPrecision;
  }
  #etiqueta {
    width: ${dim.widthPx}px;
    height: ${dim.heightPx}px;
    padding: ${dim.padPx}px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    overflow: hidden;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .etq-livre-texto {
    font-size: ${fs};
    font-weight: 700;
    line-height: 1.25;
    text-align: left;
    letter-spacing: -0.3px;
  }
</style>
</head>
<body>
<div id="etiqueta">
  <div class="etq-livre-texto">${opts.texto}</div>
</div>
</body>
</html>`;
}

export async function printEtiquetaLivre(opts: {
  texto: string;
  copies?: number;
  size?: EtiquetaSize;
}): Promise<void> {
  const copies = Math.max(1, opts.copies ?? 1);
  const size: EtiquetaSize = opts.size ?? '60x40';

  if (hasPairedPrinter()) {
    const lines = opts.texto.split('\n').map(l => stripAccents(l.toUpperCase()).slice(0, 40));
    const sizeCmd = size === '50x40' ? 'SIZE 50 mm, 40 mm' : 'SIZE 60 mm, 40 mm';
    const xMargin = 56;
    const parts: string[] = [sizeCmd, 'GAP 2 mm, 0 mm', 'DIRECTION 1', 'CLS'];
    let y = 25;
    for (const line of lines) {
      parts.push(`TEXT ${xMargin},${y},"2",0,1,1,"${line}"`);
      y += 35;
      if (y > 240) break;
    }
    parts.push(`PRINT ${copies},1`);
    await sendToUsbPrinter(encoder.encode(parts.join('\r\n') + '\r\n'));
    return;
  }

  const html = buildEtiquetaLivreHtml({ texto: opts.texto, size });
  const dataUrl = await captureEtiquetaImage(html, size);
  openEtiquetaPrintWindow(dataUrl, copies, size);
}
