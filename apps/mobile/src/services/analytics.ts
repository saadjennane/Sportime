// PostHog product analytics. Initialised once at app start; user identified on
// auth and reset on logout. No-ops gracefully if VITE_POSTHOG_KEY is unset.
import posthog from 'posthog-js';

let started = false;

export function initAnalytics(): void {
  if (started) return;
  const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
  if (!key) { console.warn('[analytics] VITE_POSTHOG_KEY missing — analytics disabled'); return; }
  try {
    posthog.init(key, {
      api_host: (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || 'https://eu.i.posthog.com',
      capture_pageview: false,            // SPA — we send our own navigation events
      person_profiles: 'identified_only', // don't create profiles for anonymous/guest traffic
      disable_session_recording: true,    // not needed inside the app webview
    });
    started = true;
    try { posthog.capture('app_opened'); } catch { /* ignore */ }
  } catch (e) {
    console.error('[analytics] init failed', e);
  }
}

export function identifyUser(id: string, props?: Record<string, any>): void {
  if (started) try { posthog.identify(id, props); } catch { /* ignore */ }
}

/** Register super properties sent on EVERY event (platform, app_version, sport, …). */
export function registerSuperProps(props: Record<string, any>): void {
  if (started) try { posthog.register(props); } catch { /* ignore */ }
}

export function resetAnalytics(): void {
  if (started) try { posthog.reset(); } catch { /* ignore */ }
}

export function track(event: string, props?: Record<string, any>): void {
  if (started) try { posthog.capture(event, props); } catch { /* ignore */ }
}
