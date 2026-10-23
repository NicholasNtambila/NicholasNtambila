import { describe, expect, it } from 'vitest';
import {
  DEFAULT_UNIFIED_CATALOG,
  calculateChange,
} from '../apps/mobile/lib/pos-math';
import {
  formatPos80ThermalReceipt,
  ReceiptData,
} from '../apps/mobile/lib/pos-receipt';

describe('POS-80 Thermal Receipt Formatting', () => {
  it('formats itemized receipt with headers, micro-timestamps, and totals', () => {
    const sampleReceipt: ReceiptData = {
      receiptId: 'REC-TEST-1234',
      companyName: 'Nicholas Ntambila Retail & Wholesale',
      branchName: 'Main Retail Branch',
      cashierName: 'Nicholas Ntambila',
      cashierId: 'usr-9c8fae75',
      timestamp: '2026-10-22T14:30:15.123Z',
      items: [
        {
          id: 'prod-pen-biro-blue',
          name: 'Biro Ballpoint Pen (Blue)',
          quantity: 2,
          unitPrice: 3.0,
          subtotal: 6.0,
        },
        {
          id: 'srv-photocopy-bw-single',
          name: 'Photocopying (B/W Single)',
          quantity: 10,
          unitPrice: 1.0,
          subtotal: 10.0,
        },
      ],
      subtotal: 16.0,
      taxAmount: 2.56,
      total: 16.0,
      paymentMethod: 'cash',
      amountTendered: 20.0,
      changeGiven: 4.0,
      currencySymbol: 'K',
    };

    const text = formatPos80ThermalReceipt(sampleReceipt);

    expect(text).toContain('NICHOLAS NTAMBILA RETAIL & WHOLESALE');
    expect(text).toContain('Main Retail Branch');
    expect(text).toContain('REC-TEST-1234');
    expect(text).toContain('Nicholas Ntambila');
    expect(text).toContain('Biro Ballpoint Pen (Blue)');
    expect(text).toContain('2 x K3.00');
    expect(text).toContain('TOTAL DUE:');
    expect(text).toContain('K16.00');
    expect(text).toContain('CASH PAYMENT');
    expect(text).toContain('TENDERED AMOUNT:');
    expect(text).toContain('K20.00');
    expect(text).toContain('CHANGE RETURNED:');
    expect(text).toContain('K4.00');
    expect(text).toContain('VAT (16% Incl.):');
  });

  it('formats Mobile Money receipt with reference ID', () => {
    const sampleMoMoReceipt: ReceiptData = {
      receiptId: 'REC-MOMO-5678',
      companyName: 'Nicholas Ntambila Retail & Wholesale',
      branchName: 'Main Branch',
      cashierName: 'Nicholas Ntambila',
      cashierId: 'usr-9c8fae75',
      timestamp: '2026-10-22T14:35:00.000Z',
      items: [
        {
          id: 'prod-paper-a4-ream',
          name: 'A4 Plain Paper (Full Ream)',
          quantity: 1,
          unitPrice: 95.0,
          subtotal: 95.0,
        },
      ],
      subtotal: 95.0,
      taxAmount: 0,
      total: 95.0,
      paymentMethod: 'mtn_momo',
      amountTendered: 95.0,
      changeGiven: 0,
      momoReference: 'MP261022.9876.H12345',
      currencySymbol: 'K',
    };

    const text = formatPos80ThermalReceipt(sampleMoMoReceipt);

    expect(text).toContain('MTN MOBILE MONEY');
    expect(text).toContain('MoMo Ref ID:');
    expect(text).toContain('MP261022.9876.H12345');
    expect(text).toContain('K95.00');
  });

  it('formats On Credit / Debt receipt with customer details', () => {
    const sampleCreditReceipt: ReceiptData = {
      receiptId: 'REC-CREDIT-999',
      companyName: 'Nicholas Ntambila Retail & Wholesale',
      branchName: 'Main Branch',
      cashierName: 'Nicholas Ntambila',
      cashierId: 'usr-9c8fae75',
      timestamp: '2026-10-22T14:40:00.000Z',
      items: [
        {
          id: 'prod-cable-type-c',
          name: 'Fast Charging USB-C Cable',
          quantity: 2,
          unitPrice: 35.0,
          subtotal: 70.0,
        },
      ],
      subtotal: 70.0,
      taxAmount: 0,
      total: 70.0,
      paymentMethod: 'credit',
      amountTendered: 20.0,
      changeGiven: 0,
      creditCustomerName: 'John Phiri',
      creditCustomerPhone: '0977112233',
      currencySymbol: 'K',
    };

    const text = formatPos80ThermalReceipt(sampleCreditReceipt);

    expect(text).toContain('ON CREDIT / DEBT');
    expect(text).toContain('Customer Name:');
    expect(text).toContain('John Phiri');
    expect(text).toContain('Customer Phone:');
    expect(text).toContain('0977112233');
    expect(text).toContain('Debt Balance:');
    expect(text).toContain('K50.00');
  });
});
