import type { ApiClient, DevicePlatform } from '@qc/contracts';
import { AuthSession } from '../auth/session';
import { createAppApi, createPublicApi } from '../core/api';
import { Connectivity, type NetworkStatusSource } from '../core/connectivity';
import { defaultPreferences, PreferencesStore } from '../core/preferences';
import type { KeyValueStore } from '../core/storage';
import { QueryCache } from '../data/cache';
import type { ContentModules } from '../features/content/modules';
import type { MapViewComponent } from '../features/maps/types';
import { PushService, RemindersService } from '../features/reminders/service';
import type { PushRegistrar, ReminderScheduler } from '../features/reminders/types';
import type { AppServices } from './services';

export interface BootOptions {
  baseUrl: string;
  deviceStore: KeyValueStore;
  tokenStore: KeyValueStore;
  scheduler: ReminderScheduler;
  registrar: PushRegistrar;
  MapView: MapViewComponent;
  content: ContentModules;
  platform: DevicePlatform;
  deviceLanguages: readonly string[];
  fetch?: typeof fetch;
  openUrl: (url: string) => Promise<void>;
  appVersion?: string;
  now?: () => Date;
  /** The platform's connection state, for the offline banner. Null where there is none. */
  network?: NetworkStatusSource | null;
}

/**
 * Builds every service from its parts. The app calls it with the real device adapters; tests
 * call it with memory stores and the contract's mock handler as `fetch`.
 */
export function createServices(options: BootOptions): AppServices {
  const connectivity = new Connectivity();
  if (options.network) connectivity.watch(options.network);
  const preferences = new PreferencesStore(
    options.deviceStore,
    defaultPreferences(options.deviceLanguages),
  );
  const getLocale = () => preferences.get().locale;
  const apiConfig = {
    baseUrl: options.baseUrl,
    getLocale,
    ...(options.fetch ? { fetch: options.fetch } : {}),
  };
  const publicApi = createPublicApi(apiConfig);
  const auth = new AuthSession({
    storage: options.tokenStore,
    refreshTokens: (refreshToken) => publicApi.auth.refresh({ body: { refreshToken } }),
  });
  const api: ApiClient = createAppApi(apiConfig, auth, connectivity);
  return {
    api,
    auth,
    cache: new QueryCache({ storage: options.deviceStore }),
    connectivity,
    preferences,
    reminders: new RemindersService(options.deviceStore, options.scheduler),
    push: new PushService(options.deviceStore, options.registrar),
    content: options.content,
    MapView: options.MapView,
    openUrl: options.openUrl,
    platform: options.platform,
    appVersion: options.appVersion ?? '0.0.0',
    now: options.now ?? (() => new Date()),
  };
}

/** Reads what was saved on this device. The root layout waits for it before showing screens. */
export async function loadServices(services: AppServices): Promise<void> {
  await Promise.all([
    services.preferences.load(),
    services.cache.hydrate(),
    services.reminders.load(),
    services.auth.restore(),
  ]);
}
