import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PageHeader } from '@/components/page-header';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth-provider';
import { supabase } from '../../lib/supabase';
import {
  EXPENSE_CATEGORY_LABELS,
  ExpenseCategory,
  getDebtEntries,
  getMicroExpenses,
} from '../../lib/pos-data';

type Branch = { id: string; name: string };
type Sale = {
  id: string;
  transaction_number: string;
  total_amount: number;
  amount_paid: number;
  payment_state: string;
  occurred_at: string;
};

type HistoryTab = 'sales' | 'expenses' | 'debt';

export default function HistoryScreen() {
  const auth = useAuth();
  const theme = useTheme();
  const tenantId = auth.activeBusiness?.tenantId;
  const [activeTab, setActiveTab] = useState<HistoryTab>('sales');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState('');
  const [sales, setSales] = useState<Sale[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Expense filter
  const [selectedExpenseCat, setSelectedExpenseCat] = useState<string>('all');

  // Load branches
  useEffect(() => {
    if (!tenantId || !supabase) return;
    void supabase
      .from('branches')
      .select('id,name')
      .eq('tenant_id', tenantId)
      .order('name')
      .then(({ data }) => {
        const rows = (data ?? []) as Branch[];
        setBranches(rows);
        setBranchId(rows[0]?.id ?? '');
      });
  }, [tenantId]);

  // Load sales history
  useEffect(() => {
    if (!tenantId || !branchId || !supabase) return;
    void supabase
      .from('sales')
      .select(
        'id,transaction_number,total_amount,amount_paid,payment_state,occurred_at',
      )
      .eq('tenant_id', tenantId)
      .eq('branch_id', branchId)
      .order('occurred_at', { ascending: false })
      .limit(50)
      .then(({ data, error: loadError }) => {
        if (loadError) setError('Could not load sales history.');
        else setSales((data ?? []) as Sale[]);
      });
  }, [tenantId, branchId]);

  // Expenses data
  const allExpenses = useMemo(() => getMicroExpenses(), []);
  const filteredExpenses = useMemo(() => {
    if (selectedExpenseCat === 'all') return allExpenses;
    return allExpenses.filter((e) => e.category === selectedExpenseCat);
  }, [allExpenses, selectedExpenseCat]);

  const totalExpenseAmount = useMemo(() => {
    return filteredExpenses.reduce((sum, item) => sum + item.amount, 0);
  }, [filteredExpenses]);

  // Debt entries data
  const debtEntries = useMemo(() => getDebtEntries(), []);
  const totalDebtBalance = useMemo(() => {
    return debtEntries.reduce((sum, item) => sum + item.balance, 0);
  }, [debtEntries]);

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Global Standardized Page Header */}
          <PageHeader
            breadcrumb="FINANCIAL AUDIT & TRANSACTION LOGS"
            title="Audit & History"
            subtitle="Review sales transactions, petty expenses down to every coin, and customer debt ledger."
            badge="LIVE LEDGER"
          />

          {/* Branch selector */}
          {branches.length > 1 && (
            <View style={styles.choices}>
              {branches.map((branch) => (
                <Pressable
                  key={branch.id}
                  onPress={() => setBranchId(branch.id)}
                  style={[
                    styles.choice,
                    branch.id === branchId && styles.selected,
                  ]}
                >
                  <ThemedText>{branch.name}</ThemedText>
                </Pressable>
              ))}
            </View>
          )}

          {/* Tab Navigation Segmented Control */}
          <View style={styles.tabBar}>
            <Pressable
              accessibilityRole="tab"
              accessibilityLabel="Sales Receipts"
              onPress={() => setActiveTab('sales')}
              style={[
                styles.tabButton,
                activeTab === 'sales' && styles.tabButtonActive,
              ]}
            >
              <ThemedText
                type="smallBold"
                style={[
                  styles.tabButtonText,
                  activeTab === 'sales' && styles.tabButtonTextActive,
                ]}
              >
                🛒 Sales ({sales.length})
              </ThemedText>
            </Pressable>

            <Pressable
              accessibilityRole="tab"
              accessibilityLabel="Petty Expenses and Coin Audit"
              onPress={() => setActiveTab('expenses')}
              style={[
                styles.tabButton,
                activeTab === 'expenses' && styles.tabButtonActive,
              ]}
            >
              <ThemedText
                type="smallBold"
                style={[
                  styles.tabButtonText,
                  activeTab === 'expenses' && styles.tabButtonTextActive,
                ]}
              >
                🪙 Petty Expenses ({allExpenses.length})
              </ThemedText>
            </Pressable>

            <Pressable
              accessibilityRole="tab"
              accessibilityLabel="Debt and Credit Ledger"
              onPress={() => setActiveTab('debt')}
              style={[
                styles.tabButton,
                activeTab === 'debt' && styles.tabButtonActive,
              ]}
            >
              <ThemedText
                type="smallBold"
                style={[
                  styles.tabButtonText,
                  activeTab === 'debt' && styles.tabButtonTextActive,
                ]}
              >
                📝 Debt Ledger ({debtEntries.length})
              </ThemedText>
            </Pressable>
          </View>

          {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

          {/* TAB 1: Sales History */}
          {activeTab === 'sales' && (
            <View style={{ gap: Spacing.two }}>
              {sales.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <ThemedText style={styles.emptyIcon}>🧾</ThemedText>
                  <ThemedText type="subtitle" style={styles.emptyTitle}>
                    No Product Sales Recorded Yet
                  </ThemedText>
                  <ThemedText
                    themeColor="textSecondary"
                    style={styles.emptySubtitle}
                  >
                    Transactions completed at the POS checkout counter will
                    automatically generate receipts and appear here with full
                    audit trail.
                  </ThemedText>
                  <Pressable
                    onPress={() => router.push('/sell')}
                    style={styles.emptyActionBtn}
                  >
                    <ThemedText style={styles.emptyActionBtnText}>
                      Open POS Checkout
                    </ThemedText>
                  </Pressable>
                </View>
              ) : (
                sales.map((sale) => (
                  <View
                    key={sale.id}
                    style={[
                      styles.row,
                      {
                        backgroundColor: theme.backgroundElement,
                        borderColor: theme.backgroundSelected,
                      },
                    ]}
                  >
                    <View>
                      <ThemedText type="smallBold">
                        {sale.transaction_number}
                      </ThemedText>
                      <ThemedText themeColor="textSecondary" style={{ fontSize: 12 }}>
                        {new Date(sale.occurred_at).toLocaleString()}
                      </ThemedText>
                    </View>
                    <View style={styles.amount}>
                      <ThemedText type="subtitle" style={{ color: '#10B981', fontWeight: '800' }}>
                        K{Number(sale.total_amount).toFixed(2)}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {sale.payment_state} · Paid K
                        {Number(sale.amount_paid).toFixed(2)}
                      </ThemedText>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          {/* TAB 2: Petty Expenses & Every Coin Accounted For */}
          {activeTab === 'expenses' && (
            <View style={{ gap: Spacing.three }}>
              {/* Summary Card */}
              <View
                style={[
                  styles.summaryCard,
                  {
                    backgroundColor: theme.backgroundElement,
                    borderColor: theme.backgroundSelected,
                  },
                ]}
              >
                <View>
                  <ThemedText type="small" themeColor="textSecondary">
                    TOTAL EXPENSES LOGGED
                  </ThemedText>
                  <ThemedText
                    type="title"
                    style={{ color: '#DC2626', fontSize: 24, fontWeight: '800' }}
                  >
                    -K{totalExpenseAmount.toFixed(2)}
                  </ThemedText>
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  {filteredExpenses.length} entries · Every coin tracked
                </ThemedText>
              </View>

              {/* Category Filter Chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.filterChipRow}>
                  <Pressable
                    onPress={() => setSelectedExpenseCat('all')}
                    style={[
                      styles.filterChip,
                      selectedExpenseCat === 'all' && styles.filterChipActive,
                    ]}
                  >
                    <ThemedText
                      type="small"
                      style={[
                        styles.filterChipText,
                        selectedExpenseCat === 'all' &&
                          styles.filterChipTextActive,
                      ]}
                    >
                      All Categories
                    </ThemedText>
                  </Pressable>

                  {(
                    Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[]
                  ).map((key) => (
                    <Pressable
                      key={key}
                      onPress={() => setSelectedExpenseCat(key)}
                      style={[
                        styles.filterChip,
                        selectedExpenseCat === key && styles.filterChipActive,
                      ]}
                    >
                      <ThemedText
                        type="small"
                        style={[
                          styles.filterChipText,
                          selectedExpenseCat === key &&
                            styles.filterChipTextActive,
                        ]}
                      >
                        {EXPENSE_CATEGORY_LABELS[key]}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>

              {/* Expenses Itemized List */}
              {filteredExpenses.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <ThemedText style={styles.emptyIcon}>🪙</ThemedText>
                  <ThemedText type="subtitle" style={styles.emptyTitle}>
                    No Petty Expenses Recorded
                  </ThemedText>
                  <ThemedText
                    themeColor="textSecondary"
                    style={styles.emptySubtitle}
                  >
                    Expenses for electricity tokens, transport, staff meals, and
                    shop maintenance recorded by cashiers will be listed here.
                  </ThemedText>
                </View>
              ) : (
                filteredExpenses.map((expense) => (
                  <View
                    key={expense.id}
                    style={[
                      styles.expenseCard,
                      {
                        backgroundColor: theme.backgroundElement,
                        borderColor: theme.backgroundSelected,
                      },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <ThemedText type="smallBold">
                        {EXPENSE_CATEGORY_LABELS[expense.category] ||
                          expense.category}
                      </ThemedText>
                      <ThemedText type="small">
                        {expense.description}
                      </ThemedText>
                      <ThemedText
                        type="small"
                        themeColor="textSecondary"
                        style={{ fontSize: 11, marginTop: 4 }}
                      >
                        {new Date(expense.timestamp).toLocaleString()} ·
                        Recorded by {expense.recordedBy.name}
                        {expense.receiptNote
                          ? ` · Ref: ${expense.receiptNote}`
                          : ''}
                      </ThemedText>
                    </View>
                    <ThemedText
                      type="subtitle"
                      style={{ color: '#DC2626', fontWeight: '800' }}
                    >
                      -K{expense.amount.toFixed(2)}
                    </ThemedText>
                  </View>
                ))
              )}
            </View>
          )}

          {/* TAB 3: Debt & Credit Ledger */}
          {activeTab === 'debt' && (
            <View style={{ gap: Spacing.three }}>
              {/* Summary Card */}
              <View
                style={[
                  styles.summaryCard,
                  {
                    backgroundColor: theme.backgroundElement,
                    borderColor: theme.backgroundSelected,
                  },
                ]}
              >
                <View>
                  <ThemedText type="small" themeColor="textSecondary">
                    TOTAL OUTSTANDING DEBT
                  </ThemedText>
                  <ThemedText
                    type="title"
                    style={{ color: '#D97706', fontSize: 24, fontWeight: '800' }}
                  >
                    K{totalDebtBalance.toFixed(2)}
                  </ThemedText>
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  {debtEntries.length} credit customers
                </ThemedText>
              </View>

              {debtEntries.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <ThemedText style={styles.emptyIcon}>📝</ThemedText>
                  <ThemedText type="subtitle" style={styles.emptyTitle}>
                    No Outstanding Customer Debts
                  </ThemedText>
                  <ThemedText
                    themeColor="textSecondary"
                    style={styles.emptySubtitle}
                  >
                    All customers have fully settled their accounts. When a
                    transaction is completed on credit, it will appear here for
                    collection.
                  </ThemedText>
                </View>
              ) : (
                debtEntries.map((debt) => (
                  <View
                    key={debt.id}
                    style={[
                      styles.debtCard,
                      {
                        backgroundColor: theme.backgroundElement,
                        borderColor: theme.backgroundSelected,
                      },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <ThemedText type="smallBold">
                        {debt.customerName} ({debt.customerPhone})
                      </ThemedText>
                      <ThemedText
                        type="small"
                        themeColor="textSecondary"
                        style={{ fontSize: 11, marginTop: 2 }}
                      >
                        Receipt #{debt.receiptId} · Cashier: {debt.cashierName}
                      </ThemedText>
                      <ThemedText
                        type="small"
                        themeColor="textSecondary"
                        style={{ fontSize: 11 }}
                      >
                        {new Date(debt.timestamp).toLocaleString()}
                      </ThemedText>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 2 }}>
                      <ThemedText
                        type="subtitle"
                        style={{ color: '#D97706', fontWeight: '800' }}
                      >
                        K{debt.balance.toFixed(2)} Due
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        Total: K{debt.amountDue.toFixed(2)} · Paid: K
                        {debt.amountPaid.toFixed(2)}
                      </ThemedText>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1 },
  content: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  choice: {
    padding: Spacing.two,
    borderWidth: 1,
    borderColor: '#D8E0E8',
    borderRadius: 6,
  },
  selected: { backgroundColor: '#DCEAE6', borderColor: '#147D92' },
  tabBar: {
    flexDirection: 'row',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    paddingBottom: Spacing.two,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  tabButtonActive: {
    backgroundColor: 'rgba(20, 125, 146, 0.18)',
    borderColor: '#147D92',
  },
  tabButtonText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  tabButtonTextActive: {
    color: '#38BDF8',
    fontWeight: '700',
  },
  summaryCard: {
    borderRadius: 12,
    padding: Spacing.three,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  filterChipRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  filterChipActive: {
    backgroundColor: '#147D92',
    borderColor: '#147D92',
  },
  filterChipText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  row: {
    minHeight: 64,
    padding: Spacing.three,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  expenseCard: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  debtCard: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  amount: { alignItems: 'flex-end' },
  error: { color: '#B42318' },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    marginVertical: 12,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    maxWidth: 420,
    marginBottom: 16,
  },
  emptyActionBtn: {
    backgroundColor: '#147D92',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
  },
  emptyActionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
