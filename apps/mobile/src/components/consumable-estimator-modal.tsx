/**
 * AI-Powered Paper & Ink Consumable Estimator Modal
 * ─────────────────────────────────────────────────────────────────────────────
 * Tracks cumulative page counts across sessions and estimates:
 *  - Days of paper reams remaining (1 ream = 500 sheets)
 *  - Days of B/W ink cartridge remaining (~2,500 pages/cartridge)
 *  - Days of colour ink cartridge remaining (~1,300 pages/cartridge)
 * Based on 7-day rolling average of usage.
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
  estimateConsumableRunway,
  getConsumableStock,
  logConsumableSession,
  saveConsumableStock,
  type ConsumableSession,
  type ConsumableStock,
} from '../../lib/pos-data';

type Tab = 'dashboard' | 'log' | 'stock';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const GAUGE_COLORS = {
  good: '#16803C',
  warn: '#D97706',
  critical: '#DC2626',
};

function daysColor(days: number): string {
  if (days >= 7) return GAUGE_COLORS.good;
  if (days >= 3) return GAUGE_COLORS.warn;
  return GAUGE_COLORS.critical;
}

function DaysGauge({
  label,
  days,
  unit,
}: {
  label: string;
  days: number;
  unit: string;
}) {
  const color = daysColor(days);
  const display = days >= 999 ? '∞' : String(days);
  return (
    <View style={[gaugeStyles.card, { borderColor: color }]}>
      <ThemedText
        type="small"
        themeColor="textSecondary"
        style={{ textAlign: 'center' }}
      >
        {label}
      </ThemedText>
      <ThemedText style={[gaugeStyles.value, { color }]}>{display}</ThemedText>
      <ThemedText
        type="small"
        themeColor="textSecondary"
        style={{ textAlign: 'center' }}
      >
        {days >= 999 ? 'no data' : `days of ${unit}`}
      </ThemedText>
    </View>
  );
}

const gaugeStyles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 90,
    borderRadius: 10,
    borderWidth: 2,
    padding: Spacing.two,
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
  },
  value: { fontSize: 40, fontWeight: '800', lineHeight: 48 },
});

export function ConsumableEstimatorModal({ visible, onClose }: Props) {
  const theme = useTheme();
  const [tab, setTab] = useState<Tab>('dashboard');

  // Log session state
  const [bwPages, setBwPages] = useState('');
  const [colorPages, setColorPages] = useState('');
  const [photoPages, setPhotoPages] = useState('');
  const [logSaved, setLogSaved] = useState(false);

  // Stock update state
  const [stockState, setStockState] =
    useState<ConsumableStock>(getConsumableStock);
  const [stockSaved, setStockSaved] = useState(false);

  const estimate = estimateConsumableRunway();

  function handleLogSession() {
    const bw = parseInt(bwPages, 10) || 0;
    const color = parseInt(colorPages, 10) || 0;
    const photo = parseInt(photoPages, 10) || 0;
    const totalSheets = bw + color + photo;

    // Rough ink yield: B/W = 0.0004 carts/page, Color = 0.0008, Photo = 0.001
    const inkUsed = bw * 0.0004 + color * 0.0008 + photo * 0.001;

    const session: ConsumableSession = {
      id: `cs-${Date.now()}`,
      date: new Date().toISOString(),
      bwPages: bw,
      colorPages: color,
      photoPages: photo,
      inkCartridgesUsed: Math.round(inkUsed * 1000) / 1000,
      paperSheetsUsed: totalSheets,
    };
    logConsumableSession(session);
    setBwPages('');
    setColorPages('');
    setPhotoPages('');
    setLogSaved(true);
    setTimeout(() => {
      setLogSaved(false);
      setTab('dashboard');
    }, 1800);
  }

  function handleSaveStock() {
    saveConsumableStock({
      ...stockState,
      lastUpdated: new Date().toISOString(),
    });
    setStockSaved(true);
    setTimeout(() => setStockSaved(false), 2000);
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
          {/* Header */}
          <View style={styles.header}>
            <View>
              <ThemedText type="subtitle">🖨️ Consumable Estimator</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                AI-powered paper & ink runway
              </ThemedText>
            </View>
            <Pressable
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <ThemedText style={styles.closeBtnText}>✕</ThemedText>
            </Pressable>
          </View>

        {/* Tabs */}
        <View style={styles.tabBar}>
          {(
            [
              { id: 'dashboard', label: '📊 Dashboard' },
              { id: 'log', label: '➕ Log Usage' },
              { id: 'stock', label: '📦 Update Stock' },
            ] as { id: Tab; label: string }[]
          ).map((t) => (
            <Pressable
              key={t.id}
              onPress={() => setTab(t.id)}
              style={[styles.tabBtn, tab === t.id && styles.tabBtnActive]}
            >
              <ThemedText
                style={[
                  styles.tabBtnText,
                  tab === t.id && styles.tabBtnTextActive,
                ]}
              >
                {t.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── DASHBOARD ── */}
          {tab === 'dashboard' && (
            <View style={{ gap: Spacing.three }}>
              {/* Runway gauges */}
              <ThemedText type="smallBold" themeColor="textSecondary">
                ESTIMATED DAYS REMAINING
              </ThemedText>
              <View style={styles.gaugeRow}>
                <DaysGauge
                  label="📄 Paper\nReams"
                  days={estimate.paperDaysLeft}
                  unit="paper"
                />
                <DaysGauge
                  label="🖤 B/W\nInk"
                  days={estimate.bwInkDaysLeft}
                  unit="B/W ink"
                />
                <DaysGauge
                  label="🎨 Color\nInk"
                  days={estimate.colorInkDaysLeft}
                  unit="color ink"
                />
              </View>

              {/* Alerts */}
              {(estimate.lowPaper ||
                estimate.lowBwInk ||
                estimate.lowColorInk) && (
                <View style={styles.alertCard}>
                  <ThemedText type="smallBold" style={{ color: '#B91C1C' }}>
                    🚨 REORDER NOW
                  </ThemedText>
                  {estimate.lowPaper && (
                    <ThemedText type="small" style={{ color: '#991B1B' }}>
                      • Paper reams critically low (≤3 days)
                    </ThemedText>
                  )}
                  {estimate.lowBwInk && (
                    <ThemedText type="small" style={{ color: '#991B1B' }}>
                      • B/W ink cartridges critically low (≤3 days)
                    </ThemedText>
                  )}
                  {estimate.lowColorInk && (
                    <ThemedText type="small" style={{ color: '#991B1B' }}>
                      • Color ink cartridges critically low (≤3 days)
                    </ThemedText>
                  )}
                </View>
              )}

              {/* Usage stats */}
              <ThemedText type="smallBold" themeColor="textSecondary">
                7-DAY AVERAGE DAILY USAGE
              </ThemedText>
              <View style={styles.usageGrid}>
                <View style={styles.usageCard}>
                  <ThemedText type="small" themeColor="textSecondary">
                    B/W Pages/day
                  </ThemedText>
                  <ThemedText type="subtitle">
                    {estimate.avgDailyBwPages}
                  </ThemedText>
                </View>
                <View style={styles.usageCard}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Color Pages/day
                  </ThemedText>
                  <ThemedText type="subtitle">
                    {estimate.avgDailyColorPages}
                  </ThemedText>
                </View>
                <View style={styles.usageCard}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Sheets/day
                  </ThemedText>
                  <ThemedText type="subtitle">
                    {estimate.avgDailySheets}
                  </ThemedText>
                </View>
              </View>

              {/* Current stock */}
              <ThemedText type="smallBold" themeColor="textSecondary">
                CURRENT STOCK
              </ThemedText>
              <View style={styles.usageGrid}>
                <View style={styles.usageCard}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Paper Reams
                  </ThemedText>
                  <ThemedText type="subtitle">
                    {stockState.a4ReemsInStock}
                  </ThemedText>
                </View>
                <View style={styles.usageCard}>
                  <ThemedText type="small" themeColor="textSecondary">
                    B/W Cartridges
                  </ThemedText>
                  <ThemedText type="subtitle">
                    {stockState.inkCartridgesInStock}
                  </ThemedText>
                </View>
                <View style={styles.usageCard}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Color Cartridges
                  </ThemedText>
                  <ThemedText type="subtitle">
                    {stockState.colorCartridgesInStock}
                  </ThemedText>
                </View>
              </View>

              <ThemedText type="small" themeColor="textSecondary">
                💡 B/W yield: ~2,500 pages/cartridge · Color yield: ~1,300
                pages/cartridge · 1 ream = 500 sheets
              </ThemedText>
            </View>
          )}

          {/* ── LOG USAGE ── */}
          {tab === 'log' && (
            <View style={{ gap: Spacing.two }}>
              <ThemedText type="subtitle">
                Log Today&apos;s Print Usage
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Enter the number of pages printed/copied today to update the AI
                estimator.
              </ThemedText>

              <ThemedText type="smallBold" themeColor="textSecondary">
                B/W PAGES (photocopies + B/W prints)
              </ThemedText>
              <TextInput
                accessibilityLabel="Black and white pages"
                placeholder="e.g. 120"
                placeholderTextColor={theme.textSecondary}
                value={bwPages}
                onChangeText={setBwPages}
                keyboardType="number-pad"
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
                COLOR PAGES (color prints)
              </ThemedText>
              <TextInput
                accessibilityLabel="Color pages"
                placeholder="e.g. 25"
                placeholderTextColor={theme.textSecondary}
                value={colorPages}
                onChangeText={setColorPages}
                keyboardType="number-pad"
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
                PHOTO PAGES (glossy / passport photos)
              </ThemedText>
              <TextInput
                accessibilityLabel="Photo pages"
                placeholder="e.g. 12"
                placeholderTextColor={theme.textSecondary}
                value={photoPages}
                onChangeText={setPhotoPages}
                keyboardType="number-pad"
                style={[
                  styles.input,
                  {
                    color: theme.text,
                    borderColor: theme.backgroundSelected,
                    backgroundColor: theme.backgroundElement,
                  },
                ]}
              />

              {logSaved && (
                <ThemedText style={styles.successText}>
                  ✅ Usage logged! Estimator updated.
                </ThemedText>
              )}

              <Pressable
                onPress={handleLogSession}
                disabled={!bwPages && !colorPages && !photoPages}
                style={[
                  styles.saveBtn,
                  {
                    opacity: !bwPages && !colorPages && !photoPages ? 0.5 : 1,
                  },
                ]}
              >
                <ThemedText style={styles.saveBtnText}>
                  📊 Log Session
                </ThemedText>
              </Pressable>
            </View>
          )}

          {/* ── UPDATE STOCK ── */}
          {tab === 'stock' && (
            <View style={{ gap: Spacing.two }}>
              <ThemedText type="subtitle">Update Consumable Stock</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Update when you receive new stock. This recalibrates the
                estimator immediately.
              </ThemedText>

              <ThemedText type="smallBold" themeColor="textSecondary">
                A4 PAPER REAMS IN STOCK
              </ThemedText>
              <TextInput
                accessibilityLabel="A4 paper reams"
                placeholder="e.g. 5"
                placeholderTextColor={theme.textSecondary}
                value={String(stockState.a4ReemsInStock)}
                onChangeText={(v) =>
                  setStockState((s) => ({
                    ...s,
                    a4ReemsInStock: parseInt(v, 10) || 0,
                  }))
                }
                keyboardType="number-pad"
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
                B/W INK CARTRIDGES IN STOCK
              </ThemedText>
              <TextInput
                accessibilityLabel="B/W ink cartridges"
                placeholder="e.g. 2"
                placeholderTextColor={theme.textSecondary}
                value={String(stockState.inkCartridgesInStock)}
                onChangeText={(v) =>
                  setStockState((s) => ({
                    ...s,
                    inkCartridgesInStock: parseInt(v, 10) || 0,
                  }))
                }
                keyboardType="number-pad"
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
                COLOR INK CARTRIDGES IN STOCK
              </ThemedText>
              <TextInput
                accessibilityLabel="Color ink cartridges"
                placeholder="e.g. 1"
                placeholderTextColor={theme.textSecondary}
                value={String(stockState.colorCartridgesInStock)}
                onChangeText={(v) =>
                  setStockState((s) => ({
                    ...s,
                    colorCartridgesInStock: parseInt(v, 10) || 0,
                  }))
                }
                keyboardType="number-pad"
                style={[
                  styles.input,
                  {
                    color: theme.text,
                    borderColor: theme.backgroundSelected,
                    backgroundColor: theme.backgroundElement,
                  },
                ]}
              />

              {stockSaved && (
                <ThemedText style={styles.successText}>
                  ✅ Stock levels saved!
                </ThemedText>
              )}

              <Pressable onPress={handleSaveStock} style={styles.saveBtn}>
                <ThemedText style={styles.saveBtnText}>
                  💾 Save Stock Levels
                </ThemedText>
              </Pressable>
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
  tabBtnText: { fontSize: 11, fontWeight: '600', color: '#64748B' },
  tabBtnTextActive: { color: '#FFFFFF' },
  content: {
    padding: Spacing.four,
    paddingTop: 0,
    gap: Spacing.two,
  },
  gaugeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  alertCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: Spacing.three,
    gap: 6,
  },
  usageGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  usageCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: Spacing.two,
    gap: 4,
    alignItems: 'center',
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  saveBtn: {
    backgroundColor: '#147D92',
    height: 50,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.two,
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  successText: { color: '#16803C', fontWeight: '600' },
});
