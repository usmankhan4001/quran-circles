import type { AppConfig } from '@qc/contracts';
import { useQuery } from '../../data/useQuery';
import { usePreferences } from '../../providers/hooks';
import { useServices } from '../../providers/services';

/** What to assume until the server answers (or when it cannot be reached): Circles lead, no flags. */
export const FALLBACK_CONFIG: Pick<AppConfig, 'seasonMode' | 'hijriOffsetDays' | 'featureFlags'> = {
  seasonMode: 'circles',
  hijriOffsetDays: 0,
  featureFlags: {
    circle_requests: false,
    session_companion: false,
    invite_friends: false,
    poster_sharing: false,
    quran_offline_copy: false,
    whatsapp_fallback_reminders: false,
  },
};

/** Season mode and feature flags from `config.get`, resolved for the person's city. */
export function useAppConfig() {
  const { api } = useServices();
  const { cityId } = usePreferences();
  const query = useQuery(
    `config:${cityId ?? 'default'}`,
    () => api.config.get({ query: cityId ? { cityId } : {} }),
    { persist: true, staleMs: 5 * 60_000 },
  );
  return {
    ...query,
    seasonMode: query.data?.seasonMode ?? FALLBACK_CONFIG.seasonMode,
    featureFlags: query.data?.featureFlags ?? FALLBACK_CONFIG.featureFlags,
  };
}
