import { designTokens } from '@sanitech/shared';
import React, { useMemo, useState } from 'react';
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
import {
  archiveShift,
  getActiveShift,
  getAuditLogs,
  logAuditEvent,
  saveActiveShift,
  ShiftRecord,
} from '../../lib/pos-data';

interface ShiftRegisterModalProps {
  visible: boolean;
  onClose: () => void;
  user: { id: string; name: string; role?: string };
  onShiftUpdated: () => void;
}

export function ShiftRegisterModal({
  visible,
  onClose,
  user,
  onShiftUpdated,
}: ShiftRegisterModalProps) {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState<'shift' | 'reconcile' | 'audit'>(
    'shift',
  );

  const activeShift = getActiveShift();
  const auditLogs = getAuditLogs();

  // Shift opening state
  const [openingFloat, setOpeningFloat] = useState('200.00');

  // Reconciler state
  const [handCounted, setHandCounted] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  // Derived reconciler calculations
  const expectedCash = useMemo(() => {
    if (!activeShift) return 0;
    return (
      (activeShift.openingFloat || 0) +
      (activeShift.cashSales || 0) -
      (activeShift.cashExpenses || 0)
    );
  }, [activeShift]);

  const discrepancy = useMemo(() => {
    if (!handCounted) return null;
    const counted = Number(handCounted);
    if (!Number.isFinite(counted)) return null;
    return Math.round((counted - expectedCash) * 100) / 100;
  }, [handCounted, expectedCash]);

  function handleOpenShift() {
    const floatVal = Number(openingFloat);
    if (!Number.isFinite(floatVal) || floatVal < 0) {
      setFeedback('Enter a valid non-negative opening float.');
      return;
    }

    const newShift: ShiftRecord = {
      id: `shift-${Date.now()}`,
      cashierId: user.id,
      cashierName: user.name,
      openedAt: new Date().toISOString(),
      openingFloat: floatVal,
      closedAt: null,
      cashSales: 0,
      cashExpenses: 0,
      expectedCash: floatVal,
      handCountedCash: null,
      discrepancy: null,
      status: 'open',
    };

    saveActiveShift(newShift);
    logAuditEvent(
      'shift_opened',
      user,
      `Shift opened with float of K${floatVal.toFixed(2)}`,
      floatVal,
    );
    setFeedback('✓ Shift started! Opening cash float recorded.');
    onShiftUpdated();
    setTimeout(() => setFeedback(null), 2500);
  }

  function handleCloseShift() {
    if (!activeShift) return;
    const counted = Number(handCounted);
    if (!Number.isFinite(counted) || counted < 0) {
      setFeedback('Enter a valid hand-counted cash amount before closing.');
      return;
    }

    const diff = Math.round((counted - expectedCash) * 100) / 100;
    const closedShift: ShiftRecord = {
      ...activeShift,
      closedAt: new Date().toISOString(),
      expectedCash,
      handCountedCash: counted,
      discrepancy: diff,
      notes: closeNotes.trim() || undefined,
      status: 'closed',
    };

    archiveShift(closedShift);
    logAuditEvent(
      'shift_closed',
      user,
      `Shift closed. Expected: K${expectedCash.toFixed(2)}, Counted: K${counted.toFixed(2)}, Discrepancy: ${diff >= 0 ? '+' : ''}K${diff.toFixed(2)}`,
      diff,
    );
    setFeedback('✓ Shift closed and archived successfully.');
    onShiftUpdated();
    setTimeout(() => {
      setFeedback(null);
      onClose();
    }, 1500);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
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
          {/* Header */}
          <View style={styles.header}>
            <View>
              <ThemedText type="subtitle">
                💼 Shift & Fraud Audit Register
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Cash drawer reconciliation and accountability controls
              </ThemedText>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <ThemedText type="subtitle">✕</ThemedText>
            </Pressable>
          </View>

          {/* Navigation Tabs */}
          <View style={styles.tabRow}>
            <Pressable
              onPress={() => setActiveTab('shift')}
              style={[styles.tab, activeTab === 'shift' && styles.tabActive]}
            >
              <ThemedText
                type="smallBold"
                style={[
                  styles.tabText,
                  activeTab === 'shift' && styles.tabTextActive,
                ]}
              >
                1. Shift Status
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab('reconcile')}
              style={[
                styles.tab,
                activeTab === 'reconcile' && styles.tabActive,
              ]}
            >
              <ThemedText
                type="smallBold"
                style={[
                  styles.tabText,
                  activeTab === 'reconcile' && styles.tabTextActive,
                ]}
              >
                2. Closeout & Drawer
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab('audit')}
              style={[styles.tab, activeTab === 'audit' && styles.tabActive]}
            >
              <ThemedText
                type="smallBold"
                style={[
                  styles.tabText,
                  activeTab === 'audit' && styles.tabTextActive,
                ]}
              >
                3. Fraud Audit Log
              </ThemedText>
            </Pressable>
          </View>

          {feedback ? (
            <ThemedText style={styles.feedbackText}>{feedback}</ThemedText>
          ) : null}

          <ScrollView style={styles.contentScroll}>
            {/* TAB 1: Shift Status & Opening Float */}
            {activeTab === 'shift' && (
              <View style={styles.section}>
                {activeShift ? (
                  <View style={styles.activeShiftCard}>
                    <View style={styles.shiftBadge}>
                      <ThemedText style={styles.shiftBadgeText}>
                        🟢 ACTIVE SHIFT IN PROGRESS
                      </ThemedText>
                    </View>
                    <ThemedText type="title" style={{ marginTop: 8 }}>
                      Cashier: {activeShift.cashierName}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      Started:{' '}
                      {new Date(activeShift.openedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      on {new Date(activeShift.openedAt).toLocaleDateString()}
                    </ThemedText>

                    <View style={styles.drawerMetricGrid}>
                      <View style={styles.metricBox}>
                        <ThemedText type="small" themeColor="textSecondary">
                          Opening Float
                        </ThemedText>
                        <ThemedText type="subtitle">
                          K{activeShift.openingFloat.toFixed(2)}
                        </ThemedText>
                      </View>
                      <View style={styles.metricBox}>
                        <ThemedText type="small" themeColor="textSecondary">
                          Cash Sales
                        </ThemedText>
                        <ThemedText
                          type="subtitle"
                          style={{ color: '#059669' }}
                        >
                          +K{(activeShift.cashSales || 0).toFixed(2)}
                        </ThemedText>
                      </View>
                      <View style={styles.metricBox}>
                        <ThemedText type="small" themeColor="textSecondary">
                          Petty Expenses
                        </ThemedText>
                        <ThemedText
                          type="subtitle"
                          style={{ color: '#DC2626' }}
                        >
                          -K{(activeShift.cashExpenses || 0).toFixed(2)}
                        </ThemedText>
                      </View>
                      <View
                        style={[styles.metricBox, styles.metricBoxHighlight]}
                      >
                        <ThemedText
                          type="smallBold"
                          style={{ color: '#1E293B' }}
                        >
                          Expected in Drawer
                        </ThemedText>
                        <ThemedText
                          type="title"
                          style={{ color: designTokens.color.brand.blue }}
                        >
                          K{expectedCash.toFixed(2)}
                        </ThemedText>
                      </View>
                    </View>
                  </View>
                ) : (
                  <View style={styles.startShiftCard}>
                    <ThemedText type="subtitle">
                      🚀 Start a New Cashier Shift
                    </ThemedText>
                    <ThemedText
                      type="small"
                      themeColor="textSecondary"
                      style={{ marginBottom: 12 }}
                    >
                      Record the starting cash float handed to cashier{' '}
                      <ThemedText type="smallBold">{user.name}</ThemedText>.
                    </ThemedText>

                    <ThemedText type="smallBold" style={{ marginBottom: 4 }}>
                      OPENING CASH FLOAT (ZMW)
                    </ThemedText>
                    <TextInput
                      accessibilityLabel="Opening cash float"
                      keyboardType="decimal-pad"
                      value={openingFloat}
                      onChangeText={setOpeningFloat}
                      placeholder="200.00"
                      style={[
                        styles.input,
                        {
                          color: theme.text,
                          backgroundColor: theme.backgroundElement,
                          borderColor: theme.backgroundSelected,
                        },
                      ]}
                    />

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Open shift and record float"
                      onPress={handleOpenShift}
                      style={[
                        styles.primaryBtn,
                        { backgroundColor: designTokens.color.brand.blue },
                      ]}
                    >
                      <ThemedText style={styles.primaryBtnText}>
                        🟢 Open Shift & Save Float
                      </ThemedText>
                    </Pressable>
                  </View>
                )}
              </View>
            )}

            {/* TAB 2: Closeout & Drawer Reconciler */}
            {activeTab === 'reconcile' && (
              <View style={styles.section}>
                {!activeShift ? (
                  <ThemedText themeColor="textSecondary">
                    No active shift to reconcile. Open a shift first.
                  </ThemedText>
                ) : (
                  <View style={{ gap: 12 }}>
                    <ThemedText type="subtitle">
                      📊 End-of-Shift Cash Drawer Reconciliation
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      Audit opening float, sales, and petty expenses against
                      your actual counted cash.
                    </ThemedText>

                    <View style={styles.auditMathCard}>
                      <View style={styles.mathRow}>
                        <ThemedText>Opening Float:</ThemedText>
                        <ThemedText type="smallBold">
                          K{activeShift.openingFloat.toFixed(2)}
                        </ThemedText>
                      </View>
                      <View style={styles.mathRow}>
                        <ThemedText>+ Total Cash Sales:</ThemedText>
                        <ThemedText
                          type="smallBold"
                          style={{ color: '#059669' }}
                        >
                          +K{(activeShift.cashSales || 0).toFixed(2)}
                        </ThemedText>
                      </View>
                      <View style={styles.mathRow}>
                        <ThemedText>- Total Cash Expenses:</ThemedText>
                        <ThemedText
                          type="smallBold"
                          style={{ color: '#DC2626' }}
                        >
                          -K{(activeShift.cashExpenses || 0).toFixed(2)}
                        </ThemedText>
                      </View>
                      <View style={[styles.mathRow, styles.mathRowTotal]}>
                        <ThemedText type="smallBold">
                          SYSTEM EXPECTED CASH:
                        </ThemedText>
                        <ThemedText type="subtitle">
                          K{expectedCash.toFixed(2)}
                        </ThemedText>
                      </View>
                    </View>

                    {/* Hand Counted Input */}
                    <ThemedText type="smallBold">
                      HAND-COUNTED PHYSICAL CASH IN DRAWER (K)
                    </ThemedText>
                    <TextInput
                      accessibilityLabel="Hand-counted cash"
                      keyboardType="decimal-pad"
                      placeholder={`e.g. ${expectedCash.toFixed(2)}`}
                      value={handCounted}
                      onChangeText={setHandCounted}
                      style={[
                        styles.input,
                        {
                          color: theme.text,
                          backgroundColor: theme.backgroundElement,
                          borderColor: theme.backgroundSelected,
                        },
                      ]}
                    />

                    {/* Discrepancy Alert */}
                    {discrepancy !== null && (
                      <View
                        style={[
                          styles.discrepancyCard,
                          discrepancy === 0
                            ? styles.discBalanced
                            : discrepancy > 0
                              ? styles.discOver
                              : styles.discShort,
                        ]}
                      >
                        <ThemedText
                          type="subtitle"
                          style={
                            discrepancy === 0
                              ? { color: '#047857' }
                              : discrepancy > 0
                                ? { color: '#1D4ED8' }
                                : { color: '#B91C1C' }
                          }
                        >
                          {discrepancy === 0
                            ? '✓ DRAWER BALANCED (K0.00)'
                            : discrepancy > 0
                              ? `📈 DRAWER OVER BY +K${discrepancy.toFixed(2)}`
                              : `⚠️ DRAWER SHORT BY -K${Math.abs(discrepancy).toFixed(2)}`}
                        </ThemedText>
                        <ThemedText type="small">
                          {discrepancy === 0
                            ? 'Hand-counted cash exactly matches expected amount.'
                            : discrepancy > 0
                              ? 'Excess cash recorded. Ensure all sales were logged.'
                              : 'Cash deficit detected. Review receipts and petty expenses.'}
                        </ThemedText>
                      </View>
                    )}

                    <ThemedText type="smallBold">
                      SHIFT CLOSEOUT NOTES (OPTIONAL)
                    </ThemedText>
                    <TextInput
                      accessibilityLabel="Closeout notes"
                      placeholder="e.g. Normal shift, handed cash to Nicholas"
                      value={closeNotes}
                      onChangeText={setCloseNotes}
                      style={[
                        styles.input,
                        {
                          color: theme.text,
                          backgroundColor: theme.backgroundElement,
                          borderColor: theme.backgroundSelected,
                        },
                      ]}
                    />

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Close shift and archive reconciler"
                      onPress={handleCloseShift}
                      style={[
                        styles.primaryBtn,
                        { backgroundColor: '#DC2626' },
                      ]}
                    >
                      <ThemedText style={styles.primaryBtnText}>
                        🔒 Close Shift & Finalize Reconciler
                      </ThemedText>
                    </Pressable>
                  </View>
                )}
              </View>
            )}

            {/* TAB 3: Cashier Fraud Audit Log */}
            {activeTab === 'audit' && (
              <View style={styles.section}>
                <ThemedText type="subtitle">
                  🛡️ Cashier Fraud & Activity Audit Trail
                </ThemedText>
                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                  style={{ marginBottom: 12 }}
                >
                  Tamper-evident logs of removed cart items, price overrides,
                  voids, and station locks.
                </ThemedText>

                {auditLogs.length === 0 ? (
                  <ThemedText themeColor="textSecondary">
                    No audit events recorded yet.
                  </ThemedText>
                ) : (
                  auditLogs.map((log) => (
                    <View key={log.id} style={styles.auditRow}>
                      <View style={{ flex: 1 }}>
                        <ThemedText type="smallBold">
                          {log.eventType.replace(/_/g, ' ').toUpperCase()}
                        </ThemedText>
                        <ThemedText type="small">{log.details}</ThemedText>
                        <ThemedText
                          type="small"
                          themeColor="textSecondary"
                          style={{ fontSize: 10, marginTop: 2 }}
                        >
                          User: {log.userName} •{' '}
                          {new Date(log.timestamp).toLocaleString()}
                        </ThemedText>
                      </View>
                      {log.amountImpact !== undefined && (
                        <ThemedText
                          type="smallBold"
                          style={{
                            color:
                              log.amountImpact >= 0 ? '#059669' : '#DC2626',
                          }}
                        >
                          {log.amountImpact >= 0 ? '+' : ''}K
                          {log.amountImpact.toFixed(2)}
                        </ThemedText>
                      )}
                    </View>
                  ))
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    maxHeight: '90%',
    padding: Spacing.four,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  closeBtn: {
    padding: Spacing.two,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: Spacing.three,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: 'rgba(20, 125, 146, 0.15)',
    borderColor: '#147D92',
  },
  tabText: {
    fontSize: 11,
    color: '#64748B',
  },
  tabTextActive: {
    color: '#147D92',
  },
  feedbackText: {
    color: '#059669',
    fontWeight: '700',
    marginBottom: 8,
  },
  contentScroll: {
    marginBottom: Spacing.two,
  },
  section: {
    gap: 12,
  },
  activeShiftCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  shiftBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  shiftBadgeText: {
    color: '#15803D',
    fontSize: 11,
    fontWeight: '700',
  },
  drawerMetricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: Spacing.three,
  },
  metricBox: {
    width: '48%',
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metricBoxHighlight: {
    width: '100%',
    backgroundColor: '#E0F2FE',
    borderColor: '#7DD3FC',
  },
  startShiftCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  primaryBtn: {
    height: 50,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  auditMathCard: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 12,
    gap: 6,
  },
  mathRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  mathRowTotal: {
    borderTopWidth: 1,
    borderTopColor: '#CBD5E1',
    paddingTop: 6,
    marginTop: 4,
  },
  discrepancyCard: {
    borderRadius: 8,
    padding: 12,
    borderWidth: 1.5,
    gap: 4,
  },
  discBalanced: {
    backgroundColor: '#F0FDF4',
    borderColor: '#22C55E',
  },
  discOver: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  discShort: {
    backgroundColor: '#FEF2F2',
    borderColor: '#EF4444',
  },
  auditRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
});
