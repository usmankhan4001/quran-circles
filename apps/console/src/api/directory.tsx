import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { City, Venue } from '@qc/contracts';
import { useAuth } from './auth';
import { fetchAllPages, useAsync } from './hooks';
import { useI18n } from '../i18n';

/**
 * Cities and the venues in the person's scope, loaded once after sign-in. Pages use them for
 * filters and for names ("City: Karachi"), so a row never shows a bare id. Venues come from the
 * admin list, which the API already limits to the person's scope.
 */
export interface Directory {
  status: 'loading' | 'ready' | 'error';
  cities: City[];
  venues: Venue[];
  cityName(id: string | null | undefined): string;
  venueName(id: string | null | undefined): string;
  venueById(id: string | null | undefined): Venue | undefined;
  reload(): void;
}

const DirectoryContext = createContext<Directory | null>(null);

export function DirectoryProvider({ children }: { children: ReactNode }) {
  const { api, status } = useAuth();
  const { localized } = useI18n();
  const loaded = useAsync(async () => {
    if (status !== 'signedIn') return { cities: [] as City[], venues: [] as Venue[] };
    const [cities, venues] = await Promise.all([
      api.places.cities().then((r) => r.items),
      fetchAllPages((cursor) =>
        api.adminVenues.list({ query: { limit: 100, cursor, includeArchived: 'false' } }),
      ),
    ]);
    return { cities, venues };
  }, [api, status]);

  const { status: loadStatus, reload } = loaded;
  const data = loaded.status === 'ready' ? loaded.data : undefined;
  const value = useMemo<Directory>(() => {
    const cities = data?.cities ?? [];
    const venues = data?.venues ?? [];
    const cityMap = new Map(cities.map((c) => [c.id, c]));
    const venueMap = new Map(venues.map((v) => [v.id, v]));
    return {
      status: loadStatus,
      cities,
      venues,
      cityName: (id) => (id ? localized(cityMap.get(id)?.name) : ''),
      venueName: (id) => (id ? localized(venueMap.get(id)?.name) : ''),
      venueById: (id) => (id ? venueMap.get(id) : undefined),
      reload,
    };
  }, [loadStatus, data, reload, localized]);

  return <DirectoryContext.Provider value={value}>{children}</DirectoryContext.Provider>;
}

export function useDirectory(): Directory {
  const ctx = useContext(DirectoryContext);
  if (!ctx) throw new Error('useDirectory must be used inside <DirectoryProvider>');
  return ctx;
}
