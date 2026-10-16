import { z } from 'zod';
import { classifyFailure, type GetContentApi } from '../account/api';
import { parseVerseKey, type AyahRef } from '../meta/ayah';
import { isJuzNumber, juzStart } from '../meta/juz';
import { isSurahNumber } from '../meta/surahs';
import { zoomIndexFromV1Rem, type ReaderPrefsStore } from '../quran/prefs';
import type { ReadingPositionService } from '../reading/position';
import { readJson, writeJson } from '../storage/json';
import type { KeyValueStorage } from '../storage/types';
import type { BookmarkInput, BookmarkService } from './service';

/**
 * The keys the V1 web app kept in the browser's localStorage (components/Quran/*.tsx):
 * - `quran_bookmarks`: a JSON array of "surah:ayah" strings.
 * - `quran_last_read`: JSON `{ mode: 'surah' | 'juz', id, name, detail }`.
 * - `quran_fontSize`: the Arabic size in rem, 1.5 to 5, default 2.4.
 * - `quran_showTranslation`: JSON true or false.
 */
export const V1_KEYS = {
  bookmarks: 'quran_bookmarks',
  lastRead: 'quran_last_read',
  fontSize: 'quran_fontSize',
  showTranslation: 'quran_showTranslation',
} as const;

/** The contract accepts at most this many items in one import call. */
export const IMPORT_MAX_ITEMS = 500;

export interface V1Raw {
  bookmarks: string | null;
  lastRead: string | null;
  fontSize: string | null;
  showTranslation: string | null;
}

/** Reads one V1 key. On the web this is `localStorage.getItem`; it may be async. */
export type V1Reader = (key: string) => string | null | Promise<string | null>;

export async function readV1(reader: V1Reader): Promise<V1Raw> {
  const get = async (key: string) => {
    try {
      return (await reader(key)) ?? null;
    } catch {
      return null;
    }
  };
  return {
    bookmarks: await get(V1_KEYS.bookmarks),
    lastRead: await get(V1_KEYS.lastRead),
    fontSize: await get(V1_KEYS.fontSize),
    showTranslation: await get(V1_KEYS.showTranslation),
  };
}

function parseJson(raw: string | null): unknown {
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export interface MappedV1Bookmarks {
  items: BookmarkInput[];
  /** Entries that were not an ayah that exists, or not a string at all. */
  invalid: number;
  duplicates: number;
}

/** "2:255" strings in V1's array become ayah bookmarks. Anything else is counted and left out. */
export function mapV1Bookmarks(raw: string | null): MappedV1Bookmarks {
  const data = parseJson(raw);
  const result: MappedV1Bookmarks = { items: [], invalid: 0, duplicates: 0 };
  if (!Array.isArray(data)) return result;
  const seen = new Set<string>();
  for (const entry of data) {
    const ref = parseVerseKey(entry);
    if (!ref) {
      result.invalid++;
      continue;
    }
    const key = `${ref.surah}:${ref.ayah}`;
    if (seen.has(key)) {
      result.duplicates++;
      continue;
    }
    seen.add(key);
    result.items.push({ kind: 'ayah', surah: ref.surah, ayah: ref.ayah });
  }
  return result;
}

const LastReadSchema = z.object({ mode: z.enum(['surah', 'juz']), id: z.number().int() });

/**
 * V1 remembered the surah or juz last opened, not the ayah. A surah becomes its first ayah; a
 * juz becomes the ayah it starts at.
 */
export function mapV1LastRead(raw: string | null): AyahRef | null {
  const parsed = LastReadSchema.safeParse(parseJson(raw));
  if (!parsed.success) return null;
  const { mode, id } = parsed.data;
  if (mode === 'surah') return isSurahNumber(id) ? { surah: id, ayah: 1 } : null;
  return isJuzNumber(id) ? juzStart(id) : null;
}

export interface V1Summary {
  bookmarks: MappedV1Bookmarks;
  lastRead: AyahRef | null;
  fontSizeRem: number | null;
  showTranslation: boolean | null;
}

export function summariseV1(raw: V1Raw): V1Summary {
  const font = raw.fontSize === null ? Number.NaN : Number.parseFloat(raw.fontSize);
  const show = parseJson(raw.showTranslation);
  return {
    bookmarks: mapV1Bookmarks(raw.bookmarks),
    lastRead: mapV1LastRead(raw.lastRead),
    fontSizeRem: Number.isFinite(font) && font > 0 ? font : null,
    showTranslation: typeof show === 'boolean' ? show : null,
  };
}

export type V1ImportStatus =
  /** Nothing from V1 to bring over, or it was already handled. */
  | { state: 'none' }
  /** There is V1 data and the person is signed in: offer the import. */
  | { state: 'available'; bookmarks: number; hasLastRead: boolean }
  /** There is V1 data but nobody is signed in yet. Offer it at first login. */
  | { state: 'waiting_for_sign_in'; bookmarks: number; hasLastRead: boolean };

export type V1ImportOutcome =
  | { ok: true; imported: number; skipped: number; positionSet: boolean }
  | { ok: false; reason: 'signed_out' | 'offline' | 'failed' };

const DoneSchema = z.object({ doneAt: z.string(), imported: z.number(), skipped: z.number() });
const DONE_KEY = 'qc.v1import.done.v1';

export interface V1Importer {
  status(): Promise<V1ImportStatus>;
  /** Sends the V1 bookmarks to the account. Safe to repeat after a failure: the call is idempotent. */
  run(): Promise<V1ImportOutcome>;
  /** The person said no. Marks it handled without importing. */
  skip(): Promise<void>;
}

export interface V1ImporterOptions {
  /** Where the V1 data is. Return null for every key when the browser has none. */
  readV1: V1Reader;
  /** Where the "already handled" flag lives. */
  storage: KeyValueStorage;
  getApi: GetContentApi;
  bookmarks: BookmarkService;
  readingPosition: ReadingPositionService;
  prefs?: ReaderPrefsStore;
  now?: () => Date;
}

/**
 * The one-time import of V1 browser bookmarks, offered at first login (docs/product/decisions.md,
 * Migration). It also carries over the last read place and the reader settings, because a
 * returning V1 reader expects to continue where they stopped.
 */
export function createV1Importer(options: V1ImporterOptions): V1Importer {
  const now = options.now ?? (() => new Date());
  const markDone = (imported: number, skipped: number) =>
    writeJson(options.storage, DONE_KEY, { doneAt: now().toISOString(), imported, skipped });

  const status: V1Importer['status'] = async () => {
    if (await readJson(options.storage, DONE_KEY, DoneSchema)) return { state: 'none' };
    const summary = summariseV1(await readV1(options.readV1));
    const bookmarks = summary.bookmarks.items.length;
    const hasLastRead = summary.lastRead !== null;
    if (bookmarks === 0 && !hasLastRead) return { state: 'none' };
    return options.getApi()
      ? { state: 'available', bookmarks, hasLastRead }
      : { state: 'waiting_for_sign_in', bookmarks, hasLastRead };
  };

  return {
    status,

    async run() {
      const api = options.getApi();
      if (!api) return { ok: false, reason: 'signed_out' };
      const summary = summariseV1(await readV1(options.readV1));
      const { items } = summary.bookmarks;

      let imported = 0;
      let skipped = summary.bookmarks.invalid + summary.bookmarks.duplicates;
      try {
        for (let at = 0; at < items.length; at += IMPORT_MAX_ITEMS) {
          const result = await api.bookmarks.import({
            body: { items: items.slice(at, at + IMPORT_MAX_ITEMS) },
          });
          imported += result.imported;
          skipped += result.skipped;
        }
      } catch (error) {
        const kind = classifyFailure(error);
        return { ok: false, reason: kind === 'signed_out' ? 'signed_out' : kind === 'offline' ? 'offline' : 'failed' };
      }

      // Bring the account's list onto the device. A failure here does not undo the import.
      await options.bookmarks.sync();

      let positionSet = false;
      if (summary.lastRead && !(await options.readingPosition.getLocal())) {
        await options.readingPosition.save(summary.lastRead.surah, summary.lastRead.ayah);
        positionSet = true;
      }
      if (options.prefs && (summary.fontSizeRem !== null || summary.showTranslation !== null)) {
        const current = await options.prefs.load();
        await options.prefs.save({
          showTranslation: summary.showTranslation ?? current.showTranslation,
          arabicZoomIndex:
            summary.fontSizeRem !== null
              ? zoomIndexFromV1Rem(summary.fontSizeRem)
              : current.arabicZoomIndex,
        });
      }

      await markDone(imported, skipped);
      return { ok: true, imported, skipped, positionSet };
    },

    async skip() {
      await markDone(0, 0);
    },
  };
}
