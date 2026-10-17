import {
  ApiClientError,
  addDays,
  pakistanDate,
  readingDayDateIssue,
  type ApiClient,
  type ReadingDay,
  type ReadingDayRecord,
  type ReadingDaySource,
} from '@qc/contracts';

/**
 * Days read (feature 1, `docs/product/features-next.md`): a gentle count of the days a person
 * read, "4 of 7 days this week". There is no streak: nothing here looks at consecutive days, and
 * a day without reading is never mentioned.
 */

/** The Monday of the Pakistan-time week a date is in. Weeks run Monday to Sunday. */
export function weekStart(date: string): string {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 is Sunday
  return addDays(date, -((weekday + 6) % 7));
}

/** The first day of the month a date is in. */
export function monthStart(date: string): string {
  return `${date.slice(0, 8)}01`;
}

/** The dates one request has to cover to count this week and this month, up to today. */
export function readingRange(today: string): { from: string; to: string } {
  const week = weekStart(today);
  const month = monthStart(today);
  return { from: week < month ? week : month, to: today };
}

export interface ReadingSummary {
  /** Today's Pakistan-time date. */
  today: string;
  /** Days read from Monday to today. */
  week: number;
  /** Days read from the 1st to today. */
  month: number;
  /** What already counted today; empty when nothing has yet. */
  todaySources: readonly ReadingDaySource[];
}

/** Counts the days in a list from `readingDays.list`. Days outside this week and month are ignored. */
export function summariseReadingDays(days: readonly ReadingDay[], today: string): ReadingSummary {
  const week = weekStart(today);
  const month = monthStart(today);
  const read = new Set(
    days.filter((d) => d.sources.length > 0 && d.date <= today).map((d) => d.date),
  );
  let inWeek = 0;
  let inMonth = 0;
  for (const date of read) {
    if (date >= week) inWeek += 1;
    if (date >= month) inMonth += 1;
  }
  return {
    today,
    week: inWeek,
    month: inMonth,
    todaySources: days.find((d) => d.date === today)?.sources ?? [],
  };
}

/** Puts the day the server answered into a list, replacing the same date. */
export function mergeReadingDay(days: readonly ReadingDay[], day: ReadingDay): ReadingDay[] {
  return [...days.filter((d) => d.date !== day.date), day].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
}

export type RecordOutcome =
  | { ok: true; day: ReadingDay }
  /** The date is not today or yesterday in Pakistan: the server would refuse it. */
  | { ok: false; reason: 'out_of_range' }
  | { ok: false; reason: 'failed'; error: unknown };

/**
 * Sends one day read. A date the server would refuse (`readingDayDateIssue`) is not sent at all,
 * and the server's own `{ path: 'date', code: 'out_of_range' }` (a phone clock that is off)
 * comes back as the same outcome, so the caller can say it once in plain words.
 */
export async function recordReadingDay(
  api: ApiClient,
  body: ReadingDayRecord,
  now: Date,
): Promise<RecordOutcome> {
  if (readingDayDateIssue(body.date, now)) return { ok: false, reason: 'out_of_range' };
  try {
    return { ok: true, day: await api.readingDays.record({ body }) };
  } catch (error) {
    if (
      error instanceof ApiClientError &&
      error.code === 'validation_failed' &&
      error.issues?.some((i) => i.path === 'date' && i.code === 'out_of_range')
    ) {
      return { ok: false, reason: 'out_of_range' };
    }
    return { ok: false, reason: 'failed', error };
  }
}

/** Today's Pakistan-time date for the app's clock. */
export const todayInPakistan = (now: Date): string => pakistanDate(now);
