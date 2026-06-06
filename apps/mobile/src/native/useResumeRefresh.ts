import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

const DEFAULT_MIN_BACKGROUND_MS = 90_000; // 1.5 min

/**
 * Runs `onResume` when the native app returns to the foreground — but ONLY if it
 * was backgrounded for at least `minBackgroundMs`. A quick app-switch (minimise
 * and come right back) does nothing, so the UI never reloads needlessly.
 * iOS/Android suspend JS timers in the background, so this lets a screen refresh
 * its data after a real absence. No-op on web.
 */
export function useResumeRefresh(
  onResume: () => void,
  minBackgroundMs: number = DEFAULT_MIN_BACKGROUND_MS,
): void {
  const cb = useRef(onResume);
  cb.current = onResume;
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let remove: (() => void) | undefined;
    App.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) {
        // Going to background — remember when.
        backgroundedAt.current = Date.now();
        return;
      }
      // Coming back to foreground — only refresh after a real absence.
      const since = backgroundedAt.current;
      backgroundedAt.current = null;
      if (since !== null && Date.now() - since >= minBackgroundMs) {
        cb.current();
      }
    })
      .then((handle) => {
        remove = () => handle.remove();
      })
      .catch(() => {});

    return () => remove?.();
  }, [minBackgroundMs]);
}
