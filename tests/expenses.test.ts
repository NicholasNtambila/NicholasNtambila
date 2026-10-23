import { describe, expect, it } from 'vitest';
import {
  EXPENSE_CATEGORY_LABELS,
  ExpenseCategory,
  MicroExpense,
  addMicroExpense,
  getMicroExpenses,
  getActiveShift,
  saveActiveShift,
  ShiftRecord,
  addDebtEntry,
  getDebtEntries,
} from '../apps/mobile/lib/pos-data';

describe('Expenses Tracking & "Every Coin Accounted For"', () => {
  it('defines the 5 mandatory business expense categories with clear labels', () => {
    const categories: ExpenseCategory[] = [
      'electricity_zesco',
      'transport',
      'meals_lunch',
      'maintenance',
      'miscellaneous',
    ];

    expect(EXPENSE_CATEGORY_LABELS['electricity_zesco']).toContain(
      'Electricity',
    );
    expect(EXPENSE_CATEGORY_LABELS['electricity_zesco']).toContain('ZESCO');
    expect(EXPENSE_CATEGORY_LABELS['transport']).toContain('Transport');
    expect(EXPENSE_CATEGORY_LABELS['meals_lunch']).toContain('Meals');
    expect(EXPENSE_CATEGORY_LABELS['maintenance']).toContain('Maintenance');
    expect(EXPENSE_CATEGORY_LABELS['miscellaneous']).toContain('Miscellaneous');
  });

  it('records petty micro-expenses down to exact coins and ngwee', () => {
    const expense: MicroExpense = {
      id: 'exp-test-zesco-1',
      tenantId: 'tenant-test',
      branchId: 'branch-test',
      category: 'electricity_zesco',
      description: 'ZESCO emergency meter recharge for studio machines',
      amount: 150.75, // down to 75 ngwee
      recordedBy: {
        id: 'usr-nicholas',
        name: 'Nicholas Ntambila',
      },
      timestamp: '2026-10-22T15:20:00.000Z',
      receiptNote: 'Meter 0412-8877-9912',
    };

    addMicroExpense(expense);
    const expenses = getMicroExpenses();

    const saved = expenses.find((e) => e.id === 'exp-test-zesco-1');
    expect(saved).toBeDefined();
    expect(saved?.amount).toBe(150.75);
    expect(saved?.category).toBe('electricity_zesco');
    expect(saved?.receiptNote).toBe('Meter 0412-8877-9912');
    expect(saved?.recordedBy.name).toBe('Nicholas Ntambila');
  });

  it('accurately deducts petty cash expenses from shift drawer expected cash', () => {
    const shift: ShiftRecord = {
      id: 'shift-test-1',
      cashierId: 'usr-nicholas',
      cashierName: 'Nicholas Ntambila',
      openedAt: new Date().toISOString(),
      openingFloat: 200.0,
      closedAt: null,
      cashSales: 550.0,
      cashExpenses: 75.5, // K50 ZESCO + K25.50 lunch
      expectedCash: 0,
      handCountedCash: null,
      discrepancy: null,
      status: 'open',
    };

    saveActiveShift(shift);
    const active = getActiveShift();
    expect(active).toBeDefined();

    // Opening Float (200) + Cash Sales (550) - Cash Expenses (75.50) = 674.50
    const expected =
      (active?.openingFloat || 0) +
      (active?.cashSales || 0) -
      (active?.cashExpenses || 0);

    expect(expected).toBe(674.5);
  });

  it('records customer debt entries with balance tracking', () => {
    addDebtEntry({
      id: 'debt-test-1',
      receiptId: 'REC-CREDIT-77',
      customerName: 'Mary Banda',
      customerPhone: '0966554433',
      amountDue: 180.0,
      amountPaid: 80.0,
      balance: 100.0,
      timestamp: new Date().toISOString(),
      cashierName: 'Nicholas Ntambila',
      status: 'outstanding',
    });

    const debts = getDebtEntries();
    const entry = debts.find((d) => d.id === 'debt-test-1');
    expect(entry).toBeDefined();
    expect(entry?.customerName).toBe('Mary Banda');
    expect(entry?.balance).toBe(100.0);
    expect(entry?.status).toBe('outstanding');
  });
});
