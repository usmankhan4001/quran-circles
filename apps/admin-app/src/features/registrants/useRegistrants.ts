import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ApiClient, RegistrationStatus, StaffRegistration } from '@qc/contracts';
import { useQuery, type QueryResult } from '../../api/query';
import { useApi } from '../../auth/AuthProvider';

export type RegistrantsPage = Awaited<ReturnType<ApiClient['registrations']['forSession']>>;

export interface RegistrantsView {
  query: QueryResult<RegistrantsPage>;
  items: StaffRegistration[];
  totals: { registrations: number; people: number; waitlisted: number } | null;
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => Promise<void>;
  /** Set when loading the next page failed; the first page stays on screen. */
  moreError: unknown;
}

export interface UseRegistrantsOptions {
  sessionId: string;
  occurrenceId?: string;
  status: Extract<RegistrationStatus, 'confirmed' | 'waitlisted'>;
  /** Poll interval for the live list. 0 turns polling off (tests). */
  pollMs: number;
  enabled?: boolean;
}

const PAGE = 50;

/**
 * The registrants of a session as a live list. The first page reloads on a timer; further pages
 * are fetched on request and appended. Names and numbers stay in memory and are never logged.
 */
export function useRegistrants(options: UseRegistrantsOptions): RegistrantsView {
  const api = useApi();
  const { sessionId, occurrenceId, status } = options;
  const [extra, setExtra] = useState<StaffRegistration[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<unknown>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const query = useQuery(
    async () => {
      const page = await api.registrations.forSession({
        params: { sessionId },
        query: { ...(occurrenceId ? { occurrenceId } : {}), status, limit: PAGE },
      });
      return page;
    },
    [sessionId, occurrenceId, status],
    { enabled: options.enabled ?? true, refetchIntervalMs: options.pollMs },
  );

  // A new filter starts the list again.
  useEffect(() => {
    setExtra([]);
    setCursor(null);
    setMoreError(null);
  }, [sessionId, occurrenceId, status]);

  const firstPageCursor = query.data?.nextCursor ?? null;
  const nextCursor = extra.length > 0 ? cursor : firstPageCursor;

  const loadMore = useCallback(async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const page = await api.registrations.forSession({
        params: { sessionId },
        query: {
          ...(occurrenceId ? { occurrenceId } : {}),
          status,
          limit: PAGE,
          cursor: nextCursor,
        },
      });
      if (!alive.current) return;
      setExtra((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    } catch (error) {
      if (alive.current) setMoreError(error);
    } finally {
      if (alive.current) setLoadingMore(false);
    }
  }, [api, nextCursor, occurrenceId, sessionId, status]);

  const items = useMemo(() => {
    const first = query.data?.items ?? [];
    const seen = new Set(first.map((r) => r.id));
    return [...first, ...extra.filter((r) => !seen.has(r.id))];
  }, [query.data, extra]);

  return {
    query,
    items,
    totals: query.data?.totals ?? null,
    hasMore: nextCursor !== null,
    loadingMore,
    loadMore,
    moreError,
  };
}
