// OneSignal native push (Capacitor) — onesignal-cordova-plugin v5. Calls are
// guarded to native platforms (no-ops on web). App ID from VITE_ONESIGNAL_APP_ID;
// APNs must be configured in the OneSignal dashboard for iOS delivery. We set the
// user's id as the OneSignal external id (login) so the server can target pushes
// by external id; the subscription id is also stored in Supabase.
import { Capacitor } from '@capacitor/core';
import OneSignal from 'onesignal-cordova-plugin';
import { registerOneSignalPlayer } from './notificationService';

let initialized = false;
const isNative = () => Capacitor.isNativePlatform();
const deviceType = (): 'ios' | 'android' | 'web' => {
  const p = Capacitor.getPlatform();
  return p === 'ios' ? 'ios' : p === 'android' ? 'android' : 'web';
};

/** Initialise the SDK once, on native platforms only. */
export function initializeOneSignal(): void {
  if (initialized || !isNative()) return;
  const appId = import.meta.env.VITE_ONESIGNAL_APP_ID as string | undefined;
  if (!appId) { console.warn('[OneSignal] VITE_ONESIGNAL_APP_ID missing — push disabled'); return; }
  try {
    OneSignal.initialize(appId);
    initialized = true;
    console.log('[OneSignal] initialized');
  } catch (e) {
    console.error('[OneSignal] init failed', e);
  }
}

async function currentSubscriptionId(): Promise<string | null> {
  try {
    const sub: any = (OneSignal as any).User?.pushSubscription;
    if (!sub) return null;
    if (typeof sub.getIdAsync === 'function') return (await sub.getIdAsync()) ?? null;
    return sub.id ?? null;
  } catch { return null; }
}

/** Link the user to OneSignal (external id), prompt for permission, store the subscription id. */
export async function setupOneSignalForUser(userId: string): Promise<void> {
  if (!isNative()) return;
  if (!initialized) initializeOneSignal();
  if (!initialized) return;
  try {
    OneSignal.login(userId); // external id = our user id
    const granted = await OneSignal.Notifications.requestPermission(true);
    if (!granted) { console.log('[OneSignal] permission not granted'); return; }
    const subId = await currentSubscriptionId();
    if (subId) await registerOneSignalPlayer(userId, subId, deviceType());
  } catch (e) {
    console.error('[OneSignal] setup failed', e);
  }
}

/** B5 — set user attribute tags for segmentation (no-op off-native). Values must be strings. */
export function addOneSignalTags(tags: Record<string, string>): void {
  if (!isNative() || !initialized) return;
  try { (OneSignal as any).User.addTags(tags); } catch (e) { console.warn('[OneSignal] addTags failed', e); }
}

/** B1 — register a handler for notification clicks; receives the deep-link route + notif_key. */
export function setNotificationOpenHandler(cb: (route: string | null, notifKey: string | null) => void): void {
  if (!isNative()) return;
  try {
    (OneSignal as any).Notifications.addEventListener('click', (event: any) => {
      const data = event?.notification?.additionalData ?? event?.result?.notification?.additionalData ?? {};
      cb((data?.route as string) ?? (data?.actionLink as string) ?? null, (data?.notifKey as string) ?? null);
    });
  } catch (e) { console.warn('[OneSignal] click handler failed', e); }
}

/** Unlink the device from the user (call on logout). */
export function logoutOneSignal(): void {
  if (!isNative() || !initialized) return;
  try { OneSignal.logout(); } catch { /* ignore */ }
}

export async function getPlayerId(): Promise<string | null> {
  if (!isNative() || !initialized) return null;
  return currentSubscriptionId();
}
