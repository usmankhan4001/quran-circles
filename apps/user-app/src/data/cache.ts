import { Observable } from '../core/observable';
import { readJson, writeJson, type KeyValueStore } from '../core/storage';

export interface CacheEntry<T = unknown> {
  data: T;
  updatedAt: number;
}

interface PersistedBlob {
  v: 1;
  order: string[];
  entries: Record<string, CacheEntry>;
}

export const CACHE_KEY = 'qc.cache.v1';

function isBlob(value: unknown): value is PersistedBlob {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<PersistedBlob>;
  return v.v === 1 && Array.isArray(v.order) && typeof v.entries === 'object' && v.entries !== null;
}

export interface QueryCacheOptions {
  storage?: KeyValueStore;
  now?: () => number;
  /** Most entries kept on the device; the least recently used go first. */
  maxPersisted?: number;
  /** Wait before writing, so a burst of results is one write. 0 writes at once. */
  writeDelayMs?: number;
}

/**
 * The memory cache behind every query, with a small copy on the device for public data
 * (venues, sessions, places) so what you viewed still shows offline. Personal data (your
 * registrations, your updates) is never written to the device by this cache.
 */
export class QueryCache {
  private readonly memory = new Map<string, CacheEntry>();
  private readonly persistedKeys: string[] = [];
  private readonly version = new Observable(0);
  private readonly invalidations = new Observable(0);
  private readonly now: () => number;
  private readonly maxPersisted: number;
  private readonly writeDelayMs: number;
  private writeTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingWrite: Promise<void> = Promise.resolve();
  /** Requests under way, by key, so screens asking for the same thing at once share one. */
  private readonly running = new Map<string, Promise<unknown>>();

  constructor(private readonly options: QueryCacheOptions = {}) {
    this.now = options.now ?? Date.now;
    this.maxPersisted = options.maxPersisted ?? 80;
    this.writeDelayMs = options.writeDelayMs ?? 300;
  }

  /** Loads the saved copy. Call once at start-up; it never overwrites newer memory entries. */
  async hydrate(): Promise<void> {
    if (!this.options.storage) return;
    const blob = await readJson(this.options.storage, CACHE_KEY, isBlob);
    if (!blob) return;
    for (const key of blob.order) {
      const entry = blob.entries[key];
      if (!entry || typeof entry.updatedAt !== 'number') continue;
      if (!this.memory.has(key)) this.memory.set(key, entry);
      this.touch(key);
    }
    this.version.update((n) => n + 1);
  }

  get<T>(key: string): CacheEntry<T> | undefined {
    return this.memory.get(key) as CacheEntry<T> | undefined;
  }

  set<T>(key: string, data: T, persist: boolean): void {
    this.memory.set(key, { data, updatedAt: this.now() });
    if (persist) {
      this.touch(key);
      this.scheduleWrite();
    }
    this.version.update((n) => n + 1);
  }

  /**
   * Runs `fetcher` for `key`, or joins the run already under way for the same key. At start-up
   * several parts of a screen ask for the same thing at once (the config, your registrations);
   * one request answers all of them instead of one each. A run that `invalidate` or `clear`
   * marked out of date is never joined: the next caller asks again.
   */
  share<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const running = this.running.get(key);
    if (running) return running as Promise<T>;
    const run: Promise<T> = Promise.resolve()
      .then(fetcher)
      .finally(() => {
        if (this.running.get(key) === run) this.running.delete(key);
      });
    this.running.set(key, run);
    return run;
  }

  /** Marks entries whose key starts with `prefix` as out of date, so mounted queries reload. */
  invalidate(prefix = ''): void {
    for (const [key, entry] of this.memory) {
      if (key.startsWith(prefix))
        this.memory.set(key, { ...entry, updatedAt: Number.MIN_SAFE_INTEGER });
    }
    for (const key of [...this.running.keys()]) {
      if (key.startsWith(prefix)) this.running.delete(key);
    }
    this.invalidations.update((n) => n + 1);
    this.version.update((n) => n + 1);
  }

  /** Drops everything, in memory and on the device: after sign-out or account deletion. */
  async clear(): Promise<void> {
    this.memory.clear();
    this.running.clear();
    this.persistedKeys.length = 0;
    if (this.writeTimer) clearTimeout(this.writeTimer);
    this.writeTimer = null;
    await this.options.storage?.remove(CACHE_KEY).catch(() => undefined);
    this.invalidations.update((n) => n + 1);
    this.version.update((n) => n + 1);
  }

  /** Changes whenever an entry is set, invalidated or cleared. */
  getVersion = (): number => this.version.get();
  subscribe = (listener: () => void): (() => void) => this.version.subscribe(listener);

  /** Changes only when entries are marked out of date, so mounted queries ask again. */
  getInvalidations = (): number => this.invalidations.get();
  subscribeInvalidations = (listener: () => void): (() => void) =>
    this.invalidations.subscribe(listener);

  /** Resolves when pending writes have reached the device. */
  async flush(): Promise<void> {
    if (this.writeTimer) {
      clearTimeout(this.writeTimer);
      this.writeTimer = null;
      this.pendingWrite = this.write();
    }
    await this.pendingWrite;
  }

  isFresh(key: string, staleMs: number): boolean {
    const entry = this.memory.get(key);
    return entry !== undefined && this.now() - entry.updatedAt < staleMs;
  }

  private touch(key: string): void {
    const at = this.persistedKeys.indexOf(key);
    if (at >= 0) this.persistedKeys.splice(at, 1);
    this.persistedKeys.push(key);
    while (this.persistedKeys.length > this.maxPersisted) {
      const evicted = this.persistedKeys.shift();
      if (evicted) this.memory.delete(evicted);
    }
  }

  private scheduleWrite(): void {
    if (!this.options.storage) return;
    if (this.writeDelayMs <= 0) {
      this.pendingWrite = this.write();
      return;
    }
    if (this.writeTimer) return;
    this.writeTimer = setTimeout(() => {
      this.writeTimer = null;
      this.pendingWrite = this.write();
    }, this.writeDelayMs);
  }

  private async write(): Promise<void> {
    const storage = this.options.storage;
    if (!storage) return;
    const entries: Record<string, CacheEntry> = {};
    for (const key of this.persistedKeys) {
      const entry = this.memory.get(key);
      if (entry) entries[key] = entry;
    }
    const blob: PersistedBlob = { v: 1, order: [...this.persistedKeys], entries };
    await writeJson(storage, CACHE_KEY, blob);
  }
}
