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
});
