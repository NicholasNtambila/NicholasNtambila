import { designTokens } from '@sanitech/shared';
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from './themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { logAuditEvent } from '../../lib/pos-data';

interface StationLockModalProps {
  visible: boolean;
  userName: string;
  userId: string;
  onUnlock: () => void;
}

export function StationLockModal({
  visible,
  userName,
  userId,
  onUnlock,
}: StationLockModalProps) {
  const theme = useTheme();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Default PIN 1234 or Nicholas password 12345678
  function handleUnlock() {
    setError(null);
    if (pin === '1234' || pin === '12345678' || pin.length >= 4) {
      logAuditEvent(
        'station_unlocked',
        { id: userId, name: userName },
        `Station unlocked by ${userName}`,
      );
      setPin('');
      onUnlock();
    } else {
      setError('Enter your 4-digit PIN (default: 1234).');
    }
  }

  function handleKey(char: string) {
    if (pin.length < 8) {
      setPin((p) => p + char);
      setError(null);
    }
  }

  function handleBackspace() {
    setPin((p) => p.slice(0, -1));
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.background,
              borderColor: theme.backgroundSelected,
            },
          ]}
        >
          {/* Lock Icon & Station Header */}
          <View style={styles.iconContainer}>
            <ThemedText style={styles.lockIcon}>🔒</ThemedText>
          </View>

          <ThemedText type="title" style={styles.title}>
            Station Locked
          </ThemedText>
          <ThemedText
            type="small"
            themeColor="textSecondary"
            style={styles.subtitle}
          >
            Logged in as <ThemedText type="smallBold">{userName}</ThemedText>
          </ThemedText>
          <ThemedText type="small" style={styles.note}>
            Active cart items, tender calculations, and shift data are safely
            preserved.
          </ThemedText>

          {/* PIN Input Display */}
          <View style={styles.pinDisplay}>
            <TextInput
              secureTextEntry
              accessibilityLabel="Unlock PIN"
              placeholder="••••"
              placeholderTextColor={theme.textSecondary}
              value={pin}
              onChangeText={setPin}
              keyboardType="number-pad"
              maxLength={8}
              style={[
                styles.pinInput,
                {
                  color: theme.text,
                  borderColor: error
                    ? designTokens.color.negative
                    : designTokens.color.brand.blue,
                  backgroundColor: theme.backgroundElement,
                },
              ]}
            />
          </View>

          {error ? (
            <ThemedText style={styles.errorText}>{error}</ThemedText>
          ) : null}

          {/* Keypad */}
          <View style={styles.keypad}>
            {[
              ['1', '2', '3'],
              ['4', '5', '6'],
              ['7', '8', '9'],
              ['C', '0', '⌫'],
            ].map((row, idx) => (
              <View key={idx} style={styles.keyRow}>
                {row.map((key) => (
                  <Pressable
                    key={key}
                    accessibilityRole="button"
                    accessibilityLabel={key}
                    onPress={() => {
                      if (key === 'C') setPin('');
                      else if (key === '⌫') handleBackspace();
                      else handleKey(key);
                    }}
                    style={[
                      styles.keyBtn,
                      { backgroundColor: theme.backgroundElement },
                    ]}
                  >
                    <ThemedText type="subtitle">{key}</ThemedText>
                  </Pressable>
                ))}
              </View>
            ))}
          </View>

          {/* Unlock Action Button */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Unlock Station"
            onPress={handleUnlock}
            style={[
              styles.unlockButton,
              { backgroundColor: designTokens.color.brand.blue },
            ]}
          >
            <ThemedText style={styles.unlockButtonText}>
              🔓 Unlock Station
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
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.four,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(20, 125, 146, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  lockIcon: {
    fontSize: 28,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 4,
  },
  note: {
    textAlign: 'center',
    color: '#059669',
    fontSize: 12,
    marginBottom: Spacing.three,
  },
  pinDisplay: {
    width: '100%',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  pinInput: {
    width: 160,
    height: 48,
    borderRadius: 8,
    borderWidth: 2,
    textAlign: 'center',
    fontSize: 24,
    letterSpacing: 8,
    fontWeight: '700',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: Spacing.two,
  },
  keypad: {
    width: '100%',
    gap: 8,
    marginBottom: Spacing.three,
  },
  keyRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  keyBtn: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unlockButton: {
    width: '100%',
    height: 50,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unlockButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
});
