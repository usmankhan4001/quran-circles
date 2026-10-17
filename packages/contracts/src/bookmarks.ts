/**
 * One-time import of V1 browser bookmarks at first login (docs/product/decisions.md).
 *
 * V1 kept bookmarks in the browser's localStorage under `quran_bookmarks`, as a JSON array of
 * verse keys such as "2:255" (surah:ayah). This pure function turns that value into the
 * `BookmarkImport` body of `POST /v1/me/bookmarks/import`. It has no dependencies, so the user
 * app imports it from `@qc/contracts/bookmarks`; the migration tool re-exports it.
 */

/** localStorage key V1 used. */
export const V1_BOOKMARKS_KEY = 'quran_bookmarks';

/** The most items the API accepts in one import (`BookmarkImport` allows 500). */
export const MAX_IMPORT_ITEMS = 500;

/** Ayat in each of the 114 surahs, in order (6236 in all). */
export const AYAH_COUNTS: readonly number[] = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98, 135, 112,
  78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75, 85, 54, 53, 89, 59, 37,
  35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12, 12, 30, 52, 52,
  44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15, 21, 11, 8,
  8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6,
];

export interface AyahBookmarkInput {
  kind: 'ayah';
  surah: number;
  ayah: number;
}

export interface V1BookmarkImport {
  /** Matches the `BookmarkImport` schema in `@qc/contracts`. */
  payload: { items: AyahBookmarkInput[] };
  stats: {
    /** Entries found in the V1 value. */
    read: number;
    imported: number;
    /** Not a "surah:ayah" key, or a surah or ayah that does not exist. */
    invalid: number;
    duplicate: number;
    /** Valid but beyond the 500-item limit of one import. */
    overLimit: number;
  };
}

const KEY = /^(\d{1,3})\s*:\s*(\d{1,3})$/;

function entriesOf(input: unknown): unknown[] {
  if (Array.isArray(input)) return input;
  if (typeof input === 'string') {
    try {
      const parsed: unknown = JSON.parse(input);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Maps V1's bookmarks. Pass the raw localStorage string or the parsed array. Never throws:
 * anything unusable is counted in `stats.invalid`. Order is kept; repeats are dropped.
 */
export function mapV1Bookmarks(input: unknown): V1BookmarkImport {
  const entries = entriesOf(input);
  const items: AyahBookmarkInput[] = [];
  const seen = new Set<string>();
  const stats = { read: entries.length, imported: 0, invalid: 0, duplicate: 0, overLimit: 0 };

  for (const entry of entries) {
    const match = typeof entry === 'string' ? KEY.exec(entry.trim()) : null;
    const surah = match ? Number(match[1]) : 0;
    const ayah = match ? Number(match[2]) : 0;
    const limit = AYAH_COUNTS[surah - 1];
    if (!match || limit === undefined || ayah < 1 || ayah > limit) {
      stats.invalid++;
      continue;
    }
    const key = `${surah}:${ayah}`;
    if (seen.has(key)) {
      stats.duplicate++;
      continue;
    }
    seen.add(key);
    if (items.length >= MAX_IMPORT_ITEMS) {
      stats.overLimit++;
      continue;
    }
    items.push({ kind: 'ayah', surah, ayah });
    stats.imported++;
  }
  return { payload: { items }, stats };
}
