import type { Session, Venue } from '@qc/contracts';
import { usePagedQuery } from '../../data/usePagedQuery';
import { useQuery } from '../../data/useQuery';
import { useServices } from '../../providers/services';
import { filtersToQuery, queryKey, type NearbyFilters, type QueryExtras } from './filters';

/** Published sessions that match the filters, page by page. Public data, cached for offline. */
export function useSessionList(filters: NearbyFilters, extras: QueryExtras = {}) {
  const { api } = useServices();
  const query = filtersToQuery(filters, extras);
  return usePagedQuery<Session>(
    queryKey('sessions:list', query),
    (cursor) => api.sessions.list({ query: cursor ? { ...query, cursor } : query }),
    { persist: true, staleMs: 30_000 },
  );
}

export function useSession(sessionId: string) {
  const { api } = useServices();
  return useQuery(`sessions:get:${sessionId}`, () => api.sessions.get({ params: { sessionId } }), {
    persist: true,
    staleMs: 30_000,
  });
}

export function useVenue(venueId: string | null) {
  const { api } = useServices();
  return useQuery(
    venueId ? `venues:get:${venueId}` : null,
    () => api.venues.get({ params: { venueId: venueId! } }),
    { persist: true, staleMs: 60_000 },
  );
}

export function useVenueSessions(venueId: string) {
  const { api } = useServices();
  return useQuery(
    `sessions:venue:${venueId}`,
    async () => (await api.sessions.list({ query: { venueId, limit: 50 } })).items,
    { persist: true, staleMs: 30_000 },
  );
}

/** Dated occurrences of one session from now on, with the portion and any recap. */
export function useSessionOccurrences(sessionId: string, from: string) {
  const { api } = useServices();
  return useQuery(
    `sessions:occurrences:${sessionId}`,
    async () =>
      (await api.sessions.occurrences({ params: { sessionId }, query: { from, limit: 8 } })).items,
    { persist: true, staleMs: 60_000 },
  );
}

export type { Venue };
