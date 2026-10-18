import type { TabRoute } from '../nav/routes';
import { toInstant } from '../features/home/useHome';
import type { AppServices } from '../providers/services';

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
    warm(app, `config:${cityId ?? 'default'}`, true, () =>
      api.config.get({ query: cityId ? { cityId } : {} }),
    ),
  ];
  if (tab === 'home') {
    runs.push(
      warm(
        app,
        `occurrences:next:${cityId ?? 'any'}`,
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
