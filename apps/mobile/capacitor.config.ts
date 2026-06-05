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
      // Resize the web view when the keyboard opens so focused inputs stay visible.
      resize: 'native',
      resizeOnFullScreen: true,
    },
    StatusBar: {
      // Dark style = light (white) text/icons, suited to our dark UI.
      style: 'DARK',
      backgroundColor: '#0f0f12',
    },
  },
};

export default config;
