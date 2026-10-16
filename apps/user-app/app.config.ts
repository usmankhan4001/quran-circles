import type { ExpoConfig } from 'expo/config';

/**
 * Public configuration only. Anything read from `EXPO_PUBLIC_*` ends up inside the app and the
 * web page, so it holds addresses and restricted keys, never secrets. The native app id is left
 * unset on purpose: it is chosen when the store accounts exist (see the status file).
 */
const config: ExpoConfig = {
  name: 'Quran Circles',
  slug: 'quran-circles',
  scheme: 'quran-circles',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  icon: './public/icons/icon-512.png',
  plugins: [
    'expo-router',
    'expo-localization',
    'expo-secure-store',
    ['expo-notifications', { color: '#064e3b', defaultChannel: 'reminders' }],
  ],
  experiments: { typedRoutes: false },
  web: {
    bundler: 'metro',
    output: 'single',
    name: 'Quran Circles',
    shortName: 'Quran Circles',
    backgroundColor: '#fdfcf6',
    themeColor: '#064e3b',
    favicon: './public/icons/icon-192.png',
  },
  ios: { supportsTablet: true },
  android: { adaptiveIcon: { backgroundColor: '#064e3b' } },
};

export default config;
