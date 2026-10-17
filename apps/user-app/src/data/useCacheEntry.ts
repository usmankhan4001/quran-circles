import { useSyncExternalStore } from 'react';
import { useServices } from '../providers/services';

/**
 * What the shared cache holds for a key right now, re-read on every cache change. Screens use it
 * next to `useQuery` when a change made on this phone is written straight into the entry (a day
 * recorded, a surah marked), so it shows at once without asking the server again.
 */
export function useCacheEntry<T>(key: string | null): T | undefined {
  const { cache } = useServices();
  useSyncExternalStore(cache.subscribe, cache.getVersion, cache.getVersion);
  return key ? cache.get<T>(key)?.data : undefined;
}
