import { useCallback, useEffect, useRef, useState } from 'react';

export type QueryStatus = 'loading' | 'success' | 'error';

export interface QueryResult<T> {
  status: QueryStatus;
  data: T | undefined;
  error: unknown;
  /** Loads again without clearing what is on screen. */
  refetch: () => Promise<void>;
  isRefetching: boolean;
}

export interface QueryOptions {
  /** Set false to wait, for example until an id is known. */
  enabled?: boolean;
  /** Load again every so many milliseconds while the screen is open. 0 or undefined: never. */
  refetchIntervalMs?: number;
}

/**
 * A small data loader for screens: runs `fetcher` when `deps` change, keeps the last good data
 * while it reloads, and ignores answers that arrive after the screen has gone or the inputs
 * have changed. It never logs what it loads.
 */
export function useQuery<T>(
  fetcher: () => Promise<T>,
  deps: readonly unknown[],
  options: QueryOptions = {},
): QueryResult<T> {
  const enabled = options.enabled ?? true;
  const [state, setState] = useState<{ status: QueryStatus; data: T | undefined; error: unknown }>({
    status: 'loading',
    data: undefined,
    error: null,
  });
  const [isRefetching, setRefetching] = useState(false);
  const run = useRef(0);
  const mounted = useRef(true);
  const latest = useRef(fetcher);
  latest.current = fetcher;

  const load = useCallback(async (background: boolean) => {
    const id = ++run.current;
    if (background) setRefetching(true);
    try {
      const data = await latest.current();
      if (mounted.current && id === run.current) setState({ status: 'success', data, error: null });
    } catch (error) {
      if (mounted.current && id === run.current) {
        setState((prev) => ({ status: 'error', data: background ? prev.data : undefined, error }));
      }
    } finally {
      if (mounted.current && id === run.current) setRefetching(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    setState({ status: 'loading', data: undefined, error: null });
    void load(false);
  }, [enabled, ...deps]);

  const interval = options.refetchIntervalMs;
  useEffect(() => {
    if (!enabled || !interval) return;
    const timer = setInterval(() => void load(true), interval);
    return () => clearInterval(timer);
  }, [enabled, interval, load]);

  const refetch = useCallback(() => load(true), [load]);
  return { ...state, refetch, isRefetching };
}

export interface MutationResult<A extends unknown[], R> {
  run: (...args: A) => Promise<R | undefined>;
  status: 'idle' | 'running' | 'success' | 'error';
  error: unknown;
  data: R | undefined;
  reset: () => void;
}

/**
 * Runs a write. `run` resolves with the result, or with undefined after storing the error, so a
 * handler can say `const saved = await save.run(body); if (saved) ...` without a try block.
 */
export function useMutation<A extends unknown[], R>(
  action: (...args: A) => Promise<R>,
): MutationResult<A, R> {
  const [state, setState] = useState<{
    status: 'idle' | 'running' | 'success' | 'error';
    error: unknown;
    data: R | undefined;
  }>({ status: 'idle', error: null, data: undefined });
  const mounted = useRef(true);
  const latest = useRef(action);
  latest.current = action;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async (...args: A): Promise<R | undefined> => {
    setState({ status: 'running', error: null, data: undefined });
    try {
      const data = await latest.current(...args);
      if (mounted.current) setState({ status: 'success', error: null, data });
      return data;
    } catch (error) {
      if (mounted.current) setState({ status: 'error', error, data: undefined });
      return undefined;
    }
  }, []);

  const reset = useCallback(() => setState({ status: 'idle', error: null, data: undefined }), []);
  return { run, ...state, reset };
}
