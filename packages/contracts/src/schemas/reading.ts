import { z } from 'zod';
import { InstantUtc, LocalDate, Uuid } from '../common';
import { AYAH_COUNTS } from '../bookmarks';
import {
  AyahOfTheDaySource,
  DailyAyahScope,
  DailyGoalUnit,
  MemorisationStatus,
  ReadingDayClientSource,
  ReadingDaySource,
} from '../enums';
import { lazy } from '../lazy';

/**
 * Days read, the community total, the ayah of the day and the memorisation tracker
 * (contract 1.0.0-rc.4, `docs/product/features-next.md`).
 *
 * Quran text is never part of the contract: an ayah is a surah and an ayah number only. The reader
 * shows the Arabic and the translation from its own source.
 */

export const SurahNumber = lazy(() => z.number().int().min(1).max(114));
/** 286 is the longest surah. Use `isAyahInSurah` (or `AyahRef`) to check the surah's own count. */
export const AyahNumber = lazy(() => z.number().int().min(1).max(286));

/** True when `ayah` exists in `surah` (1 to 114, ayah counts from the standard Hafs numbering). */
export const isAyahInSurah = (surah: number, ayah: number): boolean => {
  const count = AYAH_COUNTS[surah - 1];
  return Number.isInteger(ayah) && count !== undefined && ayah >= 1 && ayah <= count;
};

/** A surah and an ayah that exists in it. The refinement reports `{ path: 'ayah', code: 'custom' }`. */
export const AyahRef = lazy(() =>
  z
    .object({ surah: SurahNumber, ayah: AyahNumber })
    .refine((v) => isAyahInSurah(v.surah, v.ayah), { path: ['ayah'] }),
);
export type AyahRef = z.infer<typeof AyahRef>;

// Daily goal -----------------------------------------------------------------------------------

/** Most of any unit a goal may ask for. 604 is the number of pages of the standard mushaf. */
export const DAILY_GOAL_MAX = 604;

/** An optional personal goal, for example 1 page, 1 ruku or 10 minutes a day. */
export const DailyGoal = lazy(() =>
  z.object({
    unit: DailyGoalUnit,
    amount: z.number().int().min(1).max(DAILY_GOAL_MAX),
  }),
);
export type DailyGoal = z.infer<typeof DailyGoal>;

/** Days after which a memorised surah shows in "revise this week" when the person sets nothing. */
export const MEMORISATION_REVISE_AFTER_DAYS_DEFAULT = 14;
export const MemorisationReviseAfterDays = lazy(() => z.number().int().min(1).max(365));

// Reading log ----------------------------------------------------------------------------------

/** Pages in the standard mushaf and ayat in the Quran: the most one day can record. */
export const READING_DAY_MAX_PAGES = 604;
export const READING_DAY_MAX_AYAHS = 6236;
/** The longest span `GET /v1/me/reading-days` and `GET /v1/admin/daily-ayahs` answer at once. */
export const READING_RANGE_MAX_DAYS = 366;

/**
 * Record that the signed-in person read today. Safe to send again: one row per person, Pakistan
 * date and source. `pages` and `ayahs` are the day's totals so far for that source, not
 * increments; a repeat keeps the larger of the stored and the sent value.
 */
export const ReadingDayRecord = lazy(() =>
  z.object({
    source: ReadingDayClientSource,
    /**
     * The Pakistan-time date the reading happened. Defaults to today (Pakistan). Only today and
     * yesterday are accepted, so a reading made just before midnight can still sync; any other
     * date is validation_failed with `{ path: 'date', code: 'out_of_range' }` (`readingDayDateIssue`).
     */
    date: LocalDate.optional(),
    pages: z.number().int().min(0).max(READING_DAY_MAX_PAGES).optional(),
    ayahs: z.number().int().min(0).max(READING_DAY_MAX_AYAHS).optional(),
  }),
);
export type ReadingDayRecord = z.infer<typeof ReadingDayRecord>;

/** One day read, all sources together. Only days with at least one source are returned. */
export const ReadingDay = lazy(() =>
  z.object({
    date: LocalDate,
    /** Each source at most once, in the order of `READING_DAY_SOURCES`. */
    sources: z.array(ReadingDaySource).min(1),
    /** Sum over the day's sources. 0 when nothing was counted (for example "I read today"). */
    pages: z.number().int().min(0),
    ayahs: z.number().int().min(0),
  }),
);
export type ReadingDay = z.infer<typeof ReadingDay>;

/**
 * Inclusive Pakistan-time dates, at most `READING_RANGE_MAX_DAYS` days. A backwards range is
 * `{ path: 'from', code: 'invalid_range' }` and a longer one `{ path: 'to', code: 'too_big' }`
 * (`readingRangeIssue`).
 */
export const ReadingDaysQuery = lazy(() => z.object({ from: LocalDate, to: LocalDate }));
export const ReadingDaysResponse = lazy(() => z.object({ items: z.array(ReadingDay) }));

// Community total ------------------------------------------------------------------------------

/**
 * The one national number. Counted without user ids into a per-day total, so a deleted account's
 * reading stays counted as an anonymous number. No city, venue or circle breakdown exists.
 */
export const CommunityToday = lazy(() =>
  z.object({
    /** Today's Pakistan-time date. */
    date: LocalDate,
    /** People with at least one day read recorded today. */
    readersToday: z.number().int().min(0),
    /** Pages recorded today by everyone together; grows through the day. */
    pagesTogether: z.number().int().min(0),
  }),
);
export type CommunityToday = z.infer<typeof CommunityToday>;

// Ayah of the day ------------------------------------------------------------------------------

/**
 * `date` defaults to today (Pakistan). `venueId` and `circleId` are the venues and circles the
 * person follows (repeat the parameter for several); a signed-out visitor sends none. The ids are
 * public and only choose between picks: the rule is `resolveDailyAyah`.
 */
export const AyahOfTheDayQuery = lazy(() =>
  z.object({
    date: LocalDate.optional(),
    venueId: z.array(Uuid).max(50).optional(),
    circleId: z.array(Uuid).max(50).optional(),
  }),
);

export const AyahOfTheDay = lazy(() =>
  z.object({
    date: LocalDate,
    surah: SurahNumber,
    ayah: AyahNumber,
    /** `venue` or `circle`: a coordinator's pick for a place the person follows. */
    source: AyahOfTheDaySource,
    /** The venue of a venue or circle pick, otherwise null. */
    venueId: Uuid.nullable(),
    /** The circle of a circle pick, otherwise null. */
    circleId: Uuid.nullable(),
  }),
);
export type AyahOfTheDay = z.infer<typeof AyahOfTheDay>;

/** A curated pick as staff see it. Numbers only, never translation text. */
export const DailyAyahEntry = lazy(() =>
  z.object({
    id: Uuid,
    date: LocalDate,
    scopeType: DailyAyahScope,
    /** Set for venue and circle picks (the venue's city), null for national. */
    cityId: Uuid.nullable(),
    /** Set for venue picks and for circle picks (the circle's venue). */
    venueId: Uuid.nullable(),
    circleId: Uuid.nullable(),
    surah: SurahNumber,
    ayah: AyahNumber,
    updatedAt: InstantUtc,
  }),
);
export type DailyAyahEntry = z.infer<typeof DailyAyahEntry>;

export const DailyAyahTarget = lazy(() =>
  z.discriminatedUnion('type', [
    z.object({ type: z.literal('national') }),
    z.object({ type: z.literal('venue'), venueId: Uuid }),
    z.object({ type: z.literal('circle'), circleId: Uuid }),
  ]),
);
export type DailyAyahTarget = z.infer<typeof DailyAyahTarget>;

/** Set (or replace) the pick for one date and one scope. */
export const DailyAyahPut = lazy(() =>
  z
    .object({ date: LocalDate, scope: DailyAyahTarget, surah: SurahNumber, ayah: AyahNumber })
    .refine((v) => isAyahInSurah(v.surah, v.ayah), { path: ['ayah'] }),
);
export type DailyAyahPut = z.infer<typeof DailyAyahPut>;

/** Inclusive dates (at most `READING_RANGE_MAX_DAYS`), optionally narrowed to one scope or place. */
export const AdminDailyAyahsQuery = lazy(() =>
  z.object({
    from: LocalDate,
    to: LocalDate,
    scopeType: DailyAyahScope.optional(),
    venueId: Uuid.optional(),
    circleId: Uuid.optional(),
  }),
);
export const AdminDailyAyahsResponse = lazy(() => z.object({ items: z.array(DailyAyahEntry) }));

// Memorisation ---------------------------------------------------------------------------------

export const MemorisationEntry = lazy(() =>
  z.object({
    surah: SurahNumber,
    status: MemorisationStatus,
    /** Last time the person marked it revised. Null until then. */
    lastRevisedAt: InstantUtc.nullable(),
    updatedAt: InstantUtc,
  }),
);
export type MemorisationEntry = z.infer<typeof MemorisationEntry>;

export const MemorisationResponse = lazy(() =>
  z.object({
    /** Marked surahs only, in surah order. An unmarked surah has no entry. */
    items: z.array(MemorisationEntry),
    /** The person's setting, or `MEMORISATION_REVISE_AFTER_DAYS_DEFAULT`. */
    reviseAfterDays: MemorisationReviseAfterDays,
  }),
);

export const MemorisationParams = lazy(() =>
  z.object({ surah: z.coerce.number().int().min(1).max(114) }),
);

/**
 * Mark a surah. `markRevised: true` stamps `lastRevisedAt` with now. Marking a surah `memorised`
 * that has never been revised also stamps it, so it does not show in "revise this week" at once.
 */
export const MemorisationPut = lazy(() =>
  z.object({
    status: MemorisationStatus,
    markRevised: z.boolean().optional(),
  }),
);
export type MemorisationPut = z.infer<typeof MemorisationPut>;
