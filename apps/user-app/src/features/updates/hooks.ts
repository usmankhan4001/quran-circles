import { useCallback } from 'react';
import { useQuery } from '../../data/useQuery';
import { useAuthState, usePreferences } from '../../providers/hooks';
import { useServices } from '../../providers/services';
import { usePagedQuery } from '../../data/usePagedQuery';
import type { Update } from '@qc/contracts';

/** The unread count for the badge on the Home tab. Needs sign-in; zero otherwise. */
export function useUnreadCount(): number {
  const { api } = useServices();
  const { status } = useAuthState();
  const query = useQuery(
    status === 'signedIn' ? 'me:updates:unread' : null,
    () => api.updates.unreadCount(),
    { staleMs: 30_000 },
  );
  return query.data?.unreadCount ?? 0;
}

/** The Updates feed, newest first. National updates reach everyone; the rest follow the person. */
export function useUpdatesFeed(limit = 20) {
  const { api } = useServices();
  const { status } = useAuthState();
  const { cityId } = usePreferences();
  const feed = usePagedQuery<Update>(
    status === 'signedIn' ? `me:updates:feed:${cityId ?? 'any'}:${limit}` : null,
    (cursor) =>
      api.updates.feed({
        query: { limit, ...(cityId ? { cityId } : {}), ...(cursor ? { cursor } : {}) },
      }),
    { staleMs: 15_000 },
  );
  return feed;
}

export function useMarkRead() {
  const { api, cache } = useServices();
  return useCallback(
    async (input: { updateIds: string[] } | { all: true }) => {
      await api.updates.markRead({ body: input });
      cache.invalidate('me:updates');
    },
    [api, cache],
  );
}
