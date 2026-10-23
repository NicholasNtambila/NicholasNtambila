import { describe, expect, it } from 'vitest';
import {
  calculateChange,
  getSuggestedTenderShortcuts,
  safeCalculate,
} from '../apps/mobile/lib/pos-math';

describe('POS Change & Tender Calculations', () => {
  it('calculates exact payment with zero change', () => {
    const result = calculateChange(125.5, 125.5);
    expect(result.isExact).toBe(true);
    expect(result.change).toBe(0);
    expect(result.difference).toBe(0);
    expect(result.isOverpaid).toBe(false);
    expect(result.isUnderpaid).toBe(false);
  });

  it('calculates change when customer gives larger note', () => {
    // Total K135, customer gives K200 note -> K65 change
    const result = calculateChange(135, 200);
    expect(result.isOverpaid).toBe(true);
    expect(result.change).toBe(65);
    expect(result.difference).toBe(65);
    expect(result.isExact).toBe(false);
    expect(result.isUnderpaid).toBe(false);
  });

  it('calculates underpayment / remaining balance when customer pays less', () => {
    // Total K100, customer gives K60 -> K40 remaining
    const result = calculateChange(100, 60);
    expect(result.isUnderpaid).toBe(true);
    expect(result.change).toBe(0);
    expect(result.difference).toBe(40);
    expect(result.isExact).toBe(false);
    expect(result.isOverpaid).toBe(false);
  });

  it('generates smart tender shortcuts for common totals', () => {
    const shortcuts = getSuggestedTenderShortcuts(135);
    // Should include exact 135, next 10 (140), next 50 (150), next 100/notes (200, 500)
    expect(shortcuts).toContain(135);
    expect(shortcuts).toContain(140);
    expect(shortcuts).toContain(150);
    expect(shortcuts).toContain(200);
    expect(shortcuts).toContain(500);
    expect(shortcuts[0]).toBe(135); // Exact amount is always first
  });

  it('generates shortcuts for round totals', () => {
    const shortcuts = getSuggestedTenderShortcuts(50);
    expect(shortcuts[0]).toBe(50);
    expect(shortcuts).toContain(100);
    expect(shortcuts).toContain(200);
  });
});

describe('POS Safe Calculator Parser (No eval/Function)', () => {
  it('handles simple additions, subtractions, multiplications, divisions', () => {
    expect(safeCalculate('15 + 30').result).toBe(45);
    expect(safeCalculate('100 - 25.5').result).toBe(74.5);
    expect(safeCalculate('12 * 4').result).toBe(48);
    expect(safeCalculate('12 × 4').result).toBe(48);
    expect(safeCalculate('150 / 3').result).toBe(50);
    expect(safeCalculate('150 ÷ 3').result).toBe(50);
  });

  it('respects operator precedence correctly', () => {
    expect(safeCalculate('10 + 5 * 2').result).toBe(20);
    expect(safeCalculate('(10 + 5) * 2').result).toBe(30);
    expect(safeCalculate('50 - 10 / 2 + 5').result).toBe(50);
  });

  it('handles decimal numbers and unary minus', () => {
    expect(safeCalculate('12.50 * 3').result).toBe(37.5);
    expect(safeCalculate('-10 + 25').result).toBe(15);
  });

  it('safely catches division by zero without crashing', () => {
    const result = safeCalculate('100 / 0');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/division by zero/i);
  });

  it('handles invalid or empty inputs gracefully', () => {
    expect(safeCalculate('').success).toBe(false);
    expect(safeCalculate('++*').success).toBe(false);
    expect(safeCalculate('12 + (5 * 2').success).toBe(false); // missing paren
  });
});
