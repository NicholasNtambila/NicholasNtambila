/**
 * Inventory Restock Modal
 * ─────────────────────────────────────────────────────────────────────────────
 * Allows managers/cashiers to perform 1-click restocking of a catalog item:
 *  - Enter quantity received + cost per unit
 *  - Records a RestockRecord locally and calls Supabase `receive_inventory` RPC
 *  - Decrements local `available` count after sale via parent callback
 */

import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { addRestockRecord, type RestockRecord } from '../../lib/pos-data';
import { supabase } from '../../lib/supabase';
import { ThemedText } from './themed-text';

export interface RestockTarget {
  id: string;
  name: string;
  currentStock: number;
  type: 'service' | 'product';
}

interface Props {
  visible: boolean;
  item: RestockTarget | null;
  user: { id: string; name: string };
  tenantId: string;
  branchId: string;
  onClose: () => void;
  onRestocked: (itemId: string, quantityAdded: number) => void;
}

const QUICK_QTY = [10, 25, 50, 100, 200, 500];

export function InventoryRestockModal({
  visible,
  item,
  user,
  tenantId,
  branchId,
  onClose,
  onRestocked,
}: Props) {
  const theme = useTheme();
  const [quantity, setQuantity] = useState('');
  const [costPerUnit, setCostPerUnit] = useState('');
  const [supplier, setSupplier] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function reset() {
    setQuantity('');
    setCostPerUnit('');
    setSupplier('');
    setNotes('');
    setError(null);
    setSuccess(null);
    setSaving(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleRestock() {
    if (!item) return;
    const qty = parseInt(quantity, 10);
    const cost = parseFloat(costPerUnit);

    if (!qty || qty <= 0) {
      setError('Enter a valid quantity to add.');
      return;
    }
    if (isNaN(cost) || cost < 0) {
      setError('Enter a valid cost per unit (or 0 if unknown).');
      return;
    }

    setSaving(true);
    setError(null);

    const record: RestockRecord = {
      id: `restock-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      itemId: item.id,
      itemName: item.name,
      quantityAdded: qty,
      costPerUnit: cost,
      totalCost: qty * cost,
      supplier: supplier.trim() || undefined,
      recordedBy: { id: user.id, name: user.name },
      timestamp: new Date().toISOString(),
      notes: notes.trim() || undefined,
    };

    // Save locally regardless of online status
    addRestockRecord(record);

    // Try Supabase receive_inventory RPC
    let supabaseOk = false;
    if (supabase) {
      const { error: rpcError } = await supabase.rpc('receive_inventory', {
        target_tenant_id: tenantId,
        target_branch_id: branchId,
        product_id: item.id,
        quantity_received: qty,
        cost_per_unit: cost,
        supplier_name: supplier.trim() || null,
        reference_note: notes.trim() || null,
      });
      supabaseOk = !rpcError;
    }

    setSaving(false);
    setSuccess(
      supabaseOk
        ? `✅ Restocked ${qty}× "${item.name}" — inventory updated.`
        : `📵 Restocked ${qty}× "${item.name}" locally — will sync when online.`,
    );

    onRestocked(item.id, qty);
  }

  if (!item) return null;

  const qty = parseInt(quantity, 10);
  const cost = parseFloat(costPerUnit) || 0;
  const totalCost = qty > 0 ? qty * cost : 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView
        style={[styles.safe, { backgroundColor: theme.background }]}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <ThemedText type="subtitle">⚡ 1-Click Restock</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {item.name}
              </ThemedText>
            </View>
            <Pressable
              onPress={handleClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close restock modal"
            >
              <ThemedText style={styles.closeBtnText}>✕</ThemedText>
            </Pressable>
          </View>

          {/* Current stock info */}
          <View
            style={[
              styles.stockCard,
              {
                backgroundColor: item.currentStock <= 5 ? '#FEF2F2' : '#F0FDF4',
                borderColor: item.currentStock <= 5 ? '#FECACA' : '#BBF7D0',
              },
            ]}
          >
            <ThemedText type="smallBold">
              {item.currentStock <= 5 ? '🔴' : '🟢'} Current Stock:{' '}
              {item.type === 'service'
                ? '∞ (service)'
                : `${item.currentStock} units`}
            </ThemedText>
            {item.currentStock <= 5 && item.type === 'product' && (
              <ThemedText type="small" style={{ color: '#B91C1C' }}>
                ⚠️ LOW STOCK — Restock immediately!
              </ThemedText>
            )}
          </View>

          {/* Quick quantity shortcuts */}
          <ThemedText type="smallBold" themeColor="textSecondary">
            QUICK QUANTITY
          </ThemedText>
          <View style={styles.quickRow}>
            {QUICK_QTY.map((q) => (
              <Pressable
                key={q}
                onPress={() => setQuantity(String(q))}
                style={[
                  styles.quickBtn,
                  parseInt(quantity, 10) === q && styles.quickBtnActive,
                ]}
              >
                <ThemedText
                  style={[
                    styles.quickBtnText,
                    parseInt(quantity, 10) === q && styles.quickBtnTextActive,
                  ]}
                >
                  {q}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          {/* Quantity input */}
          <ThemedText type="smallBold" themeColor="textSecondary">
            QUANTITY RECEIVED *
          </ThemedText>
          <TextInput
            accessibilityLabel="Quantity received"
            placeholder="e.g. 100"
            placeholderTextColor={theme.textSecondary}
            value={quantity}
            onChangeText={setQuantity}
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

          {/* Cost per unit */}
          <ThemedText type="smallBold" themeColor="textSecondary">
            COST PER UNIT (K) — for margin tracking
          </ThemedText>
          <TextInput
            accessibilityLabel="Cost per unit"
            placeholder="e.g. 0.50"
            placeholderTextColor={theme.textSecondary}
            value={costPerUnit}
            onChangeText={setCostPerUnit}
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

          {/* Total cost display */}
          {totalCost > 0 && (
            <View style={styles.totalRow}>
              <ThemedText type="small" themeColor="textSecondary">
                Total restock cost:
              </ThemedText>
              <ThemedText type="smallBold" style={{ color: '#147D92' }}>
                K{totalCost.toFixed(2)}
              </ThemedText>
            </View>
          )}

          {/* Supplier */}
          <ThemedText type="smallBold" themeColor="textSecondary">
            SUPPLIER (optional)
          </ThemedText>
          <TextInput
            accessibilityLabel="Supplier name"
            placeholder="e.g. Zambia Printing Supplies"
            placeholderTextColor={theme.textSecondary}
            value={supplier}
            onChangeText={setSupplier}
            style={[
              styles.input,
              {
                color: theme.text,
                borderColor: theme.backgroundSelected,
                backgroundColor: theme.backgroundElement,
              },
            ]}
          />

          {/* Notes */}
          <ThemedText type="smallBold" themeColor="textSecondary">
            NOTES (optional)
          </ThemedText>
          <TextInput
            accessibilityLabel="Restock notes"
            placeholder="e.g. Delivery invoice #1234"
            placeholderTextColor={theme.textSecondary}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={2}
            style={[
              styles.input,
              styles.textArea,
              {
                color: theme.text,
                borderColor: theme.backgroundSelected,
                backgroundColor: theme.backgroundElement,
              },
            ]}
          />

          {/* Feedback */}
          {error && <ThemedText style={styles.errorText}>{error}</ThemedText>}
          {success && (
            <ThemedText style={styles.successText}>{success}</ThemedText>
          )}

          {/* Action buttons */}
          {success ? (
            <Pressable onPress={handleClose} style={styles.doneBtn}>
              <ThemedText style={styles.doneBtnText}>✓ Done — Close</ThemedText>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => void handleRestock()}
              disabled={saving || !quantity}
              style={[
                styles.restockBtn,
                { opacity: saving || !quantity ? 0.5 : 1 },
              ]}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={styles.restockBtnText}>
                  ⚡ Restock Now
                  {qty > 0 ? ` (+${qty} units)` : ''}
                </ThemedText>
              )}
            </Pressable>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    padding: Spacing.four,
    gap: Spacing.two,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.two,
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
  stockCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: Spacing.two,
    gap: 4,
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  quickBtnActive: {
    backgroundColor: '#147D92',
    borderColor: '#147D92',
  },
  quickBtnText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  quickBtnTextActive: { color: '#FFFFFF' },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  textArea: { minHeight: 72, paddingTop: 12, textAlignVertical: 'top' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderRadius: 6,
    padding: Spacing.two,
  },
  restockBtn: {
    backgroundColor: '#147D92',
    height: 52,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.two,
  },
  restockBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  doneBtn: {
    backgroundColor: '#059669',
    height: 52,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.two,
  },
  doneBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  errorText: { color: '#B42318', fontWeight: '600' },
  successText: { color: '#16803C', fontWeight: '600' },
});
