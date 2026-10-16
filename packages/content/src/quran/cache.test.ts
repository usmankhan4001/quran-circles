import { describe, expect, it } from 'vitest';
import { createMemoryStorage } from '../storage/memory';
import { createClock, createFakeQuranApi, fakeArabic } from '../test/fakes';
import { createAlQuranCloudSource } from './alquranCloud';
import { CACHE_FRESH_MS, createCachedQuranSource } from './cache';

const DAY = 24 * 60 * 60 * 1000;

const setup = (options: { maxPassages?: number; freshMs?: number } = {}) => {
  const api = createFakeQuranApi();
  const clock = createClock();
  const storage = createMemoryStorage();
  const source = createCachedQuranSource({
    source: createAlQuranCloudSource({ fetch: api.fetch, now: clock.now }),
    storage,
    now: clock.now,
    ...options,
  });
  return { api, clock, storage, source };
};

describe('createCachedQuranSource', () => {
  it('fetches a passage the first time and marks it as not from the cache', async () => {
    const { api, source } = setup();
    const passage = await source.getSurah(112);
    expect(passage.fromCache).toBe(false);
    expect(passage.stale).toBe(false);
    expect(api.calls).toHaveLength(1);
  });

  it('serves a fresh passage from the cache without touching the network', async () => {
    const { api, clock, source } = setup();
    await source.getSurah(112);
    clock.advance(DAY);
    const again = await source.getSurah(112);
    expect(again.fromCache).toBe(true);
    expect(again.stale).toBe(false);
    expect(again.verses[0]?.arabic).toBe(fakeArabic(112, 1));
    expect(api.calls).toHaveLength(1);
  });

  it('refreshes a passage once it is no longer fresh', async () => {
    const { api, clock, source } = setup();
    await source.getSurah(112);
    clock.advance(CACHE_FRESH_MS + DAY);
    const again = await source.getSurah(112);
    expect(again.fromCache).toBe(false);
    expect(api.calls).toHaveLength(2);
    expect(again.fetchedAt).toBe(clock.now().toISOString());
  });

  it('opens a passage read once while offline', async () => {
    const { api, source } = setup();
    await source.getSurah(112);
    api.offline = true;
    const offline = await source.getSurah(112);
    expect(offline.fromCache).toBe(true);
    expect(offline.verses).toHaveLength(4);
  });

  it('falls back to an old copy, marked stale, when the refresh fails', async () => {
    const { api, clock, source } = setup();
    await source.getSurah(112);
    clock.advance(CACHE_FRESH_MS + DAY);
    api.offline = true;
    const stale = await source.getSurah(112);
    expect(stale.fromCache).toBe(true);
    expect(stale.stale).toBe(true);
    expect(stale.verses).toHaveLength(4);
  });

  it('also falls back when the source answers with an error', async () => {
    const { api, clock, source } = setup();
    await source.getJuz(30);
    clock.advance(CACHE_FRESH_MS + DAY);
    api.failNextWith = 500;
    const stale = await source.getJuz(30);
    expect(stale.stale).toBe(true);
  });

  it('fails with an offline error when nothing is cached', async () => {
    const { api, source } = setup();
    api.offline = true;
    await expect(source.getSurah(112)).rejects.toMatchObject({ code: 'offline' });
    await expect(source.getJuz(1)).rejects.toMatchObject({ code: 'offline' });
  });

  it('does not cache a failure', async () => {
    const { api, source } = setup();
    api.offline = true;
    await expect(source.getSurah(112)).rejects.toBeDefined();
    api.offline = false;
    expect((await source.getSurah(112)).fromCache).toBe(false);
  });

  it('keeps surahs and juz apart', async () => {
    const { api, source } = setup();
    await source.getSurah(1);
    await source.getJuz(1);
    expect(api.calls).toHaveLength(3); // one for the surah, two editions for the juz
    expect((await source.getSurah(1)).fromCache).toBe(true);
    expect((await source.getJuz(1)).fromCache).toBe(true);
  });

  it('shares one request between callers that ask at the same time', async () => {
    const { api, source } = setup();
    const [a, b] = await Promise.all([source.getSurah(112), source.getSurah(112)]);
    expect(api.calls).toHaveLength(1);
    expect(a.verses).toEqual(b.verses);
  });

  it('ignores a cache entry that was damaged and fetches again', async () => {
    const { api, storage, source } = setup();
    await source.getSurah(112);
    await storage.setItem('qc.quran.cache.v1:surah:112', '{"kind":"surah","id":112,"verses":"oops"}');
    const again = await source.getSurah(112);
    expect(again.fromCache).toBe(false);
    expect(api.calls).toHaveLength(2);
    await storage.setItem('qc.quran.cache.v1:surah:112', 'not json at all');
    expect((await source.getSurah(112)).fromCache).toBe(false);
  });

  it('ignores an entry stored under the wrong passage', async () => {
    const { api, storage, source } = setup();
    await source.getSurah(112);
    const raw = await storage.getItem('qc.quran.cache.v1:surah:112');
    await storage.setItem('qc.quran.cache.v1:surah:113', raw ?? '');
    const other = await source.getSurah(113);
    expect(other.id).toBe(113);
    expect(other.verses[0]?.surah).toBe(113);
    expect(api.calls).toHaveLength(2);
  });

  it('keeps no more than the limit, dropping the least recently read', async () => {
    const { clock, source } = setup({ maxPassages: 2 });
    await source.getSurah(112);
    clock.advance(1000);
    await source.getSurah(113);
    clock.advance(1000);
    await source.getSurah(112); // read again, so 113 is now the oldest
    clock.advance(1000);
    await source.getSurah(114);
    expect(await source.cachedPassages()).toEqual([
      { kind: 'surah', id: 114 },
      { kind: 'surah', id: 112 },
    ]);
    expect(await source.isCached({ kind: 'surah', id: 113 })).toBe(false);
    expect(await source.isCached({ kind: 'surah', id: 112 })).toBe(true);
  });

  it('clears everything on request', async () => {
    const { api, storage, source } = setup();
    await source.getSurah(112);
    await source.clear();
    expect(await source.cachedPassages()).toEqual([]);
    expect(storage.keys()).toEqual([]);
    api.offline = true;
    await expect(source.getSurah(112)).rejects.toMatchObject({ code: 'offline' });
  });

  it('does not offer a stale copy for a surah that does not exist', async () => {
    const { source } = setup();
    await expect(source.getSurah(115)).rejects.toMatchObject({ code: 'not_found' });
  });

  it('still works when the storage refuses writes', async () => {
    const api = createFakeQuranApi();
    const source = createCachedQuranSource({
      source: createAlQuranCloudSource({ fetch: api.fetch }),
      storage: {
        getItem: () => Promise.resolve(null),
        setItem: () => Promise.reject(new Error('QuotaExceededError')),
        removeItem: () => Promise.resolve(),
      },
    });
    const passage = await source.getSurah(112);
    expect(passage.verses).toHaveLength(4);
  });
});
