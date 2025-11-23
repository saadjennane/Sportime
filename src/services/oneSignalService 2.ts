import OneSignal from 'react-onesignal';
import { registerOneSignalPlayer } from './notificationService';

/**
 * OneSignal Service
 * Handles OneSignal SDK initialization and player registration
 */

let isInitialized = false;

/**
 * Initialize OneSignal SDK
 */
export async function initializeOneSignal(): Promise<void> {
  if (isInitialized) {
    console.log('[OneSignal] Already initialized');
    return;
  }

  const appId = import.meta.env.VITE_ONESIGNAL_APP_ID;

  if (!appId) {
    console.warn('[OneSignal] VITE_ONESIGNAL_APP_ID not found in environment variables');
    return;
  }

  try {
    console.log('[OneSignal] Initializing...');

    await OneSignal.init({
      appId,
      allowLocalhostAsSecureOrigin: true, // For local development
      notifyButton: {
        enable: false, // We'll handle permissions ourselves
      },
    });

    isInitialized = true;
    console.log('[OneSignal] Initialized successfully');
  } catch (error) {
    console.error('[OneSignal] Failed to initialize:', error);
    throw error;
  }
}

/**
 * Request notification permission and register player
 */
export async function requestNotificationPermission(userId: string): Promise<string | null> {
  if (!isInitialized) {
    console.warn('[OneSignal] SDK not initialized');
    return null;
  }

  try {
    // Check if already subscribed
    const isSubscribed = await OneSignal.isPushNotificationsEnabled();

    if (isSubscribed) {
      const playerId = await OneSignal.getUserId();
      console.log('[OneSignal] Already subscribed, player ID:', playerId);
      return playerId;
    }

    // Request permission
    console.log('[OneSignal] Requesting permission...');
    await OneSignal.showNativePrompt();

    // Wait a bit for permission to be granted
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check if permission was granted
    const nowSubscribed = await OneSignal.isPushNotificationsEnabled();

    if (nowSubscribed) {
      const playerId = await OneSignal.getUserId();
      console.log('[OneSignal] Permission granted, player ID:', playerId);
      return playerId;
    } else {
      console.log('[OneSignal] Permission denied or not granted');
      return null;
    }
  } catch (error) {
    console.error('[OneSignal] Failed to request permission:', error);
    return null;
  }
}

/**
 * Register OneSignal Player ID with Supabase
 */
export async function registerPlayerWithSupabase(
  userId: string,
  playerId: string
): Promise<void> {
  try {
    console.log('[OneSignal] Registering player with Supabase:', { userId, playerId });

    // Determine device type
    const deviceType = getDeviceType();

    await registerOneSignalPlayer(userId, playerId, deviceType);

    console.log('[OneSignal] Player registered successfully');
  } catch (error) {
    console.error('[OneSignal] Failed to register player with Supabase:', error);
    throw error;
  }
}

/**
 * Setup OneSignal for a user (request permission + register)
 */
export async function setupOneSignalForUser(userId: string): Promise<void> {
  if (!isInitialized) {
    console.warn('[OneSignal] SDK not initialized, skipping setup');
    return;
  }

  try {
    const playerId = await requestNotificationPermission(userId);

    if (playerId) {
      await registerPlayerWithSupabase(userId, playerId);
    }
  } catch (error) {
    console.error('[OneSignal] Failed to setup for user:', error);
  }
}

/**
 * Get current OneSignal Player ID
 */
export async function getPlayerId(): Promise<string | null> {
  if (!isInitialized) {
    return null;
  }

  try {
    const isSubscribed = await OneSignal.isPushNotificationsEnabled();

    if (isSubscribed) {
      return await OneSignal.getUserId();
    }

    return null;
  } catch (error) {
    console.error('[OneSignal] Failed to get player ID:', error);
    return null;
  }
}

/**
 * Detect device type
 */
function getDeviceType(): 'web' | 'ios' | 'android' {
  const userAgent = navigator.userAgent.toLowerCase();

  if (/iphone|ipad|ipod/.test(userAgent)) {
    return 'ios';
  }

  if (/android/.test(userAgent)) {
    return 'android';
  }

  return 'web';
}

/**
 * Unsubscribe from notifications (optional cleanup)
 */
export async function unsubscribeFromNotifications(): Promise<void> {
  if (!isInitialized) {
    return;
  }

  try {
    await OneSignal.setSubscription(false);
    console.log('[OneSignal] Unsubscribed successfully');
  } catch (error) {
    console.error('[OneSignal] Failed to unsubscribe:', error);
  }
}
