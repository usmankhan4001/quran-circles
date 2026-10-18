import { describe, expect, it } from 'vitest';
import { MemoryStore } from '../core/storage';
import { CACHE_KEY, QueryCache } from './cache';

function make(store = new MemoryStore(), options = {}) {
  let now = 1_000;
  const cache = new QueryCache({ storage: store, now: () => now, writeDelayMs: 0, ...options });
  return { cache, store, advance: (ms: number) => (now += ms) };
}

describe('QueryCache', () => {
  it('keeps what it is given and says whether it is still fresh', () => {
    const { cache, advance } = make();
    cache.set('places:cities', [1, 2], true);
    expect(cache.get('places:cities')?.data).toEqual([1, 2]);
    expect(cache.isFresh('places:cities', 60_000)).toBe(true);
    advance(61_000);
    expect(cache.isFresh('places:cities', 60_000)).toBe(false);
  });

  it('writes public data to the device and reads it back after a restart', async () => {
    const { cache, store } = make();
    cache.set('sessions:list', { items: ['a'] }, true);
    await cache.flush();
    const { cache: next } = make(store);
    await next.hydrate();
    expect(next.get('sessions:list')?.data).toEqual({ items: ['a'] });
  });

  it('never writes personal data to the device', async () => {
    const { cache, store } = make();
    cache.set('me:registrations', [{ id: 'secret' }], false);
    cache.set('sessions:list', ['public'], true);
    await cache.flush();
    const saved = await store.get(CACHE_KEY);
    expect(saved).toContain('public');
    expect(saved).not.toContain('secret');
    expect(saved).not.toContain('me:registrations');
  });

  it('marks entries out of date by prefix and tells mounted queries to ask again', () => {
    const { cache } = make();
    cache.set('me:registrations', [], false);
    cache.set('sessions:list', [], true);
    const before = cache.getInvalidations();
    cache.invalidate('me:');
    expect(cache.getInvalidations()).toBe(before + 1);
    expect(cache.isFresh('me:registrations', 60_000)).toBe(false);
    expect(cache.isFresh('sessions:list', 60_000)).toBe(true);
    // The old data is still there to show while the new data loads.
    expect(cache.get('me:registrations')?.data).toEqual([]);
  });

  it('forgets everything, on the device too', async () => {
    const { cache, store } = make();
    cache.set('sessions:list', ['x'], true);
    await cache.flush();
    await cache.clear();
    expect(cache.get('sessions:list')).toBeUndefined();
    expect(await store.get(CACHE_KEY)).toBeNull();
  });

  it('keeps the most recently used entries when over the limit', async () => {
    const { cache } = make(new MemoryStore(), { maxPersisted: 3 });
    for (const key of ['a', 'b', 'c']) cache.set(key, key, true);
    cache.set('a', 'a2', true);
    cache.set('d', 'd', true);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')?.data).toBe('a2');
    expect(cache.get('c')).toBeDefined();
    expect(cache.get('d')).toBeDefined();
  });

  it('does not let an old saved copy overwrite newer data in memory', async () => {
    const { cache, store } = make();
    cache.set('k', 'old', true);
    await cache.flush();
    const { cache: next } = make(store);
    next.set('k', 'new', true);
    await next.hydrate();
    expect(next.get('k')?.data).toBe('new');
  });

  it('starts empty when the saved file is damaged', async () => {
    const store = new MemoryStore();
    await store.set(CACHE_KEY, 'not json');
    const { cache } = make(store);
    await cache.hydrate();
    expect(cache.get('anything')).toBeUndefined();
  });
  describe('sharing requests under way', () => {
    function deferred<T>() {
      let resolve!: (value: T) => void;
      let reject!: (error: unknown) => void;
      const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    }

    it('answers callers asking for the same key at once with one request', async () => {
      const { cache } = make();
      const first = deferred<string>();
      let calls = 0;
      const fetcher = () => {
        calls += 1;
        return first.promise;
      };
      const a = cache.share('config:default', fetcher);
      const b = cache.share('config:default', fetcher);
      first.resolve('config');
      await expect(Promise.all([a, b])).resolves.toEqual(['config', 'config']);
      expect(calls).toBe(1);
    });

    it('asks again once the request has finished', async () => {
      const { cache } = make();
      let calls = 0;
      const fetcher = async () => (calls += 1);
      await cache.share('k', fetcher);
      await cache.share('k', fetcher);
      expect(calls).toBe(2);
    });

    it('keeps different keys apart', async () => {
      const { cache } = make();
      const results = await Promise.all([
        cache.share('a', async () => 'A'),
        cache.share('b', async () => 'B'),
      ]);
      expect(results).toEqual(['A', 'B']);
    });

    it('passes a failure to every caller and then forgets it', async () => {
      const { cache } = make();
      const failing = deferred<string>();
      const a = cache.share('k', () => failing.promise);
      const b = cache.share('k', () => Promise.resolve('unused'));
      failing.reject(new Error('offline'));
      await expect(a).rejects.toThrow('offline');
      await expect(b).rejects.toThrow('offline');
      await expect(cache.share('k', async () => 'again')).resolves.toBe('again');
    });

    it('catches a fetcher that throws before it returns a promise', async () => {
      const { cache } = make();
      await expect(
        cache.share('k', () => {
          throw new Error('broken');
        }),
      ).rejects.toThrow('broken');
      await expect(cache.share('k', async () => 'ok')).resolves.toBe('ok');
    });

    it('never joins a request that an invalidation made out of date', async () => {
      const { cache } = make();
      const old = deferred<string>();
      const stale = cache.share('me:registrations', () => old.promise);
      const other = cache.share('places:cities', () => new Promise<string>(() => undefined));
      cache.invalidate('me:');
      const fresh = cache.share('me:registrations', async () => 'after');
      await expect(fresh).resolves.toBe('after');
      expect(cache.share('places:cities', async () => 'second')).toBe(other);
      old.resolve('before');
      await expect(stale).resolves.toBe('before');
    });

    it('never joins a request from before a sign-out', async () => {
      const { cache } = make();
      cache.share('me:follows', () => new Promise<string>(() => undefined));
      await cache.clear();
      await expect(cache.share('me:follows', async () => 'new person')).resolves.toBe('new person');
    });
  });
});
