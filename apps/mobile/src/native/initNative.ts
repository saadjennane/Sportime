import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Keyboard } from '@capacitor/keyboard';
import { App } from '@capacitor/app';

/**
 * One-time native bootstrap, called from main.tsx once React has mounted.
 * Every call is a no-op on the web build (PWA), so the same codebase keeps
 * working in the browser.
 *
 * Each step is independent and self-guarded: one native call hanging or
 * failing must never block the others (in particular hiding the splash).
 */
export function initNative(): void {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  // --- Splash screen --------------------------------------------------------
  // React has mounted by the time this runs, so hide the splash right away to
  // avoid the white flash. Done first so nothing else can block it.
  SplashScreen.hide().catch((err) => console.warn('[native] SplashScreen.hide failed', err));

  // --- Status bar -----------------------------------------------------------
  // Style.Dark => light (white) icons/text, suited to our dark UI.
  StatusBar.setStyle({ style: Style.Dark }).catch((err) =>
    console.warn('[native] StatusBar.setStyle failed', err),
  );
  if (Capacitor.getPlatform() === 'android') {
    StatusBar.setBackgroundColor({ color: '#0f0f12' }).catch((err) =>
      console.warn('[native] StatusBar.setBackgroundColor failed', err),
    );
  }

  // --- Keyboard -------------------------------------------------------------
  // Toggle a body class so CSS can react (release vertical centering so a
  // focused input is never hidden behind the keyboard).
  try {
    Keyboard.addListener('keyboardWillShow', () => {
      document.body.classList.add('keyboard-open');
    });
    Keyboard.addListener('keyboardWillHide', () => {
      document.body.classList.remove('keyboard-open');
    });
  } catch (err) {
    console.warn('[native] Keyboard listeners failed', err);
  }

  // --- Android hardware back button ----------------------------------------
  // Navigate back within the SPA when possible, otherwise exit at the root.
  try {
    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack || window.history.length > 1) {
        window.history.back();
      } else {
        App.exitApp();
      }
    });
  } catch (err) {
    console.warn('[native] backButton listener failed', err);
  }
}
