/**
 * POS-80 Thermal Receipt & Watermarked Invoice Generator
 * Formats itemized receipts with SaniT3ch company header, micro-timestamps, payment method details,
 * tendered amount, change given, tax breakdowns, official Mobile Money agent accounts,
 * and high-resolution semi-transparent logo watermark behind every receipt & invoice.
 */

import { SANIT3CH_BRAND, SANIT3CH_LOGO_BASE64 } from './sanit3ch-brand';

export interface ReceiptLineItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface ReceiptData {
  receiptId: string;
  companyName: string;
  branchName: string;
  cashierName: string;
  cashierId: string;
  timestamp: string; // ISO micro-timestamp
  items: ReceiptLineItem[];
  subtotal: number;
  taxAmount: number;
  total: number;
  paymentMethod:
    'cash' | 'mtn_momo' | 'airtel_money' | 'zamtel_money' | 'credit' | 'bank';
  amountTendered: number;
  changeGiven: number;
  momoReference?: string;
  creditCustomerName?: string;
  creditCustomerPhone?: string;
  currencySymbol?: string;
  footerNote?: string;
}

const LINE_WIDTH = 42; // Standard 80mm printer character width in Font A

function padLine(left: string, right: string, width = LINE_WIDTH): string {
  const space = Math.max(1, width - left.length - right.length);
  return left + ' '.repeat(space) + right;
}

function centerText(text: string, width = LINE_WIDTH): string {
  if (text.length >= width) return text.slice(0, width);
  const leftPad = Math.floor((width - text.length) / 2);
  return ' '.repeat(leftPad) + text;
}

function divider(char = '-', width = LINE_WIDTH): string {
  return char.repeat(width);
}

/**
 * Generates monospace ASCII receipt formatted for POS-80 thermal print heads.
 */
export function formatPos80ThermalReceipt(data: ReceiptData): string {
  const sym = data.currencySymbol || 'K';
  const lines: string[] = [];

  // Header
  const title = (data.companyName || SANIT3CH_BRAND.name).toUpperCase();
  lines.push(centerText(title));
  lines.push(centerText(SANIT3CH_BRAND.tagline));
  lines.push(centerText(data.branchName || 'Main Retail Branch'));
  lines.push(centerText('Tel: ' + SANIT3CH_BRAND.phonePrimary + ' / ' + SANIT3CH_BRAND.phoneSecondary));
  lines.push(centerText('*** RETAIL & SERVICES POS ***'));
  lines.push(divider('='));

  // Micro-timestamp & Cashier
  const dateObj = new Date(data.timestamp);
  const formattedDate =
    dateObj.toLocaleDateString('en-GB') +
    ' ' +
    dateObj.toLocaleTimeString('en-GB', { hour12: false }) +
    '.' +
    String(dateObj.getMilliseconds()).padStart(3, '0');

  lines.push(padLine('Receipt #:', data.receiptId.slice(0, 14).toUpperCase()));
  lines.push(padLine('Date & Time:', formattedDate));
  lines.push(
    padLine('Cashier:', `${data.cashierName} (#${data.cashierId.slice(0, 6)})`),
  );
  lines.push(divider('-'));

  // Table header
  lines.push(padLine('ITEM / QTY', 'AMOUNT'));
  lines.push(divider('-'));

  // Itemized lines
  for (const item of data.items) {
    const qtyPrice = `${item.quantity} x ${sym}${item.unitPrice.toFixed(2)}`;
    lines.push(item.name.slice(0, LINE_WIDTH));
    lines.push(padLine(`  ${qtyPrice}`, `${sym}${item.subtotal.toFixed(2)}`));
  }
  lines.push(divider('-'));

  // Financial totals
  lines.push(padLine('SUBTOTAL:', `${sym}${data.subtotal.toFixed(2)}`));
  if (data.taxAmount > 0) {
    lines.push(
      padLine('VAT (16% Incl.):', `${sym}${data.taxAmount.toFixed(2)}`),
    );
  } else {
    lines.push(padLine('TAX (Zero-Rated/Exempt):', `${sym}0.00`));
  }
  lines.push(divider('='));
  lines.push(padLine('TOTAL DUE:', `${sym}${data.total.toFixed(2)}`));
  lines.push(divider('='));

  // Payment Breakdown
  const methodLabel =
    data.paymentMethod === 'cash'
      ? 'CASH PAYMENT'
      : data.paymentMethod === 'mtn_momo'
        ? 'MTN MOBILE MONEY'
        : data.paymentMethod === 'airtel_money'
          ? 'AIRTEL MONEY'
          : data.paymentMethod === 'zamtel_money'
            ? 'ZAMTEL MONEY'
            : data.paymentMethod === 'credit'
              ? 'ON CREDIT / DEBT'
              : 'BANK TRANSFER';

  lines.push(padLine('PAYMENT METHOD:', methodLabel));

  if (data.paymentMethod === 'mtn_momo') {
    lines.push(padLine('MTN Agent MoMo:', '0768990586 (NICHOLAS)'));
  } else if (data.paymentMethod === 'airtel_money') {
    lines.push(padLine('Airtel Code:', '20051880 (MAKELO W.)'));
  }

  if (data.momoReference) {
    lines.push(padLine('MoMo Ref ID:', data.momoReference));
  }

  if (data.paymentMethod === 'credit') {
    lines.push(
      padLine('Customer Name:', data.creditCustomerName || 'Unspecified'),
    );
    lines.push(padLine('Customer Phone:', data.creditCustomerPhone || 'N/A'));
    lines.push(
      padLine(
        'Debt Balance:',
        `${sym}${Math.max(0, data.total - data.amountTendered).toFixed(2)}`,
      ),
    );
  }

  if (data.paymentMethod === 'cash') {
    lines.push(
      padLine('TENDERED AMOUNT:', `${sym}${data.amountTendered.toFixed(2)}`),
    );
    lines.push(
      padLine('CHANGE RETURNED:', `${sym}${data.changeGiven.toFixed(2)}`),
    );
  }

  lines.push(divider('-'));
  lines.push(centerText(data.footerNote || 'Thank you for your business!'));
  lines.push(centerText('Goods once sold are not returnable.'));
  lines.push(centerText('MoMo: MTN 0768990586 | Airtel 20051880'));
  lines.push(centerText('WhatsApp: 0767825250'));
  lines.push(centerText('Powered by SaNi Tech Sunga Manager'));
  lines.push(divider('='));
  lines.push(''); // Feed lines
  lines.push('');

  return lines.join('\n');
}

/**
 * Generates self-contained print-friendly HTML for web or wireless thermal print spooling,
 * with SaniT3ch official branding and semi-transparent logo watermark behind the receipt.
 */
export function generateThermalReceiptHtml(data: ReceiptData): string {
  const text = formatPos80ThermalReceipt(data);
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Receipt ${data.receiptId} - SaniT3ch</title>
  <style>
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      margin: 0;
      padding: 10px;
      font-family: 'Courier New', Courier, monospace;
      font-size: 13px;
      line-height: 1.35;
      color: #000;
      background: #fff;
    }
    .receipt-container {
      width: 78mm;
      max-width: 100%;
      margin: 0 auto;
      position: relative;
      overflow: hidden;
    }
    .receipt-watermark {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 70%;
      opacity: 0.09;
      pointer-events: none;
      z-index: 0;
    }
    .receipt-header-logo {
      display: block;
      width: 140px;
      height: auto;
      margin: 4px auto 8px auto;
    }
    .receipt-content {
      position: relative;
      z-index: 1;
      white-space: pre-wrap;
      word-break: break-all;
    }
    @media print {
      body { padding: 0; }
      .receipt-container { width: 100%; }
      @page { margin: 0; size: 80mm auto; }
    }
  </style>
</head>
<body>
  <div class="receipt-container">
    <img src="${SANIT3CH_LOGO_BASE64}" class="receipt-header-logo" alt="SaniT3ch" />
    <img src="${SANIT3CH_LOGO_BASE64}" class="receipt-watermark" alt="Watermark" />
    <div class="receipt-content">${text}</div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generates an official watermarked standard A4/A5 Invoice Document.
 */
export function generateDetailedInvoiceHtml(data: ReceiptData): string {
  const sym = data.currencySymbol || 'K';
  const rows = data.items
    .map(
      (item, idx) => `
    <tr>
      <td style="text-align: center; padding: 10px 8px; border-bottom: 1px solid #E2E8F0;">${idx + 1}</td>
      <td style="padding: 10px 8px; border-bottom: 1px solid #E2E8F0; font-weight: 600;">${escapeHtml(item.name)}</td>
      <td style="text-align: center; padding: 10px 8px; border-bottom: 1px solid #E2E8F0;">${item.quantity}</td>
      <td style="text-align: right; padding: 10px 8px; border-bottom: 1px solid #E2E8F0;">${sym}${item.unitPrice.toFixed(2)}</td>
      <td style="text-align: right; padding: 10px 8px; border-bottom: 1px solid #E2E8F0; font-weight: 700;">${sym}${item.subtotal.toFixed(2)}</td>
    </tr>
  `,
    )
    .join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Invoice ${data.receiptId} - SaniT3ch</title>
  <style>
    @page { size: A4; margin: 15mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 24px;
      color: #0F172A;
      background: #FFFFFF;
      position: relative;
    }
    .watermark-container {
      position: relative;
      min-height: 900px;
    }
    .watermark-bg {
      position: absolute;
      top: 40%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 460px;
      opacity: 0.08;
      pointer-events: none;
      z-index: 0;
    }
    .content {
      position: relative;
      z-index: 1;
    }
    .header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    .header-logo {
      height: 64px;
      object-fit: contain;
    }
    .title-banner {
      background: #0F172A;
      color: #FFFFFF;
      padding: 8px 16px;
      border-radius: 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    .meta-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
      font-size: 12px;
    }
    .meta-cell {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 6px;
      padding: 12px 14px;
      width: 50%;
      vertical-align: top;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      margin-bottom: 20px;
    }
    .items-table th {
      background: #F1F5F9;
      color: #334155;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 11px;
      padding: 10px 8px;
      border-top: 1px solid #CBD5E1;
      border-bottom: 2px solid #94A3B8;
    }
    .totals-box {
      float: right;
      width: 320px;
      font-size: 13px;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    .totals-box td { padding: 6px 10px; }
    .momo-box {
      border: 1px solid #CBD5E1;
      border-radius: 6px;
      padding: 12px;
      background: #F8FAFC;
      margin-top: 20px;
      font-size: 11px;
    }
  </style>
</head>
<body>
  <div class="watermark-container">
    <img src="${SANIT3CH_LOGO_BASE64}" class="watermark-bg" alt="Watermark" />
    <div class="content">
      <table class="header-table">
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 12px;">
              <img src="${SANIT3CH_LOGO_BASE64}" class="header-logo" alt="Logo" />
              <div>
                <h1 style="margin: 0; font-size: 22px; color: #0284C7; font-weight: 800;">SaniT3ch</h1>
                <div style="font-size: 11px; color: #64748B; font-weight: 600; text-transform: uppercase;">Powering the Digital Pulse</div>
                <div style="font-size: 11px; color: #0284C7;">Printing Services & Tech Solutions</div>
              </div>
            </div>
          </td>
          <td style="text-align: right; font-size: 11px; color: #475569;">
            <div><strong>Kitwe, Zambia</strong></div>
            <div>Email: ${escapeHtml(SANIT3CH_BRAND.email)}</div>
            <div>Phone: ${escapeHtml(SANIT3CH_BRAND.phonePrimary)} / ${escapeHtml(SANIT3CH_BRAND.phoneSecondary)}</div>
            <div>WhatsApp: ${escapeHtml(SANIT3CH_BRAND.whatsappNumber)}</div>
          </td>
        </tr>
      </table>

      <div class="title-banner">
        <span style="font-size: 14px; font-weight: 800; letter-spacing: 1px;">TAX INVOICE / RECEIPT</span>
        <span style="font-size: 12px; font-weight: 600;">INV-${escapeHtml(data.receiptId.slice(0, 12).toUpperCase())}</span>
      </div>

      <table class="meta-table">
        <tr>
          <td class="meta-cell">
            <div style="font-size: 10px; font-weight: 700; color: #64748B; text-transform: uppercase;">Billed To / Cashier</div>
            <div style="font-weight: 700; font-size: 13px; margin: 4px 0 2px 0;">Cashier: ${escapeHtml(data.cashierName)}</div>
            <div>Branch: ${escapeHtml(data.branchName || 'Main Store')}</div>
            ${data.creditCustomerName ? `<div>Customer: <strong>${escapeHtml(data.creditCustomerName)}</strong> (${escapeHtml(data.creditCustomerPhone || '')})</div>` : ''}
          </td>
          <td style="width: 14px;"></td>
          <td class="meta-cell">
            <div style="font-size: 10px; font-weight: 700; color: #64748B; text-transform: uppercase;">Transaction Details</div>
            <div style="display: flex; justify-content: space-between; margin-top: 4px;">
              <span style="color: #64748B;">Date & Time:</span>
              <strong>${escapeHtml(new Date(data.timestamp).toLocaleString('en-GB'))}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 2px;">
              <span style="color: #64748B;">Payment Mode:</span>
              <strong style="text-transform: uppercase; color: #0284C7;">${data.paymentMethod.replace('_', ' ')}</strong>
            </div>
            ${data.momoReference ? `<div style="display: flex; justify-content: space-between; margin-top: 2px;"><span style="color: #64748B;">MoMo Ref:</span><strong>${escapeHtml(data.momoReference)}</strong></div>` : ''}
          </td>
        </tr>
      </table>

      <table class="items-table">
        <thead>
          <tr>
            <th style="width: 6%;">#</th>
            <th style="text-align: left; width: 52%;">Description</th>
            <th style="width: 12%;">Qty</th>
            <th style="text-align: right; width: 15%;">Unit Price</th>
            <th style="text-align: right; width: 15%;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <div style="overflow: hidden;">
        <table class="totals-box">
          <tr>
            <td style="text-align: right; color: #64748B;">Subtotal:</td>
            <td style="text-align: right; font-weight: 600;">${sym}${data.subtotal.toFixed(2)}</td>
          </tr>
          ${data.taxAmount > 0 ? `
          <tr>
            <td style="text-align: right; color: #64748B;">VAT (16%):</td>
            <td style="text-align: right; font-weight: 600;">${sym}${data.taxAmount.toFixed(2)}</td>
          </tr>
          ` : ''}
          <tr style="background: #F0FDF4; border-top: 2px solid #16A34A; border-bottom: 2px solid #16A34A; font-weight: 800; font-size: 15px; color: #15803D;">
            <td style="text-align: right; padding: 10px;">TOTAL:</td>
            <td style="text-align: right; padding: 10px;">${sym}${data.total.toFixed(2)}</td>
          </tr>
        </table>
      </div>

      <div class="momo-box">
        <strong>Official Mobile Money Accounts:</strong>
        <div style="margin-top: 4px; display: flex; gap: 20px;">
          <div>&bull; <strong>MTN MoMo:</strong> 0768990586 (Nicholas Ntambila)</div>
          <div>&bull; <strong>Airtel Money:</strong> 20051880 (Makelo Wezzy)</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
