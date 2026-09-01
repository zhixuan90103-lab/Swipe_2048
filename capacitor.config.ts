import type { CapacitorConfig } from '@capacitor/cli';

/**
 * iOS portrait game shell:
 * - contentInset never → Safe Area only via CSS env() / --safe-*
 * - base './' on Vite → relative assets for offline WebView
 */
const config: CapacitorConfig = {
  appId: 'com.wangzhixuan.swipe2048',
  appName: 'Swipe 2048',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  ios: {
    contentInset: 'never',
    preferredContentMode: 'mobile',
    backgroundColor: '#faf8ef',
    scrollEnabled: false,
  },
};

export default config;
