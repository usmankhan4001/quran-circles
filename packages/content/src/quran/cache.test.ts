import { describe, expect, it } from 'vitest';
import { createMemoryStorage } from '../storage/memory';
import { createClock, createFakeQuranApi, fakeArabic, fakeEnglish, fakeUrdu } from '../test/fakes';
import { createAlQuranCloudSource } from './alquranCloud';
import { CACHE_FORMAT, CACHE_FRESH_MS, createCachedQuranSource } from './cache';

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
    expect(api.calls).toHaveLength(4); // one for the surah, three editions for the juz
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
    await storage.setItem(
      'qc.quran.cache.v1:surah:112',
      '{"kind":"surah","id":112,"verses":"oops"}',
    );
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

describe('createCachedQuranSource getAyah', () => {
  const ayahUrl = (key: string) => expect.stringContaining(`/ayah/${key}/editions/`) as unknown;

  it('fetches one ayah on its own, not the whole surah', async () => {
    const { api, source } = setup();
    const result = await source.getAyah(2, 255);
    expect(api.calls).toEqual([ayahUrl('2:255')]);
    expect(result).toMatchObject({ fromCache: false, stale: false });
    expect(result.verse).toEqual({
      surah: 2,
      ayah: 255,
      arabic: fakeArabic(2, 255),
      urdu: fakeUrdu(2, 255),
      english: fakeEnglish(2, 255),
    });
  });

  it('serves a fresh single ayah again from the cache, also offline', async () => {
    const { api, clock, source } = setup();
    await source.getAyah(93, 3);
    clock.advance(DAY);
    api.offline = true;
    const again = await source.getAyah(93, 3);
    expect(again).toMatchObject({ fromCache: true, stale: false });
    expect(again.verse.arabic).toBe(fakeArabic(93, 3));
    expect(api.calls).toHaveLength(1);
  });

  it('reads the ayah out of a cached surah without a request', async () => {
    const { api, source } = setup();
    await source.getSurah(112);
    const result = await source.getAyah(112, 3);
    expect(result).toMatchObject({ fromCache: true, stale: false });
    expect(result.verse).toEqual({
      surah: 112,
      ayah: 3,
      arabic: fakeArabic(112, 3),
      urdu: fakeUrdu(112, 3),
      english: fakeEnglish(112, 3),
    });
    expect(api.calls).toHaveLength(1);
  });

  it('reads the ayah out of a cached juz without a request', async () => {
    const { api, source } = setup();
    await source.getJuz(30);
    const callsAfterJuz = api.calls.length;
    const result = await source.getAyah(93, 3);
    expect(result.fromCache).toBe(true);
    expect(result.verse.arabic).toBe(fakeArabic(93, 3));
    expect(api.calls).toHaveLength(callsAfterJuz);
  });

  it('refreshes an old copy, and falls back to it marked stale when that fails', async () => {
    const { api, clock, source } = setup();
    await source.getAyah(93, 3);
    clock.advance(CACHE_FRESH_MS + DAY);
    const refreshed = await source.getAyah(93, 3);
    expect(refreshed.fromCache).toBe(false);
    expect(api.calls).toHaveLength(2);

    clock.advance(CACHE_FRESH_MS + DAY);
    api.offline = true;
    const stale = await source.getAyah(93, 3);
    expect(stale).toMatchObject({ fromCache: true, stale: true });
    expect(stale.verse.arabic).toBe(fakeArabic(93, 3));
  });

  it('falls back to an old surah copy when the single read fails', async () => {
    const { api, clock, source } = setup();
    await source.getSurah(112);
    clock.advance(CACHE_FRESH_MS + DAY);
    api.failNextWith = 500;
    const stale = await source.getAyah(112, 2);
    expect(stale).toMatchObject({ fromCache: true, stale: true });
    expect(stale.verse.ayah).toBe(2);
  });

  it('fails offline when nothing holds the ayah, and caches no failure', async () => {
    const { api, source } = setup();
    api.offline = true;
    await expect(source.getAyah(93, 3)).rejects.toMatchObject({ code: 'offline' });
    api.offline = false;
    expect((await source.getAyah(93, 3)).fromCache).toBe(false);
  });

  it('rejects an ayah that does not exist without a request', async () => {
    const { api, source } = setup();
    await expect(source.getAyah(1, 8)).rejects.toMatchObject({ code: 'not_found' });
    await expect(source.getAyah(115, 1)).rejects.toMatchObject({ code: 'not_found' });
    expect(api.calls).toEqual([]);
  });

  it('shares one request between callers that ask at the same time', async () => {
    const { api, source } = setup();
    const [a, b] = await Promise.all([source.getAyah(2, 255), source.getAyah(2, 255)]);
    expect(api.calls).toHaveLength(1);
    expect(a.verse).toEqual(b.verse);
  });

  it('does not list a single ayah as a passage that can be read offline', async () => {
    const { source } = setup();
    await source.getAyah(2, 255);
    expect(await source.cachedPassages()).toEqual([]);
    expect(await source.isCached({ kind: 'surah', id: 2 })).toBe(false);
  });

  it('counts a single ayah against the limit and clears it with the rest', async () => {
    const { clock, storage, source } = setup({ maxPassages: 1 });
    await source.getAyah(2, 255);
    clock.advance(1000);
    await source.getSurah(112);
    expect(await storage.getItem('qc.quran.cache.v1:ayah:2:255')).toBeNull();
    await source.getAyah(2, 255);
    await source.clear();
    expect(storage.keys()).toEqual([]);
  });

  it('keeps nothing when the limit is 0', async () => {
    const { api, storage, source } = setup({ maxPassages: 0 });
    await source.getAyah(2, 255);
    expect(storage.keys().filter((k) => k.includes('ayah:'))).toEqual([]);
    await source.getAyah(2, 255);
    expect(api.calls).toHaveLength(2);
  });

  it('ignores a damaged single-ayah entry and fetches again', async () => {
    const { api, storage, source } = setup();
    await source.getAyah(2, 255);
    await storage.setItem('qc.quran.cache.v1:ayah:2:255', '{"kind":"ayah","verse":"oops"}');
    expect((await source.getAyah(2, 255)).fromCache).toBe(false);
    expect(api.calls).toHaveLength(2);
  });

  it('ignores a single-ayah entry stored under the wrong ayah', async () => {
    const { api, storage, source } = setup();
    await source.getAyah(2, 255);
    const raw = await storage.getItem('qc.quran.cache.v1:ayah:2:255');
    await storage.setItem('qc.quran.cache.v1:ayah:2:256', raw ?? '');
    const other = await source.getAyah(2, 256);
    expect(other.verse.ayah).toBe(256);
    expect(other.fromCache).toBe(false);
    expect(api.calls).toHaveLength(2);
  });

  it('lets an abort through instead of falling back', async () => {
    const controller = new AbortController();
    const storage = createMemoryStorage();
    const source = createCachedQuranSource({
      source: createAlQuranCloudSource({
        // Like the real fetch: a signal that is already aborted rejects at once.
        fetch: ((_: RequestInfo | URL, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            const abort = () => reject(new DOMException('aborted', 'AbortError'));
            if (init?.signal?.aborted) abort();
            init?.signal?.addEventListener('abort', abort);
          })) as typeof fetch,
      }),
      storage,
    });
    const pending = source.getAyah(2, 255, { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
});

/**
 * Entries written before the English translation was asked for (format 1): no `format` field,
 * and no `english` on the verses. Built here from invented words.
 */
const legacyVerse = (surah: number, ayah: number) => ({
  surah,
  ayah,
  arabic: fakeArabic(surah, ayah),
  urdu: fakeUrdu(surah, ayah),
});
const legacySurah = (surah: number, ayahs: number, fetchedAt: string) =>
  JSON.stringify({
    kind: 'surah',
    id: surah,
    fetchedAt,
    verses: Array.from({ length: ayahs }, (_, i) => legacyVerse(surah, i + 1)),
  });
const legacyAyah = (surah: number, ayah: number, fetchedAt: string) =>
  JSON.stringify({ kind: 'ayah', fetchedAt, verse: legacyVerse(surah, ayah) });

describe('createCachedQuranSource with copies cached before English', () => {
  const seed = async (
    storage: ReturnType<typeof createMemoryStorage>,
    entries: Record<string, string>,
  ) => {
    for (const [key, value] of Object.entries(entries)) await storage.setItem(key, value);
    await storage.setItem(
      'qc.quran.cache.index.v1',
      JSON.stringify(Object.keys(entries).map((key, i) => ({ key, accessedAt: i }))),
    );
  };

  it('writes the English and the current format with every new copy', async () => {
    const { storage, source } = setup();
    await source.getSurah(112);
    await source.getAyah(2, 255);
    const surah = JSON.parse((await storage.getItem('qc.quran.cache.v1:surah:112')) ?? '{}') as {
      format: number;
      verses: { english: string | null }[];
    };
    expect(surah.format).toBe(CACHE_FORMAT);
    expect(surah.verses[0]?.english).toBe(fakeEnglish(112, 1));
    const ayah = JSON.parse((await storage.getItem('qc.quran.cache.v1:ayah:2:255')) ?? '{}') as {
      format: number;
      verse: { english: string | null };
    };
    expect(ayah.format).toBe(CACHE_FORMAT);
    expect(ayah.verse.english).toBe(fakeEnglish(2, 255));
  });

  it('fetches an old-format passage again when online, even inside its freshness window', async () => {
    const { api, clock, storage, source } = setup();
    await seed(storage, {
      'qc.quran.cache.v1:surah:112': legacySurah(112, 4, clock.now().toISOString()),
    });
    const passage = await source.getSurah(112);
    expect(passage).toMatchObject({ fromCache: false, stale: false });
    expect(passage.verses[0]?.english).toBe(fakeEnglish(112, 1));
    expect(api.calls).toHaveLength(1);
    // The refetched copy replaced the old one, so the next read is a plain cache hit.
    const again = await source.getSurah(112);
    expect(again).toMatchObject({ fromCache: true, stale: false });
    expect(again.verses[0]?.english).toBe(fakeEnglish(112, 1));
    expect(api.calls).toHaveLength(1);
  });

  it('still shows an old-format passage offline, without English and marked stale', async () => {
    const { api, clock, storage, source } = setup();
    await seed(storage, {
      'qc.quran.cache.v1:surah:112': legacySurah(112, 4, clock.now().toISOString()),
    });
    api.offline = true;
    const passage = await source.getSurah(112);
    expect(passage).toMatchObject({ kind: 'surah', id: 112, fromCache: true, stale: true });
    expect(passage.verses).toHaveLength(4);
    expect(passage.verses[1]).toEqual({
      surah: 112,
      ayah: 2,
      arabic: fakeArabic(112, 2),
      urdu: fakeUrdu(112, 2),
      english: null,
    });
    expect(await source.isCached({ kind: 'surah', id: 112 })).toBe(true);
    expect(await source.cachedPassages()).toEqual([{ kind: 'surah', id: 112 }]);
  });

  it('keeps the old copy when the refetch fails with an error status', async () => {
    const { api, clock, storage, source } = setup();
    const old = legacySurah(112, 4, clock.now().toISOString());
    await seed(storage, { 'qc.quran.cache.v1:surah:112': old });
    api.failNextWith = 503;
    expect(await source.getSurah(112)).toMatchObject({ fromCache: true, stale: true });
    expect(await storage.getItem('qc.quran.cache.v1:surah:112')).toBe(old);
  });

  it('fetches an old-format single ayah again when online, and shows it offline', async () => {
    const { api, clock, storage, source } = setup();
    await seed(storage, {
      'qc.quran.cache.v1:ayah:2:255': legacyAyah(2, 255, clock.now().toISOString()),
    });
    api.offline = true;
    const offline = await source.getAyah(2, 255);
    expect(offline).toMatchObject({ fromCache: true, stale: true });
    expect(offline.verse).toEqual({
      surah: 2,
      ayah: 255,
      arabic: fakeArabic(2, 255),
      urdu: fakeUrdu(2, 255),
      english: null,
    });
    api.offline = false;
    const online = await source.getAyah(2, 255);
    expect(online).toMatchObject({ fromCache: false, stale: false });
    expect(online.verse.english).toBe(fakeEnglish(2, 255));
    expect(api.calls.filter((c) => c.includes('/ayah/'))).toHaveLength(2);
  });

  it('prefers a fresh current copy of an ayah over a newer old-format one', async () => {
    const { api, clock, storage, source } = setup();
    await source.getAyah(112, 2);
    clock.advance(DAY);
    await storage.setItem(
      'qc.quran.cache.v1:surah:112',
      legacySurah(112, 4, clock.now().toISOString()),
    );
    const result = await source.getAyah(112, 2);
    expect(result).toMatchObject({ fromCache: true, stale: false });
    expect(result.verse.english).toBe(fakeEnglish(112, 2));
    expect(api.calls).toHaveLength(1);
  });

  it('does not read an ayah out of an old-format surah as fresh', async () => {
    const { api, clock, storage, source } = setup();
    await seed(storage, {
      'qc.quran.cache.v1:surah:112': legacySurah(112, 4, clock.now().toISOString()),
    });
    const result = await source.getAyah(112, 3);
    expect(result.fromCache).toBe(false);
    expect(result.verse.english).toBe(fakeEnglish(112, 3));
    expect(api.calls).toHaveLength(1);
  });

  it('keeps a copy fetched without English (a partial answer) as current, with no English', async () => {
    const { api, clock, source } = setup();
    api.english = 'missing';
    await source.getSurah(112);
    api.english = 'full';
    clock.advance(DAY);
    const again = await source.getSurah(112);
    expect(again).toMatchObject({ fromCache: true, stale: false });
    expect(again.verses.every((v) => v.english === null && v.urdu !== null)).toBe(true);
    expect(api.calls).toHaveLength(1);
  });
});
