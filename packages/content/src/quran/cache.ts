import { z } from 'zod';
import { isValidAyah } from '../meta/ayah';
import { juzOf } from '../meta/juz';
import { readJson, writeJson } from '../storage/json';
import type { KeyValueStorage } from '../storage/types';
import {
  isAbortError,
  QuranSourceError,
  type FetchOptions,
  type PassageKind,
  type PassageRef,
  type QuranAyah,
  type QuranPassage,
  type QuranSource,
  type QuranVerse,
} from './types';

const DAY_MS = 24 * 60 * 60 * 1000;
export const CACHE_FRESH_MS = 30 * DAY_MS;
export const CACHE_MAX_PASSAGES = 24;

const CACHE_PREFIX = 'qc.quran.cache.v1:';
const INDEX_KEY = 'qc.quran.cache.index.v1';

const VerseSchema = z.object({
  surah: z.number().int(),
  ayah: z.number().int(),
  arabic: z.string(),
  urdu: z.string().nullable(),
});
const EntrySchema = z.object({
  kind: z.enum(['surah', 'juz']),
  id: z.number().int(),
  fetchedAt: z.string(),
  verses: z.array(VerseSchema),
});
/** One ayah read on its own. It takes one place in the index, like a passage. */
const AyahEntrySchema = z.object({
  kind: z.literal('ayah'),
  fetchedAt: z.string(),
  verse: VerseSchema,
});
const IndexSchema = z.array(z.object({ key: z.string(), accessedAt: z.number() }));

export interface CachedQuranSourceOptions {
  source: QuranSource;
  storage: KeyValueStorage;
  now?: () => Date;
  /** How long a cached passage counts as fresh. After that the network is tried first. */
  freshMs?: number;
  /** The most passages kept on the device. The least recently read are dropped first. */
  maxPassages?: number;
}

export interface CachedQuranSource extends QuranSource {
  /** The passages that can be read offline right now, most recently read first. */
  cachedPassages(): Promise<PassageRef[]>;
  isCached(ref: PassageRef): Promise<boolean>;
  clear(): Promise<void>;
}

const keyOf = (kind: PassageKind, id: number) => `${CACHE_PREFIX}${kind}:${id}`;
const ayahKeyOf = (surah: number, ayah: number) => `${CACHE_PREFIX}ayah:${surah}:${ayah}`;

interface CachedCopy {
  key: string;
  verse: QuranVerse;
  fetchedAt: string;
}

/**
 * Remembers what the reader has fetched. A fresh copy is returned without touching the network.
 * A missing or old copy is fetched; if that fails, an old copy is still returned, marked
 * `stale`, so a passage that was read once opens without a connection. This is a cache of the
 * online source, not an offline Quran: it holds at most a couple of dozen passages.
 *
 * `getAyah` reads one ayah: from a cached surah or juz that holds it when there is one, else
 * from the source alone (one small request, not the whole surah). An ayah read on its own takes
 * one place in the same index, so `maxPassages` still bounds what is kept.
 */
export function createCachedQuranSource(options: CachedQuranSourceOptions): CachedQuranSource {
  const { source, storage } = options;
  const now = options.now ?? (() => new Date());
  const freshMs = options.freshMs ?? CACHE_FRESH_MS;
  const maxPassages = options.maxPassages ?? CACHE_MAX_PASSAGES;
  const inflight = new Map<string, Promise<QuranPassage>>();
  // The index is read, changed and written back, so changes run one after another.
  let queue: Promise<unknown> = Promise.resolve();
  const exclusive = <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(task, task);
    queue = run.catch(() => undefined);
    return run;
  };

  const touch = (key: string) =>
    exclusive(async () => {
      const index = (await readJson(storage, INDEX_KEY, IndexSchema)) ?? [];
      const next = index.filter((entry) => entry.key !== key);
      next.push({ key, accessedAt: now().getTime() });
      // Oldest access first, so what is dropped is the least recently read.
      next.sort((a, b) => a.accessedAt - b.accessedAt);
      const dropped = next.length > maxPassages ? next.splice(0, next.length - maxPassages) : [];
      await writeJson(storage, INDEX_KEY, next);
      for (const entry of dropped) await storage.removeItem(entry.key).catch(() => undefined);
    });

  const readEntry = async (kind: PassageKind, id: number) => {
    const key = keyOf(kind, id);
    const entry = await readJson(storage, key, EntrySchema);
    if (!entry || entry.kind !== kind || entry.id !== id) {
      return null;
    }
    return entry;
  };

  const load = async (
    kind: PassageKind,
    id: number,
    fetchOptions: FetchOptions | undefined,
  ): Promise<QuranPassage> => {
    const key = keyOf(kind, id);
    const cached = await readEntry(kind, id);
    const fetchedAtMs = cached ? Date.parse(cached.fetchedAt) : Number.NaN;
    const fresh = cached !== null && now().getTime() - fetchedAtMs < freshMs;

    if (cached && fresh) {
      await touch(key);
      return { ...cached, fromCache: true, stale: false };
    }

    try {
      const passage =
        kind === 'surah'
          ? await source.getSurah(id, fetchOptions)
          : await source.getJuz(id, fetchOptions);
      await writeJson(storage, key, {
        kind,
        id,
        fetchedAt: passage.fetchedAt,
        verses: passage.verses,
      });
      await touch(key);
      return { ...passage, fromCache: false, stale: false };
    } catch (error) {
      if (isAbortError(error)) throw error;
      // A surah that does not exist is not an offline problem, and there is nothing to fall back to.
      if (cached && !(error instanceof QuranSourceError && error.code === 'not_found')) {
        return { ...cached, fromCache: true, stale: true };
      }
      throw error;
    }
  };

  /**
   * The copies of one ayah already on the device: inside its cached surah, inside its cached
   * juz, or read on its own before. Freshest first.
   */
  const cachedCopiesOf = async (surah: number, ayah: number): Promise<CachedCopy[]> => {
    const copies: CachedCopy[] = [];
    for (const [kind, id] of [
      ['surah', surah],
      ['juz', juzOf({ surah, ayah })],
    ] as const) {
      const entry = await readEntry(kind, id);
      const verse = entry?.verses.find((v) => v.surah === surah && v.ayah === ayah);
      if (entry && verse) copies.push({ key: keyOf(kind, id), verse, fetchedAt: entry.fetchedAt });
    }
    const single = await readJson(storage, ayahKeyOf(surah, ayah), AyahEntrySchema);
    if (single && single.verse.surah === surah && single.verse.ayah === ayah) {
      copies.push({
        key: ayahKeyOf(surah, ayah),
        verse: single.verse,
        fetchedAt: single.fetchedAt,
      });
    }
    return copies.sort((a, b) => Date.parse(b.fetchedAt) - Date.parse(a.fetchedAt));
  };

  const loadAyah = async (
    surah: number,
    ayah: number,
    fetchOptions: FetchOptions | undefined,
  ): Promise<QuranAyah> => {
    const copies = await cachedCopiesOf(surah, ayah);
    const newest = copies[0];
    if (newest && now().getTime() - Date.parse(newest.fetchedAt) < freshMs) {
      await touch(newest.key);
      return { verse: newest.verse, fetchedAt: newest.fetchedAt, fromCache: true, stale: false };
    }
    try {
      const result = await source.getAyah(surah, ayah, fetchOptions);
      const key = ayahKeyOf(surah, ayah);
      await writeJson(storage, key, {
        kind: 'ayah',
        fetchedAt: result.fetchedAt,
        verse: result.verse,
      });
      await touch(key);
      return { ...result, fromCache: false, stale: false };
    } catch (error) {
      if (isAbortError(error)) throw error;
      if (newest && !(error instanceof QuranSourceError && error.code === 'not_found')) {
        return { verse: newest.verse, fetchedAt: newest.fetchedAt, fromCache: true, stale: true };
      }
      throw error;
    }
  };

  const inflightAyahs = new Map<string, Promise<QuranAyah>>();
  const getAyah = (surah: number, ayah: number, fetchOptions: FetchOptions | undefined) => {
    // Nothing to look up for an ayah that does not exist.
    if (!isValidAyah(surah, ayah)) return Promise.reject(new QuranSourceError('not_found'));
    const key = ayahKeyOf(surah, ayah);
    const running = inflightAyahs.get(key);
    if (running) return running;
    const promise = loadAyah(surah, ayah, fetchOptions).finally(() => inflightAyahs.delete(key));
    inflightAyahs.set(key, promise);
    return promise;
  };

  const get = (kind: PassageKind, id: number, fetchOptions: FetchOptions | undefined) => {
    const key = keyOf(kind, id);
    const running = inflight.get(key);
    if (running) return running;
    const promise = load(kind, id, fetchOptions).finally(() => inflight.delete(key));
    inflight.set(key, promise);
    return promise;
  };

  return {
    getSurah: (surah, fetchOptions) => get('surah', surah, fetchOptions),
    getJuz: (juz, fetchOptions) => get('juz', juz, fetchOptions),
    getAyah: (surah, ayah, fetchOptions) => getAyah(surah, ayah, fetchOptions),

    async cachedPassages() {
      const index = (await readJson(storage, INDEX_KEY, IndexSchema)) ?? [];
      const refs: PassageRef[] = [];
      for (const { key } of [...index].sort((a, b) => b.accessedAt - a.accessedAt)) {
        const match = /^qc\.quran\.cache\.v1:(surah|juz):(\d+)$/.exec(key);
        if (match) refs.push({ kind: match[1] as PassageKind, id: Number(match[2]) });
      }
      return refs;
    },

    async isCached(ref) {
      return (await readEntry(ref.kind, ref.id)) !== null;
    },

    clear() {
      return exclusive(async () => {
        const index = (await readJson(storage, INDEX_KEY, IndexSchema)) ?? [];
        for (const entry of index) await storage.removeItem(entry.key).catch(() => undefined);
        await storage.removeItem(INDEX_KEY).catch(() => undefined);
      });
    },
  };
}
