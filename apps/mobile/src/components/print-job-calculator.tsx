import { designTokens } from '@sanitech/shared';
import React, { useMemo, useState } from 'react';
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

interface PrintJobCalculatorProps {
  visible: boolean;
  onClose: () => void;
  onAddToCart: (item: {
    id: string;
    name: string;
    price: number;
    quantity: number;
    available: number;
  }) => void;
}

type JobType = 'photocopy' | 'printing' | 'scanning';
type ColorMode = 'bw' | 'color';
type SidesMode = 'single' | 'double';
type PaperSize = 'a4' | 'a3';
type FinishingType =
  'none' | 'spiral_binding' | 'thermal_binding' | 'lamination';

export function PrintJobCalculator({
  visible,
  onClose,
  onAddToCart,
}: PrintJobCalculatorProps) {
  const theme = useTheme();

  const [jobType, setJobType] = useState<JobType>('printing');
  const [colorMode, setColorMode] = useState<ColorMode>('bw');
  const [sidesMode, setSidesMode] = useState<SidesMode>('single');
  const [paperSize, setPaperSize] = useState<PaperSize>('a4');
  const [pages, setPages] = useState('1');
  const [copies, setCopies] = useState('1');
  const [finishing, setFinishing] = useState<FinishingType>('none');

  // Official SaniT3ch pricing matrix
  const calculation = useMemo(() => {
    const numPages = Math.max(1, parseInt(pages, 10) || 1);
    const numCopies = Math.max(1, parseInt(copies, 10) || 1);
    const totalImpressions = numPages * numCopies;

    let baseRate = 2.0;

    if (jobType === 'photocopy') {
      if (colorMode === 'bw') {
        baseRate = sidesMode === 'single' ? 2.0 : 3.0;
      } else {
        baseRate = sidesMode === 'single' ? 5.0 : 8.0;
      }
    } else if (jobType === 'printing') {
      if (colorMode === 'bw') {
        baseRate = sidesMode === 'single' ? 5.0 : 8.0;
      } else {
        baseRate = sidesMode === 'single' ? 10.0 : 16.0;
      }
    } else {
      // scanning
      baseRate = 3.0;
    }

    // A3 paper multiplier
    if (paperSize === 'a3') {
      baseRate *= 2;
    }

    const printSubtotal = totalImpressions * baseRate;

    // Finishing fees (per copy)
    let finishingPerCopy = 0;
    if (finishing === 'spiral_binding') finishingPerCopy = 25;
    else if (finishing === 'thermal_binding') finishingPerCopy = 35;
    else if (finishing === 'lamination') finishingPerCopy = 20 * numPages;

    const finishingSubtotal = finishingPerCopy * numCopies;
    const totalCost = printSubtotal + finishingSubtotal;

    return {
      numPages,
      numCopies,
      totalImpressions,
      baseRate,
      printSubtotal,
      finishingSubtotal,
      totalCost,
    };
  }, [jobType, colorMode, sidesMode, paperSize, pages, copies, finishing]);

  function handleAdd() {
    const typeLabel =
      jobType === 'photocopy'
        ? 'Photocopy'
        : jobType === 'printing'
          ? 'Print'
          : 'Scan';
    const colorLabel = colorMode === 'bw' ? 'B/W' : 'Color';
    const sidesLabel = sidesMode === 'single' ? 'Single' : 'Double';
    const finishLabel =
      finishing === 'spiral_binding'
        ? ' + Spiral'
        : finishing === 'thermal_binding'
          ? ' + Thermal'
          : finishing === 'lamination'
            ? ' + Lam'
            : '';

    const title = `${typeLabel} (${calculation.numPages}p × ${calculation.numCopies}c, ${colorLabel} ${sidesLabel} ${paperSize.toUpperCase()}${finishLabel})`;

    onAddToCart({
      id: `calc-job-${Date.now()}`,
      name: title,
      price: calculation.totalCost,
      quantity: 1,
      available: 9999,
    });

    onClose();
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
          {/* 1. Fixed Header Area */}
          <View style={styles.header}>
            <View style={styles.headerTitleGroup}>
              <ThemedText style={{ fontSize: 22 }}>🖨️</ThemedText>
              <View>
                <ThemedText type="subtitle" style={styles.modalTitle}>
                  Print & Copy Calculator
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Official SaniT3ch live pricing & finishing rates
                </ThemedText>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close calculator modal"
              onPress={onClose}
              style={styles.closeBtn}
            >
              <ThemedText type="subtitle" style={{ color: '#94A3B8' }}>✕</ThemedText>
            </Pressable>
          </View>

          {/* 2. Scrollable Body with 2-Column Responsive Layout */}
          <ScrollView
            style={styles.scrollBody}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
          >
            {/* Section 1: Job Type & Paper Size */}
            <View style={styles.gridRow}>
              <View style={styles.gridCol}>
                <ThemedText type="smallBold" style={styles.fieldLabel}>
                  JOB TYPE
                </ThemedText>
                <View style={styles.toggleRow}>
                  {[
                    { id: 'printing', label: '🖨️ Print' },
                    { id: 'photocopy', label: '📄 Copy' },
                    { id: 'scanning', label: '🔍 Scan' },
                  ].map((t) => (
                    <Pressable
                      key={t.id}
                      onPress={() => setJobType(t.id as JobType)}
                      style={[
                        styles.toggleBtn,
                        jobType === t.id && styles.toggleBtnActive,
                      ]}
                    >
                      <ThemedText
                        type="small"
                        style={[
                          styles.toggleBtnText,
                          jobType === t.id && styles.toggleBtnTextActive,
                        ]}
                      >
                        {t.label}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.gridCol}>
                <ThemedText type="smallBold" style={styles.fieldLabel}>
                  PAPER SIZE
                </ThemedText>
                <View style={styles.toggleRow}>
                  {[
                    { id: 'a4', label: 'A4 Paper' },
                    { id: 'a3', label: 'A3 (2× Rate)' },
                  ].map((s) => (
                    <Pressable
                      key={s.id}
                      onPress={() => setPaperSize(s.id as PaperSize)}
                      style={[
                        styles.toggleBtn,
                        paperSize === s.id && styles.toggleBtnActive,
                      ]}
                    >
                      <ThemedText
                        type="small"
                        style={[
                          styles.toggleBtnText,
                          paperSize === s.id && styles.toggleBtnTextActive,
                        ]}
                      >
                        {s.label}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            {/* Section 2: Color Mode & Print Sides (Aligned consistently) */}
            <View style={styles.gridRow}>
              <View style={styles.gridCol}>
                <ThemedText type="smallBold" style={styles.fieldLabel}>
                  COLOR MODE
                </ThemedText>
                <View style={styles.toggleRow}>
                  {[
                    { id: 'bw', label: '⚫ Black & White' },
                    { id: 'color', label: '🌈 Full Color' },
                  ].map((c) => (
                    <Pressable
                      key={c.id}
                      onPress={() => setColorMode(c.id as ColorMode)}
                      style={[
                        styles.toggleBtn,
                        colorMode === c.id && styles.toggleBtnActive,
                      ]}
                    >
                      <ThemedText
                        type="small"
                        style={[
                          styles.toggleBtnText,
                          colorMode === c.id && styles.toggleBtnTextActive,
                        ]}
                      >
                        {c.label}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.gridCol}>
                <ThemedText type="smallBold" style={styles.fieldLabel}>
                  SIDES / IMPRESSION
                </ThemedText>
                <View style={styles.toggleRow}>
                  {[
                    { id: 'single', label: 'Single Sided' },
                    { id: 'double', label: 'Double Sided' },
                  ].map((s) => (
                    <Pressable
                      key={s.id}
                      onPress={() => setSidesMode(s.id as SidesMode)}
                      style={[
                        styles.toggleBtn,
                        sidesMode === s.id && styles.toggleBtnActive,
                      ]}
                    >
                      <ThemedText
                        type="small"
                        style={[
                          styles.toggleBtnText,
                          sidesMode === s.id && styles.toggleBtnTextActive,
                        ]}
                      >
                        {s.label}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            {/* Section 3: Pages & Copies Inputs */}
            <View style={styles.gridRow}>
              <View style={styles.gridCol}>
                <ThemedText type="smallBold" style={styles.fieldLabel}>
                  NUMBER OF PAGES
                </ThemedText>
                <TextInput
                  accessibilityLabel="Number of pages"
                  keyboardType="numeric"
                  value={pages}
                  onChangeText={(v) =>
                    setPages(v.replace(/[^0-9]/g, ''))
                  }
                  style={[
                    styles.numberInput,
                    {
                      color: theme.text,
                      backgroundColor: theme.backgroundElement,
                      borderColor: theme.backgroundSelected,
                    },
                  ]}
                />
              </View>

              <View style={styles.gridCol}>
                <ThemedText type="smallBold" style={styles.fieldLabel}>
                  NUMBER OF COPIES
                </ThemedText>
                <TextInput
                  accessibilityLabel="Number of copies"
                  keyboardType="numeric"
                  value={copies}
                  onChangeText={(v) =>
                    setCopies(v.replace(/[^0-9]/g, ''))
                  }
                  style={[
                    styles.numberInput,
                    {
                      color: theme.text,
                      backgroundColor: theme.backgroundElement,
                      borderColor: theme.backgroundSelected,
                    },
                  ]}
                />
              </View>
            </View>

            {/* Section 4: Finishing & Binding Add-ons */}
            {jobType !== 'scanning' && (
              <View style={styles.fullWidthSection}>
                <ThemedText type="smallBold" style={styles.fieldLabel}>
                  FINISHING & BINDING
                </ThemedText>
                <View style={styles.finishingGrid}>
                  {[
                    { id: 'none', label: 'No Finishing' },
                    { id: 'spiral_binding', label: 'Spiral Comb (+K25)' },
                    { id: 'thermal_binding', label: 'Thermal Spine (+K35)' },
                    { id: 'lamination', label: 'A4 Lamination (+K20/page)' },
                  ].map((f) => (
                    <Pressable
                      key={f.id}
                      onPress={() => setFinishing(f.id as FinishingType)}
                      style={[
                        styles.finishChip,
                        finishing === f.id && styles.finishChipActive,
                      ]}
                    >
                      <ThemedText
                        type="small"
                        style={[
                          styles.finishChipText,
                          finishing === f.id && styles.finishChipTextActive,
                        ]}
                      >
                        {f.label}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* Section 5: High-Contrast Live Financial Breakdown Card */}
            <View
              style={[
                styles.summaryCard,
                {
                  backgroundColor: theme.backgroundElement,
                  borderColor: theme.backgroundSelected,
                },
              ]}
            >
              <View style={styles.summaryRow}>
                <ThemedText type="small" themeColor="textSecondary">
                  Total Impressions:
                </ThemedText>
                <ThemedText type="smallBold">
                  {calculation.totalImpressions} pages ({calculation.numPages}p
                  × {calculation.numCopies}c)
                </ThemedText>
              </View>
              <View style={styles.summaryRow}>
                <ThemedText type="small" themeColor="textSecondary">
                  Rate per Impression:
                </ThemedText>
                <ThemedText type="smallBold">
                  K{calculation.baseRate.toFixed(2)}
                </ThemedText>
              </View>
              {calculation.finishingSubtotal > 0 && (
                <View style={styles.summaryRow}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Finishing / Binding:
                  </ThemedText>
                  <ThemedText type="smallBold">
                    K{calculation.finishingSubtotal.toFixed(2)}
                  </ThemedText>
                </View>
              )}
              <View style={[styles.summaryRow, styles.totalRow]}>
                <ThemedText type="subtitle">Estimated Total:</ThemedText>
                <ThemedText
                  type="title"
                  style={{ color: '#0284C7', fontWeight: '800' }}
                >
                  K{calculation.totalCost.toFixed(2)}
                </ThemedText>
              </View>
            </View>
          </ScrollView>

          {/* 3. Dedicated Footer Action Bar (Always Accessible & Visible) */}
          <View style={styles.footerBar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add Print Job to Cart"
              onPress={handleAdd}
              style={[
                styles.addBtn,
                { backgroundColor: designTokens.color.brand.blue },
              ]}
            >
              <ThemedText style={styles.addBtnText}>
                🛒 Add Print Job to Cart &bull; K{calculation.totalCost.toFixed(2)}
              </ThemedText>
            </Pressable>
          </View>
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
    maxWidth: 740,
    maxHeight: '90%',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0284C7',
  },
  closeBtn: {
    padding: 8,
  },
  scrollBody: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
  },
  gridCol: {
    flex: 1,
  },
  fullWidthSection: {
    width: '100%',
  },
  fieldLabel: {
    marginBottom: 6,
    fontSize: 11,
    letterSpacing: 0.6,
    color: '#0284C7',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 6,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  toggleBtnActive: {
    backgroundColor: 'rgba(2, 132, 199, 0.18)',
    borderColor: '#0284C7',
  },
  toggleBtnText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  toggleBtnTextActive: {
    color: '#38BDF8',
    fontWeight: '700',
  },
  numberInput: {
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
  },
  finishingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  finishChip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  finishChipActive: {
    borderColor: '#0284C7',
    backgroundColor: 'rgba(2, 132, 199, 0.18)',
  },
  finishChipText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  finishChipTextActive: {
    color: '#38BDF8',
    fontWeight: '700',
  },
  summaryCard: {
    borderRadius: 12,
    padding: Spacing.three,
    borderWidth: 1,
    gap: 6,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 8,
    marginTop: 4,
  },
  footerBar: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  addBtn: {
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
});
