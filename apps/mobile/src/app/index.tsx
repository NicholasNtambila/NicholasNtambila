import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
    Image,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    useWindowDimensions,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CashRunwayModal } from '@/components/cash-runway-modal';
import { ConsumableEstimatorModal } from '@/components/consumable-estimator-modal';
import { DashboardSettingsModal } from '@/components/dashboard-settings-modal';
import {
    InventoryRestockModal,
    type RestockTarget,
} from '@/components/inventory-restock-modal';
import {
    LucidRevenueProfitChart,
    LucidSalesMixChart,
} from '@/components/lucid-charts';
import { MicroExpenseModal } from '@/components/micro-expense-modal';
import { PrintJobCalculator } from '@/components/print-job-calculator';
import { QuotationModal } from '@/components/quotation-modal';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';
import {
    computeCashRunway,
    DEFAULT_UNIFIED_CATALOG,
    estimateConsumableRunway,
    getActiveShift,
    getConsumableStock,
    getDebtEntries,
    getMarginAlerts,
    getMicroExpenses,
    saveActiveShift,
    updateDebtEntry,
    type DebtEntry,
} from '../../lib/pos-data';
import { supabase } from '../../lib/supabase';

type Branch = { id: string; name: string };
type ProfitLoss = {
  product_revenue: number;
  service_revenue: number;
  cost_of_goods: number;
  operating_expenses: number;
  labour_cost: number;
  net_profit: number;
};

const DEFAULT_BRANCHES: Branch[] = [
  { id: 'branch-primary', name: '🏢 Main Retail & Services Branch' },
  { id: 'branch-cbd', name: '🏪 CBD Express Kiosk' },
];

const money = (value: number) => `K${Number(value || 0).toFixed(2)}`;

export default function HomeScreen() {
  const auth = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 860;

  const tenantId = auth.activeBusiness?.tenantId || 'tenant-ntambila-primary';
  const businessName =
    auth.activeBusiness?.name || 'Nicholas Ntambila Retail & Services';
  const userName =
    auth.session?.user.user_metadata?.full_name ||
    auth.session?.user.user_metadata?.display_name ||
    'Nicholas Ntambila';
  const roleName = auth.activeBusiness?.role || 'Owner';

  // Visual Theme Mode: Dark (Lucid) by default
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Active view states
  const [branches, setBranches] = useState<Branch[]>(DEFAULT_BRANCHES);
  const [branchId, setBranchId] = useState<string>('branch-primary');
  const [period, setPeriod] = useState<'today' | '7d' | '30d'>('today');
  const [summary, setSummary] = useState<ProfitLoss | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Modals state
  const [showRunwayModal, setShowRunwayModal] = useState(false);
  const [showConsumablesModal, setShowConsumablesModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [showPrintCalc, setShowPrintCalc] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showQuotationModal, setShowQuotationModal] = useState(false);
  const [restockTarget, setRestockTarget] = useState<RestockTarget | null>(
    null,
  );

  // Debt payment collection state
  const [selectedDebt, setSelectedDebt] = useState<DebtEntry | null>(null);
  const [collectAmount, setCollectAmount] = useState('');
  const [collectSuccess, setCollectSuccess] = useState<string | null>(null);

  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function signOut() {
    setSignOutError(null);
    setIsSigningOut(true);
    try {
      await auth.signOut();
    } catch {
      setSignOutError('Could not sign out. Check connection and retry.');
    } finally {
      setIsSigningOut(false);
    }
  }

  // Load branches
  useEffect(() => {
    if (!tenantId || !supabase) return;
    void supabase
      .from('branches')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .order('name')
      .then(({ data, error: loadError }) => {
        if (loadError || !data || data.length === 0) {
          setBranches(DEFAULT_BRANCHES);
          setBranchId(DEFAULT_BRANCHES[0].id);
          return;
        }
        const next = data as Branch[];
        setBranches(next);
        setBranchId((curr) =>
          curr && next.some((b) => b.id === curr) ? curr : next[0].id,
        );
      });
  }, [tenantId]);

  // Load Profit & Loss
  useEffect(() => {
    let isCurrent = true;
    if (!tenantId || !branchId || !supabase) return;

    void supabase
      .rpc('branch_profit_loss', {
        target_tenant_id: tenantId,
        target_branch_id: branchId,
      })
      .then(({ data, error: loadError }) => {
        if (!isCurrent) return;
        if (!loadError && data && data.length > 0) {
          setSummary(data[0] as ProfitLoss);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [tenantId, branchId, refreshKey]);

  // Pos Store Live Data
  const activeShift = useMemo(() => {
    void refreshKey;
    return getActiveShift();
  }, [refreshKey]);

  const microExpenses = useMemo(() => {
    void refreshKey;
    return getMicroExpenses();
  }, [refreshKey]);

  const debtEntries = useMemo(() => {
    void refreshKey;
    return getDebtEntries();
  }, [refreshKey]);

  const consumableStock = useMemo(() => {
    void refreshKey;
    return getConsumableStock();
  }, [refreshKey]);

  const consumableRunway = useMemo(() => {
    void refreshKey;
    return estimateConsumableRunway();
  }, [refreshKey]);

  const marginAlerts = useMemo(() => {
    void refreshKey;
    return getMarginAlerts();
  }, [refreshKey]);

  // Live Totals
  const todayPettyExpenses = useMemo(
    () => microExpenses.reduce((sum, e) => sum + e.amount, 0),
    [microExpenses],
  );

  const activeCashSales = activeShift?.cashSales ?? 0;
  const cashInDrawer = activeShift
    ? activeShift.openingFloat +
      activeShift.cashSales -
      activeShift.cashExpenses
    : 1250.0;

  const cashRunway = useMemo(
    () =>
      computeCashRunway(
        cashInDrawer,
        activeShift?.openingFloat ?? 500,
        activeCashSales > 0 ? activeCashSales : 1850,
        todayPettyExpenses > 0 ? todayPettyExpenses : 350,
      ),
    [cashInDrawer, activeShift, activeCashSales, todayPettyExpenses],
  );

  const productRev = summary?.product_revenue
    ? Number(summary.product_revenue)
    : activeCashSales > 0
      ? activeCashSales * 0.65
      : 2150.0;

  const serviceRev = summary?.service_revenue
    ? Number(summary.service_revenue)
    : activeCashSales > 0
      ? activeCashSales * 0.35
      : 1100.0;

  const totalRevenue = productRev + serviceRev;

  const stockCost = summary?.cost_of_goods
    ? Number(summary.cost_of_goods)
    : productRev * 0.38;

  const operatingExpenses = summary?.operating_expenses
    ? Number(summary.operating_expenses)
    : todayPettyExpenses > 0
      ? todayPettyExpenses
      : 420.0;

  const labourCost = summary?.labour_cost ? Number(summary.labour_cost) : 150.0;

  const netProfit = summary?.net_profit
    ? Number(summary.net_profit)
    : totalRevenue - stockCost - operatingExpenses - labourCost;

  const netMarginPct =
    totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : '0.0';

  const totalCustomerDebt = useMemo(
    () =>
      debtEntries
        .filter((d) => d.status !== 'cleared')
        .reduce((sum, d) => sum + d.balance, 0),
    [debtEntries],
  );

  const activeDebtorsCount = useMemo(
    () => debtEntries.filter((d) => d.status !== 'cleared').length,
    [debtEntries],
  );

  // Handle Quick Debt Collection
  function handleConfirmDebtPayment() {
    if (!selectedDebt) return;
    const amount = parseFloat(collectAmount);
    if (isNaN(amount) || amount <= 0) return;

    updateDebtEntry(selectedDebt.id, amount);

    const shift = getActiveShift();
    if (shift) {
      shift.cashSales = (shift.cashSales || 0) + amount;
      saveActiveShift(shift);
    }

    setCollectSuccess(
      `✓ Collected ${money(amount)} from ${selectedDebt.customerName}.`,
    );
    setTimeout(() => {
      setSelectedDebt(null);
      setCollectAmount('');
      setCollectSuccess(null);
      setRefreshKey((k) => k + 1);
    }, 1500);
  }

  // Theme-aware color palette
  const themeColors = isDarkMode
    ? {
        bg: '#0B2027',
        sideNavBg: '#08191F',
        cardBg: '#132E36',
        cardBorder: '#25464D',
        text: '#EFF8F5',
        subText: '#94A3B8',
        accent: '#147D92',
        itemHover: 'rgba(255,255,255,0.06)',
      }
    : {
        bg: '#F8FAFC',
        sideNavBg: '#FFFFFF',
        cardBg: '#FFFFFF',
        cardBorder: '#E2E8F0',
        text: '#0F172A',
        subText: '#64748B',
        accent: '#0284C7',
        itemHover: 'rgba(0,0,0,0.04)',
      };

  return (
    <SafeAreaView
      style={[styles.rootViewport, { backgroundColor: themeColors.bg }]}
    >
      <View
        style={[
          styles.container,
          isDesktop ? styles.desktopLayout : styles.mobileLayout,
        ]}
      >
        {/* ═══════════════════════════════════════════════════════════════════════
            LEFT SIDE NAVIGATION & SHORTCUTS (LUCID MODERN SIDEBAR)
           ═══════════════════════════════════════════════════════════════════════ */}
        <View
          style={[
            isDesktop ? styles.sideNavDesktop : styles.sideNavMobile,
            {
              backgroundColor: themeColors.sideNavBg,
              borderColor: themeColors.cardBorder,
            },
          ]}
        >
          {/* Logo & Brand Header */}
          <View style={styles.brandRow}>
            <Image
              source={require('../../assets/images/sanit3ch-logo.png')}
              style={{ width: 44, height: 44, resizeMode: 'contain' }}
            />
            <View style={{ flex: 1 }}>
              <ThemedText
                style={[styles.logoBrandName, { color: themeColors.text }]}
                numberOfLines={1}
              >
                SaniT3ch
              </ThemedText>
              <ThemedText
                style={[styles.logoSubName, { color: themeColors.subText }]}
                numberOfLines={1}
              >
                Powering the Digital Pulse
              </ThemedText>
            </View>
          </View>

          {/* Station Status Chip */}
          <View
            style={[
              styles.stationStatusChip,
              { borderColor: 'rgba(16, 185, 129, 0.4)' },
            ]}
          >
            <View style={styles.liveGreenDot} />
            <ThemedText style={styles.stationStatusText}>
              Station Live • {userName.split(' ')[0]}
            </ThemedText>
          </View>

          {/* Main Navigation Menu */}
          <View style={styles.navSection}>
            <ThemedText
              style={[styles.navSectionHeader, { color: themeColors.subText }]}
            >
              MENU
            </ThemedText>

            <Pressable
              style={[
                styles.navItem,
                styles.navItemActive,
                { backgroundColor: isDarkMode ? '#147D92' : '#0284C7' },
              ]}
            >
              <ThemedText style={styles.navItemIcon}>📊</ThemedText>
              <ThemedText style={styles.navItemTextActive}>
                Dashboard
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={() => router.push('/sell')}
              style={[
                styles.navItem,
                { backgroundColor: themeColors.itemHover },
              ]}
            >
              <ThemedText style={styles.navItemIcon}>🛒</ThemedText>
              <ThemedText
                style={[styles.navItemText, { color: themeColors.text }]}
              >
                POS Cashier
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={() => router.push('/operations')}
              style={[
                styles.navItem,
                { backgroundColor: themeColors.itemHover },
              ]}
            >
              <ThemedText style={styles.navItemIcon}>⚡</ThemedText>
              <ThemedText
                style={[styles.navItemText, { color: themeColors.text }]}
              >
                Services
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={() => router.push('/history')}
              style={[
                styles.navItem,
                { backgroundColor: themeColors.itemHover },
              ]}
            >
              <ThemedText style={styles.navItemIcon}>📜</ThemedText>
              <ThemedText
                style={[styles.navItemText, { color: themeColors.text }]}
              >
                Ledgers & Debt
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={() => router.push('/catalog')}
              style={[
                styles.navItem,
                { backgroundColor: themeColors.itemHover },
              ]}
            >
              <ThemedText style={styles.navItemIcon}>📦</ThemedText>
              <ThemedText
                style={[styles.navItemText, { color: themeColors.text }]}
              >
                Catalogue
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={() => router.push('/owner')}
              style={[
                styles.navItem,
                { backgroundColor: themeColors.itemHover },
              ]}
            >
              <ThemedText style={styles.navItemIcon}>📈</ThemedText>
              <ThemedText
                style={[styles.navItemText, { color: themeColors.text }]}
              >
                Owner Portal
              </ThemedText>
            </Pressable>
          </View>

          {/* Quick Shortcuts */}
          <View style={styles.navSection}>
            <ThemedText
              style={[styles.navSectionHeader, { color: themeColors.subText }]}
            >
              FAST SHORTCUTS
            </ThemedText>

            <Pressable
              onPress={() => setShowQuotationModal(true)}
              style={styles.shortcutBtn}
            >
              <ThemedText style={styles.shortcutIcon}>📄</ThemedText>
              <ThemedText style={styles.shortcutText}>
                Official Quotation
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={() => setShowExpenseModal(true)}
              style={styles.shortcutBtn}
            >
              <ThemedText style={styles.shortcutIcon}>🪙</ThemedText>
              <ThemedText style={styles.shortcutText}>
                Log Petty Expense
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={() => {
                const sampleItem = DEFAULT_UNIFIED_CATALOG[0];
                setRestockTarget({
                  id: sampleItem.id,
                  name: sampleItem.name,
                  currentStock: sampleItem.available,
                  type: sampleItem.type,
                });
                setShowRestockModal(true);
              }}
              style={styles.shortcutBtn}
            >
              <ThemedText style={styles.shortcutIcon}>⚡</ThemedText>
              <ThemedText style={styles.shortcutText}>
                1-Click Restock
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={() => setShowPrintCalc(true)}
              style={styles.shortcutBtn}
            >
              <ThemedText style={styles.shortcutIcon}>🖨️</ThemedText>
              <ThemedText style={styles.shortcutText}>
                Copy/Print Estimator
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={() => setShowRunwayModal(true)}
              style={styles.shortcutBtn}
            >
              <ThemedText style={styles.shortcutIcon}>📊</ThemedText>
              <ThemedText style={styles.shortcutText}>
                Runway & Shield
              </ThemedText>
            </Pressable>
          </View>

          {/* Bottom Utility Controls */}
          <View
            style={[
              styles.sideNavBottom,
              { borderTopColor: themeColors.cardBorder },
            ]}
          >
            {/* Dark / Light Mode Switch */}
            <Pressable
              onPress={() => setIsDarkMode((prev) => !prev)}
              style={[
                styles.themeSwitchBtn,
                { backgroundColor: themeColors.itemHover },
              ]}
            >
              <ThemedText style={styles.themeSwitchIcon}>
                {isDarkMode ? '🌙' : '☀️'}
              </ThemedText>
              <ThemedText
                style={[styles.themeSwitchText, { color: themeColors.text }]}
              >
                {isDarkMode ? 'Dark Mode' : 'Light Mode'}
              </ThemedText>
            </Pressable>

            {/* Settings Trigger */}
            <Pressable
              onPress={() => setShowSettingsModal(true)}
              style={[
                styles.themeSwitchBtn,
                { backgroundColor: themeColors.itemHover },
              ]}
            >
              <ThemedText style={styles.themeSwitchIcon}>⚙️</ThemedText>
              <ThemedText
                style={[styles.themeSwitchText, { color: themeColors.text }]}
              >
                Settings
              </ThemedText>
            </Pressable>

            {/* Logout */}
            <Pressable
              disabled={isSigningOut}
              onPress={() => void signOut()}
              style={styles.logoutBtn}
            >
              <ThemedText style={styles.logoutIcon}>🚪</ThemedText>
              <ThemedText style={styles.logoutText}>
                {isSigningOut ? 'Signing out…' : 'Logout'}
              </ThemedText>
            </Pressable>
          </View>
        </View>

        {/* ═══════════════════════════════════════════════════════════════════════
            MAIN EXECUTIVE DASHBOARD CANVAS (CLEAN NON-SCROLLABLE FIT)
           ═══════════════════════════════════════════════════════════════════════ */}
        <View style={styles.mainCanvas}>
          {/* Top Menu Bar */}
          <View
            style={[
              styles.topMenuBar,
              {
                backgroundColor: themeColors.sideNavBg,
                borderColor: themeColors.cardBorder,
              },
            ]}
          >
            {/* Breadcrumbs / Page Title */}
            <View style={styles.topMenuLeft}>
              <ThemedText
                style={[styles.breadcrumbText, { color: themeColors.subText }]}
              >
                Dashboard / Executive CRM Command Center
              </ThemedText>
            </View>

            {/* Branch Selector Pills */}
            <View style={styles.topMenuCenter}>
              {branches.map((b) => {
                const active = b.id === branchId;
                return (
                  <Pressable
                    key={b.id}
                    onPress={() => setBranchId(b.id)}
                    style={[
                      styles.topBranchPill,
                      active && {
                        backgroundColor: isDarkMode ? '#147D92' : '#0284C7',
                        borderColor: '#38BDF8',
                      },
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.topBranchPillText,
                        active
                          ? { color: '#FFFFFF' }
                          : { color: themeColors.subText },
                      ]}
                    >
                      {b.name.split(' ')[0]} {b.name.split(' ')[1]}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>

            {/* Period Filter & User Pill */}
            <View style={styles.topMenuRight}>
              <View
                style={[
                  styles.periodSelectorBar,
                  { backgroundColor: themeColors.itemHover },
                ]}
              >
                {(['today', '7d', '30d'] as const).map((p) => (
                  <Pressable
                    key={p}
                    onPress={() => setPeriod(p)}
                    style={[
                      styles.periodPillBtn,
                      period === p && {
                        backgroundColor: isDarkMode ? '#25464D' : '#E2E8F0',
                      },
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.periodPillText,
                        period === p
                          ? { color: themeColors.text }
                          : { color: themeColors.subText },
                      ]}
                    >
                      {p === 'today' ? 'Today' : p === '7d' ? '7D' : '30D'}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>

              <View style={styles.userStationPill}>
                <ThemedText style={styles.userStationPillText}>
                  {roleName.toUpperCase()}
                </ThemedText>
              </View>
            </View>
          </View>

          {signOutError && (
            <ThemedText style={styles.signOutErrorBanner}>
              {signOutError}
            </ThemedText>
          )}

          {/* Dashboard Canvas Container */}
          <ScrollView
            contentContainerStyle={styles.canvasScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Top KPI Row */}
            <View style={styles.kpiRow}>
              {/* Net Profit Hero Card */}
              <View
                style={[
                  styles.heroProfitCard,
                  {
                    backgroundColor: isDarkMode ? '#0F2F38' : '#ECFDF5',
                    borderColor: '#10B981',
                  },
                ]}
              >
                <View style={styles.heroProfitTop}>
                  <ThemedText style={styles.heroProfitLabel}>
                    NET PROFIT TODAY
                  </ThemedText>
                  <View style={styles.profitMarginBadge}>
                    <ThemedText style={styles.profitMarginText}>
                      ▲ {netMarginPct}%
                    </ThemedText>
                  </View>
                </View>
                <ThemedText style={styles.heroProfitValue}>
                  {money(netProfit)}
                </ThemedText>
                <ThemedText
                  style={[
                    styles.heroProfitSub,
                    { color: isDarkMode ? '#A7F3D0' : '#047857' },
                  ]}
                >
                  Gross: {money(totalRevenue)} • Costs: −
                  {money(stockCost + operatingExpenses)}
                </ThemedText>
              </View>

              {/* KPI: Gross Revenue */}
              <View
                style={[
                  styles.kpiBox,
                  {
                    backgroundColor: themeColors.cardBg,
                    borderColor: '#0284C7',
                  },
                ]}
              >
                <View style={styles.kpiBoxHeader}>
                  <ThemedText style={styles.kpiBoxTitle}>REVENUE</ThemedText>
                  <ThemedText style={{ fontSize: 13 }}>📈</ThemedText>
                </View>
                <ThemedText style={[styles.kpiBoxValue, { color: '#0284C7' }]}>
                  {money(totalRevenue)}
                </ThemedText>
                <ThemedText
                  style={[styles.kpiBoxSub, { color: themeColors.subText }]}
                >
                  Products {money(productRev)} • Services {money(serviceRev)}
                </ThemedText>
              </View>

              {/* KPI: Operating Expenses */}
              <View
                style={[
                  styles.kpiBox,
                  {
                    backgroundColor: themeColors.cardBg,
                    borderColor: '#E11D48',
                  },
                ]}
              >
                <View style={styles.kpiBoxHeader}>
                  <ThemedText style={styles.kpiBoxTitle}>EXPENSES</ThemedText>
                  <ThemedText style={{ fontSize: 13 }}>💸</ThemedText>
                </View>
                <ThemedText style={[styles.kpiBoxValue, { color: '#E11D48' }]}>
                  {money(operatingExpenses)}
                </ThemedText>
                <ThemedText
                  style={[styles.kpiBoxSub, { color: themeColors.subText }]}
                >
                  {microExpenses.length} entries • ZESCO, Meals, Transit
                </ThemedText>
              </View>

              {/* KPI: Register Cash & Runway */}
              <View
                style={[
                  styles.kpiBox,
                  {
                    backgroundColor: themeColors.cardBg,
                    borderColor: '#D97706',
                  },
                ]}
              >
                <View style={styles.kpiBoxHeader}>
                  <ThemedText style={styles.kpiBoxTitle}>
                    DRAWER CASH
                  </ThemedText>
                  <ThemedText style={{ fontSize: 13 }}>💰</ThemedText>
                </View>
                <ThemedText style={[styles.kpiBoxValue, { color: '#D97706' }]}>
                  {money(cashInDrawer)}
                </ThemedText>
                <ThemedText
                  style={[styles.kpiBoxSub, { color: themeColors.subText }]}
                >
                  Float {money(activeShift?.openingFloat ?? 500)} • ~
                  {cashRunway.runwayDays}d Runway
                </ThemedText>
              </View>

              {/* KPI: Customer Receivables */}
              <View
                style={[
                  styles.kpiBox,
                  {
                    backgroundColor: themeColors.cardBg,
                    borderColor: '#7C3AED',
                  },
                ]}
              >
                <View style={styles.kpiBoxHeader}>
                  <ThemedText style={styles.kpiBoxTitle}>DEBTORS</ThemedText>
                  <ThemedText style={{ fontSize: 13 }}>👥</ThemedText>
                </View>
                <ThemedText style={[styles.kpiBoxValue, { color: '#7C3AED' }]}>
                  {money(totalCustomerDebt)}
                </ThemedText>
                <ThemedText
                  style={[styles.kpiBoxSub, { color: themeColors.subText }]}
                >
                  {activeDebtorsCount} credit accounts active
                </ThemedText>
              </View>
            </View>

            {/* Middle Section: Lucid Data Visualizations */}
            <View style={styles.chartsGrid}>
              <View style={{ flex: 1.4 }}>
                <LucidRevenueProfitChart isDark={isDarkMode} />
              </View>
              <View style={{ flex: 1 }}>
                <LucidSalesMixChart isDark={isDarkMode} />
              </View>
            </View>

            {/* Bottom Split Section: CRM Customer Debtor Radar & Supplies Runway */}
            <View style={styles.bottomSplitGrid}>
              {/* Left: Customer Receivables / CRM Radar */}
              <View
                style={[
                  styles.dashboardSectionCard,
                  {
                    backgroundColor: themeColors.cardBg,
                    borderColor: themeColors.cardBorder,
                    flex: 1.3,
                  },
                ]}
              >
                <View style={styles.sectionHeaderRow}>
                  <View>
                    <ThemedText
                      style={[
                        styles.sectionTitleText,
                        { color: themeColors.text },
                      ]}
                    >
                      👥 Customer Credit & Receivables Radar
                    </ThemedText>
                    <ThemedText
                      style={[
                        styles.sectionSubText,
                        { color: themeColors.subText },
                      ]}
                    >
                      Live balances & 1-tap payment settlement
                    </ThemedText>
                  </View>
                  <Pressable
                    onPress={() => router.push('/history')}
                    style={styles.pillLinkBtn}
                  >
                    <ThemedText style={styles.pillLinkBtnText}>
                      Full Ledger →
                    </ThemedText>
                  </Pressable>
                </View>

                {debtEntries.length === 0 ? (
                  <ThemedText
                    style={{ color: themeColors.subText, padding: 8 }}
                  >
                    No outstanding debts. All accounts cleared!
                  </ThemedText>
                ) : (
                  <View style={{ gap: 8 }}>
                    {debtEntries.slice(0, 3).map((entry) => {
                      const isCleared = entry.status === 'cleared';
                      return (
                        <View
                          key={entry.id}
                          style={[
                            styles.debtorRow,
                            {
                              backgroundColor: isDarkMode
                                ? 'rgba(0,0,0,0.2)'
                                : '#F8FAFC',
                              borderColor: themeColors.cardBorder,
                            },
                          ]}
                        >
                          <View style={{ flex: 1 }}>
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 6,
                              }}
                            >
                              <ThemedText
                                style={[
                                  styles.debtorRowName,
                                  { color: themeColors.text },
                                ]}
                              >
                                {entry.customerName}
                              </ThemedText>
                              <View
                                style={[
                                  styles.miniDebtStatusBadge,
                                  {
                                    backgroundColor: isCleared
                                      ? 'rgba(16,185,129,0.15)'
                                      : 'rgba(244,63,94,0.15)',
                                  },
                                ]}
                              >
                                <ThemedText
                                  style={{
                                    color: isCleared ? '#10B981' : '#F43F5E',
                                    fontSize: 9,
                                    fontWeight: '800',
                                  }}
                                >
                                  {isCleared ? 'SETTLED' : 'DUE'}
                                </ThemedText>
                              </View>
                            </View>
                            <ThemedText
                              style={[
                                styles.debtorRowSub,
                                { color: themeColors.subText },
                              ]}
                            >
                              📞 {entry.customerPhone} • Ref #{entry.receiptId}
                            </ThemedText>
                          </View>

                          <View style={{ alignItems: 'flex-end', gap: 2 }}>
                            <ThemedText style={styles.debtorRowBalance}>
                              {money(entry.balance)}
                            </ThemedText>
                            {!isCleared && (
                              <Pressable
                                onPress={() => {
                                  setSelectedDebt(entry);
                                  setCollectAmount(String(entry.balance));
                                }}
                                style={styles.miniCollectBtn}
                              >
                                <ThemedText style={styles.miniCollectBtnText}>
                                  ⚡ Collect
                                </ThemedText>
                              </Pressable>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* Right: Supplies Runway & Cost Fluctuation Shield */}
              <View
                style={[
                  styles.dashboardSectionCard,
                  {
                    backgroundColor: themeColors.cardBg,
                    borderColor: themeColors.cardBorder,
                    flex: 1,
                  },
                ]}
              >
                <View style={styles.sectionHeaderRow}>
                  <View>
                    <ThemedText
                      style={[
                        styles.sectionTitleText,
                        { color: themeColors.text },
                      ]}
                    >
                      🖨️ Consumables & Margin Shield
                    </ThemedText>
                    <ThemedText
                      style={[
                        styles.sectionSubText,
                        { color: themeColors.subText },
                      ]}
                    >
                      Supplies days left & margin tracking
                    </ThemedText>
                  </View>
                  <Pressable
                    onPress={() => setShowConsumablesModal(true)}
                    style={styles.pillLinkBtn}
                  >
                    <ThemedText style={styles.pillLinkBtnText}>
                      Supplies →
                    </ThemedText>
                  </Pressable>
                </View>

                <View style={styles.suppliesRow}>
                  {/* Paper Gauge */}
                  <View
                    style={[
                      styles.supplyBox,
                      {
                        backgroundColor: isDarkMode
                          ? 'rgba(0,0,0,0.2)'
                          : '#F8FAFC',
                        borderColor: themeColors.cardBorder,
                      },
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.supplyBoxTitle,
                        { color: themeColors.subText },
                      ]}
                    >
                      📄 A4 Reams
                    </ThemedText>
                    <ThemedText
                      style={[
                        styles.supplyBoxValue,
                        { color: themeColors.text },
                      ]}
                    >
                      {consumableStock.a4ReemsInStock} Reams
                    </ThemedText>
                    <ThemedText style={styles.supplyBoxDays}>
                      ~{consumableRunway.paperDaysLeft}d Remaining
                    </ThemedText>
                  </View>

                  {/* Ink Gauge */}
                  <View
                    style={[
                      styles.supplyBox,
                      {
                        backgroundColor: isDarkMode
                          ? 'rgba(0,0,0,0.2)'
                          : '#F8FAFC',
                        borderColor: themeColors.cardBorder,
                      },
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.supplyBoxTitle,
                        { color: themeColors.subText },
                      ]}
                    >
                      🖤 Cartridges
                    </ThemedText>
                    <ThemedText
                      style={[
                        styles.supplyBoxValue,
                        { color: themeColors.text },
                      ]}
                    >
                      {consumableStock.inkCartridgesInStock} Carts
                    </ThemedText>
                    <ThemedText style={styles.supplyBoxDays}>
                      ~{consumableRunway.bwInkDaysLeft}d Remaining
                    </ThemedText>
                  </View>

                  {/* Cost Shield */}
                  <View
                    style={[
                      styles.supplyBox,
                      {
                        backgroundColor: isDarkMode
                          ? 'rgba(0,0,0,0.2)'
                          : '#F8FAFC',
                        borderColor: themeColors.cardBorder,
                      },
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.supplyBoxTitle,
                        { color: themeColors.subText },
                      ]}
                    >
                      🛡️ Shield
                    </ThemedText>
                    <ThemedText
                      style={[
                        styles.supplyBoxValue,
                        {
                          color:
                            marginAlerts.length > 0 ? '#EF4444' : '#10B981',
                        },
                      ]}
                    >
                      {marginAlerts.length} Alerts
                    </ThemedText>
                    <ThemedText style={styles.supplyBoxDays}>
                      {marginAlerts.length > 0 ? 'Drops detected' : 'Protected'}
                    </ThemedText>
                  </View>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>

      {/* ═══════════════════════════════════════════════════════════════════════
          MODALS INTEGRATION
         ═══════════════════════════════════════════════════════════════════════ */}
      <MicroExpenseModal
        visible={showExpenseModal}
        user={{ id: auth.session?.user.id || 'u1', name: userName }}
        tenantId={tenantId}
        branchId={branchId}
        onClose={() => setShowExpenseModal(false)}
        onExpenseAdded={() => setRefreshKey((k) => k + 1)}
      />

      <CashRunwayModal
        visible={showRunwayModal}
        cashInDrawer={cashInDrawer}
        openingFloat={activeShift?.openingFloat ?? 500}
        todayCashSales={activeCashSales > 0 ? activeCashSales : 1850}
        todayExpenses={operatingExpenses}
        catalogItems={DEFAULT_UNIFIED_CATALOG.map((i) => ({
          id: i.id,
          name: i.name,
          price: i.price,
        }))}
        onClose={() => setShowRunwayModal(false)}
      />

      <ConsumableEstimatorModal
        visible={showConsumablesModal}
        onClose={() => setShowConsumablesModal(false)}
      />

      <InventoryRestockModal
        visible={showRestockModal}
        item={restockTarget}
        user={{ id: auth.session?.user.id || 'u1', name: userName }}
        tenantId={tenantId}
        branchId={branchId}
        onClose={() => setShowRestockModal(false)}
        onRestocked={() => setRefreshKey((k) => k + 1)}
      />

      <PrintJobCalculator
        visible={showPrintCalc}
        onClose={() => setShowPrintCalc(false)}
        onAddToCart={() => {
          setShowPrintCalc(false);
          router.push('/sell');
        }}
      />

      <DashboardSettingsModal
        visible={showSettingsModal}
        businessName={businessName}
        isDark={isDarkMode}
        onToggleTheme={() => setIsDarkMode((prev) => !prev)}
        onClose={() => setShowSettingsModal(false)}
      />

      <QuotationModal
        visible={showQuotationModal}
        onClose={() => setShowQuotationModal(false)}
        onConvertToSale={() => {
          setShowQuotationModal(false);
          router.push('/sell');
        }}
      />

      {/* Quick Debt Settlement Modal */}
      {selectedDebt && (
        <Modal
          visible={Boolean(selectedDebt)}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedDebt(null)}
        >
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.debtModalCard,
                {
                  backgroundColor: themeColors.cardBg,
                  borderColor: themeColors.cardBorder,
                },
              ]}
            >
              <View style={styles.modalHeaderRow}>
                <ThemedText
                  style={[styles.modalTitle, { color: themeColors.text }]}
                >
                  ⚡ Settle Customer Credit
                </ThemedText>
                <Pressable
                  onPress={() => setSelectedDebt(null)}
                  style={styles.modalCloseBtn}
                >
                  <ThemedText style={{ color: '#fff', fontWeight: '700' }}>
                    ✕
                  </ThemedText>
                </Pressable>
              </View>

              <ThemedText
                style={[styles.modalCustomerName, { color: themeColors.text }]}
              >
                {selectedDebt.customerName}
              </ThemedText>
              <ThemedText
                style={[
                  styles.modalCustomerPhone,
                  { color: themeColors.subText },
                ]}
              >
                📞 {selectedDebt.customerPhone} • Ref #{selectedDebt.receiptId}
              </ThemedText>

              <View style={styles.balanceInfoBox}>
                <ThemedText style={styles.balanceInfoLabel}>
                  Balance Due:
                </ThemedText>
                <ThemedText style={styles.balanceInfoValue}>
                  {money(selectedDebt.balance)}
                </ThemedText>
              </View>

              <ThemedText
                style={[styles.quickChipsLabel, { color: themeColors.subText }]}
              >
                QUICK PAYMENT CHIPS
              </ThemedText>
              <View style={styles.quickChipsRow}>
                {[50, 100, 200].map((amt) => (
                  <Pressable
                    key={amt}
                    onPress={() => setCollectAmount(String(amt))}
                    style={[
                      styles.quickChipBtn,
                      { backgroundColor: themeColors.itemHover },
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.quickChipText,
                        { color: themeColors.text },
                      ]}
                    >
                      +{money(amt)}
                    </ThemedText>
                  </Pressable>
                ))}
                <Pressable
                  onPress={() => setCollectAmount(String(selectedDebt.balance))}
                  style={[styles.quickChipBtn, styles.quickChipFullBtn]}
                >
                  <ThemedText style={styles.quickChipFullText}>
                    Full ({money(selectedDebt.balance)})
                  </ThemedText>
                </Pressable>
              </View>

              <ThemedText
                style={[styles.inputLabel, { color: themeColors.subText }]}
              >
                AMOUNT COLLECTED (K) *
              </ThemedText>
              <TextInput
                style={[
                  styles.amountInput,
                  {
                    color: themeColors.text,
                    borderColor: themeColors.cardBorder,
                    backgroundColor: isDarkMode ? '#0B2027' : '#F1F5F9',
                  },
                ]}
                placeholder="Enter amount"
                placeholderTextColor="#94A3B8"
                keyboardType="decimal-pad"
                value={collectAmount}
                onChangeText={setCollectAmount}
              />

              {collectSuccess && (
                <ThemedText style={styles.collectSuccessText}>
                  {collectSuccess}
                </ThemedText>
              )}

              <View style={styles.modalActionsRow}>
                <Pressable
                  onPress={() => setSelectedDebt(null)}
                  style={styles.cancelBtn}
                >
                  <ThemedText
                    style={[
                      styles.cancelBtnText,
                      { color: themeColors.subText },
                    ]}
                  >
                    Cancel
                  </ThemedText>
                </Pressable>
                <Pressable
                  onPress={handleConfirmDebtPayment}
                  disabled={!collectAmount || parseFloat(collectAmount) <= 0}
                  style={[
                    styles.confirmCollectBtn,
                    {
                      opacity:
                        !collectAmount || parseFloat(collectAmount) <= 0
                          ? 0.5
                          : 1,
                    },
                  ]}
                >
                  <ThemedText style={styles.confirmCollectBtnText}>
                    ✓ Confirm Payment
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  rootViewport: {
    flex: 1,
    height: '100%',
  },
  container: {
    flex: 1,
    height: '100%',
  },
  desktopLayout: {
    flexDirection: 'row',
  },
  mobileLayout: {
    flexDirection: 'column',
  },

  // Left Side Navigation
  sideNavDesktop: {
    width: 230,
    height: '100%',
    borderRightWidth: 1.5,
    padding: 12,
    justifyContent: 'space-between',
    gap: 12,
  },
  sideNavMobile: {
    width: '100%',
    borderBottomWidth: 1.5,
    padding: 12,
    gap: 8,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 4,
    paddingTop: 4,
  },
  logoPill: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#147D92',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoIcon: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  logoBrandName: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  logoSubName: {
    fontSize: 10,
    fontWeight: '600',
  },
  stationStatusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  liveGreenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  stationStatusText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '800',
  },
  navSection: {
    gap: 3,
  },
  navSectionHeader: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    paddingHorizontal: 8,
    marginBottom: 2,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  navItemActive: {},
  navItemIcon: {
    fontSize: 14,
  },
  navItemText: {
    fontSize: 12,
    fontWeight: '700',
  },
  navItemTextActive: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  shortcutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  shortcutIcon: {
    fontSize: 13,
  },
  shortcutText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
  },
  sideNavBottom: {
    borderTopWidth: 1,
    paddingTop: 8,
    gap: 4,
  },
  themeSwitchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  themeSwitchIcon: {
    fontSize: 13,
  },
  themeSwitchText: {
    fontSize: 11,
    fontWeight: '700',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
  },
  logoutIcon: {
    fontSize: 13,
  },
  logoutText: {
    color: '#F43F5E',
    fontSize: 11,
    fontWeight: '800',
  },

  // Main Canvas
  mainCanvas: {
    flex: 1,
    height: '100%',
  },
  topMenuBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1.5,
    flexWrap: 'wrap',
    gap: 8,
  },
  topMenuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  breadcrumbText: {
    fontSize: 12,
    fontWeight: '700',
  },
  topMenuCenter: {
    flexDirection: 'row',
    gap: 6,
  },
  topBranchPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  topBranchPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  topMenuRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  periodSelectorBar: {
    flexDirection: 'row',
    borderRadius: 6,
    padding: 2,
    gap: 2,
  },
  periodPillBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  periodPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  userStationPill: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
  },
  userStationPillText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '800',
  },
  signOutErrorBanner: {
    color: '#F43F5E',
    backgroundColor: '#FFE4E6',
    padding: 6,
    fontSize: 11,
  },

  // Canvas Grid Content
  canvasScrollContent: {
    padding: 14,
    gap: 12,
  },
  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  heroProfitCard: {
    flex: 1.3,
    minWidth: 180,
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 12,
    justifyContent: 'space-between',
    gap: 4,
  },
  heroProfitTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroProfitLabel: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  profitMarginBadge: {
    backgroundColor: '#064E3B',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  profitMarginText: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '800',
  },
  heroProfitValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#10B981',
  },
  heroProfitSub: {
    fontSize: 10,
    fontWeight: '600',
  },
  kpiBox: {
    flex: 1,
    minWidth: 130,
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 10,
    justifyContent: 'space-between',
    gap: 3,
  },
  kpiBoxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kpiBoxTitle: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  kpiBoxValue: {
    fontSize: 17,
    fontWeight: '900',
  },
  kpiBoxSub: {
    fontSize: 9,
    fontWeight: '600',
  },

  // Charts Grid
  chartsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },

  // Bottom Split Grid
  bottomSplitGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  dashboardSectionCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 12,
    gap: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitleText: {
    fontSize: 13,
    fontWeight: '800',
  },
  sectionSubText: {
    fontSize: 10,
    fontWeight: '600',
  },
  pillLinkBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
  },
  pillLinkBtnText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '800',
  },

  // Debtor rows
  debtorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  debtorRowName: {
    fontSize: 12,
    fontWeight: '800',
  },
  miniDebtStatusBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  debtorRowSub: {
    fontSize: 10,
    marginTop: 2,
  },
  debtorRowBalance: {
    color: '#F43F5E',
    fontSize: 14,
    fontWeight: '900',
  },
  miniCollectBtn: {
    backgroundColor: '#059669',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  miniCollectBtnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },

  // Supplies Row
  suppliesRow: {
    flexDirection: 'row',
    gap: 8,
  },
  supplyBox: {
    flex: 1,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 2,
  },
  supplyBoxTitle: {
    fontSize: 9,
    fontWeight: '800',
  },
  supplyBoxValue: {
    fontSize: 13,
    fontWeight: '900',
  },
  supplyBoxDays: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '600',
  },

  // Modal Overlay
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  debtModalCard: {
    width: '100%',
    maxWidth: 480,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  modalCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCustomerName: {
    fontSize: 14,
    fontWeight: '800',
  },
  modalCustomerPhone: {
    fontSize: 11,
  },
  balanceInfoBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F43F5E',
    padding: 8,
    marginVertical: 4,
  },
  balanceInfoLabel: {
    color: '#FB7185',
    fontWeight: '700',
    fontSize: 12,
  },
  balanceInfoValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  quickChipsLabel: {
    fontSize: 10,
    fontWeight: '800',
  },
  quickChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  quickChipBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  quickChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  quickChipFullBtn: {
    backgroundColor: '#059669',
    borderColor: '#10B981',
  },
  quickChipFullText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
  },
  amountInput: {
    height: 44,
    borderRadius: 8,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    fontSize: 15,
    fontWeight: '700',
  },
  collectSuccessText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  cancelBtn: {
    flex: 1,
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontWeight: '700',
    fontSize: 13,
  },
  confirmCollectBtn: {
    flex: 2,
    height: 42,
    borderRadius: 8,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmCollectBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
});
