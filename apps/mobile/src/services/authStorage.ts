// Native storage adapter for the Supabase auth session — backed by Capacitor Preferences
// (iOS UserDefaults / Android SharedPreferences). Survives WebView storage eviction, so a
// guest stays attached to the device until signup. Migrates any pre-existing localStorage
// session on first read (no one gets logged out by the switch).
import { Preferences } from '@capacitor/preferences';

export const capacitorAuthStorage = {
  async getItem(key: string): Promise<string | null> {
    const { value } = await Preferences.get({ key });
    if (value != null) return value;
    // One-time migration of a session previously kept in WebView localStorage.
    try {
      const legacy = globalThis.localStorage?.getItem(key) ?? null;
      if (legacy != null) { await Preferences.set({ key, value: legacy }); return legacy; }
    } catch { /* no localStorage */ }
    return null;
  },
  async setItem(key: string, value: string): Promise<void> {
    await Preferences.set({ key, value });
  },
  async removeItem(key: string): Promise<void> {
    await Preferences.remove({ key });
    try { globalThis.localStorage?.removeItem(key); } catch { /* ignore */ }
  },
};
