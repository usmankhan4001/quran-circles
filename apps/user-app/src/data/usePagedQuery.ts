import { useCallback, useState } from 'react';
import { toAppError, type AppError } from '../core/errors';
import { useQuery, type QueryOptions, type QueryResult } from './useQuery';

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

/** `data` is the first page; `items` is every page loaded so far. */
export interface PagedResult<T> extends QueryResult<Page<T>> {
  items: T[];
  hasMore: boolean;
  loadingMore: boolean;
  loadMoreError: AppError | undefined;
  loadMore: () => Promise<void>;
}

interface Extra<T> {
  base: Page<T> | undefined;
  items: T[];
  nextCursor: string | null;
}

/** A list read page by page. The first page is cached; "load more" appends the next ones. */
export function usePagedQuery<T>(
  key: string | null,
  fetchPage: (cursor: string | undefined) => Promise<Page<T>>,
  options: QueryOptions = {},
): PagedResult<T> {
  const first = useQuery<Page<T>>(key, () => fetchPage(undefined), options);
  const [extra, setExtra] = useState<Extra<T> | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<AppError | undefined>();

  // Extra pages belong to one first page; a refresh of it starts over.
  const own = extra && extra.base === first.data ? extra : null;
  const items = [...(first.data?.items ?? []), ...(own?.items ?? [])];
  const nextCursor = own ? own.nextCursor : (first.data?.nextCursor ?? null);

  const loadMore = useCallback(async (): Promise<void> => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setLoadMoreError(undefined);
    try {
      const page = await fetchPage(nextCursor);
      setExtra((previous) => {
        const base = first.data;
        const kept = previous && previous.base === base ? previous.items : [];
        return { base, items: [...kept, ...page.items], nextCursor: page.nextCursor };
      });
    } catch (error) {
      setLoadMoreError(toAppError(error));
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore, fetchPage, first.data]);

  return { ...first, items, hasMore: nextCursor !== null, loadingMore, loadMoreError, loadMore };
}
