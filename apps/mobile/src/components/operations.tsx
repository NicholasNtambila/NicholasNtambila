import { useEffect, useMemo, useState } from 'react';
import {
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PageHeader } from '@/components/page-header';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth-provider';
import {
    addMicroExpense,
    computePopcornBatchMetrics,
    DEFAULT_POPCORN_RECIPE,
    EXPENSE_CATEGORY_LABELS,
    ExpenseCategory,
    getActiveShift,
    getMicroExpenses,
    getPopcornBatches,
    logAuditEvent,
    MicroExpense,
    PopcornBatchRecord,
    saveActiveShift,
    savePopcornBatch,
} from '../../lib/pos-data';
import { supabase } from '../../lib/supabase';

type Branch = { id: string; name: string };
type Product = { id: string; name: string; selling_price: number };
type Service = { service_id: string; name: string; price: number };
type Mode = 'service' | 'stock' | 'expense' | 'time' | 'popcorn';
type SelectableOption = Product | Service;
const idempotencyKey = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-operations-entry`;
const optionId = (item: SelectableOption) =>
  'service_id' in item ? item.service_id : item.id;
const optionPrice = (item: SelectableOption) =>
  'price' in item ? item.price : item.selling_price;

function createPopcornBatchRecord(gals: number, recorder: string): PopcornBatchRecord {
  const metrics = computePopcornBatchMetrics(gals, DEFAULT_POPCORN_RECIPE);
  const now = Date.now();
  return {
    id: `batch-${now}`,
    batchNumber: `POP-GAL-${now.toString().slice(-4)}`,
    startedAt: new Date(now).toISOString(),
    gallonsPopped: gals,
    cookingOilMl: gals * 750,
    plasticBagsYield: gals * 500,
    spicesCost: gals * 20,
    saltCost: gals * 5,
    totalProductionCost: metrics.totalCost,
    expectedGrossRevenue: metrics.expectedRevenue,
    expectedNetProfit: metrics.expectedProfit,
    costPerBag: metrics.costPerBag,
    recordedBy: recorder,
    status: 'active_popping',
    notes: `Batch: ${gals} Gallon(s) + ${gals * 750}ml oil + ${gals * 500} plastic bags + K${gals * 20} spices + K${gals * 5} salt. Selling @ K2/bag.`,
  };
}

export default function Operations() {
  const auth = useAuth();
  const tenantId = auth.activeBusiness?.tenantId;
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [mode, setMode] = useState<Mode>('service');
  const [selectedId, setSelectedId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [price, setPrice] = useState('');
  const [category] = useState('General');
  const [selectedExpenseCat, setSelectedExpenseCat] =
    useState<ExpenseCategory>('electricity_zesco');
  const [receiptNote, setReceiptNote] = useState('');
  const [expenseVersion, setExpenseVersion] = useState(0);
  const microExpensesList = useMemo<MicroExpense[]>(() => {
    void expenseVersion;
    return getMicroExpenses();
  }, [expenseVersion]);
  const [description, setDescription] = useState('');
  const [worker, setWorker] = useState('');
  const [hours, setHours] = useState('1');

  // Popcorn Batch Production State
  const [popcornGallons, setPopcornGallons] = useState('1');
  const [popcornVersion, setPopcornVersion] = useState(0);
  const popcornBatches = useMemo(() => {
    void popcornVersion;
    return getPopcornBatches();
  }, [popcornVersion]);

  const popcornMetrics = useMemo(() => {
    const gals = Math.max(1, parseInt(popcornGallons) || 1);
    return computePopcornBatchMetrics(gals, DEFAULT_POPCORN_RECIPE);
  }, [popcornGallons]);

  function handleStartPopcornBatch() {
    const gals = Math.max(1, parseInt(popcornGallons) || 1);
    const recorder = auth.session?.user.user_metadata?.full_name || 'Nicholas Ntambila';
    const newBatch = createPopcornBatchRecord(gals, recorder);
    savePopcornBatch(newBatch);
    setPopcornVersion((v) => v + 1);
    setMessage(`✅ Popcorn Batch ${newBatch.batchNumber} logged! Produced: ${newBatch.plasticBagsYield} bags @ K2 = K${newBatch.expectedGrossRevenue.toFixed(2)}.`);
  }

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const canManage = ['owner', 'administrator', 'manager'].includes(
    auth.activeBusiness?.role ?? '',
  );
  useEffect(() => {
    if (!tenantId || !supabase) return;
    void supabase
      .from('branches')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .order('name')
      .then(({ data }) => {
        const rows = (data ?? []) as Branch[];
        setBranches(rows);
        setBranchId(rows[0]?.id ?? '');
      });
    void supabase
      .from('products')
      .select('id, name, selling_price')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => setProducts((data ?? []) as Product[]));
  }, [tenantId]);
  useEffect(() => {
    if (!tenantId || !branchId || !supabase) return;
    void supabase
      .from('branch_service_offerings')
      .select('service_id, price, service_offerings(name)')
      .eq('tenant_id', tenantId)
      .eq('branch_id', branchId)
      .eq('is_enabled', true)
      .then(({ data }) =>
        setServices(
          (data ?? []).flatMap((row: any) =>
            row.service_offerings
              ? [
                  {
                    service_id: row.service_id,
                    name: row.service_offerings.name,
                    price: Number(row.price),
                  },
                ]
              : [],
          ),
        ),
      );
  }, [tenantId, branchId]);
  const options = mode === 'service' ? services : products;
  const selectLabel = mode === 'service' ? 'Service' : 'Product';
  async function submit() {
    if (!tenantId || !branchId || !supabase) return;
    setError(null);
    setMessage(null);
    const amount = Number(price);
    const count = Number(quantity);
    if (
      (mode === 'service' || mode === 'stock') &&
      (!selectedId ||
        !Number.isFinite(count) ||
        count <= 0 ||
        !Number.isFinite(amount) ||
        amount < 0)
    ) {
      setError('Choose an item and enter valid quantity and amount.');
      return;
    }
    if (
      mode === 'expense' &&
      (!description.trim() || !Number.isFinite(amount) || amount <= 0)
    ) {
      setError('Enter an expense description and amount.');
      return;
    }
    if (
      mode === 'time' &&
      (!worker.trim() ||
        !Number.isFinite(Number(hours)) ||
        Number(hours) <= 0 ||
        !Number.isFinite(amount) ||
        amount < 0)
    ) {
      setError('Enter a worker, hours, and hourly cost.');
      return;
    }
    setSaving(true);
    try {
      let result;
      if (mode === 'service')
        result = await supabase.rpc('record_service_transaction', {
          target_tenant_id: tenantId,
          target_branch_id: branchId,
          target_service_id: selectedId,
          sold_quantity: count,
          paid_unit_price: amount,
          paid_with: 'cash',
        });
      else if (mode === 'stock')
        result = await supabase.rpc('receive_inventory', {
          target_tenant_id: tenantId,
          target_branch_id: branchId,
          target_product_id: selectedId,
          received_quantity: count,
          received_unit_cost: amount,
          request_idempotency_key: idempotencyKey(),
        });
      else if (mode === 'expense') {
        const finalCategory =
          EXPENSE_CATEGORY_LABELS[selectedExpenseCat] ||
          category.trim() ||
          'General';
        const fullDesc = `${description.trim()}${receiptNote.trim() ? ` (Ref: ${receiptNote.trim()})` : ''}`;

        result = await supabase.rpc('record_expense', {
          target_tenant_id: tenantId,
          target_branch_id: branchId,
          expense_category: finalCategory,
          expense_description: fullDesc,
          expense_amount: amount,
        });

        // Sync to local micro-expenses, shift register & audit trail
        const microExp: MicroExpense = {
          id: `exp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          tenantId,
          branchId,
          category: selectedExpenseCat,
          description: description.trim(),
          amount: Math.round(amount * 100) / 100,
          recordedBy: {
            id: auth.session?.user.id || 'usr-ops',
            name:
              auth.session?.user.user_metadata?.full_name ||
              auth.session?.user.email ||
              'Nicholas Ntambila',
          },
          timestamp: new Date().toISOString(),
          receiptNote: receiptNote.trim() || undefined,
        };
        addMicroExpense(microExp);

        const shift = getActiveShift();
        if (shift) {
          shift.cashExpenses = (shift.cashExpenses || 0) + microExp.amount;
          saveActiveShift(shift);
        }

        logAuditEvent(
          'expense_recorded',
          {
            id: auth.session?.user.id || 'usr-ops',
            name:
              auth.session?.user.user_metadata?.full_name ||
              'Nicholas Ntambila',
          },
          `Petty expense: ${finalCategory} - K${amount.toFixed(2)} (${description.trim()})`,
          -amount,
        );
        setReceiptNote('');
        setExpenseVersion((v) => v + 1);
      } else {
        const ended = new Date();
        const started = new Date(ended.getTime() - Number(hours) * 3600000);
        result = await supabase.rpc('record_time_entry', {
          target_tenant_id: tenantId,
          target_branch_id: branchId,
          staff_name: worker.trim(),
          started: started.toISOString(),
          ended: ended.toISOString(),
          cost_per_hour: amount,
          entry_notes: description.trim() || null,
        });
      }
      if (result.error) throw result.error;
      setMessage(
        mode === 'stock'
          ? 'Stock received and recorded.'
          : mode === 'service'
            ? 'Service sale recorded.'
            : mode === 'expense'
              ? 'Expense recorded.'
              : 'Time and labour cost recorded.',
      );
      setDescription('');
      setWorker('');
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Could not save this entry.',
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <PageHeader
            breadcrumb="SERVICES & BRANCH OPS · SANI TECH"
            title="Branch Operations & Services"
            subtitle="Record operational costs, stock intake, petty expenses, and popcorn batch production"
          />
          <View style={styles.choices}>
            {branches.map((branch) => (
              <Choice
                key={branch.id}
                selected={branch.id === branchId}
                label={branch.name}
                onPress={() => {
                  setBranchId(branch.id);
                  setSelectedId('');
                  setPrice('');
                }}
              />
            ))}
          </View>
          <View style={styles.choices}>
            {(['service', 'stock', 'expense', 'time', 'popcorn'] as Mode[]).map((item) => (
              <Choice
                key={item}
                selected={item === mode}
                label={
                  item === 'time'
                    ? 'Work time'
                    : item === 'popcorn'
                      ? '🍿 Popcorn Batch'
                      : item[0].toUpperCase() + item.slice(1)
                }
                onPress={() => {
                  setMode(item);
                  setSelectedId('');
                  setPrice('');
                  setError(null);
                }}
              />
            ))}
          </View>
          {mode === 'service' || mode === 'stock' ? (
            <>
              <ThemedText type="smallBold">{selectLabel}</ThemedText>
              <View style={styles.choices}>
                {options.map((item) => (
                  <Choice
                    key={optionId(item)}
                    selected={optionId(item) === selectedId}
                    label={item.name}
                    onPress={() => {
                      setSelectedId(optionId(item));
                      setPrice(String(optionPrice(item)));
                    }}
                  />
                ))}
              </View>
              <Field
                label="Quantity"
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="decimal-pad"
              />
              <Field
                label={
                  mode === 'stock' ? 'Unit cost (ZMW)' : 'Unit price (ZMW)'
                }
                value={price}
                onChangeText={setPrice}
                keyboardType="decimal-pad"
              />
            </>
          ) : null}
          {mode === 'expense' ? (
            <View style={{ gap: Spacing.two }}>
              <ThemedText type="smallBold">EXPENSE CATEGORY</ThemedText>
              <View style={styles.choices}>
                {(
                  Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[]
                ).map((catKey) => (
                  <Choice
                    key={catKey}
                    selected={catKey === selectedExpenseCat}
                    label={EXPENSE_CATEGORY_LABELS[catKey]}
                    onPress={() => setSelectedExpenseCat(catKey)}
                  />
                ))}
              </View>

              <Field
                label="Amount (ZMW) - Exact coins/ngwee"
                value={price}
                onChangeText={setPrice}
                keyboardType="decimal-pad"
              />

              {/* Quick bill shortcuts */}
              <View style={styles.quickBillRow}>
                {[10, 20, 50, 100, 200].map((inc) => (
                  <Pressable
                    key={inc}
                    onPress={() => {
                      const curr = parseFloat(price) || 0;
                      setPrice((curr + inc).toFixed(2));
                    }}
                    style={styles.quickBillChip}
                  >
                    <ThemedText style={styles.quickBillText}>
                      +K{inc}
                    </ThemedText>
                  </Pressable>
                ))}
                <Pressable
                  onPress={() => setPrice('')}
                  style={[styles.quickBillChip, { backgroundColor: '#FEE2E2' }]}
                >
                  <ThemedText
                    style={[styles.quickBillText, { color: '#DC2626' }]}
                  >
                    Clear
                  </ThemedText>
                </Pressable>
              </View>

              <Field
                label="What was paid for? (Description)"
                value={description}
                onChangeText={setDescription}
              />

              <Field
                label="Receipt / Voucher / Meter Token # (Optional)"
                value={receiptNote}
                onChangeText={setReceiptNote}
              />

              {/* Every Coin Accounted For - Audit Trail & Daily Position */}
              <View style={styles.expenseAuditContainer}>
                <View style={styles.expenseAuditHeader}>
                  <View>
                    <ThemedText type="subtitle">
                      🪙 Every Coin Accounted For
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      Petty cash log & shift drawer audit trail
                    </ThemedText>
                  </View>
                  <ThemedText
                    type="title"
                    style={{ color: '#DC2626', fontSize: 18 }}
                  >
                    -K
                    {microExpensesList
                      .reduce((s, e) => s + e.amount, 0)
                      .toFixed(2)}
                  </ThemedText>
                </View>

                {microExpensesList.length === 0 ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    No petty expenses recorded yet today.
                  </ThemedText>
                ) : (
                  microExpensesList.slice(0, 8).map((item) => (
                    <View key={item.id} style={styles.auditExpenseRow}>
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
                          {item.receiptNote
                            ? ` • Ref: ${item.receiptNote}`
                            : ''}
                        </ThemedText>
                      </View>
                      <ThemedText type="subtitle" style={{ color: '#DC2626' }}>
                        -K{item.amount.toFixed(2)}
                      </ThemedText>
                    </View>
                  ))
                )}
              </View>
            </View>
          ) : null}
          {mode === 'time' ? (
            <>
              <Field
                label="Worker name"
                value={worker}
                onChangeText={setWorker}
              />
              <Field
                label="Hours worked"
                value={hours}
                onChangeText={setHours}
                keyboardType="decimal-pad"
              />
              <Field
                label="Hourly cost (ZMW)"
                value={price}
                onChangeText={setPrice}
                keyboardType="decimal-pad"
              />
              <Field
                label="Notes (optional)"
                value={description}
                onChangeText={setDescription}
              />
            </>
          ) : null}

          {mode === 'popcorn' ? (
            <View style={{ gap: Spacing.two }}>
              <View
                style={{
                  backgroundColor: '#FEF3C7',
                  borderColor: '#F59E0B',
                  borderWidth: 1,
                  borderRadius: 10,
                  padding: 14,
                }}
              >
                <ThemedText type="subtitle" style={{ color: '#B45309' }}>
                  🍿 POPCORN PRODUCTION & BATCH SHIELD
                </ThemedText>
                <ThemedText type="small" style={{ color: '#78350F', marginTop: 4 }}>
                  Official SaniT3ch Formula: 1 Gallon Corn + 750ml Cooking Oil + 500 Plastic Bags Case + K20 Spices + K5 Salt.
                </ThemedText>
                <ThemedText type="smallBold" style={{ color: '#B45309', marginTop: 6 }}>
                  Selling Price: K2.00 per bag &bull; Yield: 500 Bags per Gallon
                </ThemedText>
              </View>

              <Field
                label="Number of Corn Gallons to Pop (default: 1 Gallon)"
                value={popcornGallons}
                onChangeText={setPopcornGallons}
                keyboardType="decimal-pad"
              />

              {/* Live Batch Production Financial Breakdown */}
              <View
                style={{
                  backgroundColor: 'rgba(16, 185, 129, 0.08)',
                  borderColor: 'rgba(16, 185, 129, 0.3)',
                  borderWidth: 1,
                  borderRadius: 10,
                  padding: 14,
                }}
              >
                <ThemedText type="subtitle" style={{ color: '#10B981', marginBottom: 8 }}>
                  📊 Projected Batch Economics ({popcornMetrics.gallons} Gallon{popcornMetrics.gallons > 1 ? 's' : ''})
                </ThemedText>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: 2 }}>
                  <ThemedText type="small">1 Gal Corn Cost (K{DEFAULT_POPCORN_RECIPE.gallonCornCost} × {popcornMetrics.gallons}):</ThemedText>
                  <ThemedText type="smallBold">K{popcornMetrics.cornCost.toFixed(2)}</ThemedText>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: 2 }}>
                  <ThemedText type="small">750ml Oil (K{DEFAULT_POPCORN_RECIPE.cookingOil750mlCost} × {popcornMetrics.gallons}):</ThemedText>
                  <ThemedText type="smallBold">K{popcornMetrics.oilCost.toFixed(2)}</ThemedText>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: 2 }}>
                  <ThemedText type="small">500 Plastic Bags Case (K{DEFAULT_POPCORN_RECIPE.plasticsCaseCost} × {popcornMetrics.gallons}):</ThemedText>
                  <ThemedText type="smallBold">K{popcornMetrics.plasticsCost.toFixed(2)}</ThemedText>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: 2 }}>
                  <ThemedText type="small">Spices (K20) + Salt (K5):</ThemedText>
                  <ThemedText type="smallBold">K{(popcornMetrics.spicesCost + popcornMetrics.saltCost).toFixed(2)}</ThemedText>
                </View>
                <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(16, 185, 129, 0.25)', marginTop: 8, paddingTop: 8 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <ThemedText type="smallBold">Total Batch Cost:</ThemedText>
                    <ThemedText type="smallBold" style={{ color: '#EF4444' }}>K{popcornMetrics.totalCost.toFixed(2)}</ThemedText>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                    <ThemedText type="subtitle" style={{ color: '#10B981' }}>Expected Revenue ({popcornMetrics.expectedBags} Bags @ K2):</ThemedText>
                    <ThemedText type="subtitle" style={{ color: '#10B981' }}>K{popcornMetrics.expectedRevenue.toFixed(2)}</ThemedText>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                    <ThemedText type="subtitle" style={{ color: '#0284C7' }}>Expected Net Profit ({popcornMetrics.marginPercentage}%):</ThemedText>
                    <ThemedText type="subtitle" style={{ color: '#0284C7' }}>+K{popcornMetrics.expectedProfit.toFixed(2)}</ThemedText>
                  </View>
                </View>

                <Pressable
                  onPress={handleStartPopcornBatch}
                  style={[styles.button, { backgroundColor: '#10B981', marginTop: 12 }]}
                >
                  <ThemedText style={styles.buttonText}>
                    🚀 Start & Log {popcornMetrics.gallons}-Gallon Popcorn Batch
                  </ThemedText>
                </Pressable>
              </View>

              {/* Past Batches History */}
              <View style={{ marginTop: 12 }}>
                <ThemedText type="subtitle" style={{ marginBottom: 6 }}>
                  📜 Recent Popcorn Batches
                </ThemedText>
                {popcornBatches.map((batch) => (
                  <View
                    key={batch.id}
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.03)',
                      borderColor: 'rgba(255, 255, 255, 0.08)',
                      borderWidth: 1,
                      borderRadius: 8,
                      padding: 10,
                      marginBottom: 8,
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <ThemedText type="smallBold" style={{ color: '#0284C7' }}>
                        {batch.batchNumber} • {batch.gallonsPopped} Gallon(s)
                      </ThemedText>
                      <View style={{ backgroundColor: '#D1FAE5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                        <ThemedText style={{ color: '#065F46', fontSize: 10, fontWeight: '700' }}>
                          {batch.status.toUpperCase()}
                        </ThemedText>
                      </View>
                    </View>
                    <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: 4 }}>
                      Yield: {batch.plasticBagsYield} bags @ K2.00 | Cost: K{batch.totalProductionCost.toFixed(2)} | Profit: +K{batch.expectedNetProfit.toFixed(2)}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11, marginTop: 2 }}>
                      {new Date(batch.startedAt).toLocaleString('en-GB')} by {batch.recordedBy}
                    </ThemedText>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {!canManage && mode !== 'service' && mode !== 'popcorn' ? (
            <ThemedText style={styles.error}>
              Your role can only record service sales.
            </ThemedText>
          ) : null}
          {error ? (
            <ThemedText style={styles.error} accessibilityRole="alert">
              {error}
            </ThemedText>
          ) : null}
          {message ? (
            <ThemedText style={styles.success}>{message}</ThemedText>
          ) : null}
          {mode !== 'popcorn' && (
            <Pressable
              disabled={saving || (!canManage && mode !== 'service')}
              onPress={() => void submit()}
              style={[
                styles.button,
                { backgroundColor: '#147D92', opacity: saving ? 0.6 : 1 },
              ]}
            >
              <ThemedText style={styles.buttonText}>
                {saving ? 'Saving…' : 'Record entry'}
              </ThemedText>
            </Pressable>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}
function Choice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.choice, selected && styles.selected]}
    >
      <ThemedText>{label}</ThemedText>
    </Pressable>
  );
}
function Field(props: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'decimal-pad';
}) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{props.label}</ThemedText>
      <TextInput
        {...props}
        accessibilityLabel={props.label}
        placeholder={props.label}
        placeholderTextColor={theme.textSecondary}
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
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderWidth: 1,
    borderColor: '#D8E0E8',
    borderRadius: 6,
  },
  selected: { backgroundColor: '#DCEAE6', borderColor: '#147D92' },
  field: { gap: Spacing.one },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  button: {
    minHeight: 50,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '700' },
  error: { color: '#B42318' },
  success: { color: '#16803C' },
  quickBillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 4,
  },
  quickBillChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  quickBillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  expenseAuditContainer: {
    marginTop: Spacing.three,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: Spacing.three,
    backgroundColor: '#F8FAFC',
    gap: Spacing.two,
  },
  expenseAuditHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 8,
  },
  auditExpenseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
});
