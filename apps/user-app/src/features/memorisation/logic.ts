import {
  MEMORISATION_REVISE_AFTER_DAYS_DEFAULT,
  MEMORISATION_STATUSES,
  needsRevision,
  type MemorisationEntry,
  type MemorisationStatus,
} from '@qc/contracts';
import { SURAHS, getSurah } from '@qc/content/meta';

/**
 * The memorisation tracker (feature 3): private to the person, per surah. "Revise this week" is a
 * gentle list, never a reminder: memorised surahs not marked revised within the person's setting.
 */

/** Memorised surahs due for revision, the longest since revised first (never revised first of all). */
export function reviseThisWeek(
  items: readonly MemorisationEntry[],
  now: Date,
  reviseAfterDays: number = MEMORISATION_REVISE_AFTER_DAYS_DEFAULT,
): MemorisationEntry[] {
  return items
    .filter((entry) => needsRevision(entry, now, reviseAfterDays))
    .sort((a, b) => {
      if (a.lastRevisedAt === b.lastRevisedAt) return a.surah - b.surah;
      if (a.lastRevisedAt === null) return -1;
      if (b.lastRevisedAt === null) return 1;
      return a.lastRevisedAt.localeCompare(b.lastRevisedAt);
    });
}

/** How many surahs have each mark. */
export function countByStatus(
  items: readonly MemorisationEntry[],
): Record<MemorisationStatus, number> {
  const counts = Object.fromEntries(MEMORISATION_STATUSES.map((s) => [s, 0])) as Record<
    MemorisationStatus,
    number
  >;
  for (const entry of items) counts[entry.status] += 1;
  return counts;
}

/** Puts the server's answer for one surah into the list, in surah order. */
export function upsertEntry(
  items: readonly MemorisationEntry[],
  entry: MemorisationEntry,
): MemorisationEntry[] {
  return [...items.filter((e) => e.surah !== entry.surah), entry].sort((a, b) => a.surah - b.surah);
}

export function removeEntry(
  items: readonly MemorisationEntry[],
  surah: number,
): MemorisationEntry[] {
  return items.filter((e) => e.surah !== surah);
}

/** The surah's transliterated name and its Arabic name, from the content package's list. */
export function surahNames(surah: number): { simple: string; arabic: string } {
  const info = getSurah(surah);
  return info
    ? { simple: info.nameSimple, arabic: info.nameArabic }
    : { simple: String(surah), arabic: String(surah) };
}

/** Every surah number, 1 to 114. */
export const SURAH_NUMBERS: readonly number[] = SURAHS.map((s) => s.id);
