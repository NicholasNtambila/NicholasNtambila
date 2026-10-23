/**
 * Push Notifications helper for Sunga Manager.
 *
 * ⚠️  expo-notifications is NOT yet installed.
 *     When you have internet access run:
 *       npx expo install expo-notifications
 *     Then add to app.json plugins:
 *       ["expo-notifications", { "icon": "./assets/images/icon.png", "color": "#208AEF" }]
 *
 * This module safely no-ops on web and when the native module is absent so
 * the rest of the app can import it without crashes.
 *
 * Usage
 * -----
 *   // Register on app start (call once after user logs in):
 *   const token = await registerForPushNotifications();
 *   // Save token to your Supabase users table here.
 *
 *   // Schedule a local alert (works offline, no internet needed):
 *   await scheduleLocalNotification('Low stock', 'Flour is below minimum threshold.');
 *
 *   // Listen to incoming foreground notifications:
 *   const remove = addNotificationListener((n) => console.log(n.request.content.title));
 *   // Call remove() to unsubscribe.
 */

import { Platform } from 'react-native';

// ---------------------------------------------------------------------------
// Safe lazy import — avoids crash if native module is missing
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Notifications: any = null;

function getNotifications() {
  if (Notifications) return Notifications;
  if (Platform.OS === 'web') return null; // web not supported
  try {
    // Dynamic require so Metro doesn't error at bundle time if package missing
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Notifications = require('expo-notifications');
    return Notifications;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Types (inline — avoids importing from the missing package at top level)
// ---------------------------------------------------------------------------

export type NotificationListener = (notification: {
  request: { content: { title: string | null; body: string | null } };
}) => void;

// ---------------------------------------------------------------------------
// Register for remote push notifications
// ---------------------------------------------------------------------------

/**
 * Request permission and return the Expo Push Token string,
 * or `null` on web / when the native module is missing.
 *
 * IMPORTANT: Physical device required for a real token.
 * On simulator/emulator this returns a simulated token.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  const N = getNotifications();
  if (!N) return null;

  try {
    // Configure foreground behaviour
    await N.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    const { status: existingStatus } = await N.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await N.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return null; // user denied
    }

    const tokenData = await N.getExpoPushTokenAsync({
      // Replace with your EAS projectId from app.json / EAS dashboard
      projectId: 'sunga-manager',
    });
    return tokenData.data as string;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Schedule a local notification (works fully offline)
// ---------------------------------------------------------------------------

/**
 * Schedule an immediate local notification.
 * @param title  Short alert title.
 * @param body   Longer description text.
 * @param delaySeconds  Delay before showing (default 0 = immediate).
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  delaySeconds = 0,
): Promise<void> {
  const N = getNotifications();
  if (!N) return;

  try {
    await N.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger:
        delaySeconds > 0
          ? {
              type:
                N.SchedulableTriggerInputTypes?.TIME_INTERVAL ?? 'timeInterval',
              seconds: delaySeconds,
            }
          : null, // null = fire immediately
    });
  } catch {
    // silently ignore — notifications are non-critical
  }
}

// ---------------------------------------------------------------------------
// Low-stock alert helper (cashier sell flow)
// ---------------------------------------------------------------------------

/**
 * Fire an immediate local notification when a product hits low stock.
 * Call after a successful sale where remaining stock < threshold.
 */
export async function alertLowStock(
  productName: string,
  remaining: number,
  threshold = 5,
): Promise<void> {
  if (remaining > threshold) return;
  await scheduleLocalNotification(
    '⚠️ Low stock alert',
    `${productName} has only ${remaining} unit${remaining === 1 ? '' : 's'} remaining.`,
  );
}

// ---------------------------------------------------------------------------
// Add / remove listener for foreground notifications
// ---------------------------------------------------------------------------

/**
 * Listen to notifications received while the app is in the foreground.
 * Returns a cleanup function — call it in your useEffect cleanup.
 */
export function addNotificationListener(
  listener: NotificationListener,
): () => void {
  const N = getNotifications();
  if (!N) return () => {};

  try {
    const subscription = N.addNotificationReceivedListener(listener);
    return () => subscription.remove();
  } catch {
    return () => {};
  }
}
