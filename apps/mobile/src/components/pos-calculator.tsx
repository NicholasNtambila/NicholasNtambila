import { designTokens } from '@sanitech/shared';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  calculateChange,
  getSuggestedTenderShortcuts,
  safeCalculate,
} from '../../lib/pos-math';

interface PosCalculatorProps {
  total: number;
  currencySymbol?: string;
  amountPaid: string;
  onAmountPaidChange: (value: string) => void;
  onAddCustomItem?: (name: string, price: number) => void;
  isCash?: boolean;
}

type CalculatorMode = 'tender' | 'calc';

export function PosCalculator({
  total,
  currencySymbol = 'K',
  amountPaid,
  onAmountPaidChange,
  onAddCustomItem,
  isCash = true,
}: PosCalculatorProps) {
  const theme = useTheme();
  const [mode, setMode] = useState<CalculatorMode>('tender');

  // Calculator mode state
  const [calcExpr, setCalcExpr] = useState('');
  const [calcResult, setCalcResult] = useState<number | null>(null);

  // Derived change calculation
  const numericPaid = amountPaid ? Number(amountPaid) : 0;
  const changeResult = useMemo(
    () => calculateChange(total, numericPaid),
    [total, numericPaid],
  );

  // Suggested shortcuts (e.g. Exact, 140, 150, 200, 500)
  const shortcuts = useMemo(() => getSuggestedTenderShortcuts(total), [total]);

  // Quick note increments
  const noteIncrements = [10, 20, 50, 100];

  // Keypad actions for tender
  function handleTenderKey(key: string) {
    if (key === 'CLEAR') {
      onAmountPaidChange('');
      return;
    }
    if (key === 'BACKSPACE') {
      onAmountPaidChange(amountPaid.slice(0, -1));
      return;
    }
    if (key === 'EXACT') {
      onAmountPaidChange(total.toFixed(2));
      return;
    }
    if (key === '.') {
      if (amountPaid.includes('.')) return;
      onAmountPaidChange(amountPaid ? `${amountPaid}.` : '0.');
      return;
    }
    if (key === '00') {
      if (!amountPaid || amountPaid === '0') return;
      onAmountPaidChange(`${amountPaid}00`);
      return;
    }

    // Append digit
    if (amountPaid === '0') {
      onAmountPaidChange(key);
    } else {
      // Limit to 2 decimal places if dot present
      const parts = amountPaid.split('.');
      if (parts[1] && parts[1].length >= 2) return;
      onAmountPaidChange(`${amountPaid}${key}`);
    }
  }

  function handleAddIncrement(inc: number) {
    const current = Number(amountPaid) || 0;
    const next = current + inc;
    onAmountPaidChange(next.toFixed(2));
  }

  function handleSetExact() {
    onAmountPaidChange(total.toFixed(2));
  }

  // Calculator expressions
  function handleCalcKey(key: string) {
    if (key === 'C') {
      setCalcExpr('');
      setCalcResult(null);
      return;
    }
    if (key === '⌫') {
      const next = calcExpr.slice(0, -1);
      setCalcExpr(next);
      if (!next) {
        setCalcResult(null);
      } else {
        const res = safeCalculate(next);
        if (res.success && res.result !== undefined) setCalcResult(res.result);
      }
      return;
    }
    if (key === '=') {
      const res = safeCalculate(calcExpr);
      if (res.success && res.result !== undefined) {
        setCalcResult(res.result);
        setCalcExpr(String(res.result));
      }
      return;
    }

    const nextExpr = `${calcExpr}${key}`;
    setCalcExpr(nextExpr);
    const res = safeCalculate(nextExpr);
    if (res.success && res.result !== undefined) {
      setCalcResult(res.result);
    }
  }

  function applyCalcToTender() {
    if (calcResult !== null && Number.isFinite(calcResult) && calcResult >= 0) {
      onAmountPaidChange(calcResult.toFixed(2));
      setMode('tender');
    }
  }

  function handleAddCustomLine() {
    if (calcResult !== null && Number.isFinite(calcResult) && calcResult > 0) {
      onAddCustomItem?.(`Custom Item (${calcExpr || 'Calc'})`, calcResult);
      setCalcExpr('');
      setCalcResult(null);
    }
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.backgroundElement,
          borderColor: theme.backgroundSelected,
        },
      ]}
    >
      {/* Mode Switcher Tabs */}
      <View style={styles.tabBar}>
        <Pressable
          accessibilityRole="tab"
          accessibilityLabel="Tender & Change"
          onPress={() => setMode('tender')}
          style={[styles.tab, mode === 'tender' && styles.tabActive]}
        >
          <ThemedText
            type="smallBold"
            style={[
              styles.tabText,
              mode === 'tender' && { color: designTokens.color.brand.blue },
            ]}
          >
            💵 Cash Tender & Change
          </ThemedText>
        </Pressable>
        <Pressable
          accessibilityRole="tab"
          accessibilityLabel="Math Calculator"
          onPress={() => setMode('calc')}
          style={[styles.tab, mode === 'calc' && styles.tabActive]}
        >
          <ThemedText
            type="smallBold"
            style={[
              styles.tabText,
              mode === 'calc' && { color: designTokens.color.brand.blue },
            ]}
          >
            🧮 Math Calculator
          </ThemedText>
        </Pressable>
      </View>

      {mode === 'tender' ? (
        <View style={styles.tenderSection}>
          {/* Display Banner: Total vs Tendered */}
          <View style={styles.tenderHeaderRow}>
            <View>
              <ThemedText type="small" themeColor="textSecondary">
                SALE TOTAL
              </ThemedText>
              <ThemedText type="subtitle">
                {currencySymbol}
                {total.toFixed(2)}
              </ThemedText>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <ThemedText type="small" themeColor="textSecondary">
                AMOUNT TENDERED
              </ThemedText>
              <ThemedText
                type="subtitle"
                style={{
                  color: amountPaid
                    ? designTokens.color.brand.blue
                    : theme.textSecondary,
                }}
              >
                {currencySymbol}
                {amountPaid ? Number(amountPaid).toFixed(2) : total.toFixed(2)}
              </ThemedText>
            </View>
          </View>

          {/* Change Display Card */}
          {isCash && (
            <View
              style={[
                styles.changeCard,
                !amountPaid || changeResult.isExact
                  ? styles.changeCardExact
                  : changeResult.isOverpaid
                    ? styles.changeCardOverpaid
                    : styles.changeCardUnderpaid,
              ]}
            >
              <View style={styles.changeCardContent}>
                <View>
                  <ThemedText
                    type="smallBold"
                    style={[
                      styles.changeEyebrow,
                      !amountPaid || changeResult.isExact
                        ? styles.textExact
                        : changeResult.isOverpaid
                          ? styles.textOverpaid
                          : styles.textUnderpaid,
                    ]}
                  >
                    {!amountPaid || changeResult.isExact
                      ? 'EXACT PAYMENT'
                      : changeResult.isOverpaid
                        ? 'CHANGE TO RETURN'
                        : 'REMAINING DUE'}
                  </ThemedText>
                  <ThemedText
                    type="title"
                    style={[
                      styles.changeAmount,
                      !amountPaid || changeResult.isExact
                        ? styles.textExact
                        : changeResult.isOverpaid
                          ? styles.textOverpaid
                          : styles.textUnderpaid,
                    ]}
                  >
                    {currencySymbol}
                    {!amountPaid || changeResult.isExact
                      ? '0.00'
                      : changeResult.isOverpaid
                        ? changeResult.change.toFixed(2)
                        : changeResult.difference.toFixed(2)}
                  </ThemedText>
                </View>
                <ThemedText
                  type="small"
                  style={[
                    styles.changeHint,
                    !amountPaid || changeResult.isExact
                      ? styles.textExact
                      : changeResult.isOverpaid
                        ? styles.textOverpaid
                        : styles.textUnderpaid,
                  ]}
                >
                  {!amountPaid
                    ? 'No change needed'
                    : changeResult.isExact
                      ? 'Exact amount tendered'
                      : changeResult.isOverpaid
                        ? `Customer gives ${currencySymbol}${numericPaid.toFixed(2)} → Return ${currencySymbol}${changeResult.change.toFixed(2)}`
                        : `Customer underpaid by ${currencySymbol}${changeResult.difference.toFixed(2)}`}
                </ThemedText>
              </View>
            </View>
          )}

          {/* Exact & Smart Note Shortcuts */}
          <View style={styles.shortcutsSection}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              QUICK TENDER SHORTCUTS
            </ThemedText>
            <View style={styles.shortcutRow}>
              {/* Exact Amount Button */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Exact amount"
                onPress={handleSetExact}
                style={[
                  styles.shortcutChip,
                  styles.exactChip,
                  numericPaid === total && styles.chipActive,
                ]}
              >
                <ThemedText style={styles.exactChipText}>
                  ⚡ Exact {currencySymbol}
                  {total.toFixed(2)}
                </ThemedText>
              </Pressable>

              {/* Dynamic Note Shortcuts */}
              {shortcuts
                .filter((s) => s > total)
                .slice(0, 4)
                .map((amount) => (
                  <Pressable
                    key={amount}
                    accessibilityRole="button"
                    accessibilityLabel={`Pay ${currencySymbol}${amount}`}
                    onPress={() => onAmountPaidChange(amount.toFixed(2))}
                    style={[
                      styles.shortcutChip,
                      numericPaid === amount && styles.chipActive,
                    ]}
                  >
                    <ThemedText style={styles.shortcutChipText}>
                      {currencySymbol}
                      {amount}
                    </ThemedText>
                  </Pressable>
                ))}
            </View>

            {/* Note Increments (+10, +20, +50, +100) */}
            <View style={styles.incrementRow}>
              <ThemedText
                type="small"
                themeColor="textSecondary"
                style={{ alignSelf: 'center', marginRight: Spacing.one }}
              >
                Add Note:
              </ThemedText>
              {noteIncrements.map((inc) => (
                <Pressable
                  key={inc}
                  accessibilityRole="button"
                  accessibilityLabel={`Add note ${currencySymbol}${inc}`}
                  onPress={() => handleAddIncrement(inc)}
                  style={styles.incrementChip}
                >
                  <ThemedText style={styles.incrementChipText}>
                    +{currencySymbol}
                    {inc}
                  </ThemedText>
                </Pressable>
              ))}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Reset tender"
                onPress={() => onAmountPaidChange('')}
                style={[styles.incrementChip, styles.resetChip]}
              >
                <ThemedText style={styles.resetChipText}>Clear</ThemedText>
              </Pressable>
            </View>
          </View>

          {/* Built-in POS Tender Keypad */}
          <View style={styles.keypadGrid}>
            <View style={styles.keypadRow}>
              <KeypadButton label="7" onPress={() => handleTenderKey('7')} />
              <KeypadButton label="8" onPress={() => handleTenderKey('8')} />
              <KeypadButton label="9" onPress={() => handleTenderKey('9')} />
              <KeypadButton
                label="+K20"
                variant="accent"
                onPress={() => handleAddIncrement(20)}
              />
            </View>
            <View style={styles.keypadRow}>
              <KeypadButton label="4" onPress={() => handleTenderKey('4')} />
              <KeypadButton label="5" onPress={() => handleTenderKey('5')} />
              <KeypadButton label="6" onPress={() => handleTenderKey('6')} />
              <KeypadButton
                label="+K50"
                variant="accent"
                onPress={() => handleAddIncrement(50)}
              />
            </View>
            <View style={styles.keypadRow}>
              <KeypadButton label="1" onPress={() => handleTenderKey('1')} />
              <KeypadButton label="2" onPress={() => handleTenderKey('2')} />
              <KeypadButton label="3" onPress={() => handleTenderKey('3')} />
              <KeypadButton
                label="+K100"
                variant="accent"
                onPress={() => handleAddIncrement(100)}
              />
            </View>
            <View style={styles.keypadRow}>
              <KeypadButton
                label="C"
                variant="danger"
                onPress={() => handleTenderKey('CLEAR')}
              />
              <KeypadButton label="0" onPress={() => handleTenderKey('0')} />
              <KeypadButton label="." onPress={() => handleTenderKey('.')} />
              <KeypadButton
                label="⌫"
                variant="muted"
                onPress={() => handleTenderKey('BACKSPACE')}
              />
            </View>
          </View>
        </View>
      ) : (
        /* Math Calculator Mode */
        <View style={styles.calcSection}>
          {/* Formula & Result Display */}
          <View style={styles.calcDisplay}>
            <ThemedText
              style={styles.calcExprText}
              numberOfLines={1}
              themeColor="textSecondary"
            >
              {calcExpr || '0'}
            </ThemedText>
            <ThemedText type="title" style={styles.calcResultText}>
              ={calcResult !== null ? calcResult : '0'}
            </ThemedText>
          </View>

          {/* Action buttons from calculator */}
          <View style={styles.calcActionRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Use as tender amount"
              disabled={calcResult === null || calcResult < 0}
              onPress={applyCalcToTender}
              style={[
                styles.calcActionButton,
                { backgroundColor: designTokens.color.brand.blue },
                (calcResult === null || calcResult < 0) && { opacity: 0.5 },
              ]}
            >
              <ThemedText style={styles.calcActionButtonText}>
                💵 Use as Tender ({currencySymbol}
                {calcResult !== null ? calcResult.toFixed(2) : '0.00'})
              </ThemedText>
            </Pressable>

            {onAddCustomItem ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add as custom item"
                disabled={calcResult === null || calcResult <= 0}
                onPress={handleAddCustomLine}
                style={[
                  styles.calcActionButton,
                  { backgroundColor: '#0D9488' },
                  (calcResult === null || calcResult <= 0) && { opacity: 0.5 },
                ]}
              >
                <ThemedText style={styles.calcActionButtonText}>
                  🛒 Add to Cart
                </ThemedText>
              </Pressable>
            ) : null}
          </View>

          {/* Scientific / POS Calculator Keypad */}
          <View style={styles.keypadGrid}>
            <View style={styles.keypadRow}>
              <KeypadButton
                label="C"
                variant="danger"
                onPress={() => handleCalcKey('C')}
              />
              <KeypadButton
                label="("
                variant="muted"
                onPress={() => handleCalcKey('(')}
              />
              <KeypadButton
                label=")"
                variant="muted"
                onPress={() => handleCalcKey(')')}
              />
              <KeypadButton
                label="÷"
                variant="accent"
                onPress={() => handleCalcKey('÷')}
              />
            </View>
            <View style={styles.keypadRow}>
              <KeypadButton label="7" onPress={() => handleCalcKey('7')} />
              <KeypadButton label="8" onPress={() => handleCalcKey('8')} />
              <KeypadButton label="9" onPress={() => handleCalcKey('9')} />
              <KeypadButton
                label="×"
                variant="accent"
                onPress={() => handleCalcKey('×')}
              />
            </View>
            <View style={styles.keypadRow}>
              <KeypadButton label="4" onPress={() => handleCalcKey('4')} />
              <KeypadButton label="5" onPress={() => handleCalcKey('5')} />
              <KeypadButton label="6" onPress={() => handleCalcKey('6')} />
              <KeypadButton
                label="-"
                variant="accent"
                onPress={() => handleCalcKey('-')}
              />
            </View>
            <View style={styles.keypadRow}>
              <KeypadButton label="1" onPress={() => handleCalcKey('1')} />
              <KeypadButton label="2" onPress={() => handleCalcKey('2')} />
              <KeypadButton label="3" onPress={() => handleCalcKey('3')} />
              <KeypadButton
                label="+"
                variant="accent"
                onPress={() => handleCalcKey('+')}
              />
            </View>
            <View style={styles.keypadRow}>
              <KeypadButton label="0" onPress={() => handleCalcKey('0')} />
              <KeypadButton label="." onPress={() => handleCalcKey('.')} />
              <KeypadButton
                label="⌫"
                variant="muted"
                onPress={() => handleCalcKey('⌫')}
              />
              <KeypadButton
                label="="
                variant="primary"
                onPress={() => handleCalcKey('=')}
              />
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

function KeypadButton({
  label,
  onPress,
  variant = 'default',
}: {
  label: string;
  onPress: () => void;
  variant?: 'default' | 'accent' | 'primary' | 'danger' | 'muted';
}) {
  const theme = useTheme();

  const getBgColor = () => {
    switch (variant) {
      case 'primary':
        return designTokens.color.brand.blue;
      case 'accent':
        return '#0284C7';
      case 'danger':
        return '#EF4444';
      case 'muted':
        return theme.backgroundSelected;
      default:
        return theme.background;
    }
  };

  const getTextColor = () => {
    switch (variant) {
      case 'primary':
      case 'accent':
      case 'danger':
        return '#FFFFFF';
      default:
        return theme.text;
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.keyButton,
        {
          backgroundColor: getBgColor(),
          borderColor: theme.backgroundSelected,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <ThemedText
        type="subtitle"
        style={[styles.keyText, { color: getTextColor() }]}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    marginTop: Spacing.two,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    borderBottomWidth: 3,
    borderBottomColor: designTokens.color.brand.blue,
    backgroundColor: 'rgba(20, 125, 146, 0.08)',
  },
  tabText: {
    fontSize: 13,
  },
  tenderSection: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  tenderHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  changeCard: {
    borderRadius: 8,
    borderWidth: 1.5,
    padding: Spacing.two,
    marginVertical: 4,
  },
  changeCardExact: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  changeCardOverpaid: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  changeCardUnderpaid: {
    backgroundColor: '#FFFBEB',
    borderColor: '#F59E0B',
  },
  changeCardContent: {
    gap: 2,
  },
  changeEyebrow: {
    fontSize: 11,
    letterSpacing: 0.5,
  },
  changeAmount: {
    fontSize: 24,
    fontWeight: '800',
  },
  changeHint: {
    fontSize: 12,
    fontWeight: '500',
  },
  textExact: {
    color: '#15803D',
  },
  textOverpaid: {
    color: '#047857',
  },
  textUnderpaid: {
    color: '#B45309',
  },
  shortcutsSection: {
    gap: 6,
    marginVertical: 4,
  },
  shortcutRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  shortcutChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  exactChip: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7',
  },
  chipActive: {
    backgroundColor: '#1E293B',
    borderColor: '#1E293B',
  },
  exactChipText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  shortcutChipText: {
    color: '#1E293B',
    fontWeight: '600',
    fontSize: 12,
  },
  incrementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  incrementChip: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 5,
    backgroundColor: '#E2E8F0',
  },
  incrementChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  resetChip: {
    backgroundColor: '#FEE2E2',
  },
  resetChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#B91C1C',
  },
  keypadGrid: {
    gap: 6,
    marginTop: 6,
  },
  keypadRow: {
    flexDirection: 'row',
    gap: 6,
  },
  keyButton: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: {
    fontSize: 16,
    fontWeight: '700',
  },
  calcSection: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  calcDisplay: {
    padding: Spacing.two,
    borderRadius: 8,
    backgroundColor: '#0F172A',
    alignItems: 'flex-end',
    minHeight: 64,
    justifyContent: 'center',
  },
  calcExprText: {
    color: '#94A3B8',
    fontSize: 14,
  },
  calcResultText: {
    color: '#38BDF8',
    fontSize: 24,
    fontWeight: '800',
  },
  calcActionRow: {
    flexDirection: 'row',
    gap: 6,
  },
  calcActionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calcActionButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
});
