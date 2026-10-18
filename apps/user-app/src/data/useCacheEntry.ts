import { useCallback, useSyncExternalStore } from 'react';
import { useServices } from '../providers/services';

/**
 * What the shared cache holds for a key right now. Screens use it next to `useQuery` when a
 * change made on this phone is written straight into the entry (a day recorded, a surah
 * marked), so it shows at once without asking the server again. It draws again only when this
 * key's data changes, not on every write to the cache (at start-up, each answer is a write).
 */
export function useCacheEntry<T>(key: string | null): T | undefined {
  const { cache } = useServices();
  const read = useCallback(() => (key ? cache.get<T>(key)?.data : undefined), [cache, key]);
  return useSyncExternalStore(cache.subscribe, read, read);
}
