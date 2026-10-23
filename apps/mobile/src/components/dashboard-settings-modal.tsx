import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from './themed-text';
import { Spacing } from '@/constants/theme';

interface Props {
  visible: boolean;
  businessName: string;
  isDark: boolean;
  onToggleTheme: () => void;
  onClose: () => void;
}

export function DashboardSettingsModal({
  visible,
  businessName,
  isDark,
  onToggleTheme,
  onClose,
}: Props) {
  const [shopName, setShopName] = useState(businessName);
  const [floatAmount, setFloatAmount] = useState('500.00');
  const [taxRate, setTaxRate] = useState('16');
  const [lowStockLimit, setLowStockLimit] = useState('5');
  const [receiptFooter, setReceiptFooter] = useState(
    'Thank you for your business! Nicholas Ntambila Retail & Services',
  );
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 1200);
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={[
          styles.safe,
          { backgroundColor: isDark ? '#0B2027' : '#F8FAFC' },
        ]}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <ThemedText
                style={[
                  styles.title,
                  { color: isDark ? '#FFFFFF' : '#0F172A' },
                ]}
              >
                ⚙️ Dashboard & POS Settings
              </ThemedText>
              <ThemedText
                style={[styles.sub, { color: isDark ? '#94A3B8' : '#64748B' }]}
              >
                Configure store preferences, taxation, and display defaults
              </ThemedText>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <ThemedText style={{ color: '#FFFFFF', fontWeight: '800' }}>
                ✕
              </ThemedText>
            </Pressable>
          </View>

          {/* Theme Preference */}
          <View
            style={[
              styles.settingCard,
              {
                backgroundColor: isDark ? '#132E36' : '#FFFFFF',
                borderColor: isDark ? '#25464D' : '#E2E8F0',
              },
            ]}
          >
            <View style={styles.cardHeader}>
              <ThemedText
                style={[
                  styles.cardTitle,
                  { color: isDark ? '#FFFFFF' : '#0F172A' },
                ]}
              >
                🌓 Visual Theme Mode
              </ThemedText>
              <Pressable
                onPress={onToggleTheme}
                style={[
                  styles.themeToggleBtn,
                  { backgroundColor: isDark ? '#147D92' : '#0284C7' },
                ]}
              >
                <ThemedText style={styles.themeToggleText}>
                  {isDark ? '🌙 Dark Mode (Active)' : '☀️ Light Mode (Active)'}
                </ThemedText>
              </Pressable>
            </View>
            <ThemedText
              style={[
                styles.helperText,
                { color: isDark ? '#94A3B8' : '#64748B' },
              ]}
            >
              Toggle between modern Lucid Dark glass mode and clean
              High-Contrast Light mode.
            </ThemedText>
          </View>

          {/* Business Branding */}
          <View
            style={[
              styles.settingCard,
              {
                backgroundColor: isDark ? '#132E36' : '#FFFFFF',
                borderColor: isDark ? '#25464D' : '#E2E8F0',
              },
            ]}
          >
            <ThemedText
              style={[
                styles.cardTitle,
                { color: isDark ? '#FFFFFF' : '#0F172A' },
              ]}
            >
              🏢 Business Name & Header
            </ThemedText>
            <TextInput
              style={[
                styles.input,
                {
                  color: isDark ? '#FFFFFF' : '#0F172A',
                  backgroundColor: isDark ? '#0B2027' : '#F1F5F9',
                  borderColor: isDark ? '#25464D' : '#CBD5E1',
                },
              ]}
              value={shopName}
              onChangeText={setShopName}
              placeholder="e.g. Nicholas Ntambila Retail & Services"
              placeholderTextColor="#94A3B8"
            />
          </View>

          {/* Register & Float Defaults */}
          <View
            style={[
              styles.settingCard,
              {
                backgroundColor: isDark ? '#132E36' : '#FFFFFF',
                borderColor: isDark ? '#25464D' : '#E2E8F0',
              },
            ]}
          >
            <ThemedText
              style={[
                styles.cardTitle,
                { color: isDark ? '#FFFFFF' : '#0F172A' },
              ]}
            >
              💵 Register & Cashier Defaults
            </ThemedText>
            <View style={styles.twoColRow}>
              <View style={{ flex: 1 }}>
                <ThemedText
                  style={[
                    styles.fieldLabel,
                    { color: isDark ? '#94A3B8' : '#64748B' },
                  ]}
                >
                  Default Opening Float (K)
                </ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    {
                      color: isDark ? '#FFFFFF' : '#0F172A',
                      backgroundColor: isDark ? '#0B2027' : '#F1F5F9',
                      borderColor: isDark ? '#25464D' : '#CBD5E1',
                    },
                  ]}
                  value={floatAmount}
                  onChangeText={setFloatAmount}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText
                  style={[
                    styles.fieldLabel,
                    { color: isDark ? '#94A3B8' : '#64748B' },
                  ]}
                >
                  Standard VAT / Tax (%)
                </ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    {
                      color: isDark ? '#FFFFFF' : '#0F172A',
                      backgroundColor: isDark ? '#0B2027' : '#F1F5F9',
                      borderColor: isDark ? '#25464D' : '#CBD5E1',
                    },
                  ]}
                  value={taxRate}
                  onChangeText={setTaxRate}
                  keyboardType="number-pad"
                />
              </View>
            </View>
          </View>

          {/* Inventory Alert Rules */}
          <View
            style={[
              styles.settingCard,
              {
                backgroundColor: isDark ? '#132E36' : '#FFFFFF',
                borderColor: isDark ? '#25464D' : '#E2E8F0',
              },
            ]}
          >
            <ThemedText
              style={[
                styles.cardTitle,
                { color: isDark ? '#FFFFFF' : '#0F172A' },
              ]}
            >
              📦 Inventory Thresholds
            </ThemedText>
            <View style={{ gap: 4 }}>
              <ThemedText
                style={[
                  styles.fieldLabel,
                  { color: isDark ? '#94A3B8' : '#64748B' },
                ]}
              >
                Low Stock Warning Level (Units)
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: isDark ? '#FFFFFF' : '#0F172A',
                    backgroundColor: isDark ? '#0B2027' : '#F1F5F9',
                    borderColor: isDark ? '#25464D' : '#CBD5E1',
                  },
                ]}
                value={lowStockLimit}
                onChangeText={setLowStockLimit}
                keyboardType="number-pad"
              />
            </View>
          </View>

          {/* Receipt Footer */}
          <View
            style={[
              styles.settingCard,
              {
                backgroundColor: isDark ? '#132E36' : '#FFFFFF',
                borderColor: isDark ? '#25464D' : '#E2E8F0',
              },
            ]}
          >
            <ThemedText
              style={[
                styles.cardTitle,
                { color: isDark ? '#FFFFFF' : '#0F172A' },
              ]}
            >
              🧾 Thermal Receipt Footer Note
            </ThemedText>
            <TextInput
              style={[
                styles.input,
                styles.textArea,
                {
                  color: isDark ? '#FFFFFF' : '#0F172A',
                  backgroundColor: isDark ? '#0B2027' : '#F1F5F9',
                  borderColor: isDark ? '#25464D' : '#CBD5E1',
                },
              ]}
              value={receiptFooter}
              onChangeText={setReceiptFooter}
              multiline
              numberOfLines={2}
            />
          </View>

          {saved && (
            <ThemedText style={styles.successBanner}>
              ✓ Store settings saved successfully!
            </ThemedText>
          )}

          <Pressable onPress={handleSave} style={styles.saveBtn}>
            <ThemedText style={styles.saveBtnText}>
              💾 Save Store Configuration
            </ThemedText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
    maxWidth: 620,
    width: '100%',
    alignSelf: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  sub: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingCard: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: Spacing.three,
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  themeToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  themeToggleText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  helperText: {
    fontSize: 11,
    fontWeight: '500',
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 10,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
  },
  input: {
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    fontSize: 14,
    fontWeight: '600',
  },
  textArea: {
    height: 60,
    textAlignVertical: 'top',
    paddingTop: 8,
  },
  saveBtn: {
    backgroundColor: '#147D92',
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  successBanner: {
    color: '#10B981',
    fontWeight: '800',
    fontSize: 13,
    textAlign: 'center',
  },
});
