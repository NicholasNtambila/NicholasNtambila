import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const BIOMETRIC_KEY = 'sunga_biometric_session';

export type BiometricStatus = {
  isAvailable: boolean;
  isEnrolled: boolean;
  biometricType: 'Face ID' | 'Fingerprint' | 'Biometrics' | null;
};

export type StoredBiometricCredential = {
  email: string;
  refreshToken: string;
};

export async function checkBiometrics(): Promise<BiometricStatus> {
  if (Platform.OS === 'web') {
    return { isAvailable: false, isEnrolled: false, biometricType: null };
  }

  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) {
      return { isAvailable: false, isEnrolled: false, biometricType: null };
    }

    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    const supportedTypes =
      await LocalAuthentication.supportedAuthenticationTypesAsync();

    let biometricType: 'Face ID' | 'Fingerprint' | 'Biometrics' = 'Biometrics';
    if (
      supportedTypes.includes(
        LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
      )
    ) {
      biometricType = 'Face ID';
    } else if (
      supportedTypes.includes(
        LocalAuthentication.AuthenticationType.FINGERPRINT,
      )
    ) {
      biometricType = 'Fingerprint';
    }

    return {
      isAvailable: true,
      isEnrolled,
      biometricType,
    };
  } catch {
    return { isAvailable: false, isEnrolled: false, biometricType: null };
  }
}

export async function authenticateWithBiometrics(
  promptMessage = 'Scan your biometric to sign in',
): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      fallbackLabel: 'Use password instead',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });
    return result.success;
  } catch {
    return false;
  }
}

export async function saveBiometricSession(
  email: string,
  refreshToken: string,
): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const data: StoredBiometricCredential = { email, refreshToken };
    await SecureStore.setItemAsync(BIOMETRIC_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage failure
  }
}

export async function getBiometricSession(): Promise<StoredBiometricCredential | null> {
  if (Platform.OS === 'web') return null;
  try {
    const raw = await SecureStore.getItemAsync(BIOMETRIC_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredBiometricCredential;
    if (parsed && typeof parsed.email === 'string' && parsed.refreshToken) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export async function clearBiometricSession(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await SecureStore.deleteItemAsync(BIOMETRIC_KEY);
  } catch {
    // Ignore delete failure
  }
}
