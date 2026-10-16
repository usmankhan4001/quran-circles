import { useCallback, useEffect, useRef, useState } from 'react';

export type AsyncState<T> =
  { status: 'loading' } | { status: 'error'; error: unknown } | { status: 'ready'; data: T };

/**
 * Runs an async loader when its inputs change and ignores results that arrive late.
 * `reload` runs it again, keeping the current data on screen until the new data arrives.
 */
export function useAsync<T>(
  loader: () => Promise<T>,
  deps: readonly unknown[],
): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' });
  const [tick, setTick] = useState(0);
  const latest = useRef(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    const run = ++latest.current;
    setState((prev) => (prev.status === 'ready' && tick > 0 ? prev : { status: 'loading' }));
    loaderRef
      .current()
      .then((data) => {
        if (run === latest.current) setState({ status: 'ready', data });
      })
      .catch((error: unknown) => {
        if (run === latest.current) setState({ status: 'error', error });
      });
  }, [tick, ...deps]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { ...state, reload };
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export type PagedState<T> =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'ready'; items: T[]; hasMore: boolean; loadingMore: boolean };

/** A cursor-paged list. `loadMore` appends the next page; changing `deps` starts over. */
export function usePaged<T>(
  fetchPage: (cursor: string | undefined) => Promise<Page<T>>,
  deps: readonly unknown[],
): PagedState<T> & { loadMore: () => void; reload: () => void; moreError: unknown } {
  const [state, setState] = useState<PagedState<T>>({ status: 'loading' });
  const [moreError, setMoreError] = useState<unknown>(null);
  const [tick, setTick] = useState(0);
  const cursor = useRef<string | null>(null);
  const latest = useRef(0);
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;

  useEffect(() => {
    const run = ++latest.current;
    cursor.current = null;
    setMoreError(null);
    setState({ status: 'loading' });
    fetchRef
      .current(undefined)
      .then((page) => {
        if (run !== latest.current) return;
        cursor.current = page.nextCursor;
        setState({
          status: 'ready',
          items: page.items,
          hasMore: page.nextCursor !== null,
          loadingMore: false,
        });
      })
      .catch((error: unknown) => {
        if (run === latest.current) setState({ status: 'error', error });
      });
  }, [tick, ...deps]);

  const loadMore = useCallback(() => {
    const next = cursor.current;
    if (next === null) return;
    const run = latest.current;
    setMoreError(null);
    setState((prev) => (prev.status === 'ready' ? { ...prev, loadingMore: true } : prev));
    fetchRef
      .current(next)
      .then((page) => {
        if (run !== latest.current) return;
        cursor.current = page.nextCursor;
        setState((prev) =>
          prev.status === 'ready'
            ? {
                status: 'ready',
                items: [...prev.items, ...page.items],
                hasMore: page.nextCursor !== null,
                loadingMore: false,
              }
            : prev,
        );
      })
      .catch((error: unknown) => {
        if (run !== latest.current) return;
        setMoreError(error);
        setState((prev) => (prev.status === 'ready' ? { ...prev, loadingMore: false } : prev));
      });
  }, []);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { ...state, loadMore, reload, moreError };
}

/** Reads every page of a cursor-paged endpoint, up to a safety limit. */
export async function fetchAllPages<T>(
  fetchPage: (cursor: string | undefined) => Promise<Page<T>>,
  maxPages = 20,
): Promise<T[]> {
  const out: T[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < maxPages; i++) {
    const page = await fetchPage(cursor);
    out.push(...page.items);
    if (page.nextCursor === null) break;
    cursor = page.nextCursor;
  }
  return out;
}
