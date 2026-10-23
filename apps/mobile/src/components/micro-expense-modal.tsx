import { designTokens } from '@sanitech/shared';
import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from './themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '../../lib/supabase';
import {
  addMicroExpense,
  EXPENSE_CATEGORY_LABELS,
  ExpenseCategory,
  getActiveShift,
  getMicroExpenses,
  logAuditEvent,
  MicroExpense,
  saveActiveShift,
} from '../../lib/pos-data';

interface MicroExpenseModalProps {
  visible: boolean;
  onClose: () => void;
  user: { id: string; name: string };
  tenantId?: string;
  branchId?: string;
  onExpenseAdded?: () => void;
}

export function MicroExpenseModal({
  visible,
  onClose,
  user,
  tenantId = 'tenant-primary',
  branchId = 'branch-primary',
  onExpenseAdded,
}: MicroExpenseModalProps) {
  const theme = useTheme();

  const [category, setCategory] =
    useState<ExpenseCategory>('electricity_zesco');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [receiptNote, setReceiptNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [expenseVersion, setExpenseVersion] = useState(0);

  const expenses = React.useMemo(() => {
    void expenseVersion;
    return getMicroExpenses();
  }, [expenseVersion]);

  const totalToday = React.useMemo(() => {
    return expenses.reduce((sum, item) => sum + item.amount, 0);
  }, [expenses]);

  const quickAmounts = [10, 20, 50, 100, 200];

  async function handleSubmit() {
    setError(null);
    setSuccess(null);

    const numericAmount = parseFloat(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError('Please enter a valid expense amount greater than zero.');
      return;
    }

    if (!description.trim()) {
      setError('Please enter a description of what was paid for.');
      return;
    }

    const currentShift = getActiveShift();
    if (!currentShift) {
      setError(
        'A cashier shift must be open before recording cash expenses from the drawer.',
      );
      return;
    }

    // 1. Record MicroExpense in local storage
    const newExpense: MicroExpense = {
      id: `exp-${Date.now()}`,
      tenantId,
      branchId,
      category,
      description: description.trim(),
      amount: numericAmount,
      recordedBy: {
        id: user.id,
        name: user.name,
      },
      timestamp: new Date().toISOString(),
      receiptNote: receiptNote.trim() || undefined,
    };

    addMicroExpense(newExpense);

    // 2. Adjust active shift cash drawer balance
    currentShift.cashExpenses += numericAmount;
    currentShift.expectedCash -= numericAmount;
    saveActiveShift(currentShift);

    // 3. Log fraud audit event
    logAuditEvent(
      'expense_recorded',
      { id: user.id, name: user.name },
      `Petty expense: K${numericAmount.toFixed(2)} for ${category} (${description.trim()})`,
      -numericAmount,
    );

    // 4. Mirror to Supabase if connected
    if (supabase) {
      void supabase
        .from('petty_expenses')
        .insert({
          tenant_id: tenantId,
          branch_id: branchId,
          recorded_by: user.id,
          category,
          amount: numericAmount,
          description: description.trim(),
          receipt_ref: receiptNote.trim() || null,
          occurred_at: newExpense.timestamp,
        })
        .then(
          () => {},
          () => {},
        );
    }

    setSuccess(`Recorded -K${numericAmount.toFixed(2)} from drawer.`);
    setAmount('');
    setDescription('');
    setReceiptNote('');
    setExpenseVersion((v) => v + 1);

    if (onExpenseAdded) {
      onExpenseAdded();
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.container,
            {
              backgroundColor: theme.background,
              borderColor: theme.backgroundSelected,
            },
          ]}
        >
          {/* 1. Fixed Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <ThemedText style={{ fontSize: 22 }}>🪙</ThemedText>
              <View>
                <ThemedText type="subtitle" style={styles.headerTitle}>
                  Petty Cash & Micro-Expenses
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Log operational costs deducted from the active cash drawer
                </ThemedText>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close expense modal"
              onPress={onClose}
              style={styles.closeBtn}
            >
              <ThemedText type="subtitle" style={{ color: '#94A3B8' }}>✕</ThemedText>
            </Pressable>
          </View>

          {/* 2. Scrollable Content Body */}
          <ScrollView
            style={styles.scrollBody}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
          >
            {/* Category Selector */}
            <ThemedText type="smallBold" style={styles.fieldLabel}>
              EXPENSE CATEGORY
            </ThemedText>
            <View style={styles.categoryGrid}>
              {(
                Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[]
              ).map((catKey) => (
                <Pressable
                  key={catKey}
                  onPress={() => setCategory(catKey)}
                  style={[
                    styles.catChip,
                    category === catKey && styles.catChipActive,
                  ]}
                >
                  <ThemedText
                    type="small"
                    style={[
                      styles.catChipText,
                      category === catKey && styles.catChipTextActive,
                    ]}
                  >
                    {EXPENSE_CATEGORY_LABELS[catKey]}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            {/* Amount Input & Quick Chips */}
            <ThemedText type="smallBold" style={styles.fieldLabel}>
              AMOUNT (ZMW)
            </ThemedText>
            <TextInput
              accessibilityLabel="Expense amount in Kwacha"
              placeholder="e.g. 50.00"
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
              style={[
                styles.input,
                {
                  color: theme.text,
                  backgroundColor: theme.backgroundElement,
                  borderColor: theme.backgroundSelected,
                },
              ]}
            />

            <View style={styles.quickAmountRow}>
              {quickAmounts.map((q) => (
                <Pressable
                  key={q}
                  onPress={() => setAmount(String(q))}
                  style={styles.quickAmountChip}
                >
                  <ThemedText style={styles.quickAmountChipText}>
                    K{q}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            {/* Description */}
            <ThemedText type="smallBold" style={styles.fieldLabel}>
              DESCRIPTION / REASON
            </ThemedText>
            <TextInput
              accessibilityLabel="Expense description"
              placeholder="e.g. ZESCO meter token refill for studio"
              value={description}
              onChangeText={setDescription}
              style={[
                styles.input,
                {
                  color: theme.text,
                  backgroundColor: theme.backgroundElement,
                  borderColor: theme.backgroundSelected,
                },
              ]}
            />

            {/* Receipt / Token Reference */}
            <ThemedText type="smallBold" style={styles.fieldLabel}>
              RECEIPT / TOKEN REFERENCE (OPTIONAL)
            </ThemedText>
            <TextInput
              accessibilityLabel="Receipt or token reference"
              placeholder="e.g. Token # 1234-5678-9012"
              value={receiptNote}
              onChangeText={setReceiptNote}
              style={[
                styles.input,
                {
                  color: theme.text,
                  backgroundColor: theme.backgroundElement,
                  borderColor: theme.backgroundSelected,
                },
              ]}
            />

            {error ? (
              <ThemedText style={styles.errorText}>{error}</ThemedText>
            ) : null}
            {success ? (
              <ThemedText style={styles.successText}>{success}</ThemedText>
            ) : null}

            {/* Recent Micro-Expenses */}
            <View style={styles.recentSection}>
              <View style={styles.recentHeader}>
                <ThemedText type="smallBold">
                  TODAY&apos;S RECORDED EXPENSES
                </ThemedText>
                <ThemedText type="smallBold" style={{ color: '#DC2626' }}>
                  Total: K{totalToday.toFixed(2)}
                </ThemedText>
              </View>

              {expenses.length === 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  No petty expenses logged today.
                </ThemedText>
              ) : (
                expenses.slice(0, 10).map((item) => (
                  <View key={item.id} style={styles.expenseItem}>
                    <View style={{ flex: 1 }}>
                      <ThemedText type="smallBold">
                        {EXPENSE_CATEGORY_LABELS[item.category] ||
                          item.category}
                      </ThemedText>
                      <ThemedText type="small">{item.description}</ThemedText>
                      <ThemedText
                        type="small"
                        themeColor="textSecondary"
                        style={{ fontSize: 10, marginTop: 2 }}
                      >
                        {new Date(item.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        by {item.recordedBy.name}
                        {item.receiptNote ? ` • Ref: ${item.receiptNote}` : ''}
                      </ThemedText>
                    </View>
                    <ThemedText type="subtitle" style={{ color: '#DC2626', fontWeight: '800' }}>
                      -K{item.amount.toFixed(2)}
                    </ThemedText>
                  </View>
                ))
              )}
            </View>
          </ScrollView>

          {/* 3. Fixed Footer Action Bar */}
          <View style={styles.footerBar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Record micro-expense"
              onPress={handleSubmit}
              style={[
                styles.submitBtn,
                { backgroundColor: designTokens.color.negative },
              ]}
            >
              <ThemedText style={styles.submitBtnText}>
                🪙 Record Petty Expense {amount ? `(-K${parseFloat(amount || '0').toFixed(2)})` : ''}
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.two,
  },
  container: {
    width: '100%',
    maxWidth: 620,
    maxHeight: '90%',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0284C7',
  },
  closeBtn: {
    padding: 8,
  },
  scrollBody: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.four,
    gap: Spacing.two,
  },
  fieldLabel: {
    marginTop: Spacing.two,
    marginBottom: 6,
    fontSize: 11,
    letterSpacing: 0.5,
    color: '#0284C7',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  catChip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  catChipActive: {
    borderColor: '#DC2626',
    backgroundColor: 'rgba(220, 38, 38, 0.15)',
  },
  catChipText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  catChipTextActive: {
    color: '#F87171',
    fontWeight: '700',
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  errorText: {
    color: '#DC2626',
    fontWeight: '600',
    marginTop: 6,
  },
  successText: {
    color: '#059669',
    fontWeight: '700',
    marginTop: 6,
  },
  footerBar: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  submitBtn: {
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  recentSection: {
    marginTop: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingTop: Spacing.two,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  expenseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  quickAmountRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  quickAmountChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  quickAmountChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#CBD5E1',
  },
});
