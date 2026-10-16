import { and, desc, eq, gte } from 'drizzle-orm';
import { schema, type Db } from '../../db';
import { addDays, compareDates, dayOfWeek, localToUtc, utcToLocalDate } from '../shared/time';

const { occurrences } = schema;

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
  db: Db,
  sessionId: string,
  planned: readonly PlannedOccurrence[],
): Promise<number> {
  if (planned.length === 0) return 0;
  const inserted = await db
    .insert(occurrences)
    .values(planned.map((p) => ({ sessionId, startsAt: p.startsAt, endsAt: p.endsAt })))
    .onConflictDoNothing({ target: [occurrences.sessionId, occurrences.startsAt] })
    .returning({ id: occurrences.id });
  return inserted.length;
}

/**
 * Creates the occurrences of a new session, from its start (or today) to the horizon. A session in
 * a season stops at the season's last day.
 */
export async function materializeSession(
  db: Db,
  sessionId: string,
  spec: ScheduleSpec,
  now: Date,
  horizonDays: number,
): Promise<number> {
  const today = utcToLocalDate(now, spec.timezone);
  const from = compareDates(spec.startsOn, today) > 0 ? spec.startsOn : today;
  const planned =
    spec.kind === 'one_off'
      ? planOccurrences(spec, spec.startsOn, spec.startsOn)
      : planOccurrences(spec, from, horizonDate(now, spec.timezone, horizonDays));
  return insertPlanned(db, sessionId, planned);
}

/**
 * Keeps a recurring session's occurrences ahead of the horizon. It only adds dates after the
 * latest one that exists, so an occurrence that was moved or cancelled by hand is never recreated.
 * Safe to call often; the worker also calls it daily.
 */
export async function topUpOccurrences(
  db: Db,
  sessionId: string,
  spec: ScheduleSpec,
  now: Date,
  horizonDays: number,
): Promise<number> {
  if (spec.kind !== 'recurring') return 0;
  const [latest] = await db
    .select({ startsAt: occurrences.startsAt })
    .from(occurrences)
    .where(eq(occurrences.sessionId, sessionId))
    .orderBy(desc(occurrences.startsAt))
    .limit(1);
  const today = utcToLocalDate(now, spec.timezone);
  const after = latest ? addDays(utcToLocalDate(latest.startsAt, spec.timezone), 1) : spec.startsOn;
  const from = compareDates(after, today) > 0 ? after : today;
  const to = horizonDate(now, spec.timezone, horizonDays);
  if (compareDates(from, to) > 0) return 0;
  return insertPlanned(db, sessionId, planOccurrences(spec, from, to));
}

export interface ScheduleChangeResult {
  changed: number;
  /** Ids of occurrences whose time moved or that were cancelled, for notifying people. */
  affectedIds: string[];
}

/**
 * Recomputes the future occurrences of a session from a date. Occurrences on dates that still
 * run are moved in place (so registrations, portion and recap stay attached), dates that no longer
 * run are cancelled (history stays), and new dates are added. Earlier occurrences are untouched.
 */
export async function applyScheduleChange(
  db: Db,
  sessionId: string,
  spec: ScheduleSpec,
  effectiveFrom: string,
  now: Date,
  horizonDays: number,
): Promise<ScheduleChangeResult> {
  const today = utcToLocalDate(now, spec.timezone);
  const from = compareDates(effectiveFrom, today) > 0 ? effectiveFrom : today;
  const rows = await db
    .select()
    .from(occurrences)
    .where(and(eq(occurrences.sessionId, sessionId), gte(occurrences.endsAt, now)));
  const existing = rows
    .map((r) => ({ row: r, date: utcToLocalDate(r.startsAt, spec.timezone) }))
    .filter((e) => compareDates(e.date, from) >= 0);
  const latestExisting = existing.reduce((m, e) => (compareDates(e.date, m) > 0 ? e.date : m), from);
  const horizon = horizonDate(now, spec.timezone, horizonDays);
  const to = compareDates(latestExisting, horizon) > 0 ? latestExisting : horizon;
  const planned = planOccurrences(spec, from, to);
  const plannedByDate = new Map(planned.map((p) => [p.date, p]));
  const existingByDate = new Map<string, (typeof existing)[number][]>();
  for (const e of existing) existingByDate.set(e.date, [...(existingByDate.get(e.date) ?? []), e]);

  const affected: string[] = [];
  let changed = 0;

  for (const [date, group] of existingByDate) {
    const plan = plannedByDate.get(date);
    for (const e of group) {
      if (e.row.status !== 'scheduled') continue;
      if (!plan) {
        await db
          .update(occurrences)
          .set({ status: 'cancelled', updatedAt: now })
          .where(eq(occurrences.id, e.row.id));
        affected.push(e.row.id);
        changed += 1;
      } else if (
        e.row.startsAt.getTime() !== plan.startsAt.getTime() ||
        e.row.endsAt.getTime() !== plan.endsAt.getTime()
      ) {
        await db
          .update(occurrences)
          .set({ startsAt: plan.startsAt, endsAt: plan.endsAt, updatedAt: now })
          .where(eq(occurrences.id, e.row.id));
        affected.push(e.row.id);
        changed += 1;
      }
    }
  }

  const toInsert = planned.filter((p) => !existingByDate.has(p.date));
  if (toInsert.length) {
    const inserted = await db
      .insert(occurrences)
      .values(toInsert.map((p) => ({ sessionId, startsAt: p.startsAt, endsAt: p.endsAt })))
      .onConflictDoNothing({ target: [occurrences.sessionId, occurrences.startsAt] })
      .returning({ id: occurrences.id });
    changed += inserted.length;
    affected.push(...inserted.map((i) => i.id));
  }
  return { changed, affectedIds: affected };
}

/** Cancels every future scheduled occurrence of a session (used when the session is cancelled). */
export async function cancelFutureOccurrences(db: Db, sessionId: string, now: Date): Promise<string[]> {
  const rows = await db
    .update(occurrences)
    .set({ status: 'cancelled', updatedAt: now })
    .where(
      and(
        eq(occurrences.sessionId, sessionId),
        eq(occurrences.status, 'scheduled'),
        gte(occurrences.endsAt, now),
      ),
    )
    .returning({ id: occurrences.id });
  return rows.map((r) => r.id);
}

