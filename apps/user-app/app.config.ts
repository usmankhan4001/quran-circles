import type { ExpoConfig } from 'expo/config';

/**
 * Public configuration only. Anything read from `EXPO_PUBLIC_*` ends up inside the app and the
 * web page, so it holds addresses and restricted keys, never secrets.
 *
 * Store builds run on EAS (`eas.json`); see `docs/release/go-live.md`. The app id
 * (`APP_ID`) is permanent once the first build is uploaded to Google Play, and the Maps key
 * restriction and the Firebase app are registered against it.
 *
 * The public variables the app reads (`src/platform/env.ts`):
 * - `EXPO_PUBLIC_API_URL`: the API's address.
 * - `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`: the Google Maps key, restricted to our web origins and app
 *   ids. Without it the map shows the list-only view.
 * - `EXPO_PUBLIC_VAPID_PUBLIC_KEY`: the public half of the web push key pair. Without it web
 *   push is off.
 *
 * Build-time only (EAS environment variables, not shipped as `EXPO_PUBLIC_*`):
 * - `GOOGLE_SERVICES_JSON`: path to Firebase's `google-services.json` for the Android app (an EAS
 *   file variable). Push needs it: the app registers its native FCM token. Without it the build
 *   still succeeds and push is off.
 * - `EAS_PROJECT_ID`: overrides the EAS project id set below (printed by `eas init`).
 */
const APP_ID = 'pk.doraquran.circles';

const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || undefined;
const googleServicesFile = process.env.GOOGLE_SERVICES_JSON || undefined;
// The EAS project @twoplustwoios-team/quran-circles; `EAS_PROJECT_ID` overrides it.
const easProjectId = process.env.EAS_PROJECT_ID || 'b4979929-6d56-42e0-aed0-6aa5e53d3069';

const config: ExpoConfig = {
  name: 'Quran Circles',
  slug: 'quran-circles',
  owner: 'twoplustwoios-team',
  scheme: 'quran-circles',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  icon: './public/icons/icon-1024.png',
  plugins: [
    'expo-router',
    'expo-localization',
    'expo-secure-store',
    ['expo-notifications', { color: '#0a6938', defaultChannel: 'reminders' }],
  ],
  experiments: { typedRoutes: false },
  web: {
    bundler: 'metro',
    output: 'single',
    name: 'Quran Circles',
    shortName: 'Quran Circles',
    backgroundColor: '#ffffff',
    themeColor: '#0a6938',
    favicon: './public/icons/icon-192.png',
  },
  ios: { bundleIdentifier: APP_ID, supportsTablet: true, config: { googleMapsApiKey } },
  android: {
    package: APP_ID,
    googleServicesFile,
    // The phone app never asks for location (platform/location.native.ts) or reads shared
    // storage; keep libraries and Expo's defaults from adding those permissions, so the Play
    // data-safety answers stay "no location" and no storage access is declared.
    blockedPermissions: [
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.ACCESS_BACKGROUND_LOCATION',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
    ],
    // react-native-maps on Android needs the key in the native manifest, not only at run time.
    config: { googleMaps: { apiKey: googleMapsApiKey } },
    adaptiveIcon: {
      foregroundImage: './public/icons/adaptive-foreground.png',
      backgroundColor: '#ffffff',
    },
  },
  extra: { eas: { projectId: easProjectId } },
};

export default config;
