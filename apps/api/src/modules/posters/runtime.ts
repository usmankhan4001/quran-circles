import type { AppDeps } from '../shared/context';
import { unwiredPosterQueue, type PosterQueue } from './queue';
import { posterStorageFromEnv, type PosterStorage } from './storage';

/** What the poster endpoints need besides the database: the file store and the render queue. */
export interface PosterRuntime {
  storage: PosterStorage;
  queue: PosterQueue;
}

/**
 * The runtime for an app: `AppDeps.posters` (the server passes `localDiskPosterStorage(...)` and
 * `pgBossPosterQueue(boss)` to `createApp`; the test harness a temp folder and an in-memory queue),
 * else the store from `POSTER_STORAGE_DIR` and a queue that refuses every job, so a server that was
 * never wired marks new posters failed rather than leaving them queued.
 */
export function posterRuntimeFor(deps: Pick<AppDeps, 'posters'>): PosterRuntime {
  return deps.posters ?? { storage: posterStorageFromEnv(), queue: unwiredPosterQueue };
}
