import { createContext, useContext, type ReactNode } from 'react';
import type { ApiClient, DevicePlatform } from '@qc/contracts';
import type { AuthSession } from '../auth/session';
import type { Connectivity } from '../core/connectivity';
import type { PreferencesStore } from '../core/preferences';
import type { QueryCache } from '../data/cache';
import type { ContentModules } from '../features/content/modules';
import type { MapViewComponent } from '../features/maps/types';
import type { PushService, RemindersService } from '../features/reminders/service';

/** What the app needs from outside React: injected at the root, replaced by fakes in tests. */
export interface AppServices {
  api: ApiClient;
  auth: AuthSession;
  cache: QueryCache;
  connectivity: Connectivity;
  preferences: PreferencesStore;
  reminders: RemindersService;
  push: PushService;
  content: ContentModules;
  MapView: MapViewComponent;
  /** Opens a link outside the app: `tel:`, a map address or a web page. */
  openUrl: (url: string) => Promise<void>;
  platform: DevicePlatform;
  /** Shown in About. */
  appVersion: string;
  /** The current time. Tests pass a fixed one. */
  now: () => Date;
}

const ServicesContext = createContext<AppServices | null>(null);

export function ServicesProvider({
  services,
  children,
}: {
  services: AppServices;
  children: ReactNode;
}) {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

export function useServices(): AppServices {
  const services = useContext(ServicesContext);
  if (!services) throw new Error('useServices needs a ServicesProvider');
  return services;
}
