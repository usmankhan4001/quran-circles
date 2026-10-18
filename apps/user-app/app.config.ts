import type { ExpoConfig } from 'expo/config';

/**
 * Public configuration only. Anything read from `EXPO_PUBLIC_*` ends up inside the app and the
 * web page, so it holds addresses and restricted keys, never secrets. The native app id is left
 * unset on purpose: it is chosen when the store accounts exist (see the status file).
 *
 * The public variables the app reads (`src/platform/env.ts`):
 * - `EXPO_PUBLIC_API_URL`: the API's address.
 * - `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`: the Google Maps key, restricted to our web origins and app
 *   ids. Without it the map shows the list-only view.
 * - `EXPO_PUBLIC_VAPID_PUBLIC_KEY`: the public half of the web push key pair. Without it web
 *   push is off.
 */
const config: ExpoConfig = {
  name: 'Quran Circles',
  slug: 'quran-circles',
  scheme: 'quran-circles',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  icon: './public/icons/icon-1024.png',
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
  android: {
    adaptiveIcon: {
      foregroundImage: './public/icons/adaptive-foreground.png',
      backgroundColor: '#ffffff',
    },
  },
};

export default config;
