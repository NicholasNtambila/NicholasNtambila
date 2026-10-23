import { describe, expect, it } from 'vitest';
import {
  addDebtEntry,
  addMicroExpense,
  addRestockRecord,
  computeCashRunway,
  estimateConsumableRunway,
  getDebtEntries,
  getMarginAlerts,
  getRestockRecords,
  logConsumableSession,
  saveConsumableStock,
  saveCostFluctuationEntry,
  updateDebtEntry,
} from '../apps/mobile/lib/pos-data';

describe('Advanced POS Business Intelligence & Inventory', () => {
  it('computes predictive cash runway based on rolling expense average', () => {
    // Record mock daily expenses
    const nowIso = new Date().toISOString();
    addMicroExpense({
      id: `exp-${Date.now()}-1`,
      tenantId: 'tenant-test',
      branchId: 'branch-test',
      category: 'electricity_zesco',
      description: 'ZESCO tokens',
      amount: 100,
      recordedBy: { id: 'u1', name: 'Nicholas' },
      timestamp: nowIso,
    });

    const runway = computeCashRunway(500, 200, 600, 100);
    expect(runway.cashInDrawer).toBe(500);
    expect(runway.avgDailyExpenses).toBeGreaterThan(0);
    expect(runway.runwayDays).toBeGreaterThan(0);
  });

  it('detects low margins with Cost-Fluctuation Shield and suggests prices', () => {
    saveCostFluctuationEntry({
      itemId: 'prod-paper-ream-1',
      itemName: 'A4 Paper Ream',
      baseCostPerUnit: 85,
      sellingPrice: 90, // Margin is only (90-85)/90 = ~5.5%
      minimumMarginPct: 20, // Threshold is 20%
      updatedAt: new Date().toISOString(),
    });

    const alerts = getMarginAlerts();
    const alert = alerts.find((a) => a.itemId === 'prod-paper-ream-1');
    expect(alert).toBeDefined();
    expect(alert?.marginPct).toBeLessThan(20);
    // Suggested price = 85 / (1 - 0.20) = 85 / 0.8 = 106.25
    expect(alert?.suggestedPrice).toBeCloseTo(106.25, 1);
  });

  it('estimates paper and ink consumable runway based on page usage', () => {
    saveConsumableStock({
      a4ReemsInStock: 2, // 2 reams = 1,000 sheets
      inkCartridgesInStock: 1, // ~2,500 pages
      colorCartridgesInStock: 1, // ~1,300 pages
      lastUpdated: new Date().toISOString(),
    });

    logConsumableSession({
      id: `sess-${Date.now()}`,
      date: new Date().toISOString(),
      bwPages: 100,
      colorPages: 20,
      photoPages: 5,
      inkCartridgesUsed: 0.05,
      paperSheetsUsed: 125,
    });

    const runway = estimateConsumableRunway();
    expect(runway.avgDailySheets).toBeGreaterThan(0);
    expect(runway.paperDaysLeft).toBeGreaterThan(0);
    expect(runway.bwInkDaysLeft).toBeGreaterThan(0);
  });

  it('handles customer debt lifecycle: partial payments and debt clearance', () => {
    const debtId = `debt-test-${Date.now()}`;
    addDebtEntry({
      id: debtId,
      receiptId: 'REC-TEST-99',
      customerName: 'Chanda Mwewa',
      customerPhone: '0977000111',
      amountDue: 250,
      amountPaid: 50,
      balance: 200,
      timestamp: new Date().toISOString(),
      cashierName: 'Cashier Nicholas',
      status: 'outstanding',
    });

    // Make partial payment of K100
    const partial = updateDebtEntry(debtId, 100);
    expect(partial?.amountPaid).toBe(150);
    expect(partial?.balance).toBe(100);
    expect(partial?.status).toBe('partially_paid');

    // Make remaining payment of K100
    const cleared = updateDebtEntry(debtId, 100);
    expect(cleared?.amountPaid).toBe(250);
    expect(cleared?.balance).toBe(0);
    expect(cleared?.status).toBe('cleared');

    // Check store state
    const all = getDebtEntries();
    const entry = all.find((d) => d.id === debtId);
    expect(entry?.status).toBe('cleared');
    expect(entry?.balance).toBe(0);
  });

  it('records 1-click inventory restock entries with unit cost tracking', () => {
    const restockId = `restock-test-${Date.now()}`;
    addRestockRecord({
      id: restockId,
      itemId: 'prod-pen-biro',
      itemName: 'Biro Pen (Blue)',
      quantityAdded: 50,
      costPerUnit: 2.5,
      totalCost: 125,
      supplier: 'Lusaka Stationers Ltd',
      recordedBy: { id: 'u1', name: 'Nicholas' },
      timestamp: new Date().toISOString(),
    });

    const records = getRestockRecords();
    const found = records.find((r) => r.id === restockId);
    expect(found).toBeDefined();
    expect(found?.quantityAdded).toBe(50);
    expect(found?.totalCost).toBe(125);
  });
});
