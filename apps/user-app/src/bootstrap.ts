import { getLocales } from 'expo-localization';
import { Platform } from 'react-native';
import type { DevicePlatform } from '@qc/contracts';
import { createContentModules } from './features/content/contentPackage';
import { GoogleMapView } from './features/maps/GoogleMapView';
import { createTranslator } from './i18n/translate';
import { readEnv } from './platform/env';
import { createContentStorage } from './platform/contentStorage';
import { openExternalUrl } from './platform/linking';
import { createPushRegistrar } from './platform/push';
import { ExpoReminderScheduler, UnsupportedReminderScheduler } from './platform/scheduler';
import { createDeviceStore, createTokenStore } from './platform/stores';
import { createServices } from './providers/createServices';
import type { AppServices } from './providers/services';

/** The real app: device storage, device notifications, Google Maps, the Quran & Prayer package. */
export function createDeviceServices(appVersion: string): AppServices {
  const env = readEnv();
  const web = Platform.OS === 'web';
  const t = createTranslator('en');
  const platform: DevicePlatform = web ? 'web' : Platform.OS === 'ios' ? 'ios' : 'android';
  const deviceLanguages = getLocales().map((l) => l.languageTag);
  // The Quran package asks for the API client while someone is signed in, and none otherwise.
  // It is built before the services, so it reaches them through this late reference.
  const late: { services?: AppServices } = {};
  const content = createContentModules({
    fetch: (input, init) => fetch(input, init),
    ...createContentStorage(),
    getApi: () => (late.services?.auth.getState().status === 'signedIn' ? late.services.api : null),
  });
  const services = createServices({
    baseUrl: env.apiUrl,
    deviceStore: createDeviceStore(),
    tokenStore: createTokenStore(),
    scheduler: web
      ? new UnsupportedReminderScheduler()
      : new ExpoReminderScheduler(t('notifications.channel')),
    registrar: createPushRegistrar(env.vapidPublicKey),
    MapView: GoogleMapView,
    content,
    platform,
    deviceLanguages,
    openUrl: openExternalUrl,
    appVersion,
  });
  late.services = services;
  return services;
}
