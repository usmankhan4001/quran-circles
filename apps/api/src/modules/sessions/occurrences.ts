import { and, eq, gte } from 'drizzle-orm';
import {
  horizonDate,
  insertPlanned,
  planOccurrences,
  topUpOccurrences,
  withSeasonEnd,
  type PlannedOccurrence,
  type ScheduleSpec,
} from '@qc/db';
import { schema, type Db } from '../../db';
import { compareDates, utcToLocalDate } from '../shared/time';

const { occurrences } = schema;

/**
 * The planner (`planOccurrences`, `horizonDate`, `insertPlanned`) and the lazy per-session
 * `topUpOccurrences` live in `@qc/db`, shared with the worker's daily job, so the API and the
 * worker always plan the same dates. What stays here is API-only: creating a new session's
 * occurrences, schedule changes and cancellation.
 */
export { horizonDate, insertPlanned, planOccurrences, topUpOccurrences, withSeasonEnd };
export type { PlannedOccurrence, ScheduleSpec };

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
  const latestExisting = existing.reduce(
    (m, e) => (compareDates(e.date, m) > 0 ? e.date : m),
    from,
  );
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
export async function cancelFutureOccurrences(
  db: Db,
  sessionId: string,
  now: Date,
): Promise<string[]> {
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
