import { designTokens } from '@sanitech/shared';
import * as Print from 'expo-print';
import React, { useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
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
  saveStoredQuotation,
} from '../../lib/pos-data';
import {
  calculateQuotationTotals,
  generateOfficialQuotationHtml,
  generateQuotationNumber,
  QuotationData,
  QuotationItem,
  SANIT3CH_BRAND,
} from '../../lib/sanit3ch-brand';

interface QuotationModalProps {
  visible: boolean;
  onClose: () => void;
  initialItems?: { name: string; quantity: number; unitPrice: number }[];
  onConvertToSale?: (items: QuotationItem[]) => void;
}

function createQuotationRecord(params: {
  quotationNumber: string;
  preparedBy: string;
  clientName: string;
  contactPerson: string;
  clientPhone: string;
  clientEmail: string;
  clientAddress: string;
  items: QuotationItem[];
  totals: ReturnType<typeof calculateQuotationTotals>;
  discountPercent: number;
  notes: string;
}): QuotationData {
  const timestamp = Date.now();
  const today = new Date(timestamp).toISOString().slice(0, 10);
  const validUntilDate = new Date(timestamp + 14 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  return {
    id: `qt-${timestamp}`,
    quotationNumber: params.quotationNumber,
    date: today,
    validUntil: validUntilDate,
    preparedBy: params.preparedBy,
    client: {
      clientName: params.clientName.trim() || 'Valued Client',
      contactPerson: params.contactPerson.trim() || undefined,
      phone: params.clientPhone.trim() || 'N/A',
      email: params.clientEmail.trim() || undefined,
      address: params.clientAddress.trim() || undefined,
    },
    items: params.items,
    subtotal: params.totals.subtotal,
    discountPercentage: params.discountPercent,
    discountAmount: params.totals.discountAmount,
    grandTotal: params.totals.grandTotal,
    depositRequired: params.totals.depositRequired,
    balanceDue: params.totals.balanceDue,
    status: 'draft',
    notes: params.notes,
    createdAt: new Date(timestamp).toISOString(),
  };
}

export function QuotationModal({
  visible,
  onClose,
  initialItems,
  onConvertToSale,
}: QuotationModalProps) {
  const theme = useTheme();

  // Quotation Metadata State
  const [quotationNumber] = useState(generateQuotationNumber);
  const [clientName, setClientName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [preparedBy] = useState(SANIT3CH_BRAND.ceoName);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [notes, setNotes] = useState('50% deposit required prior to printing & service delivery.');

  // Items State
  const [items, setItems] = useState<QuotationItem[]>(() => {
    if (initialItems && initialItems.length > 0) {
      return initialItems.map((it, idx) => ({
        id: `item-${idx + 1}`,
        description: it.name,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        total: it.quantity * it.unitPrice,
      }));
    }
    return [
      {
        id: '1',
        description: 'Wall Stickers A4 Glossy Adhesive Print',
        quantity: 10,
        unitPrice: 35.0,
        total: 350.0,
      },
      {
        id: '2',
        description: 'Spiral / Comb Book Binding with Acetate Covers',
        quantity: 5,
        unitPrice: 25.0,
        total: 125.0,
      },
    ];
  });

  // Calculate live breakdown
  const totals = calculateQuotationTotals(items, discountPercent);

  // Item modification helpers
  function updateItem(id: string, updates: Partial<QuotationItem>) {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const updated = { ...it, ...updates };
        updated.total = (updated.quantity || 0) * (updated.unitPrice || 0);
        return updated;
      }),
    );
  }

  function addItem() {
    const nextId = String(items.length + 1);
    setItems((prev) => [
      ...prev,
      {
        id: nextId,
        description: 'Printing / Photocopy Service',
        quantity: 1,
        unitPrice: 20.0,
        total: 20.0,
      },
    ]);
  }

  function removeItem(id: string) {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  // Construct current quotation data object
  function buildQuotationData(): QuotationData {
    return createQuotationRecord({
      quotationNumber,
      preparedBy,
      clientName,
      contactPerson,
      clientPhone,
      clientEmail,
      clientAddress,
      items,
      totals,
      discountPercent,
      notes,
    });
  }

  // Print / Export PDF with Watermark
  async function handlePrintQuotation() {
    const quoteData = buildQuotationData();
    const html = generateOfficialQuotationHtml(quoteData);

    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const printWin = window.open('', '_blank');
        if (printWin) {
          printWin.document.write(html);
          printWin.document.close();
          printWin.focus();
          setTimeout(() => printWin.print(), 350);
        } else {
          window.print();
        }
      } else {
        await Print.printAsync({ html });
      }
      saveStoredQuotation(quoteData);
    } catch {
      Alert.alert('Printing Error', 'Could not open print preview.');
    }
  }

  // Share via WhatsApp
  function handleShareWhatsApp() {
    const quote = buildQuotationData();
    saveStoredQuotation(quote);

    const itemsSummary = quote.items
      .map((it) => `• ${it.description}: ${it.quantity} x K${it.unitPrice.toFixed(2)} = K${it.total.toFixed(2)}`)
      .join('\n');

    const message = `*${SANIT3CH_BRAND.name.toUpperCase()} - OFFICIAL QUOTATION*
*Quotation No:* ${quote.quotationNumber}
*Prepared For:* ${quote.client.clientName}
*Valid For:* 14 Days (Until ${quote.validUntil})

*ITEMIZED ESTIMATE:*
${itemsSummary}

*FINANCIAL SUMMARY:*
• Subtotal: K${quote.subtotal.toFixed(2)}
${quote.discountAmount > 0 ? `• Discount (${quote.discountPercentage}%): -K${quote.discountAmount.toFixed(2)}\n` : ''}*• GRAND TOTAL: K${quote.grandTotal.toFixed(2)}*
----------------------------------------
*PAYMENT TERMS (50% Deposit):*
• *Deposit Required (50%): K${quote.depositRequired.toFixed(2)}*
• Balance on Delivery: K${quote.balanceDue.toFixed(2)}

*PAY VIA MOBILE MONEY:*
📱 *MTN MoMo:* 0768990586 (NICHOLAS NTAMBILA)
📱 *Airtel Money:* 20051880 (MAKELO WEZZY)
Send proof of payment to WhatsApp: 0767825250.`;

    const encoded = encodeURIComponent(message);
    const targetPhone = clientPhone.replace(/[^0-9]/g, '');
    const url = targetPhone ? `https://wa.me/26${targetPhone.replace(/^0/, '')}?text=${encoded}` : `https://wa.me/?text=${encoded}`;

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url).catch(() => {
        Alert.alert('Notice', 'WhatsApp could not be opened automatically.');
      });
    }
  }

  // Convert Quotation directly into a POS sale / cart
  function handleConvert() {
    const quote = buildQuotationData();
    quote.status = 'converted';
    saveStoredQuotation(quote);

    if (onConvertToSale) {
      onConvertToSale(items);
      Alert.alert('Synced with POS', `Quotation ${quote.quotationNumber} items loaded directly into POS checkout!`);
      onClose();
    }
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
            <View style={styles.brandRow}>
              <Image
                source={require('../../assets/images/sanit3ch-logo.png')}
                style={styles.headerLogo}
                resizeMode="contain"
              />
              <View>
                <ThemedText type="subtitle" style={{ color: designTokens.color.brand.blue }}>
                  SaniT3ch Official Quotation
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {quotationNumber} &bull; 14-Day Validity
                </ThemedText>
              </View>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <ThemedText type="subtitle">✕</ThemedText>
            </Pressable>
          </View>

          <ScrollView style={styles.scrollBody} contentContainerStyle={styles.scrollContent}>
            {/* Watermark Logo in Background */}
            <Image
              source={require('../../assets/images/sanit3ch-logo.png')}
              style={styles.watermarkBg}
              resizeMode="contain"
            />

            {/* Client Information Form */}
            <View style={styles.sectionCard}>
              <ThemedText type="smallBold" style={styles.sectionTitle}>
                📋 CLIENT INFORMATION
              </ThemedText>
              <View style={styles.formRow}>
                <View style={styles.inputCol}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Client / Company Name *
                  </ThemedText>
                  <TextInput
                    style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
                    placeholder="e.g. Copperbelt Logistics / John Banda"
                    placeholderTextColor="#64748B"
                    value={clientName}
                    onChangeText={setClientName}
                  />
                </View>
                <View style={styles.inputCol}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Contact Phone *
                  </ThemedText>
                  <TextInput
                    style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
                    placeholder="0977... or 0768..."
                    placeholderTextColor="#64748B"
                    keyboardType="phone-pad"
                    value={clientPhone}
                    onChangeText={setClientPhone}
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={styles.inputCol}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Contact Person (Optional)
                  </ThemedText>
                  <TextInput
                    style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
                    placeholder="Attn: Mr. / Mrs."
                    placeholderTextColor="#64748B"
                    value={contactPerson}
                    onChangeText={setContactPerson}
                  />
                </View>
                <View style={styles.inputCol}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Client Email
                  </ThemedText>
                  <TextInput
                    style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
                    placeholder="client@example.com"
                    placeholderTextColor="#64748B"
                    keyboardType="email-address"
                    value={clientEmail}
                    onChangeText={setClientEmail}
                  />
                </View>
              </View>

              <View style={[styles.formRow, { marginTop: 6 }]}>
                <View style={styles.inputCol}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Delivery Address / Location
                  </ThemedText>
                  <TextInput
                    style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
                    placeholder="Location in Kitwe"
                    placeholderTextColor="#64748B"
                    value={clientAddress}
                    onChangeText={setClientAddress}
                  />
                </View>
                <View style={styles.inputCol}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Terms & Instructions Note
                  </ThemedText>
                  <TextInput
                    style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
                    placeholder="e.g. 50% deposit required"
                    placeholderTextColor="#64748B"
                    value={notes}
                    onChangeText={setNotes}
                  />
                </View>
              </View>
            </View>

            {/* Itemized Table */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <ThemedText type="smallBold" style={styles.sectionTitle}>
                  📦 SERVICES & ITEMS (WATERMARKED)
                </ThemedText>
                <Pressable onPress={addItem} style={styles.addItemBtn}>
                  <ThemedText style={styles.addItemBtnText}>+ Add Service</ThemedText>
                </Pressable>
              </View>

              {items.map((item, idx) => (
                <View key={item.id} style={styles.itemRowCard}>
                  <View style={{ flex: 1 }}>
                    <ThemedText type="small" style={{ fontWeight: '700', marginBottom: 4 }}>
                      #{idx + 1} Description:
                    </ThemedText>
                    <TextInput
                      style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected, marginBottom: 8 }]}
                      value={item.description}
                      onChangeText={(val) => updateItem(item.id, { description: val })}
                      placeholder="Service name / paper specification"
                      placeholderTextColor="#64748B"
                    />
                    <View style={styles.itemNumericRow}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <ThemedText type="small" themeColor="textSecondary">
                          Qty:
                        </ThemedText>
                        <TextInput
                          style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
                          keyboardType="numeric"
                          value={String(item.quantity)}
                          onChangeText={(v) => updateItem(item.id, { quantity: Math.max(1, parseInt(v) || 0) })}
                        />
                      </View>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <ThemedText type="small" themeColor="textSecondary">
                          Price (K):
                        </ThemedText>
                        <TextInput
                          style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
                          keyboardType="numeric"
                          value={String(item.unitPrice)}
                          onChangeText={(v) => updateItem(item.id, { unitPrice: Math.max(0, parseFloat(v) || 0) })}
                        />
                      </View>
                      <View style={{ flex: 1, justifyContent: 'center' }}>
                        <ThemedText type="small" themeColor="textSecondary">
                          Total:
                        </ThemedText>
                        <ThemedText type="subtitle" style={{ color: '#10B981' }}>
                          K{item.total.toFixed(2)}
                        </ThemedText>
                      </View>
                      {items.length > 1 && (
                        <Pressable onPress={() => removeItem(item.id)} style={styles.removeBtn}>
                          <ThemedText style={{ color: '#EF4444', fontWeight: 'bold' }}>✕</ThemedText>
                        </Pressable>
                      )}
                    </View>
                  </View>
                </View>
              ))}

              {/* Discount Selector */}
              <View style={styles.discountRow}>
                <ThemedText type="small" themeColor="textSecondary">
                  Discount Percentage:
                </ThemedText>
                <View style={styles.discountPills}>
                  {[0, 5, 10, 15, 20].map((rate) => (
                    <Pressable
                      key={rate}
                      onPress={() => setDiscountPercent(rate)}
                      style={[
                        styles.discountPill,
                        discountPercent === rate && { backgroundColor: designTokens.color.brand.blue },
                      ]}
                    >
                      <ThemedText
                        type="smallBold"
                        style={{ color: discountPercent === rate ? '#FFF' : theme.text }}
                      >
                        {rate}%
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            {/* Financial Totals & 50% Deposit Shield */}
            <View style={styles.totalsCard}>
              <View style={styles.totalRow}>
                <ThemedText type="small" themeColor="textSecondary">Subtotal:</ThemedText>
                <ThemedText type="smallBold">K{totals.subtotal.toFixed(2)}</ThemedText>
              </View>
              {totals.discountAmount > 0 && (
                <View style={styles.totalRow}>
                  <ThemedText type="small" style={{ color: '#F59E0B' }}>
                    Discount ({discountPercent}%):
                  </ThemedText>
                  <ThemedText type="smallBold" style={{ color: '#F59E0B' }}>
                    -K{totals.discountAmount.toFixed(2)}
                  </ThemedText>
                </View>
              )}
              <View style={[styles.totalRow, styles.grandTotalBorder]}>
                <ThemedText type="subtitle" style={{ color: '#10B981' }}>
                  GRAND TOTAL:
                </ThemedText>
                <ThemedText type="subtitle" style={{ color: '#10B981' }}>
                  K{totals.grandTotal.toFixed(2)}
                </ThemedText>
              </View>

              {/* 50% Deposit Term */}
              <View style={styles.depositNotice}>
                <ThemedText type="smallBold" style={{ color: '#B45309' }}>
                  📌 OFFICIAL TERMS (50% Deposit Rule):
                </ThemedText>
                <ThemedText type="small" style={{ color: '#78350F', marginTop: 2 }}>
                  &bull; <strong>Deposit Due (50%):</strong> K{totals.depositRequired.toFixed(2)} before job commencement.
                </ThemedText>
                <ThemedText type="small" style={{ color: '#78350F' }}>
                  &bull; <strong>Balance Due (50%):</strong> K{totals.balanceDue.toFixed(2)} on final delivery.
                </ThemedText>
              </View>
            </View>

            {/* Verified Mobile Money Accounts */}
            <View style={styles.momoCard}>
              <ThemedText type="smallBold" style={{ color: '#0F172A', marginBottom: 6 }}>
                🏦 OFFICIAL MOBILE MONEY ACCOUNTS:
              </ThemedText>
              <View style={styles.momoGrid}>
                <View style={[styles.momoAgentBox, { borderLeftColor: '#EF4444' }]}>
                  <ThemedText type="smallBold" style={{ color: '#B91C1C' }}>AIRTEL MONEY</ThemedText>
                  <ThemedText style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>Code: 20051880</ThemedText>
                  <ThemedText type="small" style={{ color: '#475569' }}>Name: MAKELO WEZZY</ThemedText>
                </View>

                <View style={[styles.momoAgentBox, { borderLeftColor: '#EAB308' }]}>
                  <ThemedText type="smallBold" style={{ color: '#B45309' }}>MTN MOBILE MONEY</ThemedText>
                  <ThemedText style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>Number: 0768990586</ThemedText>
                  <ThemedText type="small" style={{ color: '#475569' }}>Name: NICHOLAS NTAMBILA</ThemedText>
                </View>
              </View>
              <ThemedText type="small" style={{ color: '#0284C7', fontWeight: '600', marginTop: 8 }}>
                📲 Send proof of deposit to WhatsApp: 0767825250
              </ThemedText>
            </View>
          </ScrollView>

          {/* Action Footer Buttons */}
          <View style={styles.footerBar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Print watermarked quotation"
              onPress={handlePrintQuotation}
              style={[styles.footerBtn, { backgroundColor: designTokens.color.brand.blue }]}
            >
              <ThemedText style={styles.footerBtnText}>🖨️ Print / PDF</ThemedText>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Share quote via WhatsApp"
              onPress={handleShareWhatsApp}
              style={[styles.footerBtn, { backgroundColor: '#10B981' }]}
            >
              <ThemedText style={styles.footerBtnText}>💬 WhatsApp Quote</ThemedText>
            </Pressable>

            {onConvertToSale && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Sync to POS sale"
                onPress={handleConvert}
                style={[styles.footerBtn, { backgroundColor: '#8B5CF6' }]}
              >
                <ThemedText style={styles.footerBtnText}>⚡ Load to POS</ThemedText>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.two,
  },
  container: {
    width: '100%',
    maxWidth: 680,
    maxHeight: '92%',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerLogo: {
    width: 44,
    height: 44,
  },
  closeBtn: {
    padding: 6,
  },
  scrollBody: {
    flex: 1,
    position: 'relative',
  },
  scrollContent: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  watermarkBg: {
    position: 'absolute',
    top: '30%',
    left: '25%',
    width: '50%',
    height: 260,
    opacity: 0.05,
    pointerEvents: 'none',
  },
  sectionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    padding: Spacing.two + 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 12,
    letterSpacing: 0.8,
    color: designTokens.color.brand.blue,
  },
  addItemBtn: {
    backgroundColor: 'rgba(2, 132, 199, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  addItemBtnText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
  },
  formRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  inputCol: {
    flex: 1,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 13,
    marginTop: 4,
  },
  itemRowCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: 8,
    marginTop: 6,
  },
  itemNumericRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  removeBtn: {
    padding: 8,
    marginLeft: 6,
  },
  discountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  discountPills: {
    flexDirection: 'row',
    gap: 6,
  },
  discountPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  totalsCard: {
    backgroundColor: 'rgba(16, 185, 129, 0.04)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
    padding: Spacing.two + 4,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 2,
  },
  grandTotalBorder: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(16, 185, 129, 0.3)',
    marginTop: 8,
    paddingTop: 8,
  },
  depositNotice: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  momoCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
  },
  momoGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  momoAgentBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderLeftWidth: 4,
    borderRadius: 6,
    padding: 8,
  },
  footerBar: {
    flexDirection: 'row',
    padding: Spacing.two,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  footerBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
});
