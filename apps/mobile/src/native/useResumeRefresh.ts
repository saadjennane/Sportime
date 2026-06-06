import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

/**
 * Runs `onResume` whenever the native app returns to the foreground.
 * iOS/Android suspend JS timers in the background, so polling stops; this lets
 * a screen refresh its data the moment the user comes back. No-op on web.
 */
export function useResumeRefresh(onResume: () => void): void {
  const cb = useRef(onResume);
  cb.current = onResume;

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let remove: (() => void) | undefined;
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) cb.current();
    })
      .then((handle) => {
        remove = () => handle.remove();
      })
      .catch(() => {});

    return () => remove?.();
  }, []);
}
