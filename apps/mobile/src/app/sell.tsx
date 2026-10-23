import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useOfflineSync } from '@/hooks/use-offline-sync';
import { useAuth } from '@/providers/auth-provider';
import { PosCalculator } from '@/components/pos-calculator';
import { calculateChange } from '../../lib/pos-math';
import { supabase } from '../../lib/supabase';
import { enqueueSale } from '../../lib/offline-queue';
import { alertLowStock } from '../../lib/notifications';
import {
  DEFAULT_UNIFIED_CATALOG,
  getActiveShift,
  logAuditEvent,
  addDebtEntry,
  saveActiveShift,
} from '../../lib/pos-data';
import { ReceiptData } from '../../lib/pos-receipt';
import { StationLockModal } from '@/components/station-lock-modal';
import { PrintJobCalculator } from '@/components/print-job-calculator';
import { ThermalReceiptModal } from '@/components/thermal-receipt-modal';
import { ShiftRegisterModal } from '@/components/shift-register-modal';
import { MicroExpenseModal } from '@/components/micro-expense-modal';
import {
  InventoryRestockModal,
  type RestockTarget,
} from '@/components/inventory-restock-modal';
import { CashRunwayModal } from '@/components/cash-runway-modal';
import { ConsumableEstimatorModal } from '@/components/consumable-estimator-modal';
import { QuotationModal } from '@/components/quotation-modal';
import { QuotationItem } from '../../lib/sanit3ch-brand';

type Branch = { id: string; name: string };
type StockItem = {
  id: string;
  name: string;
  price: number;
  available: number;
  category?: string;
  type?: 'service' | 'product';
};
type CartLine = StockItem & { quantity: number };
type PaymentMethod =
  'cash' | 'mtn_momo' | 'airtel_money' | 'zamtel_money' | 'credit' | 'bank';

const paymentLabels: Record<PaymentMethod, string> = {
  cash: '💵 Cash',
  mtn_momo: '📱 MTN MoMo',
  airtel_money: '📱 Airtel Money',
  zamtel_money: '📱 Zamtel',
  credit: '📝 On Credit / Debt',
  bank: '🏦 Bank',
};

type CatalogCategory =
  'all' | 'services' | 'stationery' | 'phone_accessories' | 'snacks';

const CATEGORY_TABS: { id: CatalogCategory; label: string }[] = [
  { id: 'all', label: 'All Items' },
  { id: 'services', label: '⚡ Services' },
  { id: 'stationery', label: '📄 Stationery & Paper' },
  { id: 'phone_accessories', label: '🔌 Accessories' },
  { id: 'snacks', label: '🍿 Snacks & Drinks' },
];

const LOW_STOCK_THRESHOLD = 5;

const newIdempotencyKey = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-cashier-sale`;

const newMomoReference = () => `MO-${Date.now().toString(36).toUpperCase()}`;

export default function SellScreen() {
  const auth = useAuth();
  const tenantId = auth.activeBusiness?.tenantId || 'tenant-ntambila-primary';
  const businessName =
    auth.activeBusiness?.name || 'Nicholas Ntambila Retail & Services';
  const theme = useTheme();
  const { isOnline, pendingCount, syncNow, syncing } = useOfflineSync();

  const user = {
    id: auth.session?.user.id || 'usr-cashier-1',
    name:
      auth.session?.user.user_metadata?.full_name ||
      auth.session?.user.user_metadata?.display_name ||
      'Nicholas Ntambila',
    role: auth.activeBusiness?.role || 'cashier',
  };

  const [branches, setBranches] = useState<Branch[]>([
    { id: 'branch-primary', name: 'Main Retail & Services Branch' },
  ]);
  const [branchId, setBranchId] = useState('branch-primary');
  const [items, setItems] = useState<StockItem[]>(DEFAULT_UNIFIED_CATALOG);
  const [selectedCategory, setSelectedCategory] =
    useState<CatalogCategory>('all');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [query, setQuery] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [amountPaid, setAmountPaid] = useState('');
  const [showCalculator, setShowCalculator] = useState(true);

  // Mobile Money and Credit fields
  const [momoReference, setMomoReference] = useState('');
  const [creditCustomerName, setCreditCustomerName] = useState('');
  const [creditCustomerPhone, setCreditCustomerPhone] = useState('');

  // Modals state
  const [showStationLock, setShowStationLock] = useState(false);
  const [showPrintCalc, setShowPrintCalc] = useState(false);
  const [showShiftRegister, setShowShiftRegister] = useState(false);
  const [showMicroExpense, setShowMicroExpense] = useState(false);
  const [receiptModalData, setReceiptModalData] = useState<ReceiptData | null>(
    null,
  );

  const [shiftVersion, setShiftVersion] = useState(0);
  const activeShift = useMemo(() => {
    void shiftVersion;
    return getActiveShift();
  }, [shiftVersion]);

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // New feature modals
  const [restockTarget, setRestockTarget] = useState<RestockTarget | null>(
    null,
  );
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [showRunwayModal, setShowRunwayModal] = useState(false);
  const [showConsumableModal, setShowConsumableModal] = useState(false);
  const [showQuotationModal, setShowQuotationModal] = useState(false);

  function handleLoadFromQuotation(quotationItems: QuotationItem[]) {
    const loadedLines: CartLine[] = quotationItems.map((qi) => ({
      id: qi.id.startsWith('srv-') || qi.id.startsWith('prod-') ? qi.id : `srv-qt-${Date.now()}-${Math.random()}`,
      name: qi.description,
      price: qi.unitPrice,
      available: 9999,
      quantity: qi.quantity,
      type: 'service',
    }));
    setCart(loadedLines);
    setMessage(`Synced ${quotationItems.length} items from quotation into POS cart.`);
  }

  // Mobile Money gateway — show initiate button state
  const [momoInitiated, setMomoInitiated] = useState(false);

  // Load branches from Supabase if available
  useEffect(() => {
    if (!tenantId || !supabase) return;
    void supabase
      .from('branches')
      .select('id,name')
      .eq('tenant_id', tenantId)
      .order('name')
      .then(({ data }) => {
        const rows = (data ?? []) as Branch[];
        if (rows.length > 0) {
          setBranches(rows);
          setBranchId(rows[0].id);
        }
      });
  }, [tenantId]);

  // Load stock for selected branch and merge with unified catalog
  useEffect(() => {
    let isCurrent = true;
    if (!tenantId || !branchId || !supabase) return;

    void supabase
      .from('branch_inventory')
      .select('product_id,quantity_on_hand,products(id,name,selling_price)')
      .eq('tenant_id', tenantId)
      .eq('branch_id', branchId)
      .gt('quantity_on_hand', 0)
      .then(({ data, error: stockError }) => {
        if (!isCurrent) return;
        if (stockError || !data || data.length === 0) {
          setItems(DEFAULT_UNIFIED_CATALOG);
          return;
        }
        const supabaseProducts: StockItem[] = data.flatMap((row: any) =>
          row.products
            ? [
                {
                  id: row.product_id,
                  name: row.products.name,
                  price: Number(row.products.selling_price),
                  available: Number(row.quantity_on_hand),
                  category: 'general',
                  type: 'product',
                },
              ]
            : [],
        );
        const servicesOnly = DEFAULT_UNIFIED_CATALOG.filter(
          (c) => c.type === 'service',
        );
        setItems([...servicesOnly, ...supabaseProducts]);
      });

    return () => {
      isCurrent = false;
    };
  }, [tenantId, branchId]);

  const total = useMemo(
    () => cart.reduce((sum, line) => sum + line.price * line.quantity, 0),
    [cart],
  );

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch = item.name
        .toLowerCase()
        .includes(query.toLowerCase());
      const matchesCategory =
        selectedCategory === 'all' || item.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [items, query, selectedCategory]);

  function add(item: StockItem) {
    setCart((current) => {
      const line = current.find((entry) => entry.id === item.id);
      if (line)
        return current.map((entry) =>
          entry.id === item.id && entry.quantity < item.available
            ? { ...entry, quantity: entry.quantity + 1 }
            : entry,
        );
      return [...current, { ...item, quantity: 1 }];
    });
    setAmountPaid('');
    setMessage(null);
  }

  function adjust(id: string, delta: number) {
    setCart((current) =>
      current.flatMap((line) => {
        if (line.id !== id) return [line];
        const nextQty = line.quantity + delta;
        if (nextQty <= 0) {
          // Log cart item removal to fraud audit log
          logAuditEvent(
            'cart_item_removed',
            user,
            `Removed ${line.quantity}x "${line.name}" from cart`,
            -(line.price * line.quantity),
          );
          return [];
        }
        if (nextQty > line.available) return [line];
        return [{ ...line, quantity: nextQty }];
      }),
    );
    setAmountPaid('');
  }

  function handleClearCart() {
    if (cart.length > 0) {
      logAuditEvent(
        'cart_cleared',
        user,
        `Cleared full cart (${cart.length} items, total K${total.toFixed(2)})`,
        -total,
      );
      setCart([]);
      setAmountPaid('');
    }
  }

  function addCustomItem(name: string, price: number) {
    const customLine: StockItem = {
      id: `custom-${Date.now()}`,
      name,
      price,
      available: 9999,
      type: 'service',
      category: 'services',
    };
    setCart((current) => [...current, { ...customLine, quantity: 1 }]);
    setMessage(`Added "${name}" (K${price.toFixed(2)}) to cart.`);
  }

  function handleLockStation() {
    logAuditEvent(
      'station_locked',
      user,
      `Station locked by cashier ${user.name}`,
    );
    setShowStationLock(true);
  }

  /** Open 1-click restock modal for a specific item. */
  function handleOpenRestock(item: StockItem) {
    setRestockTarget({
      id: item.id,
      name: item.name,
      currentStock: item.available,
      type: item.type ?? 'product',
    });
    setShowRestockModal(true);
  }

  /** Update local item availability after a restock. */
  const handleRestocked = useCallback(
    (itemId: string, quantityAdded: number) => {
      setItems((prev) =>
        prev.map((i) =>
          i.id === itemId
            ? { ...i, available: i.available + quantityAdded }
            : i,
        ),
      );
    },
    [],
  );

  /** Initiate mobile money request — generates a USSD deep-link prompt.
   *  Full gateway (Airtel/MTN API) requires server-side Edge Function.
   *  This flow pre-fills reference and marks as initiated for audit. */
  function handleMomoInitiate() {
    const refId = newMomoReference();
    setMomoReference(refId);
    setMomoInitiated(true);
    logAuditEvent(
      'price_override',
      user,
      `Mobile Money payment initiated — ref ${refId} (${method === 'mtn_momo' ? 'MTN MoMo' : 'Airtel Money'})`,
    );
  }

  /** Low-stock product items (products only, threshold ≤5) */
  const lowStockItems = useMemo(
    () =>
      items.filter(
        (i) => i.type === 'product' && i.available <= LOW_STOCK_THRESHOLD,
      ),
    [items],
  );

  /** Shift cash summary for Cash Runway modal */
  const shiftCashSummary = useMemo(() => {
    const shift = activeShift;
    return {
      cashInDrawer: shift
        ? shift.openingFloat + shift.cashSales - shift.cashExpenses
        : 0,
      openingFloat: shift?.openingFloat ?? 0,
      todayCashSales: shift?.cashSales ?? 0,
      todayExpenses: shift?.cashExpenses ?? 0,
    };
  }, [activeShift]);

  async function checkout() {
    if (!branchId || cart.length === 0) return;
    setError(null);

    const paid = amountPaid ? Number(amountPaid) : total;
    if (!Number.isFinite(paid) || paid < 0) {
      setError('Payment must be a valid non-negative amount.');
      return;
    }

    // Explicit validation for Mobile Money and Credit
    if (
      (method === 'mtn_momo' || method === 'airtel_money') &&
      !momoReference.trim()
    ) {
      setError('Enter the Mobile Money Transaction Reference ID.');
      return;
    }

    if (method === 'credit') {
      if (!creditCustomerName.trim() || !creditCustomerPhone.trim()) {
        setError(
          'Customer Full Name and Phone Number are required for Credit sales.',
        );
        return;
      }
    }

    const changeResult = calculateChange(total, paid);
    const recordedPaid = method === 'credit' ? paid : Math.min(paid, total);
    const changeGiven = method === 'cash' ? changeResult.change : 0;

    setSaving(true);
    const idempotencyKey = newIdempotencyKey();
    const saleItems = cart.map((line) => ({
      product_id: line.id,
      quantity: line.quantity,
    }));
    const salePayments =
      recordedPaid > 0 ? [{ method, amount: recordedPaid }] : [];

    const activeBranchName =
      branches.find((b) => b.id === branchId)?.name || 'Main Branch';

    const now = new Date();
    const receiptTimeStr = now.toISOString();
    const receiptIdSuffix = now.getTime().toString(36).toUpperCase();

    // Build itemized POS-80 thermal receipt data
    const receipt: ReceiptData = {
      receiptId: `REC-${receiptIdSuffix}`,
      companyName: businessName,
      branchName: activeBranchName,
      cashierName: user.name,
      cashierId: user.id,
      timestamp: receiptTimeStr,
      items: cart.map((c) => ({
        id: c.id,
        name: c.name,
        quantity: c.quantity,
        unitPrice: c.price,
        subtotal: c.price * c.quantity,
      })),
      subtotal: total,
      taxAmount: Math.round(total * 0.16 * 100) / 100,
      total,
      paymentMethod: method,
      amountTendered: paid,
      changeGiven,
      momoReference: momoReference.trim() || undefined,
      creditCustomerName: creditCustomerName.trim() || undefined,
      creditCustomerPhone: creditCustomerPhone.trim() || undefined,
      currencySymbol: 'K',
      footerNote: 'Thank you for your business!',
    };

    // Update active shift cashSales if paid in cash
    if (method === 'cash') {
      const shift = getActiveShift();
      if (shift) {
        shift.cashSales = (shift.cashSales || 0) + recordedPaid;
        saveActiveShift(shift);
        setShiftVersion((v) => v + 1);
      }
    }

    // Record debt entry if on credit
    if (method === 'credit') {
      addDebtEntry({
        id: `debt-${receiptIdSuffix}`,
        receiptId: receipt.receiptId,
        customerName: creditCustomerName.trim(),
        customerPhone: creditCustomerPhone.trim(),
        amountDue: total,
        amountPaid: paid,
        balance: Math.max(0, total - paid),
        timestamp: receiptTimeStr,
        cashierName: user.name,
        status: paid >= total ? 'cleared' : 'outstanding',
      });
    }

    const changeNotice =
      changeGiven > 0 ? ` • Change Given: K${changeGiven.toFixed(2)}` : '';

    // --- Offline path
    if (!isOnline || !supabase) {
      enqueueSale(idempotencyKey, tenantId, branchId, {
        idempotencyKey,
        items: saleItems,
        payments: salePayments,
      });
      setSaving(false);
      setMessage(`📵 Sale saved offline${changeNotice} — ready to print.`);
      setReceiptModalData(receipt);
      setCart([]);
      setAmountPaid('');
      setMomoReference('');
      setCreditCustomerName('');
      setCreditCustomerPhone('');
      return;
    }

    // --- Online path
    const { data, error: saleError } = await supabase.rpc('post_sale', {
      target_tenant_id: tenantId,
      target_branch_id: branchId,
      request_idempotency_key: idempotencyKey,
      sale_items: saleItems,
      sale_payments: salePayments,
    });
    setSaving(false);

    if (saleError) {
      enqueueSale(idempotencyKey, tenantId, branchId, {
        idempotencyKey,
        items: saleItems,
        payments: salePayments,
      });
      setMessage(
        `⚠️ Server unreachable — saved offline${changeNotice} and will sync shortly.`,
      );
      setReceiptModalData(receipt);
      setCart([]);
      setAmountPaid('');
      setMomoReference('');
      setCreditCustomerName('');
      setCreditCustomerPhone('');
      return;
    }

    setMessage(
      `✓ Sale recorded. Receipt: ${String(data).slice(0, 8)}${changeNotice}`,
    );
    setReceiptModalData(receipt);
    setCart([]);
    setAmountPaid('');
    setMomoReference('');
    setMomoInitiated(false);
    setCreditCustomerName('');
    setCreditCustomerPhone('');

    // Fire low-stock alerts
    for (const line of cart) {
      const remaining = line.available - line.quantity;
      void alertLowStock(line.name, remaining);
    }
  }

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header & Station Security Bar */}
          <View style={styles.topControlBar}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Image
                source={require('../../assets/images/sanit3ch-logo.png')}
                style={{ width: 44, height: 44, resizeMode: 'contain' }}
              />
              <View>
                <ThemedText type="title" style={{ fontSize: 18, color: '#0284C7' }}>SaniT3ch POS Hub</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Cashier: <ThemedText type="smallBold">{user.name}</ThemedText> ({user.role.toUpperCase()})
                </ThemedText>
              </View>
            </View>

            {/* Quick Lock & Shift Actions */}
            <View style={styles.topActionButtons}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Official Quotations"
                onPress={() => setShowQuotationModal(true)}
                style={[styles.topActionBtn, { backgroundColor: '#0284C7' }]}
              >
                <ThemedText style={{ color: '#FFF', fontWeight: '700', fontSize: 11 }}>
                  📄 Quotation
                </ThemedText>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Lock Station"
                onPress={handleLockStation}
                style={[styles.topActionBtn, styles.lockStationBtn]}
              >
                <ThemedText style={styles.lockStationBtnText}>
                  🔒 Lock
                </ThemedText>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Shift Register"
                onPress={() => setShowShiftRegister(true)}
                style={[
                  styles.topActionBtn,
                  activeShift ? styles.shiftActiveBtn : styles.shiftWarningBtn,
                ]}
              >
                <ThemedText style={styles.shiftBtnText}>
                  {activeShift ? '🟢 Shift Open' : '⚠️ Open Shift'}
                </ThemedText>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Petty Cash Expenses"
                onPress={() => setShowMicroExpense(true)}
                style={[styles.topActionBtn, styles.expenseBtn]}
              >
                <ThemedText style={styles.expenseBtnText}>
                  🪙 Expenses
                </ThemedText>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cash Runway & Cost Shield"
                onPress={() => setShowRunwayModal(true)}
                style={[styles.topActionBtn, styles.runwayBtn]}
              >
                <ThemedText style={styles.runwayBtnText}>📊 Runway</ThemedText>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Consumable Estimator"
                onPress={() => setShowConsumableModal(true)}
                style={[styles.topActionBtn, styles.consumableBtn]}
              >
                <ThemedText style={styles.consumableBtnText}>
                  🖨️ Ink/Paper
                </ThemedText>
              </Pressable>
            </View>
          </View>

          {/* Connectivity banner */}
          {!isOnline && (
            <View style={styles.offlineBanner}>
              <ThemedText style={styles.offlineText}>
                📵 Offline — sales queued locally & synced automatically.
              </ThemedText>
            </View>
          )}

          {/* Pending sync badge */}
          {pendingCount > 0 && (
            <View style={styles.syncBanner}>
              <ThemedText style={styles.syncText}>
                🔄 {pendingCount} sale{pendingCount > 1 ? 's' : ''} pending sync
                {isOnline ? ' — syncing now…' : ' when back online'}
              </ThemedText>
              {isOnline && (
                <Pressable
                  onPress={() => void syncNow()}
                  disabled={syncing}
                  style={styles.syncButton}
                >
                  <ThemedText style={styles.syncButtonText}>
                    {syncing ? 'Syncing…' : 'Sync now'}
                  </ThemedText>
                </Pressable>
              )}
            </View>
          )}

          {/* Low-Stock Alert Banner */}
          {lowStockItems.length > 0 && (
            <View style={styles.lowStockBanner}>
              <ThemedText style={styles.lowStockTitle}>
                🔴 LOW STOCK WARNING ({lowStockItems.length} items)
              </ThemedText>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 6 }}
              >
                {lowStockItems.map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => handleOpenRestock(item)}
                    style={styles.lowStockChip}
                  >
                    <ThemedText style={styles.lowStockChipText}>
                      {item.name} ({item.available} left) — ⚡ Restock
                    </ThemedText>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Branch selector & Tools Bar */}
          <View style={styles.branchRow}>
            <View style={styles.choices}>
              {branches.map((branch) => (
                <Pressable
                  key={branch.id}
                  onPress={() => {
                    setBranchId(branch.id);
                    setCart([]);
                  }}
                  style={[
                    styles.choice,
                    branch.id === branchId && styles.selected,
                  ]}
                >
                  <ThemedText>{branch.name}</ThemedText>
                </Pressable>
              ))}
            </View>

            {/* Print Job & Copy Calculator Shortcut */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Print Job & Copy Calculator"
              onPress={() => setShowPrintCalc(true)}
              style={styles.printEstimatorBtn}
            >
              <ThemedText style={styles.printEstimatorBtnText}>
                🖨️ Copy & Print Estimator
              </ThemedText>
            </Pressable>
          </View>

          {/* Category Filter Tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryScroll}
          >
            {CATEGORY_TABS.map((tab) => (
              <Pressable
                key={tab.id}
                onPress={() => setSelectedCategory(tab.id)}
                style={[
                  styles.categoryChip,
                  selectedCategory === tab.id && styles.categoryChipActive,
                ]}
              >
                <ThemedText
                  type="smallBold"
                  style={[
                    styles.categoryChipText,
                    selectedCategory === tab.id &&
                      styles.categoryChipTextActive,
                  ]}
                >
                  {tab.label}
                </ThemedText>
              </Pressable>
            ))}
          </ScrollView>

          {/* Product and Service Search */}
          <TextInput
            accessibilityLabel="Search catalog products and services"
            placeholder="Search printing, biro pens, paper reams, cables, popcorns…"
            placeholderTextColor={theme.textSecondary}
            value={query}
            onChangeText={setQuery}
            style={[
              styles.input,
              {
                color: theme.text,
                borderColor: theme.backgroundSelected,
                backgroundColor: theme.backgroundElement,
              },
            ]}
          />

          {/* Available Unified Catalog */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <ThemedText type="subtitle">Catalog & Services</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Showing {filtered.length} items
              </ThemedText>
            </View>

            {filtered.length === 0 ? (
              <ThemedText themeColor="textSecondary">
                No items match your search.
              </ThemedText>
            ) : (
              <View style={styles.catalogGrid}>
                {filtered.map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => add(item)}
                    style={[
                      styles.catalogCard,
                      {
                        backgroundColor: theme.backgroundElement,
                        borderColor: theme.backgroundSelected,
                      },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <ThemedText type="smallBold" numberOfLines={2}>
                        {item.name}
                      </ThemedText>
                      <ThemedText
                        type="small"
                        themeColor="textSecondary"
                        style={{ fontSize: 11 }}
                      >
                        {item.type === 'service' ? '⚡ Service' : '📦 In stock'}{' '}
                        · K{item.price.toFixed(2)}
                      </ThemedText>
                      {item.type === 'product' &&
                        item.available <= LOW_STOCK_THRESHOLD && (
                          <ThemedText
                            style={{
                              fontSize: 10,
                              color: '#DC2626',
                              fontWeight: '700',
                            }}
                          >
                            🔴 {item.available} left
                          </ThemedText>
                        )}
                    </View>
                    <View style={{ gap: 4, alignItems: 'flex-end' }}>
                      <View style={styles.addPill}>
                        <ThemedText style={styles.addPillText}>
                          + Add
                        </ThemedText>
                      </View>
                      {item.type === 'product' &&
                        item.available <= LOW_STOCK_THRESHOLD && (
                          <Pressable
                            onPress={() => handleOpenRestock(item)}
                            style={styles.restockPill}
                          >
                            <ThemedText style={styles.restockPillText}>
                              ⚡ Restock
                            </ThemedText>
                          </Pressable>
                        )}
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* Live Interactive Cart */}
          <View style={styles.section}>
            <View style={styles.cartHeader}>
              <ThemedText type="subtitle">
                🛒 Active Cart ({cart.reduce((s, l) => s + l.quantity, 0)}{' '}
                items)
              </ThemedText>
              {cart.length > 0 && (
                <Pressable onPress={handleClearCart}>
                  <ThemedText type="smallBold" style={{ color: '#DC2626' }}>
                    Clear All
                  </ThemedText>
                </Pressable>
              )}
            </View>

            {cart.length === 0 ? (
              <ThemedText themeColor="textSecondary">
                Add products or services from the catalog above.
              </ThemedText>
            ) : (
              cart.map((line) => (
                <View
                  key={line.id}
                  style={[
                    styles.cartRow,
                    {
                      backgroundColor: theme.backgroundElement,
                      borderColor: theme.backgroundSelected,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <ThemedText type="smallBold">{line.name}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {line.quantity} × K{line.price.toFixed(2)} = K
                      {(line.price * line.quantity).toFixed(2)}
                    </ThemedText>
                  </View>
                  <View style={styles.counter}>
                    <Pressable
                      onPress={() => adjust(line.id, -1)}
                      style={styles.counterBtn}
                    >
                      <ThemedText type="subtitle">−</ThemedText>
                    </Pressable>
                    <ThemedText type="subtitle">{line.quantity}</ThemedText>
                    <Pressable
                      onPress={() => adjust(line.id, 1)}
                      style={styles.counterBtn}
                    >
                      <ThemedText type="subtitle">+</ThemedText>
                    </Pressable>
                  </View>
                </View>
              ))
            )}
            <View style={styles.totalRow}>
              <ThemedText type="title">Total Due:</ThemedText>
              <ThemedText
                type="title"
                style={{ color: '#147D92', fontSize: 24 }}
              >
                K{total.toFixed(2)}
              </ThemedText>
            </View>

            {cart.length > 0 && (
              <Pressable
                onPress={() => setShowQuotationModal(true)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  backgroundColor: 'rgba(2, 132, 199, 0.12)',
                  borderColor: '#0284C7',
                  borderWidth: 1,
                  borderRadius: 8,
                  paddingVertical: 10,
                  marginTop: 10,
                }}
              >
                <ThemedText style={{ color: '#0284C7', fontWeight: '700', fontSize: 13 }}>
                  📄 Convert Cart to Official Quotation (Watermarked)
                </ThemedText>
              </Pressable>
            )}
          </View>

          {/* Payment method and POS Tender / Calculator */}
          <View style={styles.section}>
            <View style={styles.paymentHeader}>
              <ThemedText type="subtitle">Payment & Tender</ThemedText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Toggle POS Calculator"
                onPress={() => setShowCalculator((curr) => !curr)}
                style={styles.calcToggleBtn}
              >
                <ThemedText style={styles.calcToggleBtnText}>
                  {showCalculator ? '🧮 Hide Keypad' : '🧮 Tender & Calculator'}
                </ThemedText>
              </Pressable>
            </View>

            {/* Payment Method Selector */}
            <View style={styles.choices}>
              {(Object.keys(paymentLabels) as PaymentMethod[]).map((item) => (
                <Pressable
                  key={item}
                  onPress={() => setMethod(item)}
                  style={[styles.choice, method === item && styles.selected]}
                >
                  <ThemedText>{paymentLabels[item]}</ThemedText>
                </Pressable>
              ))}
            </View>

            {/* Specific Payment Input Fields */}
            {method === 'mtn_momo' || method === 'airtel_money' ? (
              <View style={{ gap: 8 }}>
                {/* Official MoMo Agent Account Details Card */}
                <View
                  style={{
                    backgroundColor: method === 'mtn_momo' ? '#FEFCE8' : '#FEF2F2',
                    borderColor: method === 'mtn_momo' ? '#EAB308' : '#EF4444',
                    borderLeftWidth: 4,
                    borderWidth: 1,
                    borderRadius: 8,
                    padding: 10,
                  }}
                >
                  <ThemedText type="smallBold" style={{ color: method === 'mtn_momo' ? '#A16207' : '#B91C1C' }}>
                    {method === 'mtn_momo' ? '📱 OFFICIAL MTN MOBILE MONEY' : '📱 OFFICIAL AIRTEL MONEY'}
                  </ThemedText>
                  <View style={{ marginVertical: 3 }}>
                    <ThemedText style={{ fontSize: 14, fontWeight: '800', color: '#0F172A' }}>
                      {method === 'mtn_momo' ? 'Number: 0768990586' : 'Agent Code: 20051880'}
                    </ThemedText>
                    <ThemedText type="small" style={{ color: '#475569' }}>
                      {method === 'mtn_momo' ? 'Account Name: NICHOLAS NTAMBILA' : 'Account Name: MAKELO WEZZY'}
                    </ThemedText>
                  </View>
                  <ThemedText type="small" style={{ color: '#0284C7', fontWeight: '600' }}>
                    WhatsApp Proof of Payment: 0767825250
                  </ThemedText>
                </View>

                {/* Mobile Money Gateway Flow */}
                <View style={styles.momoGatewayCard}>
                  <ThemedText type="smallBold">
                    {method === 'mtn_momo'
                      ? '📱 MTN Mobile Money'
                      : '📱 Airtel Money'}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {momoInitiated
                      ? "✅ Request initiated — confirm on customer's phone, then enter ref ID below."
                      : 'Tap "Initiate" to generate a reference number, then ask customer to confirm.'}
                  </ThemedText>
                  {!momoInitiated && (
                    <Pressable
                      onPress={handleMomoInitiate}
                      style={styles.momoInitiateBtn}
                      accessibilityRole="button"
                      accessibilityLabel="Initiate Mobile Money request"
                    >
                      <ThemedText style={styles.momoInitiateBtnText}>
                        ⚡ Initiate MoMo Request (K{total.toFixed(2)})
                      </ThemedText>
                    </Pressable>
                  )}
                </View>
                <TextInput
                  accessibilityLabel="Mobile Money Reference ID"
                  placeholder="Mobile Money Transaction Ref ID (e.g. MP261020.1234.H56789)"
                  placeholderTextColor={theme.textSecondary}
                  value={momoReference}
                  onChangeText={(v) => {
                    setMomoReference(v);
                    if (v.trim()) setMomoInitiated(true);
                  }}
                  style={[
                    styles.input,
                    {
                      color: theme.text,
                      borderColor: momoInitiated
                        ? '#16803C'
                        : theme.backgroundSelected,
                      backgroundColor: theme.backgroundElement,
                    },
                  ]}
                />
              </View>
            ) : null}

            {method === 'credit' ? (
              <View style={{ gap: 8 }}>
                <TextInput
                  accessibilityLabel="Credit customer name"
                  placeholder="Customer Full Name (Required for Debt Ledger) *"
                  placeholderTextColor={theme.textSecondary}
                  value={creditCustomerName}
                  onChangeText={setCreditCustomerName}
                  style={[
                    styles.input,
                    {
                      color: theme.text,
                      borderColor: theme.backgroundSelected,
                      backgroundColor: theme.backgroundElement,
                    },
                  ]}
                />
                <TextInput
                  accessibilityLabel="Credit customer phone"
                  placeholder="Customer Phone Number (e.g. 0977123456) *"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="phone-pad"
                  value={creditCustomerPhone}
                  onChangeText={setCreditCustomerPhone}
                  style={[
                    styles.input,
                    {
                      color: theme.text,
                      borderColor: theme.backgroundSelected,
                      backgroundColor: theme.backgroundElement,
                    },
                  ]}
                />
              </View>
            ) : null}

            {/* ⚡ RUSH-HOUR TENDER SHORTCUTS BAR — always visible for cash */}
            {method === 'cash' && cart.length > 0 && (
              <View style={styles.tenderBar}>
                <ThemedText style={styles.tenderBarLabel}>
                  ⚡ QUICK TENDER
                </ThemedText>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.tenderBarScroll}
                >
                  {[10, 20, 50, 100, 200].map((amount) => (
                    <Pressable
                      key={amount}
                      onPress={() => setAmountPaid(String(amount))}
                      style={[
                        styles.tenderBtn,
                        amountPaid === String(amount) && styles.tenderBtnActive,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Tender K${amount}`}
                    >
                      <ThemedText
                        style={[
                          styles.tenderBtnText,
                          amountPaid === String(amount) &&
                            styles.tenderBtnTextActive,
                        ]}
                      >
                        K{amount}
                      </ThemedText>
                    </Pressable>
                  ))}
                  {/* Exact Amount shortcut */}
                  <Pressable
                    onPress={() => setAmountPaid(total.toFixed(2))}
                    style={[
                      styles.tenderBtn,
                      styles.tenderBtnExact,
                      amountPaid === total.toFixed(2) && styles.tenderBtnActive,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Exact amount K${total.toFixed(2)}`}
                  >
                    <ThemedText
                      style={[
                        styles.tenderBtnText,
                        styles.tenderBtnExactText,
                        amountPaid === total.toFixed(2) &&
                          styles.tenderBtnTextActive,
                      ]}
                    >
                      ✓ Exact K{total.toFixed(2)}
                    </ThemedText>
                  </Pressable>
                </ScrollView>
                {/* Live change display */}
                {amountPaid !== '' && Number(amountPaid) >= total && (
                  <View style={styles.changeDisplay}>
                    <ThemedText style={styles.changeDisplayText}>
                      💰 Change: K{(Number(amountPaid) - total).toFixed(2)}
                    </ThemedText>
                  </View>
                )}
              </View>
            )}

            {/* Amount Paid Input */}
            <TextInput
              accessibilityLabel="Amount paid"
              placeholder={`Amount paid (default K${total.toFixed(2)})`}
              placeholderTextColor={theme.textSecondary}
              value={amountPaid}
              onChangeText={setAmountPaid}
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

            {showCalculator && (
              <PosCalculator
                total={total}
                currencySymbol="K"
                amountPaid={amountPaid}
                onAmountPaidChange={setAmountPaid}
                onAddCustomItem={addCustomItem}
                isCash={method === 'cash'}
              />
            )}
          </View>

          {/* Feedback */}
          {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}
          {message ? (
            <ThemedText style={styles.success}>{message}</ThemedText>
          ) : null}

          {/* Receipt Preview Shortcut Button */}
          {receiptModalData && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View and print thermal receipt"
              onPress={() => setReceiptModalData(receiptModalData)}
              style={styles.viewReceiptBtn}
            >
              <ThemedText style={styles.viewReceiptBtnText}>
                🧾 View & Print POS-80 Thermal Receipt
              </ThemedText>
            </Pressable>
          )}

          {/* Complete Sale Button */}
          <Pressable
            disabled={saving || cart.length === 0}
            onPress={() => void checkout()}
            style={[
              styles.button,
              { opacity: saving || cart.length === 0 ? 0.5 : 1 },
            ]}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.buttonText}>
                Complete Sale & Generate Receipt (K{total.toFixed(2)})
              </ThemedText>
            )}
          </Pressable>
        </ScrollView>
      </SafeAreaView>

      {/* Modals */}
      <StationLockModal
        visible={showStationLock}
        userName={user.name}
        userId={user.id}
        onUnlock={() => setShowStationLock(false)}
      />

      <PrintJobCalculator
        visible={showPrintCalc}
        onClose={() => setShowPrintCalc(false)}
        onAddToCart={add}
      />

      <ShiftRegisterModal
        visible={showShiftRegister}
        user={user}
        onClose={() => setShowShiftRegister(false)}
        onShiftUpdated={() => setShiftVersion((v) => v + 1)}
      />

      <MicroExpenseModal
        visible={showMicroExpense}
        user={user}
        tenantId={tenantId}
        branchId={branchId}
        onClose={() => setShowMicroExpense(false)}
        onExpenseAdded={() => setShiftVersion((v) => v + 1)}
      />

      <ThermalReceiptModal
        visible={Boolean(receiptModalData)}
        receiptData={receiptModalData}
        onClose={() => setReceiptModalData(null)}
      />

      <QuotationModal
        visible={showQuotationModal}
        onClose={() => setShowQuotationModal(false)}
        initialItems={cart.map((c) => ({
          name: c.name,
          quantity: c.quantity,
          unitPrice: c.price,
        }))}
        onConvertToSale={handleLoadFromQuotation}
      />

      {/* 1-Click Inventory Restock Modal */}
      <InventoryRestockModal
        visible={showRestockModal}
        item={restockTarget}
        user={user}
        tenantId={tenantId}
        branchId={branchId}
        onClose={() => {
          setShowRestockModal(false);
          setRestockTarget(null);
        }}
        onRestocked={handleRestocked}
      />

      {/* Predictive Cash Runway + Cost-Fluctuation Shield Modal */}
      <CashRunwayModal
        visible={showRunwayModal}
        cashInDrawer={shiftCashSummary.cashInDrawer}
        openingFloat={shiftCashSummary.openingFloat}
        todayCashSales={shiftCashSummary.todayCashSales}
        todayExpenses={shiftCashSummary.todayExpenses}
        catalogItems={items.map((i) => ({
          id: i.id,
          name: i.name,
          price: i.price,
        }))}
        onClose={() => setShowRunwayModal(false)}
      />

      {/* AI-Powered Paper & Ink Consumable Estimator */}
      <ConsumableEstimatorModal
        visible={showConsumableModal}
        onClose={() => setShowConsumableModal(false)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1 },
  content: {
    gap: Spacing.three,
    padding: Spacing.four,
    maxWidth: 840,
    width: '100%',
    alignSelf: 'center',
  },
  topControlBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  topActionButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  topActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  lockStationBtn: {
    backgroundColor: '#334155',
  },
  lockStationBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  shiftActiveBtn: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  shiftWarningBtn: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  shiftBtnText: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 12,
  },
  expenseBtn: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  expenseBtnText: {
    color: '#991B1B',
    fontWeight: '700',
    fontSize: 12,
  },
  offlineBanner: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: Spacing.two,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  offlineText: { color: '#92400E', fontWeight: '600' },
  syncBanner: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    padding: Spacing.two,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  syncText: { color: '#1D4ED8', flex: 1 },
  syncButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
    borderRadius: 6,
  },
  syncButtonText: { color: '#fff', fontWeight: '600', fontSize: 12 },
  branchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  choices: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
  choice: {
    padding: Spacing.two,
    borderWidth: 1,
    borderColor: '#D8E0E8',
    borderRadius: 6,
  },
  selected: { backgroundColor: '#DCEAE6', borderColor: '#147D92' },
  printEstimatorBtn: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  printEstimatorBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  categoryScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  categoryChipActive: {
    backgroundColor: '#147D92',
    borderColor: '#147D92',
  },
  categoryChipText: {
    fontSize: 12,
    color: '#475569',
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
  },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  section: {
    gap: Spacing.two,
    borderTopWidth: 1,
    borderColor: '#D8E0E8',
    paddingTop: Spacing.three,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  catalogGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  catalogCard: {
    width: '48.5%',
    minHeight: 74,
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addPill: {
    backgroundColor: '#147D92',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  addPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  cartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cartRow: {
    minHeight: 52,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    gap: Spacing.two,
  },
  counter: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  counterBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
  },
  button: {
    minHeight: 52,
    borderRadius: 6,
    backgroundColor: '#147D92',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  error: { color: '#B42318' },
  success: { color: '#16803C', fontWeight: '600' },
  paymentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calcToggleBtn: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(20, 125, 146, 0.12)',
  },
  calcToggleBtnText: {
    color: '#147D92',
    fontSize: 12,
    fontWeight: '700',
  },
  viewReceiptBtn: {
    backgroundColor: '#059669',
    height: 48,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewReceiptBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  // ── Low-stock banner ──
  lowStockBanner: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: Spacing.two,
    gap: 6,
  },
  lowStockTitle: {
    color: '#B91C1C',
    fontWeight: '700',
    fontSize: 12,
  },
  lowStockChip: {
    backgroundColor: '#DC2626',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  lowStockChipText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  // ── Restock pill on catalog card ──
  restockPill: {
    backgroundColor: '#F59E0B',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  restockPillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  // ── Rush-hour tender bar ──
  tenderBar: {
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    padding: Spacing.two,
    gap: 8,
  },
  tenderBarLabel: {
    color: '#166534',
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  tenderBarScroll: {
    flexDirection: 'row' as const,
    gap: 8,
    alignItems: 'center' as const,
  },
  tenderBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#147D92',
    minWidth: 52,
    alignItems: 'center' as const,
  },
  tenderBtnActive: {
    backgroundColor: '#147D92',
  },
  tenderBtnExact: {
    borderColor: '#059669',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
  },
  tenderBtnExactText: {
    color: '#059669',
  },
  tenderBtnText: {
    color: '#147D92',
    fontWeight: '800' as const,
    fontSize: 15,
  },
  tenderBtnTextActive: {
    color: '#FFFFFF',
  },
  changeDisplay: {
    backgroundColor: '#147D92',
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    paddingVertical: 8,
    alignItems: 'center' as const,
  },
  changeDisplayText: {
    color: '#FFFFFF',
    fontWeight: '800' as const,
    fontSize: 18,
  },
  // ── Mobile Money Gateway ──
  momoGatewayCard: {
    backgroundColor: '#FFF7ED',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FED7AA',
    padding: Spacing.two,
    gap: 8,
  },
  momoInitiateBtn: {
    backgroundColor: '#EA580C',
    borderRadius: 8,
    height: 44,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  momoInitiateBtnText: {
    color: '#FFFFFF',
    fontWeight: '700' as const,
    fontSize: 14,
  },
  // ── Top bar extras ──
  runwayBtn: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  runwayBtnText: {
    color: '#1D4ED8',
    fontWeight: '700' as const,
    fontSize: 12,
  },
  consumableBtn: {
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  consumableBtnText: {
    color: '#6D28D9',
    fontWeight: '700' as const,
    fontSize: 12,
  },
});
