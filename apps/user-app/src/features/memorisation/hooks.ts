import {
  MEMORISATION_REVISE_AFTER_DAYS_DEFAULT,
  type MemorisationEntry,
  type MemorisationPut,
} from '@qc/contracts';
import { useAction } from '../../data/useAction';
import { useCacheEntry } from '../../data/useCacheEntry';
import { useQuery } from '../../data/useQuery';
import { useAuthState } from '../../providers/hooks';
import { useServices } from '../../providers/services';
import { useFeature } from '../reading/hooks';
import { removeEntry, upsertEntry } from './logic';

export const MEMORISATION_KEY = 'me:memorisation';

interface MemorisationData {
  items: MemorisationEntry[];
  reviseAfterDays: number;
}

/**
 * The person's tracker. Private (own data only, for every role), so kept in memory only, and only
 * while signed in with `memorisation` on. Marks made on this phone show at once.
 */
export function useMemorisation() {
  const { api } = useServices();
  const { status, me } = useAuthState();
  const feature = useFeature('memorisation');
  const key = status === 'signedIn' && feature.on ? MEMORISATION_KEY : null;
  const query = useQuery<MemorisationData>(key, () => api.memorisation.list(), { staleMs: 30_000 });
  const live = useCacheEntry<MemorisationData>(key) ?? query.data;
  // The profile is the setting's home; it may have changed on this phone since the list came.
  const profileDays = me?.profile.memorisationReviseAfterDays;
  const reviseAfterDays =
    profileDays !== undefined
      ? (profileDays ?? MEMORISATION_REVISE_AFTER_DAYS_DEFAULT)
      : (live?.reviseAfterDays ?? MEMORISATION_REVISE_AFTER_DAYS_DEFAULT);
  return { query, enabled: feature.on, settled: feature.settled, data: live, reviseAfterDays };
}

/** Marks a surah, or marks it revised, and writes the answer into the list. */
export function useMarkSurah() {
  const { api, cache } = useServices();
  return useAction(async (surah: number, body: MemorisationPut) => {
    const entry = await api.memorisation.put({ params: { surah }, body });
    const known = cache.get<MemorisationData>(MEMORISATION_KEY)?.data;
    if (known)
      cache.set(MEMORISATION_KEY, { ...known, items: upsertEntry(known.items, entry) }, false);
    return entry;
  });
}

/** Clears the mark on a surah. Safe to repeat: the server answers 204 either way. */
export function useClearSurah() {
  const { api, cache } = useServices();
  return useAction(async (surah: number) => {
    await api.memorisation.delete({ params: { surah } });
    const known = cache.get<MemorisationData>(MEMORISATION_KEY)?.data;
    if (known)
      cache.set(MEMORISATION_KEY, { ...known, items: removeEntry(known.items, surah) }, false);
    return true;
  });
}
