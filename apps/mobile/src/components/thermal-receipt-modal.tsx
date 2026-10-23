import { designTokens } from '@sanitech/shared';
import * as Print from 'expo-print';
import React, { useState } from 'react';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { ThemedText } from './themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  formatPos80ThermalReceipt,
  generateDetailedInvoiceHtml,
  generateThermalReceiptHtml,
  ReceiptData,
} from '../../lib/pos-receipt';

interface ThermalReceiptModalProps {
  visible: boolean;
  receiptData: ReceiptData | null;
  onClose: () => void;
}

export function ThermalReceiptModal({
  visible,
  receiptData,
  onClose,
}: ThermalReceiptModalProps) {
  const theme = useTheme();
  const [copied, setCopied] = useState(false);

  if (!receiptData) return null;

  const receiptText = formatPos80ThermalReceipt(receiptData);

  async function handlePrintThermal() {
    const html = generateThermalReceiptHtml(receiptData!);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const printWindow = window.open('', '_blank', 'width=380,height=600');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 300);
      } else {
        window.print();
      }
    } else {
      await Print.printAsync({ html });
    }
  }

  async function handlePrintInvoice() {
    const html = generateDetailedInvoiceHtml(receiptData!);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 350);
      } else {
        window.print();
      }
    } else {
      await Print.printAsync({ html });
    }
  }

  function handleCopy() {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(receiptText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <Modal visible={visible} animationType="fade" transparent>
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Image
                source={require('../../assets/images/sanit3ch-logo.png')}
                style={styles.logoHeader}
                resizeMode="contain"
              />
              <View>
                <ThemedText type="subtitle">🧾 Official Receipt & Invoice</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  SaniT3ch POS-80 with Watermark
                </ThemedText>
              </View>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <ThemedText type="subtitle">✕</ThemedText>
            </Pressable>
          </View>

          {/* Paper Receipt Simulation Card with Watermark */}
          <ScrollView style={styles.paperScroll}>
            <View style={styles.paper}>
              <Image
                source={require('../../assets/images/sanit3ch-logo.png')}
                style={styles.watermarkBg}
                resizeMode="contain"
              />
              <ThemedText style={styles.paperText}>{receiptText}</ThemedText>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actionsRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Print POS-80 thermal receipt"
              onPress={handlePrintThermal}
              style={[
                styles.actionBtn,
                { backgroundColor: designTokens.color.brand.blue },
              ]}
            >
              <ThemedText style={styles.actionBtnText}>
                🖨️ POS-80 (Thermal)
              </ThemedText>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Print full invoice"
              onPress={handlePrintInvoice}
              style={[
                styles.actionBtn,
                { backgroundColor: '#0284C7' },
              ]}
            >
              <ThemedText style={styles.actionBtnText}>
                📄 Tax Invoice (A4)
              </ThemedText>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Copy receipt text"
              onPress={handleCopy}
              style={[styles.actionBtn, styles.copyBtn]}
            >
              <ThemedText style={styles.copyBtnText}>
                {copied ? '✓ Copied' : '📋 Copy'}
              </ThemedText>
            </Pressable>
          </View>

          <Pressable onPress={onClose} style={styles.doneBtn}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              Done / Close
            </ThemedText>
          </Pressable>
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
    maxWidth: 480,
    maxHeight: '90%',
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.two,
    paddingBottom: Spacing.one,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  logoHeader: {
    width: 36,
    height: 36,
  },
  closeBtn: {
    padding: 6,
  },
  paperScroll: {
    flex: 1,
    marginVertical: Spacing.one,
  },
  paper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
    overflow: 'hidden',
  },
  watermarkBg: {
    position: 'absolute',
    top: '30%',
    left: '20%',
    width: '60%',
    height: 200,
    opacity: 0.08,
    pointerEvents: 'none',
  },
  paperText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11.5,
    lineHeight: 16,
    color: '#0F172A',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: Spacing.two,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  copyBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  copyBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
  },
  doneBtn: {
    marginTop: Spacing.one,
    paddingVertical: 8,
    alignItems: 'center',
  },
});
