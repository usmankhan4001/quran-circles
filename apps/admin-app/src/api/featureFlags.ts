import { featureOn, type ApiClient, type FeatureFlagKey } from '@qc/contracts';
import { useApi } from '../auth/AuthProvider';
import { useQuery, type QueryResult } from './query';

/**
 * Whether a feature flag is on, as the server resolves it for a city (or the platform default
 * without one). A flag the server does not send is off (`featureOn`).
 */
export async function loadFeatureFlag(
  api: ApiClient,
  key: FeatureFlagKey,
  cityId?: string | null,
): Promise<boolean> {
  const config = await api.config.get(cityId ? { query: { cityId } } : undefined);
  return featureOn(config.featureFlags, key);
}

/**
 * The flag as a query. Screens that only offer a way in treat anything but a loaded `true` as
 * off, so a failed config read hides the feature rather than showing it.
 */
export function useFeatureFlag(
  key: FeatureFlagKey,
  cityId?: string | null,
  options: { enabled?: boolean } = {},
): QueryResult<boolean> {
  const api = useApi();
  return useQuery(() => loadFeatureFlag(api, key, cityId), [key, cityId ?? null], options);
}
