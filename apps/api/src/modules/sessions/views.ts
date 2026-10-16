import { and, asc, eq, gte, inArray, sql } from 'drizzle-orm';
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

/**
 * Builds the contract's session view for each id, in the order given. Missing ids are skipped.
 * Seats, circles and next occurrences are loaded in batches, not one query per session.
 */
export async function loadSessions(
  db: Db,
  ids: readonly string[],
  now: Date,
): Promise<AdminSession[]> {
  if (ids.length === 0) return [];
  const unique = [...new Set(ids)];
  const records = await selectSessionRecords(db).where(inArray(sessions.id, unique));
  const circleIds = [...new Set(records.flatMap((r) => (r.s.circleId ? [r.s.circleId] : [])))];

  const [circleRows, seatRows, nextRows] = await Promise.all([
    circleIds.length
      ? db.select().from(circles).where(inArray(circles.id, circleIds))
      : Promise.resolve([]),
    db
      .select({
        sessionId: registrations.sessionId,
        seats: sql<number>`coalesce(sum(${registrations.partySize}), 0)`.mapWith(Number),
      })
      .from(registrations)
      .where(and(inArray(registrations.sessionId, unique), eq(registrations.status, 'confirmed')))
      .groupBy(registrations.sessionId),
    db
      .selectDistinctOn([occurrences.sessionId])
      .from(occurrences)
      .where(
        and(
          inArray(occurrences.sessionId, unique),
          eq(occurrences.status, 'scheduled'),
          gte(occurrences.endsAt, now),
        ),
      )
      .orderBy(asc(occurrences.sessionId), asc(occurrences.startsAt)),
  ]);
  const circleById = new Map(circleRows.map((c) => [c.id, c]));
  const seatsBySession = new Map(seatRows.map((r) => [r.sessionId, r.seats]));
  const nextBySession = new Map(nextRows.map((r) => [r.sessionId, r]));
  const recordById = new Map(records.map((r) => [r.s.id, r]));

  const out: AdminSession[] = [];
  for (const id of ids) {
    const record = recordById.get(id);
    if (!record) continue;
    const { s, venue } = record;
    const circle = s.circleId ? (circleById.get(s.circleId) ?? null) : null;
    const seats = seatsBySession.get(s.id) ?? 0;
    const capacity = s.capacityEnabled ? s.capacity : null;
    const next = nextBySession.get(s.id);
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
  const { circleStatus: _circleStatus, ...rest } = s;
  return rest;
};
