import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

/**
 * Thin haptics wrapper. Every call is a no-op on the web build, so callers can
 * sprinkle feedback freely without platform checks.
 */

const isNative = () => Capacitor.isNativePlatform();

/** Physical "tap" feedback — use on selections, toggles, quick actions. */
export function hapticImpact(style: 'light' | 'medium' | 'heavy' = 'light'): void {
  if (!isNative()) return;
  const map = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy };
  Haptics.impact({ style: map[style] }).catch(() => {});
}

/** Success feedback — use when an action completes (bet placed, claim, etc.). */
export function hapticSuccess(): void {
  if (!isNative()) return;
  Haptics.notification({ type: NotificationType.Success }).catch(() => {});
}

/** Warning/error feedback — use on rejected actions. */
export function hapticError(): void {
  if (!isNative()) return;
  Haptics.notification({ type: NotificationType.Error }).catch(() => {});
}
