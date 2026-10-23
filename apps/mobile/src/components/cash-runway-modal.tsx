/**
 * Cash Runway & Cost-Fluctuation Shield Modal
 * ─────────────────────────────────────────────────────────────────────────────
 * Two-tab modal:
 *  Tab 1 – Predictive Cash-Runway Calculator
 *    • Shows current cash in drawer vs. avg daily expenses → days runway
 *    • Based on real MicroExpense history (7-day rolling average)
 *
 *  Tab 2 – Dynamic Cost-Fluctuation Shield
 *    • Owner configures base cost + minimum margin % per catalog item
 *    • Shows alerts when selling price margin falls below threshold
 *    • Suggests minimum selling price to hit target margin
 */

import { useState } from 'react';
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
  computeCashRunway,
  getCostFluctuationEntries,
  getMarginAlerts,
  saveCostFluctuationEntry,
  type CostFluctuationEntry,
} from '../../lib/pos-data';

type Tab = 'runway' | 'shield';

interface Props {
  visible: boolean;
  cashInDrawer: number; // Current shift expected cash
  openingFloat: number;
  todayCashSales: number;
  todayExpenses: number;
  catalogItems: { id: string; name: string; price: number }[];
  onClose: () => void;
}

export function CashRunwayModal({
  visible,
  cashInDrawer,
  openingFloat,
  todayCashSales,
  todayExpenses,
  catalogItems,
  onClose,
}: Props) {
  const theme = useTheme();
  const [tab, setTab] = useState<Tab>('runway');

  // ── Cost-Fluctuation Shield state ──
  const [selectedItemId, setSelectedItemId] = useState('');
  const [baseCost, setBaseCost] = useState('');
  const [minMarginPct, setMinMarginPct] = useState('30');
  const [shieldSaved, setShieldSaved] = useState(false);

  const runway = computeCashRunway(
    cashInDrawer,
    openingFloat,
    todayCashSales,
    todayExpenses,
  );

  const marginAlerts = getMarginAlerts();
  const allEntries = getCostFluctuationEntries();

  const runwayColor =
    runway.runwayDays >= 14
      ? '#16803C'
      : runway.runwayDays >= 7
        ? '#D97706'
        : '#DC2626';

  function handleSaveShield() {
    const item = catalogItems.find((i) => i.id === selectedItemId);
    if (!item) return;
    const cost = parseFloat(baseCost);
    const margin = parseFloat(minMarginPct);
    if (isNaN(cost) || cost < 0 || isNaN(margin)) return;

    const entry: CostFluctuationEntry = {
      itemId: item.id,
      itemName: item.name,
      baseCostPerUnit: cost,
      sellingPrice: item.price,
      minimumMarginPct: margin,
      updatedAt: new Date().toISOString(),
    };
    saveCostFluctuationEntry(entry);
    setShieldSaved(true);
    setTimeout(() => setShieldSaved(false), 2500);
    setBaseCost('');
    setSelectedItemId('');
  }

  const selectedItem = catalogItems.find((i) => i.id === selectedItemId);
  const previewCost = parseFloat(baseCost) || 0;
  const previewMargin =
    selectedItem && previewCost > 0
      ? ((selectedItem.price - previewCost) / selectedItem.price) * 100
      : null;
  const previewSuggestedPrice =
    previewCost > 0 && parseFloat(minMarginPct) > 0
      ? previewCost / (1 - parseFloat(minMarginPct) / 100)
      : null;

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
          {/* Header */}
          <View style={styles.header}>
            <View>
              <ThemedText type="subtitle">📊 Business Intelligence</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Cash Runway & Cost Shield
              </ThemedText>
            </View>
            <Pressable
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close modal"
            >
              <ThemedText style={styles.closeBtnText}>✕</ThemedText>
            </Pressable>
          </View>

        {/* Tab bar */}
        <View style={styles.tabBar}>
          <Pressable
            onPress={() => setTab('runway')}
            style={[styles.tabBtn, tab === 'runway' && styles.tabBtnActive]}
          >
            <ThemedText
              style={[
                styles.tabBtnText,
                tab === 'runway' && styles.tabBtnTextActive,
              ]}
            >
              💰 Cash Runway
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => setTab('shield')}
            style={[styles.tabBtn, tab === 'shield' && styles.tabBtnActive]}
          >
            <ThemedText
              style={[
                styles.tabBtnText,
                tab === 'shield' && styles.tabBtnTextActive,
              ]}
            >
              🛡️ Cost Shield
              {marginAlerts.length > 0 && (
                <ThemedText style={styles.alertBadge}>
                  {' '}
                  ⚠️{marginAlerts.length}
                </ThemedText>
              )}
            </ThemedText>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── TAB 1: CASH RUNWAY ── */}
          {tab === 'runway' && (
            <View style={{ gap: Spacing.three }}>
              {/* Runway indicator */}
              <View style={[styles.runwayCard, { borderColor: runwayColor }]}>
                <ThemedText type="small" themeColor="textSecondary">
                  ESTIMATED CASH RUNWAY
                </ThemedText>
                <ThemedText style={[styles.runwayDays, { color: runwayColor }]}>
                  {runway.runwayDays >= 999 ? '∞' : runway.runwayDays}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {runway.runwayDays >= 999
                    ? 'No expense data yet — add daily expenses'
                    : `days until cash runs out at current burn rate`}
                </ThemedText>
              </View>

              {/* Stats grid */}
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Cash In Drawer
                  </ThemedText>
                  <ThemedText type="subtitle" style={{ color: '#147D92' }}>
                    K{runway.cashInDrawer.toFixed(2)}
                  </ThemedText>
                </View>
                <View style={styles.statCard}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Avg Daily Expenses
                  </ThemedText>
                  <ThemedText type="subtitle" style={{ color: '#D97706' }}>
                    K{runway.avgDailyExpenses.toFixed(2)}
                  </ThemedText>
                </View>
                <View style={styles.statCard}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Today&apos;s Cash Sales
                  </ThemedText>
                  <ThemedText type="subtitle" style={{ color: '#16803C' }}>
                    K{runway.todayCashSales.toFixed(2)}
                  </ThemedText>
                </View>
                <View style={styles.statCard}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Today&apos;s Expenses
                  </ThemedText>
                  <ThemedText type="subtitle" style={{ color: '#DC2626' }}>
                    K{runway.todayExpenses.toFixed(2)}
                  </ThemedText>
                </View>
              </View>

              {/* Runway advice */}
              <View
                style={[
                  styles.adviceCard,
                  {
                    backgroundColor:
                      runway.runwayDays < 7 ? '#FEF2F2' : '#F0FDF4',
                    borderColor: runway.runwayDays < 7 ? '#FECACA' : '#BBF7D0',
                  },
                ]}
              >
                <ThemedText type="smallBold">
                  {runway.runwayDays < 3
                    ? '🚨 CRITICAL: Cash very low — replenish immediately!'
                    : runway.runwayDays < 7
                      ? '⚠️ WARNING: Less than 1 week of operating cash remaining.'
                      : runway.runwayDays < 14
                        ? '🟡 CAUTION: 1–2 weeks runway. Plan restocking soon.'
                        : '✅ HEALTHY: Good cash runway for daily operations.'}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Based on 7-day rolling average of recorded expenses.
                </ThemedText>
              </View>
            </View>
          )}

          {/* ── TAB 2: COST-FLUCTUATION SHIELD ── */}
          {tab === 'shield' && (
            <View style={{ gap: Spacing.three }}>
              {/* Active alerts */}
              {marginAlerts.length > 0 && (
                <View style={styles.alertSection}>
                  <ThemedText type="smallBold" style={{ color: '#B91C1C' }}>
                    ⚠️ MARGIN ALERTS ({marginAlerts.length} items)
                  </ThemedText>
                  {marginAlerts.map((alert) => (
                    <View key={alert.itemId} style={styles.alertRow}>
                      <View style={{ flex: 1 }}>
                        <ThemedText type="smallBold">
                          {alert.itemName}
                        </ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          Selling K{alert.sellingPrice.toFixed(2)} | Cost K
                          {alert.baseCostPerUnit.toFixed(2)} | Margin{' '}
                          {alert.marginPct.toFixed(1)}%
                        </ThemedText>
                      </View>
                      <View style={styles.alertTag}>
                        <ThemedText style={styles.alertTagText}>
                          Suggest K{alert.suggestedPrice.toFixed(2)}
                        </ThemedText>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Configure new shield */}
              <ThemedText type="subtitle">Configure Cost Shield</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Set your base cost and minimum margin. You&apos;ll be alerted
                when prices drop below your target.
              </ThemedText>

              {/* Item selector */}
              <ThemedText type="smallBold" themeColor="textSecondary">
                SELECT ITEM
              </ThemedText>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.itemScroll}
              >
                {catalogItems.slice(0, 20).map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => setSelectedItemId(item.id)}
                    style={[
                      styles.itemChip,
                      selectedItemId === item.id && styles.itemChipActive,
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.itemChipText,
                        selectedItemId === item.id && styles.itemChipTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </ThemedText>
                  </Pressable>
                ))}
              </ScrollView>

              {selectedItem && (
                <ThemedText type="small" themeColor="textSecondary">
                  Current selling price:{' '}
                  <ThemedText type="smallBold">
                    K{selectedItem.price.toFixed(2)}
                  </ThemedText>
                </ThemedText>
              )}

              <ThemedText type="smallBold" themeColor="textSecondary">
                YOUR COST PER UNIT (K)
              </ThemedText>
              <TextInput
                accessibilityLabel="Base cost per unit"
                placeholder="e.g. 0.35"
                placeholderTextColor={theme.textSecondary}
                value={baseCost}
                onChangeText={setBaseCost}
                keyboardType="decimal-pad"
                style={[
                  styles.input,
                  {
                    color: theme.text,
                    borderColor: theme.backgroundSelected,
                    backgroundColor: theme.backgroundElement,
                  },
                ]}
              />

              <ThemedText type="smallBold" themeColor="textSecondary">
                MINIMUM MARGIN % (default 30%)
              </ThemedText>
              <TextInput
                accessibilityLabel="Minimum margin percent"
                placeholder="e.g. 30"
                placeholderTextColor={theme.textSecondary}
                value={minMarginPct}
                onChangeText={setMinMarginPct}
                keyboardType="decimal-pad"
                style={[
                  styles.input,
                  {
                    color: theme.text,
                    borderColor: theme.backgroundSelected,
                    backgroundColor: theme.backgroundElement,
                  },
                ]}
              />

              {/* Live preview */}
              {previewCost > 0 && selectedItem && (
                <View style={styles.previewCard}>
                  <ThemedText type="smallBold">Live Preview</ThemedText>
                  <View style={styles.previewRow}>
                    <ThemedText type="small" themeColor="textSecondary">
                      Current margin:
                    </ThemedText>
                    <ThemedText
                      type="smallBold"
                      style={{
                        color:
                          (previewMargin ?? 0) < parseFloat(minMarginPct)
                            ? '#DC2626'
                            : '#16803C',
                      }}
                    >
                      {previewMargin !== null
                        ? `${previewMargin.toFixed(1)}%`
                        : '—'}
                    </ThemedText>
                  </View>
                  {previewSuggestedPrice !== null && (
                    <View style={styles.previewRow}>
                      <ThemedText type="small" themeColor="textSecondary">
                        Suggested min price:
                      </ThemedText>
                      <ThemedText type="smallBold" style={{ color: '#147D92' }}>
                        K{previewSuggestedPrice.toFixed(2)}
                      </ThemedText>
                    </View>
                  )}
                </View>
              )}

              {shieldSaved && (
                <ThemedText style={styles.successText}>
                  ✅ Cost shield saved for {selectedItem?.name}
                </ThemedText>
              )}

              <Pressable
                onPress={handleSaveShield}
                disabled={!selectedItemId || !baseCost}
                style={[
                  styles.saveBtn,
                  { opacity: !selectedItemId || !baseCost ? 0.5 : 1 },
                ]}
              >
                <ThemedText style={styles.saveBtnText}>
                  🛡️ Save Cost Shield
                </ThemedText>
              </Pressable>

              {/* Existing entries */}
              {allEntries.length > 0 && (
                <View style={{ gap: Spacing.two }}>
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    CONFIGURED ITEMS ({allEntries.length})
                  </ThemedText>
                  {allEntries.map((e) => {
                    const margin =
                      e.sellingPrice > 0
                        ? ((e.sellingPrice - e.baseCostPerUnit) /
                            e.sellingPrice) *
                          100
                        : 0;
                    const ok = margin >= e.minimumMarginPct;
                    return (
                      <View key={e.itemId} style={styles.entryRow}>
                        <View style={{ flex: 1 }}>
                          <ThemedText type="smallBold" numberOfLines={1}>
                            {e.itemName}
                          </ThemedText>
                          <ThemedText type="small" themeColor="textSecondary">
                            Cost K{e.baseCostPerUnit.toFixed(2)} → Sell K
                            {e.sellingPrice.toFixed(2)} · Margin{' '}
                            {margin.toFixed(1)}%
                          </ThemedText>
                        </View>
                        <View
                          style={[
                            styles.statusBadge,
                            { backgroundColor: ok ? '#DCFCE7' : '#FEE2E2' },
                          ]}
                        >
                          <ThemedText
                            style={[
                              styles.statusBadgeText,
                              { color: ok ? '#166534' : '#991B1B' },
                            ]}
                          >
                            {ok ? '✓ OK' : '⚠ LOW'}
                          </ThemedText>
                        </View>
                      </View>
                    );
                  })}
                </View>
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
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.two,
  },
  container: {
    width: '100%',
    maxWidth: 720,
    maxHeight: '90%',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: Spacing.four,
    paddingBottom: Spacing.two,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: { fontWeight: '700', fontSize: 16 },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: Spacing.four,
    marginBottom: Spacing.two,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 4,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  tabBtnActive: { backgroundColor: '#147D92' },
  tabBtnText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  tabBtnTextActive: { color: '#FFFFFF' },
  alertBadge: { color: '#DC2626', fontWeight: '700' },
  content: {
    padding: Spacing.four,
    paddingTop: 0,
    gap: Spacing.three,
  },
  runwayCard: {
    borderRadius: 12,
    borderWidth: 2,
    padding: Spacing.four,
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
  },
  runwayDays: { fontSize: 72, fontWeight: '800', lineHeight: 80 },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: Spacing.two,
    gap: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  adviceCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: Spacing.three,
    gap: 6,
  },
  alertSection: {
    gap: Spacing.two,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 6,
    padding: Spacing.two,
  },
  alertTag: {
    backgroundColor: '#DC2626',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  alertTagText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  itemScroll: { gap: 8, paddingVertical: 4 },
  itemChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    maxWidth: 160,
  },
  itemChipActive: { backgroundColor: '#147D92', borderColor: '#147D92' },
  itemChipText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  itemChipTextActive: { color: '#FFFFFF' },
  previewCard: {
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    padding: Spacing.two,
    gap: 6,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  saveBtn: {
    backgroundColor: '#147D92',
    height: 50,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  successText: { color: '#16803C', fontWeight: '600' },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: Spacing.two,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusBadge: {
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
});
