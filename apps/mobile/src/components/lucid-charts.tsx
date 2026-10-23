import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from './themed-text';

export interface DayPerformance {
  day: string;
  revenue: number;
  cost: number;
  profit: number;
}

const DEFAULT_WEEKLY_DATA: DayPerformance[] = [
  { day: 'Mon', revenue: 2400, cost: 850, profit: 1550 },
  { day: 'Tue', revenue: 3100, cost: 1050, profit: 2050 },
  { day: 'Wed', revenue: 2850, cost: 950, profit: 1900 },
  { day: 'Thu', revenue: 3600, cost: 1200, profit: 2400 },
  { day: 'Fri', revenue: 4200, cost: 1400, profit: 2800 },
  { day: 'Sat', revenue: 4850, cost: 1650, profit: 3200 },
  { day: 'Today', revenue: 3450, cost: 1100, profit: 2350 },
];

interface RevenueProfitChartProps {
  data?: DayPerformance[];
  isDark?: boolean;
}

export function LucidRevenueProfitChart({
  data = DEFAULT_WEEKLY_DATA,
  isDark = true,
}: RevenueProfitChartProps) {
  const [selectedIdx, setSelectedIdx] = useState<number>(data.length - 1);
  const maxVal = Math.max(...data.map((d) => d.revenue), 5000);

  const selectedItem = data[selectedIdx] || data[data.length - 1];
  const marginPct =
    selectedItem.revenue > 0
      ? ((selectedItem.profit / selectedItem.revenue) * 100).toFixed(1)
      : '0.0';

  return (
    <View
      style={[
        styles.chartCard,
        {
          backgroundColor: isDark ? 'rgba(19, 46, 54, 0.7)' : '#FFFFFF',
          borderColor: isDark ? '#25464D' : '#E2E8F0',
        },
      ]}
    >
      {/* Header with Title & Live Tooltip Pill */}
      <View style={styles.chartHeaderRow}>
        <View>
          <View style={styles.badgeRow}>
            <View style={styles.chartBadgePill}>
              <ThemedText style={styles.chartBadgeText}>
                LUCID VISUALIZER
              </ThemedText>
            </View>
            <ThemedText
              style={[
                styles.chartSub,
                { color: isDark ? '#94A3B8' : '#64748B' },
              ]}
            >
              7-Day Revenue vs Profit
            </ThemedText>
          </View>
          <ThemedText
            style={[
              styles.chartTitle,
              { color: isDark ? '#FFFFFF' : '#0F172A' },
            ]}
          >
            Financial Performance Trend
          </ThemedText>
        </View>

        {/* Selected Day Stats Pill */}
        <View style={styles.activeDayPill}>
          <ThemedText style={styles.activeDayPillTitle}>
            {selectedItem.day}: Rev K{selectedItem.revenue.toLocaleString()} •
            Net{' '}
            <ThemedText style={{ color: '#34D399', fontWeight: '800' }}>
              +K{selectedItem.profit.toLocaleString()}
            </ThemedText>{' '}
            ({marginPct}%)
          </ThemedText>
        </View>
      </View>

      {/* Chart Legend */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#38BDF8' }]} />
          <ThemedText
            style={[
              styles.legendText,
              { color: isDark ? '#CBD5E1' : '#475569' },
            ]}
          >
            Gross Revenue
          </ThemedText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#34D399' }]} />
          <ThemedText
            style={[
              styles.legendText,
              { color: isDark ? '#CBD5E1' : '#475569' },
            ]}
          >
            Net Profit
          </ThemedText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#F43F5E' }]} />
          <ThemedText
            style={[
              styles.legendText,
              { color: isDark ? '#CBD5E1' : '#475569' },
            ]}
          >
            Operating Costs
          </ThemedText>
        </View>
      </View>

      {/* Bars Canvas with Grid Reference Lines */}
      <View style={styles.canvasContainer}>
        {/* Horizontal reference gridlines */}
        <View style={styles.gridLinesContainer}>
          <View style={styles.gridLineRow}>
            <ThemedText style={styles.gridLabel}>K5.0k</ThemedText>
            <View
              style={[
                styles.gridLine,
                {
                  borderColor: isDark
                    ? 'rgba(255,255,255,0.06)'
                    : 'rgba(0,0,0,0.06)',
                },
              ]}
            />
          </View>
          <View style={styles.gridLineRow}>
            <ThemedText style={styles.gridLabel}>K2.5k</ThemedText>
            <View
              style={[
                styles.gridLine,
                {
                  borderColor: isDark
                    ? 'rgba(255,255,255,0.06)'
                    : 'rgba(0,0,0,0.06)',
                },
              ]}
            />
          </View>
          <View style={styles.gridLineRow}>
            <ThemedText style={styles.gridLabel}>K0</ThemedText>
            <View
              style={[
                styles.gridLine,
                {
                  borderColor: isDark
                    ? 'rgba(255,255,255,0.1)'
                    : 'rgba(0,0,0,0.1)',
                },
              ]}
            />
          </View>
        </View>

        {/* Columns */}
        <View style={styles.barsRow}>
          {data.map((item, idx) => {
            const isSelected = idx === selectedIdx;
            const revHeight = Math.max(12, (item.revenue / maxVal) * 110);
            const profitHeight = Math.max(8, (item.profit / maxVal) * 110);

            return (
              <Pressable
                key={item.day}
                onPress={() => setSelectedIdx(idx)}
                style={[
                  styles.barColWrapper,
                  isSelected && styles.barColWrapperSelected,
                ]}
              >
                {/* Dual Bars Pair */}
                <View style={styles.barPair}>
                  {/* Revenue Bar (Cyan) */}
                  <View
                    style={[
                      styles.barFill,
                      {
                        height: revHeight,
                        backgroundColor: isSelected ? '#38BDF8' : '#0284C7',
                        opacity: isSelected ? 1 : 0.85,
                      },
                    ]}
                  />
                  {/* Profit Bar (Emerald) */}
                  <View
                    style={[
                      styles.barFill,
                      {
                        height: profitHeight,
                        backgroundColor: isSelected ? '#34D399' : '#059669',
                        opacity: isSelected ? 1 : 0.9,
                      },
                    ]}
                  />
                </View>
                <ThemedText
                  style={[
                    styles.colDayLabel,
                    isSelected && styles.colDayLabelSelected,
                    {
                      color: isSelected
                        ? '#38BDF8'
                        : isDark
                          ? '#94A3B8'
                          : '#64748B',
                    },
                  ]}
                >
                  {item.day}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

// ── Department / Sales Mix Segmented Visualizer ──────────────────────────────
export interface CategoryMix {
  label: string;
  icon: string;
  pct: number;
  amount: number;
  color: string;
}

const DEFAULT_SALES_MIX: CategoryMix[] = [
  {
    label: 'Printing & Copies',
    icon: '⚡',
    pct: 54,
    amount: 3850,
    color: '#06B6D4',
  },
  {
    label: 'Stationery & Paper',
    icon: '📄',
    pct: 26,
    amount: 1850,
    color: '#10B981',
  },
  {
    label: 'Phone Accessories',
    icon: '🔌',
    pct: 12,
    amount: 860,
    color: '#F59E0B',
  },
  {
    label: 'Snacks & Drinks',
    icon: '🍿',
    pct: 8,
    amount: 570,
    color: '#F43F5E',
  },
];

interface SalesMixChartProps {
  categories?: CategoryMix[];
  isDark?: boolean;
}

export function LucidSalesMixChart({
  categories = DEFAULT_SALES_MIX,
  isDark = true,
}: SalesMixChartProps) {
  return (
    <View
      style={[
        styles.chartCard,
        {
          backgroundColor: isDark ? 'rgba(19, 46, 54, 0.7)' : '#FFFFFF',
          borderColor: isDark ? '#25464D' : '#E2E8F0',
        },
      ]}
    >
      <View style={styles.chartHeaderRow}>
        <View>
          <ThemedText style={styles.chartBadgeText}>
            PORTFOLIO BREAKDOWN
          </ThemedText>
          <ThemedText
            style={[
              styles.chartTitle,
              { color: isDark ? '#FFFFFF' : '#0F172A', marginTop: 2 },
            ]}
          >
            Sales Mix by Category
          </ThemedText>
        </View>
        <ThemedText
          style={[styles.chartSub, { color: isDark ? '#94A3B8' : '#64748B' }]}
        >
          Total: K7,130
        </ThemedText>
      </View>

      {/* Segmented Lucid Bar */}
      <View style={styles.segmentedBarTrack}>
        {categories.map((cat) => (
          <View
            key={cat.label}
            style={[
              styles.segmentedBarFill,
              { width: `${cat.pct}%`, backgroundColor: cat.color },
            ]}
          />
        ))}
      </View>

      {/* Department Breakdown Grid */}
      <View style={styles.mixList}>
        {categories.map((cat) => (
          <View
            key={cat.label}
            style={[
              styles.mixRowItem,
              {
                backgroundColor: isDark ? 'rgba(0, 0, 0, 0.2)' : '#F8FAFC',
                borderColor: isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0',
              },
            ]}
          >
            <View style={styles.mixRowLeft}>
              <View
                style={[styles.mixIndicatorDot, { backgroundColor: cat.color }]}
              />
              <ThemedText style={{ fontSize: 13 }}>{cat.icon}</ThemedText>
              <ThemedText
                style={[
                  styles.mixLabelText,
                  { color: isDark ? '#FFFFFF' : '#0F172A' },
                ]}
                numberOfLines={1}
              >
                {cat.label}
              </ThemedText>
            </View>

            <View style={styles.mixRowRight}>
              <ThemedText
                style={[
                  styles.mixAmountText,
                  { color: isDark ? '#CBD5E1' : '#334155' },
                ]}
              >
                K{cat.amount.toLocaleString()}
              </ThemedText>
              <View
                style={[
                  styles.mixPctBadge,
                  { backgroundColor: `${cat.color}20` },
                ]}
              >
                <ThemedText style={[styles.mixPctText, { color: cat.color }]}>
                  {cat.pct}%
                </ThemedText>
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chartCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 14,
    gap: 10,
  },
  chartHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  chartBadgePill: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
  },
  chartBadgeText: {
    color: '#38BDF8',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  chartSub: {
    fontSize: 11,
    fontWeight: '600',
  },
  chartTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  activeDayPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  activeDayPillTitle: {
    color: '#EFF8F5',
    fontSize: 11,
    fontWeight: '700',
  },
  legendRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    marginTop: -2,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 10,
    fontWeight: '700',
  },

  // Bars Canvas
  canvasContainer: {
    height: 130,
    position: 'relative',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  gridLinesContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 20,
    justifyContent: 'space-between',
  },
  gridLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  gridLabel: {
    fontSize: 8,
    color: '#64748B',
    width: 24,
    textAlign: 'right',
  },
  gridLine: {
    flex: 1,
    borderBottomWidth: 1,
  },
  barsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    paddingLeft: 24,
    height: 120,
  },
  barColWrapper: {
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 6,
  },
  barColWrapperSelected: {
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
  },
  barPair: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
  },
  barFill: {
    width: 8,
    borderRadius: 4,
  },
  colDayLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
  },
  colDayLabelSelected: {
    fontWeight: '900',
  },

  // Segmented Mix
  segmentedBarTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    flexDirection: 'row',
    overflow: 'hidden',
    marginVertical: 4,
  },
  segmentedBarFill: {
    height: '100%',
  },
  mixList: {
    gap: 6,
  },
  mixRowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  mixRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  mixIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  mixLabelText: {
    fontSize: 12,
    fontWeight: '700',
  },
  mixRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mixAmountText: {
    fontSize: 12,
    fontWeight: '800',
  },
  mixPctBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  mixPctText: {
    fontSize: 11,
    fontWeight: '800',
  },
});
