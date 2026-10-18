import type { Area } from '@qc/contracts';
import type { TabRoute } from '../nav/routes';
import { emptyFilters, filtersToQuery, queryKey } from '../features/nearby/filters';
import { toInstant } from '../features/home/useHome';
import type { AppServices } from '../providers/services';

const configKey = (cityId: string | null | undefined) => `config:${cityId ?? 'default'}`;
const nextKey = (cityId: string | null | undefined) => `occurrences:next:${cityId ?? 'any'}`;

/**
 * True when the first screen has nothing saved to draw its content from, so it would open on
 * its skeleton: a start on Home with no config or next sessions in the cache (a first visit, or
 * a change of city). An installed app that saved them draws them at once and need not wait.
 */
export function needsStartData(app: AppServices, tab: TabRoute | null): boolean {
  if (tab !== 'home') return false;
  const { cityId } = app.preferences.get();
  return (
    app.cache.get(configKey(cityId)) === undefined || app.cache.get(nextKey(cityId)) === undefined
  );
}

/** Runs one request into the cache, the way `useQuery` would; failures are left to the screen. */
function warm<T>(app: AppServices, key: string, persist: boolean, fetcher: () => Promise<T>) {
  return app.cache
    .share(key, fetcher)
    .then((data) => app.cache.set(key, data, persist))
    .catch(() => undefined);
}

/**
 * Starts the first screen's first requests as soon as the saved choices and sign-in are read,
 * while the page is still drawing, instead of after the screen has mounted. The screens' own
 * queries then join the request under way, or find its result in the cache, through
 * `QueryCache.share`. The keys and requests here are the same as theirs:
 *
 * - every start: the config (`useAppConfig`), which season leads and which features are on;
 *   several of Home's requests wait for it.
 * - a start on Home: the next sessions near the person (`useNextNearYou`) and, when signed
 *   in, their registrations (`useMyRegistrations`) and follows (`useMyFollows`; the ayah of
 *   the day waits for them).
 *
 * `startQueries.test.ts` renders Home after this and checks that each request is made once.
 * Resolves when the requests have settled; it never rejects.
 */
export function prefetchStartQueries(app: AppServices, tab: TabRoute | null): Promise<void> {
  const { api, now } = app;
  const { cityId } = app.preferences.get();
  const runs: Promise<void>[] = [
    warm(app, configKey(cityId), true, () => api.config.get({ query: cityId ? { cityId } : {} })),
  ];
  if (tab === 'home') {
    runs.push(
      warm(
        app,
        nextKey(cityId),
        true,
        async () =>
          (
            await api.occurrences.list({
              query: { from: toInstant(now()), limit: 10, ...(cityId ? { cityId } : {}) },
            })
          ).items,
      ),
    );
    if (app.auth.getState().status === 'signedIn') {
      // Personal: kept in memory only, like `useMyRegistrations` and `useMyFollows`.
      runs.push(
        warm(
          app,
          'me:registrations',
          false,
          async () =>
            (await api.registrations.listMine({ query: { upcomingOnly: 'true', limit: 50 } }))
              .items,
        ),
        warm(app, 'me:follows', false, async () => (await api.follows.list()).items),
      );
    }
  }
  return Promise.all(runs).then(() => undefined);
}

/** How long Nearby treats its list as fresh (`useSessionList`). */
const NEARBY_STALE_MS = 30_000;

/**
 * Asks for the list Nearby opens on (no filters, the chosen city, measured from the chosen
 * area's centre), under the key `useSessionList` uses, so the first tap on Nearby draws the
 * list from the cache instead of waiting for a round trip. Run once Home has settled, next to
 * the download of Nearby's code. When an area is chosen but the area list is not in the cache
 * yet, it asks nothing: Nearby works out its starting point from that list, and a guess could
 * land under another key. Resolves when done; it never rejects.
 */
export function prefetchNearbyList(app: AppServices): Promise<void> {
  const { cityId, areaId } = app.preferences.get();
  let origin: { lat: number; lng: number } | null = null;
  if (cityId && areaId) {
    const areas = app.cache.get<Area[]>(`places:areas:${cityId}`)?.data;
    if (!areas) return Promise.resolve();
    const area = areas.find((a) => a.id === areaId);
    if (area && area.lat !== null && area.lng !== null) origin = { lat: area.lat, lng: area.lng };
  }
  const query = filtersToQuery({ ...emptyFilters, cityId }, { origin });
  const key = queryKey('sessions:list', query);
  if (app.cache.isFresh(key, NEARBY_STALE_MS)) return Promise.resolve();
  return warm(app, key, true, () => app.api.sessions.list({ query }));
}
