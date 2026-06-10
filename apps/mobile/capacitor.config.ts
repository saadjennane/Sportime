import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sportime.app',
  appName: 'Sportime',
  webDir: 'dist',
  backgroundColor: '#0f0f12',
  ios: {
    backgroundColor: '#0f0f12',
    // Let the web content extend under the status bar / home indicator;
    // safe-area insets are handled in CSS.
    contentInset: 'never',
  },
  android: {
    backgroundColor: '#0f0f12',
  },
  plugins: {
    SplashScreen: {
      // We hide the splash manually from the native init once React has mounted,
      // which avoids the white "Loading..." flash.
      launchAutoHide: false,
      backgroundColor: '#0f0f12',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
    Keyboard: {
      // 'none' = keyboard overlays the webview without resizing it, so fixed elements
      // (bottom nav/footer) stay put instead of jumping up with the keyboard.
      resize: 'none',
    },
    StatusBar: {
      // Dark style = light (white) text/icons, suited to our dark UI.
      style: 'DARK',
      backgroundColor: '#0f0f12',
    },
  },
};

export default config;
