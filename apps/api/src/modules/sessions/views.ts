import { and, asc, eq, gte, inArray, isNull, or, sql, type SQL } from 'drizzle-orm';
import {
  Portion,
  type AdminOccurrence,
  type AdminSession,
  type Occurrence,
  type Session,
} from '@qc/contracts';
import { schema, type Db } from '../../db';
import { localized, toVenueSummary, venueColumns } from '../shared/mappers';
import { toLocalTime } from '../shared/time';

const { sessions, venues, areas, programs, circles, registrations, occurrences } = schema;

export type OccurrenceRow = typeof occurrences.$inferSelect;

export function toOccurrence(row: OccurrenceRow): Occurrence {
  const portion = row.portion ? Portion.safeParse(row.portion) : null;
  return {
    id: row.id,
    sessionId: row.sessionId,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    status: row.status,
    portion: portion?.success ? portion.data : null,
    portionLabel: row.portionLabel,
    recapNote: row.recapNote,
    recapLocale: row.recapLocale,
  };
}

export const toAdminOccurrence = (row: OccurrenceRow): AdminOccurrence => ({
  ...toOccurrence(row),
  headcount: row.headcount,
});

/** Joined session, venue and program rows, the input to every session view. */
export const selectSessionRecords = (db: Db) =>
  db
    .select({ s: sessions, venue: venueColumns, programKey: programs.key })
    .from(sessions)
    .innerJoin(venues, eq(venues.id, sessions.venueId))
    .innerJoin(areas, eq(areas.id, venues.areaId))
    .innerJoin(programs, eq(programs.id, sessions.programId));

export type SessionRecord = Awaited<ReturnType<typeof selectSessionRecords>>[number];

/** Sessions the public may see: published, at an active venue, and not tied to an unapproved circle. */
export const publicSessionConditions = (): SQL[] => [
  eq(sessions.status, 'published'),
  eq(venues.status, 'active'),
  or(isNull(sessions.circleId), eq(circles.status, 'published')) as SQL,
];

/**
 * The earliest `starts_at` an occurrence still running at or after `from` can have, for an exact
 * lower bound on `starts_at` next to `ends_at >= from` (load test, Gate 5). Without it, every read
 * of upcoming occurrences walks the `starts_at` index through all past occurrences, which grow by
 * one per session per day. A generated occurrence lasts at most a day (the session's duration is
 * 1 to 1,440 minutes), so `from - 1 day` bounds it; an occurrence an organiser stretched past a
 * day is found through the partial index `occurrences_multiday_starts_idx` (migration 0012), which
 * holds only those. `least` ignores the NULL when there are none.
 */
export const occurrenceStartFloor = (from: Date): SQL =>
  sql`least(${from}::timestamptz - interval '1 day', (select min(l.starts_at) from ${occurrences} l
    where l.ends_at - l.starts_at > interval '1 day' and l.ends_at >= ${from}::timestamptz))`;

/**
 * Builds the contract's session view for each id, in the order given. Missing ids are skipped.
 * Seats, circles and next occurrences are loaded in batches, not one query per session.
 */
export async function loadSessions(
  db: Db,
  ids: readonly string[],
  now: Date,
  options: { publicOnly?: boolean } = {},
): Promise<AdminSession[]> {
  if (ids.length === 0) return [];
  const unique = [...new Set(ids)];
  // One statement for the session, venue and program rows, the seats taken and the next
  // occurrence (load test, Gate 5: it was three, on every list, detail and registration read).
  const next = db
    .select()
    .from(occurrences)
    .where(
      and(
        eq(occurrences.sessionId, sessions.id),
        eq(occurrences.status, 'scheduled'),
        gte(occurrences.endsAt, now),
        gte(occurrences.startsAt, occurrenceStartFloor(now)),
      ),
    )
    .orderBy(asc(occurrences.startsAt))
    .limit(1)
    .as('next_occurrence');
  const seats = sql<number>`(select coalesce(sum(r.party_size), 0) from ${registrations} r
    where r.session_id = ${sessions.id} and r.status = 'confirmed')`.mapWith(Number);
  const base = db
    .select({
      s: sessions,
      venue: venueColumns,
      programKey: programs.key,
      seats,
      next: {
        id: next.id,
        sessionId: next.sessionId,
        startsAt: next.startsAt,
        endsAt: next.endsAt,
        status: next.status,
        portion: next.portion,
        portionLabel: next.portionLabel,
        recapNote: next.recapNote,
        recapLocale: next.recapLocale,
        headcount: next.headcount,
        createdAt: next.createdAt,
        updatedAt: next.updatedAt,
      },
    })
    .from(sessions)
    .innerJoin(venues, eq(venues.id, sessions.venueId))
    .innerJoin(areas, eq(areas.id, venues.areaId))
    .innerJoin(programs, eq(programs.id, sessions.programId))
    .leftJoinLateral(next, sql`true`)
    .$dynamic();
  // `publicOnly`: the public visibility check in the same statement (it was one more query).
  const records = options.publicOnly
    ? await base
        .leftJoin(circles, eq(circles.id, sessions.circleId))
        .where(and(inArray(sessions.id, unique), ...publicSessionConditions()))
    : await base.where(inArray(sessions.id, unique));
  const circleIds = [...new Set(records.flatMap((r) => (r.s.circleId ? [r.s.circleId] : [])))];

  // Never Promise.all: `db` may be a transaction (registration, schedule change), whose single
  // client runs one query at a time (F-02).
  const circleRows = circleIds.length
    ? await db.select().from(circles).where(inArray(circles.id, circleIds))
    : [];
  const circleById = new Map(circleRows.map((c) => [c.id, c]));
  const recordById = new Map(records.map((r) => [r.s.id, r]));

  const out: AdminSession[] = [];
  for (const id of ids) {
    const record = recordById.get(id);
    if (!record) continue;
    const { s, venue } = record;
    const circle = s.circleId ? (circleById.get(s.circleId) ?? null) : null;
    const seats = record.seats;
    const capacity = s.capacityEnabled ? s.capacity : null;
    const next = record.next;
    out.push({
      id: s.id,
      program: record.programKey,
      seasonId: s.seasonId,
      venueId: s.venueId,
      cityId: venue.cityId,
      areaId: venue.areaId,
      venue: toVenueSummary(venue as never),
      circle: circle
        ? {
            id: circle.id,
            name: localized(circle.nameEn, circle.nameUr),
            teacherName: circle.teacherName,
            onlineLink: circle.onlineLink,
          }
        : null,
      kind: s.kind,
      title: localized(s.titleEn, s.titleUr),
      description: s.descriptionEn ? localized(s.descriptionEn, s.descriptionUr) : null,
      section: s.section,
      language: s.language,
      localStartTime: toLocalTime(s.localStartTime),
      durationMinutes: s.durationMinutes,
      daysOfWeek: [...s.daysOfWeek].sort((a, b) => a - b),
      startsOn: s.startsOn,
      endsOn: s.endsOn,
      timezone: s.timezone,
      registration: {
        enabled: s.registrationEnabled,
        capacity,
        seatsTaken: capacity === null ? null : seats,
        full: capacity !== null && seats >= capacity,
      },
      status: s.status,
      nextOccurrence: next ? toOccurrence(next) : null,
      circleStatus: circle?.status ?? null,
    });
  }
  return out;
}

/** The public shape: the same view without admin-only fields. */
export const toPublicSession = (s: AdminSession): Session => {
  const copy: Omit<AdminSession, 'circleStatus'> & { circleStatus?: unknown } = { ...s };
  delete copy.circleStatus;
  return copy;
};
