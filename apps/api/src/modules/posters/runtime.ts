import type { Db } from '../../db';
import { unwiredPosterQueue, type PosterQueue } from './queue';
import { posterStorageFromEnv, type PosterStorage } from './storage';

/** What the poster endpoints need besides the database: the file store and the render queue. */
export interface PosterRuntime {
  storage: PosterStorage;
  queue: PosterQueue;
}

const provided = new WeakMap<object, PosterRuntime>();

/**
 * Sets the poster store and queue for the app built on this database handle. The server calls it
 * with the real ones (`localDiskPosterStorage(POSTER_STORAGE_DIR)` or the platform's store, and
 * `pgBossPosterQueue(boss)`); the test harness with a temp folder and an in-memory queue.
 * Keyed by the handle so two apps in one process (tests) never share a queue.
 */
export function providePosterRuntime(db: Db, runtime: PosterRuntime): void {
  provided.set(db, runtime);
}

/**
 * The runtime for an app: what was provided, else the store from `POSTER_STORAGE_DIR` and a queue
 * that refuses every job (so a server that was never wired marks new posters failed rather than
 * leaving them queued).
 */
export function posterRuntimeFor(db: Db): PosterRuntime {
  return provided.get(db) ?? { storage: posterStorageFromEnv(), queue: unwiredPosterQueue };
}
