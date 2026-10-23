import { describe, expect, it } from 'vitest';
import {
  calculateQuotationTotals,
  generateOfficialQuotationHtml,
  generateQuotationNumber,
  QuotationData,
  SANIT3CH_BRAND,
} from '../apps/mobile/lib/sanit3ch-brand';

describe('SaniT3ch Official Quotation Engine', () => {
  it('calculates 50% deposit and 50% balance accurately', () => {
    const items = [
      { quantity: 20, unitPrice: 35.0 }, // 700
      { quantity: 10, unitPrice: 25.0 }, // 250
      { quantity: 25, unitPrice: 20.0 }, // 500
    ];
    // Subtotal = 1450, 10% discount = 145 -> Grand Total = 1305
    const totals = calculateQuotationTotals(items, 10);

    expect(totals.subtotal).toBe(1450);
    expect(totals.discountAmount).toBe(145);
    expect(totals.grandTotal).toBe(1305);
    expect(totals.depositRequired).toBe(652.5);
    expect(totals.balanceDue).toBe(652.5);
  });

  it('generates an official quotation HTML with watermark and MoMo details', () => {
    const quotation: QuotationData = {
      id: 'qt-test-1',
      quotationNumber: 'ST-QT-202610-9999',
      date: '2026-10-23',
      validUntil: '2026-11-06',
      preparedBy: 'Nicholas Ntambila',
      client: {
        clientName: 'Copperbelt Logistics Ltd',
        phone: '0977123456',
      },
      items: [
        {
          id: '1',
          description: 'A4 Wall Stickers Adhesive (Bulk)',
          quantity: 20,
          unitPrice: 35.0,
          total: 700.0,
        },
      ],
      subtotal: 700.0,
      discountPercentage: 0,
      discountAmount: 0,
      grandTotal: 700.0,
      depositRequired: 350.0,
      balanceDue: 350.0,
      status: 'draft',
      createdAt: new Date().toISOString(),
    };

    const html = generateOfficialQuotationHtml(quotation);

    expect(html).toContain('SaniT3ch');
    expect(html).toContain('Powering the Digital Pulse');
    expect(html).toContain('ST-QT-202610-9999');
    expect(html).toContain('Copperbelt Logistics Ltd');
    expect(html).toContain('watermark-bg');
    expect(html).toContain('AIRTEL MONEY');
    expect(html).toContain('20051880');
    expect(html).toContain('MAKELO WEZZY');
    expect(html).toContain('MTN MOBILE MONEY');
    expect(html).toContain('0768990586');
    expect(html).toContain('NICHOLAS NTAMBILA');
    expect(html).toContain('0767825250');
    expect(html).toContain('Nicholas Ntambila');
    expect(html).toContain('C.E.O — SaniT3ch');
  });

  it('generates valid quotation format numbers', () => {
    const qtNum = generateQuotationNumber();
    expect(qtNum).toMatch(/^ST-QT-\d{6}-\d{4}$/);
  });
});

