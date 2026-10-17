import { desc, eq } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import * as schema from '../schema/index';
import { addDays, compareDates, dayOfWeek, localToUtc, utcToLocalDate } from './local-time';

/**
 * The database handle the jobs take: the common type of the node-postgres driver (servers) and the
 * PGlite driver (tests). A transaction is one too.
 */
export type JobDb = PgDatabase<PgQueryResultHKT, typeof schema>;

/** How far ahead occurrences are kept, in days. The API uses the same value. */
export const DEFAULT_OCCURRENCE_HORIZON_DAYS = 90;

/** The parts of a session that decide when its occurrences fall. */
export interface ScheduleSpec {
  kind: 'recurring' | 'one_off';
  localStartTime: string;
  durationMinutes: number;
  daysOfWeek: readonly number[];
  startsOn: string;
  endsOn: string | null;
  timezone: string;
}

export interface PlannedOccurrence {
  /** Local calendar date in the session's timezone. */
  date: string;
  startsAt: Date;
  endsAt: Date;
}

/** Hard stop so a bad schedule can never create thousands of rows. */
const MAX_PLANNED = 400;

/** The schedule of a session row. Postgres `time` comes back as `HH:MM:SS`; plans use `HH:MM`. */
export function scheduleSpecOf(s: typeof schema.sessions.$inferSelect): ScheduleSpec {
  return {
    kind: s.kind,
    localStartTime: s.localStartTime.slice(0, 5),
    durationMinutes: s.durationMinutes,
    daysOfWeek: s.daysOfWeek,
    startsOn: s.startsOn,
    endsOn: s.endsOn,
    timezone: s.timezone,
  };
}

/**
 * The dated instances of a schedule between two local dates, inclusive. A recurring session
 * repeats on its days of the week; a one-off lecture has a single date (its `startsOn`).
 */
export function planOccurrences(
  spec: ScheduleSpec,
  fromDate: string,
  toDate: string,
): PlannedOccurrence[] {
  const make = (date: string): PlannedOccurrence => {
    const startsAt = localToUtc(date, spec.localStartTime, spec.timezone);
    return { date, startsAt, endsAt: new Date(startsAt.getTime() + spec.durationMinutes * 60_000) };
  };
  if (spec.kind === 'one_off') {
    const d = spec.startsOn;
    return compareDates(d, fromDate) >= 0 && compareDates(d, toDate) <= 0 ? [make(d)] : [];
  }
  const out: PlannedOccurrence[] = [];
  let date = compareDates(spec.startsOn, fromDate) >= 0 ? spec.startsOn : fromDate;
  const last = spec.endsOn && compareDates(spec.endsOn, toDate) < 0 ? spec.endsOn : toDate;
  const days = new Set(spec.daysOfWeek);
  while (compareDates(date, last) <= 0 && out.length < MAX_PLANNED) {
    if (days.has(dayOfWeek(date))) out.push(make(date));
    date = addDays(date, 1);
  }
  return out;
}

export function horizonDate(now: Date, timezone: string, horizonDays: number): string {
  return addDays(utcToLocalDate(now, timezone), horizonDays);
}

/** Inserts planned occurrences; ones that already exist at the same instant are left alone. */
export async function insertPlanned(
  db: JobDb,
  sessionId: string,
  planned: readonly PlannedOccurrence[],
): Promise<number> {
  if (planned.length === 0) return 0;
  const inserted = await db
    .insert(schema.occurrences)
    .values(planned.map((p) => ({ sessionId, startsAt: p.startsAt, endsAt: p.endsAt })))
    .onConflictDoNothing({ target: [schema.occurrences.sessionId, schema.occurrences.startsAt] })
    .returning({ id: schema.occurrences.id });
  return inserted.length;
}

/**
 * Keeps a recurring session's occurrences ahead of the horizon. It only adds dates after the
 * latest one that exists, so an occurrence that was moved or cancelled by hand is never recreated.
 * Safe to call often.
 */
export async function topUpOccurrences(
  db: JobDb,
  sessionId: string,
  spec: ScheduleSpec,
  now: Date,
  horizonDays: number,
): Promise<number> {
  if (spec.kind !== 'recurring') return 0;
  const [latest] = await db
    .select({ startsAt: schema.occurrences.startsAt })
    .from(schema.occurrences)
    .where(eq(schema.occurrences.sessionId, sessionId))
    .orderBy(desc(schema.occurrences.startsAt))
    .limit(1);
  const today = utcToLocalDate(now, spec.timezone);
  const after = latest ? addDays(utcToLocalDate(latest.startsAt, spec.timezone), 1) : spec.startsOn;
  const from = compareDates(after, today) > 0 ? after : today;
  const to = horizonDate(now, spec.timezone, horizonDays);
  if (compareDates(from, to) > 0) return 0;
  return insertPlanned(db, sessionId, planOccurrences(spec, from, to));
}
