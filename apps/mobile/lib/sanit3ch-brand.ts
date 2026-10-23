import { SANIT3CH_LOGO_BASE64 } from './brand-logo-data';

export { SANIT3CH_LOGO_BASE64 };

export interface MoMoAgentAccount {
  provider: 'mtn' | 'airtel' | 'zamtel';
  providerName: string;
  accountNumber: string;
  accountName: string;
  type: 'agent' | 'merchant' | 'personal';
  badgeColor: string;
}

export const SANIT3CH_BRAND = {
  name: 'SaniT3ch',
  legalName: 'Nicholas Ntambila Retail & Services',
  tagline: 'Powering the Digital Pulse',
  subtitle: 'Printing Services and Tech Solutions',
  location: 'Kitwe, Zambia',
  email: 'sanit3ch@gmail.com',
  phones: ['0772348850', '0767825250'],
  phonePrimary: '0772348850',
  phoneSecondary: '0767825250',
  whatsappNumber: '0767825250',
  ceoName: 'Nicholas Ntambila',
  ceoTitle: 'C.E.O — SaniT3ch',
  momoAccounts: [
    {
      provider: 'mtn',
      providerName: 'MTN Mobile Money',
      accountNumber: '0768990586',
      accountName: 'NICHOLAS NTAMBILA',
      type: 'agent',
      badgeColor: '#EAB308', // MTN Yellow
    },
    {
      provider: 'airtel',
      providerName: 'Airtel Money',
      accountNumber: '20051880',
      accountName: 'MAKELO WEZZY',
      type: 'agent',
      badgeColor: '#EF4444', // Airtel Red
    },
  ] as MoMoAgentAccount[],
};

export interface QuotationItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface QuotationClient {
  clientName: string;
  contactPerson?: string;
  phone: string;
  email?: string;
  address?: string;
}

export interface QuotationData {
  id: string;
  quotationNumber: string;
  date: string;
  validUntil: string;
  preparedBy: string;
  client: QuotationClient;
  items: QuotationItem[];
  subtotal: number;
  discountPercentage: number;
  discountAmount: number;
  grandTotal: number;
  depositRequired: number; // 50%
  balanceDue: number; // 50%
  status: 'draft' | 'sent' | 'accepted' | 'converted' | 'cancelled';
  notes?: string;
  createdAt: string;
  convertedReceiptId?: string;
}

/**
 * Calculates quotation financial breakdown.
 */
export function calculateQuotationTotals(
  items: Array<{ quantity: number; unitPrice: number }>,
  discountPercentage = 0,
): {
  subtotal: number;
  discountAmount: number;
  grandTotal: number;
  depositRequired: number;
  balanceDue: number;
} {
  const subtotal = items.reduce((acc, it) => acc + (it.quantity || 0) * (it.unitPrice || 0), 0);
  const discountRate = Math.max(0, Math.min(100, discountPercentage)) / 100;
  const discountAmount = Math.round(subtotal * discountRate * 100) / 100;
  const grandTotal = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);
  const depositRequired = Math.round((grandTotal / 2) * 100) / 100;
  const balanceDue = Math.round((grandTotal - depositRequired) * 100) / 100;

  return {
    subtotal,
    discountAmount,
    grandTotal,
    depositRequired,
    balanceDue,
  };
}

/**
 * Generates an official SaniT3ch quotation number.
 * Format: ST-QT-YYYYMM-XXXX
 */
export function generateQuotationNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `ST-QT-${year}${month}-${rand}`;
}

/**
 * Generates a full HTML document for printing or PDF export of the Quotation,
 * with SaniT3ch logo watermark, exact pre-printed table, deposit calculation,
 * Mobile money agent boxes, WhatsApp payment instructions, and CEO signature block.
 */
export function generateOfficialQuotationHtml(data: QuotationData): string {
  const rows = data.items
    .map(
      (item, idx) => `
    <tr>
      <td style="text-align: center; font-weight: bold; padding: 10px 8px; border-bottom: 1px solid #E2E8F0;">${idx + 1}</td>
      <td style="padding: 10px 8px; border-bottom: 1px solid #E2E8F0;">
        <div style="font-weight: 600; color: #0F172A;">${escapeHtml(item.description)}</div>
      </td>
      <td style="text-align: center; padding: 10px 8px; border-bottom: 1px solid #E2E8F0;">${item.quantity}</td>
      <td style="text-align: right; padding: 10px 8px; border-bottom: 1px solid #E2E8F0;">K${item.unitPrice.toFixed(2)}</td>
      <td style="text-align: right; font-weight: 600; padding: 10px 8px; border-bottom: 1px solid #E2E8F0;">K${item.total.toFixed(2)}</td>
    </tr>
  `,
    )
    .join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Quotation ${data.quotationNumber} - SaniT3ch</title>
  <style>
    @page {
      size: A4;
      margin: 15mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
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
      min-height: 1000px;
    }
    .watermark-bg {
      position: absolute;
      top: 35%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 480px;
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
      height: 70px;
      object-fit: contain;
    }
    .company-title {
      font-size: 24px;
      font-weight: 800;
      color: #0284C7;
      letter-spacing: -0.5px;
      margin: 0;
    }
    .company-subtitle {
      font-size: 11px;
      font-weight: 600;
      color: #64748B;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-top: 2px;
    }
    .company-contact {
      font-size: 11px;
      color: #475569;
      line-height: 1.5;
    }
    .quotation-title-bar {
      background: #0284C7;
      color: white;
      padding: 8px 16px;
      border-radius: 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 18px;
    }
    .meta-box {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
      font-size: 12px;
    }
    .meta-card {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 6px;
      padding: 12px 14px;
      vertical-align: top;
      width: 50%;
    }
    .meta-label {
      font-size: 10px;
      font-weight: 700;
      color: #64748B;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .meta-value-bold {
      font-size: 13px;
      font-weight: 700;
      color: #0F172A;
      margin-bottom: 2px;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      margin-bottom: 16px;
    }
    .items-table th {
      background: #F1F5F9;
      color: #334155;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.5px;
      padding: 10px 8px;
      border-top: 1px solid #CBD5E1;
      border-bottom: 2px solid #94A3B8;
    }
    .totals-layout {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    .totals-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    .totals-table td {
      padding: 6px 12px;
    }
    .totals-grand {
      background: #F0FDF4;
      border-top: 2px solid #16A34A;
      border-bottom: 2px solid #16A34A;
      font-size: 15px;
      font-weight: 800;
      color: #15803D;
    }
    .deposit-pill {
      background: #FEF3C7;
      border: 1px dashed #D97706;
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 11px;
      color: #92400E;
      font-weight: 600;
      margin-top: 6px;
    }
    .terms-box {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 8px;
      padding: 14px 16px;
      margin-bottom: 24px;
    }
    .terms-title {
      font-size: 11px;
      font-weight: 800;
      color: #0F172A;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    .terms-list {
      margin: 0;
      padding-left: 18px;
      font-size: 11px;
      color: #334155;
      line-height: 1.6;
    }
    .momo-grid {
      display: flex;
      gap: 12px;
      margin-top: 10px;
    }
    .momo-box {
      flex: 1;
      border: 1px solid #CBD5E1;
      border-radius: 6px;
      padding: 8px 12px;
      background: #FFFFFF;
      font-size: 11px;
    }
    .signature-area {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 30px;
      padding-top: 16px;
      border-top: 1px solid #E2E8F0;
    }
    .signature-block {
      text-align: right;
    }
    .signature-line {
      width: 200px;
      border-bottom: 1.5px solid #0F172A;
      margin-bottom: 6px;
      margin-left: auto;
    }
  </style>
</head>
<body>
  <div class="watermark-container">
    <img src="${SANIT3CH_LOGO_BASE64}" class="watermark-bg" alt="SaniT3ch Watermark" />
    
    <div class="content">
      <!-- Header -->
      <table class="header-table">
        <tr>
          <td style="vertical-align: middle; width: 65%;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <img src="${SANIT3CH_LOGO_BASE64}" class="header-logo" alt="SaniT3ch Logo" />
              <div>
                <h1 class="company-title">SaniT3ch</h1>
                <div class="company-subtitle">Powering the Digital Pulse</div>
                <div style="font-size: 12px; color: #0284C7; font-weight: 600; margin-top: 2px;">Printing Services and Tech Solutions</div>
              </div>
            </div>
          </td>
          <td style="vertical-align: middle; text-align: right; width: 35%;" class="company-contact">
            <div><strong>Kitwe, Zambia</strong></div>
            <div>Email: ${escapeHtml(SANIT3CH_BRAND.email)}</div>
            <div>Phone: ${escapeHtml(SANIT3CH_BRAND.phonePrimary)} / ${escapeHtml(SANIT3CH_BRAND.phoneSecondary)}</div>
            <div>WhatsApp: ${escapeHtml(SANIT3CH_BRAND.whatsappNumber)}</div>
          </td>
        </tr>
      </table>

      <!-- Title Bar -->
      <div class="quotation-title-bar">
        <span style="font-size: 15px; font-weight: 800; letter-spacing: 1px;">OFFICIAL QUOTATION</span>
        <span style="font-size: 13px; font-weight: 600;"># ${escapeHtml(data.quotationNumber)}</span>
      </div>

      <!-- Meta Card -->
      <table class="meta-box">
        <tr>
          <td class="meta-card" style="padding-right: 12px;">
            <div class="meta-label">Quoted To:</div>
            <div class="meta-value-bold">${escapeHtml(data.client.clientName || 'Valued Client')}</div>
            ${data.client.contactPerson ? `<div>Attn: ${escapeHtml(data.client.contactPerson)}</div>` : ''}
            <div>Phone: <strong>${escapeHtml(data.client.phone || 'N/A')}</strong></div>
            ${data.client.email ? `<div>Email: ${escapeHtml(data.client.email)}</div>` : ''}
            ${data.client.address ? `<div>Address: ${escapeHtml(data.client.address)}</div>` : ''}
          </td>
          <td style="width: 16px;"></td>
          <td class="meta-card" style="padding-left: 12px;">
            <div class="meta-label">Quotation Details:</div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
              <span style="color: #64748B;">Date Issued:</span>
              <strong>${escapeHtml(data.date)}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
              <span style="color: #64748B;">Valid Until:</span>
              <strong style="color: #0284C7;">${escapeHtml(data.validUntil)} (14 Days)</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #64748B;">Prepared By:</span>
              <strong>${escapeHtml(data.preparedBy || SANIT3CH_BRAND.ceoName)}</strong>
            </div>
          </td>
        </tr>
      </table>

      <!-- Item Table -->
      <table class="items-table">
        <thead>
          <tr>
            <th style="width: 6%;">#</th>
            <th style="text-align: left; width: 50%;">Description / Service</th>
            <th style="width: 12%;">Qty</th>
            <th style="text-align: right; width: 16%;">Unit Price</th>
            <th style="text-align: right; width: 16%;">Total (ZMW)</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <!-- Totals & Deposit Section -->
      <table class="totals-layout">
        <tr>
          <td style="vertical-align: top; width: 55%; padding-right: 20px;">
            <div class="deposit-pill">
              <strong>PAYMENT TERMS:</strong> 50% Deposit required before commencement.<br>
              <strong>Deposit Due (50%):</strong> K${data.depositRequired.toFixed(2)} &bull;
              <strong>Balance on Delivery (50%):</strong> K${data.balanceDue.toFixed(2)}
            </div>
          </td>
          <td style="vertical-align: top; width: 45%;">
            <table class="totals-table">
              <tr>
                <td style="text-align: right; color: #64748B;">Subtotal:</td>
                <td style="text-align: right; font-weight: 600;">K${data.subtotal.toFixed(2)}</td>
              </tr>
              ${
                data.discountAmount > 0
                  ? `
              <tr>
                <td style="text-align: right; color: #D97706;">Discount (${data.discountPercentage}%):</td>
                <td style="text-align: right; font-weight: 600; color: #D97706;">-K${data.discountAmount.toFixed(2)}</td>
              </tr>
              `
                  : ''
              }
              <tr class="totals-grand">
                <td style="text-align: right; padding: 10px 12px;">GRAND TOTAL:</td>
                <td style="text-align: right; padding: 10px 12px;">K${data.grandTotal.toFixed(2)}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- Terms & Conditions Box with Mobile Money -->
      <div class="terms-box">
        <div class="terms-title">TERMS & CONDITIONS</div>
        <ol class="terms-list">
          <li>This quotation is valid for <strong>14 days</strong> from the date of issue.</li>
          <li>A <strong>50% deposit</strong> is required before work commences; balance due upon delivery.</li>
          <li>Payments to be made via Mobile Money:</li>
        </ol>
        <div class="momo-grid">
          <div class="momo-box" style="border-left: 4px solid #EF4444;">
            <div style="font-weight: 800; color: #B91C1C;">AIRTEL MONEY</div>
            <div style="font-size: 13px; font-weight: 700; color: #0F172A; margin: 2px 0;">Code: 20051880</div>
            <div style="color: #64748B;">Name: MAKELO WEZZY</div>
          </div>
          <div class="momo-box" style="border-left: 4px solid #EAB308;">
            <div style="font-weight: 800; color: #B45309;">MTN MOBILE MONEY</div>
            <div style="font-size: 13px; font-weight: 700; color: #0F172A; margin: 2px 0;">Number: 0768990586</div>
            <div style="color: #64748B;">Name: NICHOLAS NTAMBILA</div>
          </div>
        </div>
        <div style="margin-top: 10px; font-size: 11px; color: #0284C7; font-weight: 600;">
          &#128242; Proof of payment should be sent via WhatsApp to: <strong>0767825250</strong>
        </div>
      </div>

      <!-- Signature Area -->
      <div class="signature-area">
        <div style="font-size: 11px; color: #64748B;">
          Thank you for choosing SaniT3ch!<br>
          <i>Quality Printing &bull; Trusted Tech Solutions</i>
        </div>
        <div class="signature-block">
          <div class="signature-line"></div>
          <div style="font-size: 12px; font-weight: 800; color: #0F172A;">${escapeHtml(SANIT3CH_BRAND.ceoName)}</div>
          <div style="font-size: 10px; font-weight: 600; color: #64748B; text-transform: uppercase;">${escapeHtml(SANIT3CH_BRAND.ceoTitle)}</div>
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

