import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { featureOn, type FeatureFlagKey, type Principal } from '@qc/contracts';
import { useAuth } from './auth';
import { useAsync } from './hooks';

/**
 * The feature flags from `GET /v1/config`, loaded once after sign-in. Pages behind a flag (such as
 * the ayah of the day list) are hidden while it is off. A flag that is missing, still loading or
 * could not be loaded counts as off, the same rule as `featureOn`.
 */
export type FeatureFlags = Partial<Record<FeatureFlagKey, boolean>>;

export interface Features {
  status: 'loading' | 'ready' | 'error';
  flags: FeatureFlags;
  on(key: FeatureFlagKey): boolean;
}

/**
 * The city to resolve flags for. Flags can be switched on city by city, so a coordinator whose
 * roles all sit in one city gets that city's flags. A national admin, or someone with roles in
 * several cities, gets the platform default.
 */
export function configCityFor(principal: Principal | null): string | undefined {
  if (!principal || principal.assignments.length === 0) return undefined;
  if (principal.assignments.some((a) => a.role === 'national_admin')) return undefined;
  const cities = new Set(principal.assignments.map((a) => a.cityId));
  if (cities.size !== 1) return undefined;
  const [only] = cities;
  return only ?? undefined;
}

const FeaturesContext = createContext<Features | null>(null);

export function FeaturesProvider({ children }: { children: ReactNode }) {
  const { api, status, principal } = useAuth();
  const cityId = configCityFor(principal);
  const loaded = useAsync(async () => {
    if (status !== 'signedIn') return {} as FeatureFlags;
    const config = await api.config.get({ query: cityId ? { cityId } : {} });
    return config.featureFlags as FeatureFlags;
  }, [api, status, cityId]);

  const data = loaded.status === 'ready' ? loaded.data : undefined;
  const value = useMemo<Features>(() => {
    const flags = data ?? {};
    return { status: loaded.status, flags, on: (key) => featureOn(flags, key) };
  }, [loaded.status, data]);

  return <FeaturesContext.Provider value={value}>{children}</FeaturesContext.Provider>;
}

export function useFeatures(): Features {
  const ctx = useContext(FeaturesContext);
  if (!ctx) throw new Error('useFeatures must be used inside <FeaturesProvider>');
  return ctx;
}
