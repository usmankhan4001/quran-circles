import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { isNetworkError, toAppError, type AppError } from '../core/errors';
import { useServices } from '../providers/services';

export type QueryStatus = 'idle' | 'loading' | 'success' | 'error';

export interface QueryResult<T> {
  status: QueryStatus;
  data: T | undefined;
  error: AppError | undefined;
  /** A request is running, including a refresh behind data that is already showing. */
  fetching: boolean;
  /** The data on screen is a saved copy because the server could not be reached. */
  offline: boolean;
  refetch: () => Promise<void>;
}

export interface QueryOptions {
  /**
   * Public data only (venues, sessions, places): kept on the device so it shows offline.
   * Personal data stays in memory.
   */
  persist?: boolean;
  /** How long a result is used without asking again. Default one minute. */
  staleMs?: number;
}

interface State<T> {
  key: string | null;
  data: T | undefined;
  error: AppError | undefined;
  fetching: boolean;
  offline: boolean;
  loaded: boolean;
}

/**
 * Runs `fetcher` for `key` and keeps the result in the shared cache. Pass a null key to wait
 * (for example until sign-in). When the call fails and a saved copy exists, the copy stays on
 * screen and `offline` says so.
 */
export function useQuery<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  options: QueryOptions = {},
): QueryResult<T> {
  const { cache } = useServices();
  const persist = options.persist ?? false;
  const staleMs = options.staleMs ?? 60_000;
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const runId = useRef(0);
  const invalidations = useSyncExternalStore(
    cache.subscribeInvalidations,
    cache.getInvalidations,
    cache.getInvalidations,
  );

  const initial = useCallback(
    (k: string | null): State<T> => {
      const cached = k ? cache.get<T>(k) : undefined;
      return {
        key: k,
        data: cached?.data,
        error: undefined,
        fetching: k !== null,
        offline: false,
        loaded: cached !== undefined,
      };
    },
    [cache],
  );
  const [stored, setStored] = useState<State<T>>(() => initial(key));
  // A new key starts from whatever the cache already holds for it, in the same render.
  const state = stored.key === key ? stored : initial(key);

  const run = useCallback(async (): Promise<void> => {
    if (key === null) return;
    const id = ++runId.current;
    setStored((s) => ({ ...(s.key === key ? s : initial(key)), fetching: true }));
    try {
      const data = await cache.share(key, () => fetcherRef.current());
      if (id !== runId.current) return;
      cache.set(key, data, persist);
      setStored({ key, data, error: undefined, fetching: false, offline: false, loaded: true });
    } catch (error) {
      if (id !== runId.current) return;
      const saved = cache.get<T>(key);
      setStored({
        key,
        data: saved?.data,
        error: toAppError(error),
        fetching: false,
        offline: saved !== undefined && isNetworkError(error),
        loaded: saved !== undefined,
      });
    }
  }, [cache, key, persist, initial]);

  useEffect(() => {
    if (key === null) return;
    if (cache.isFresh(key, staleMs)) {
      const cached = cache.get<T>(key);
      setStored({
        key,
        data: cached?.data,
        error: undefined,
        fetching: false,
        offline: false,
        loaded: true,
      });
      return;
    }
    void run();
    return () => {
      runId.current++;
    };
  }, [cache, key, staleMs, run, invalidations]);

  let status: QueryStatus;
  if (key === null) status = 'idle';
  else if (state.loaded) status = 'success';
  else if (state.error) status = 'error';
  else status = 'loading';

  return {
    status,
    data: state.data,
    error: state.error,
    fetching: state.fetching,
    offline: state.offline,
    refetch: run,
  };
}
