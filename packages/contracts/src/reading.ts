import type { ValidationIssue } from './errors';
import type { DailyAyahScope } from './enums';
import {
  MEMORISATION_REVISE_AFTER_DAYS_DEFAULT,
  READING_RANGE_MAX_DAYS,
  type AyahOfTheDay,
  type AyahRef,
  type MemorisationEntry,
} from './schemas/reading';

/**
 * Pure rules shared by the API, the worker, the mock server and the apps for the rc.4 features.
 * Keep them here so every layer answers the same way.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** Pakistan is UTC+5 all year, with no daylight saving. */
const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;

/** The Pakistan-time calendar date (YYYY-MM-DD) of an instant. */
export function pakistanDate(instant: Date | string): string {
  const t = typeof instant === 'string' ? Date.parse(instant) : instant.getTime();
  return new Date(t + PKT_OFFSET_MS).toISOString().slice(0, 10);
}

/** Days since 1970-01-01 for a YYYY-MM-DD date. */
const dayNumber = (date: string): number =>
  Math.floor(Date.parse(`${date}T00:00:00Z`) / MS_PER_DAY);

/** Adds whole days to a YYYY-MM-DD date. */
export function addDays(date: string, days: number): string {
  return new Date((dayNumber(date) + days) * MS_PER_DAY).toISOString().slice(0, 10);
}

/**
 * The date rule of `POST /v1/me/reading-days`: today or yesterday in Pakistan. Returns the issue
 * to answer with validation_failed, or null when the date is fine. A missing date means today.
 */
export function readingDayDateIssue(date: string | undefined, now: Date): ValidationIssue | null {
  if (date === undefined) return null;
  const today = pakistanDate(now);
  return date === today || date === addDays(today, -1)
    ? null
    : { path: 'date', code: 'out_of_range' };
}

/**
 * The range rule of `GET /v1/me/reading-days` and `GET /v1/admin/daily-ayahs`: inclusive dates,
 * `from` not after `to`, at most `READING_RANGE_MAX_DAYS` days.
 */
export function readingRangeIssue(q: { from: string; to: string }): ValidationIssue | null {
  if (q.from > q.to) return { path: 'from', code: 'invalid_range' };
  if (dayNumber(q.to) - dayNumber(q.from) + 1 > READING_RANGE_MAX_DAYS)
    return { path: 'to', code: 'too_big' };
  return null;
}

// Ayah of the day ------------------------------------------------------------------------------

/**
 * Well-known ayat that fill any day without a curated pick: surah and ayah numbers only, never
 * text. Picked in turn by date (`builtInAyahFor`). Changing the list changes which ayah shows on
 * which day, so add to the end.
 */
export const BUILT_IN_DAILY_AYAHS: readonly AyahRef[] = (
  [
    [1, 1],
    [1, 2],
    [1, 5],
    [1, 6],
    [2, 152],
    [2, 153],
    [2, 155],
    [2, 156],
    [2, 186],
    [2, 201],
    [2, 255],
    [2, 256],
    [2, 286],
    [3, 8],
    [3, 26],
    [3, 31],
    [3, 92],
    [3, 103],
    [3, 134],
    [3, 139],
    [3, 159],
    [3, 173],
    [3, 190],
    [3, 191],
    [3, 200],
    [5, 2],
    [6, 162],
    [7, 23],
    [7, 56],
    [7, 199],
    [8, 2],
    [9, 51],
    [10, 57],
    [12, 87],
    [13, 11],
    [13, 28],
    [14, 7],
    [15, 9],
    [16, 90],
    [16, 97],
    [16, 128],
    [17, 23],
    [17, 24],
    [17, 80],
    [17, 82],
    [18, 10],
    [18, 46],
    [20, 25],
    [20, 114],
    [21, 87],
    [21, 107],
    [23, 1],
    [24, 35],
    [25, 63],
    [25, 74],
    [28, 24],
    [29, 45],
    [29, 69],
    [31, 18],
    [33, 21],
    [33, 41],
    [33, 56],
    [39, 10],
    [39, 53],
    [40, 60],
    [41, 34],
    [47, 7],
    [49, 10],
    [49, 12],
    [49, 13],
    [50, 16],
    [51, 56],
    [55, 13],
    [59, 18],
    [59, 22],
    [59, 23],
    [59, 24],
    [65, 2],
    [65, 3],
    [67, 1],
    [67, 2],
    [89, 27],
    [89, 28],
    [93, 5],
    [94, 5],
    [94, 6],
    [96, 1],
    [103, 1],
    [103, 2],
    [103, 3],
    [112, 1],
    [113, 1],
    [114, 1],
  ] as const
).map(([surah, ayah]) => ({ surah, ayah }));

/** The built-in ayah for a Pakistan-time date. The same date always gives the same ayah. */
export function builtInAyahFor(date: string): AyahRef {
  const n = BUILT_IN_DAILY_AYAHS.length;
  const index = ((dayNumber(date) % n) + n) % n;
  return BUILT_IN_DAILY_AYAHS[index]!;
}

/** A stored pick, as the resolver needs it. */
export interface DailyAyahPick {
  date: string;
  scopeType: DailyAyahScope;
  venueId: string | null;
  circleId: string | null;
  surah: number;
  ayah: number;
}

export interface ResolveDailyAyahInput {
  /** Pakistan-time date to resolve. */
  date: string;
  /** Candidate picks; those for other dates are ignored. */
  picks: readonly DailyAyahPick[];
  /** Venues and circles the person follows. Empty for a signed-out visitor. */
  followedVenueIds?: readonly string[];
  followedCircleIds?: readonly string[];
}

/**
 * The ayah of the day rule (change request 2026-10-17, item 4):
 * 1. When exactly one pick of a followed venue or circle applies that day, show it.
 * 2. Otherwise (none, or several) the national pick for the day.
 * 3. Otherwise the built-in list.
 * The API (`GET /v1/ayah-of-the-day`), the worker's morning push and the mock all use this.
 */
export function resolveDailyAyah(input: ResolveDailyAyahInput): AyahOfTheDay {
  const venues = new Set(input.followedVenueIds ?? []);
  const circles = new Set(input.followedCircleIds ?? []);
  const today = input.picks.filter((p) => p.date === input.date);
  const followed = today.filter(
    (p) =>
      (p.scopeType === 'venue' && p.venueId !== null && venues.has(p.venueId)) ||
      (p.scopeType === 'circle' && p.circleId !== null && circles.has(p.circleId)),
  );
  if (followed.length === 1) {
    const p = followed[0]!;
    return {
      date: input.date,
      surah: p.surah,
      ayah: p.ayah,
      source: p.scopeType,
      venueId: p.venueId,
      circleId: p.scopeType === 'circle' ? p.circleId : null,
    };
  }
  const national = today.find((p) => p.scopeType === 'national');
  if (national) {
    return {
      date: input.date,
      surah: national.surah,
      ayah: national.ayah,
      source: 'national',
      venueId: null,
      circleId: null,
    };
  }
  const builtIn = builtInAyahFor(input.date);
  return { date: input.date, ...builtIn, source: 'built_in', venueId: null, circleId: null };
}

// Memorisation ---------------------------------------------------------------------------------

/**
 * Whether a surah belongs in the gentle "revise this week" list: memorised, and not marked revised
 * in the last `reviseAfterDays` days (never revised counts as due). No reminder is ever sent.
 */
export function needsRevision(
  entry: Pick<MemorisationEntry, 'status' | 'lastRevisedAt'>,
  now: Date,
  reviseAfterDays: number = MEMORISATION_REVISE_AFTER_DAYS_DEFAULT,
): boolean {
  if (entry.status !== 'memorised') return false;
  if (entry.lastRevisedAt === null) return true;
  return now.getTime() - Date.parse(entry.lastRevisedAt) >= reviseAfterDays * MS_PER_DAY;
}
