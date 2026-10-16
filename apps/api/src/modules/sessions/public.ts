import {
  and,
  arrayOverlaps,
  asc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lte,
  ne,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import type { Occurrence, OccurrenceWithSession, Session, SessionListQuery } from '@qc/contracts';
import { schema, type Db } from '../../db';
import { fail } from '../shared/errors';
import { likePattern, venueLat, venueLng } from '../shared/mappers';
import { decodeOffsetCursor, offsetPage, type Page } from '../shared/pagination';
import { topUpOccurrences, type ScheduleSpec } from './occurrences';
import { loadSessions, selectSessionRecords, toOccurrence, toPublicSession } from './views';
import { toLocalTime } from '../shared/time';

const { sessions, venues, areas, programs, circles, occurrences } = schema;

/** Sessions the public may see: published, at an active venue, and not tied to an unapproved circle. */
export const publicSessionConditions = (): SQL[] => [
  eq(sessions.status, 'published'),
  eq(venues.status, 'active'),
  or(isNull(sessions.circleId), eq(circles.status, 'published')) as SQL,
];

type Filters = Pick<
  SessionListQuery,
  | 'cityId'
  | 'areaId'
  | 'venueId'
  | 'circleId'
  | 'program'
  | 'kind'
  | 'section'
  | 'language'
  | 'dayOfWeek'
  | 'timeFrom'
  | 'timeTo'
  | 'q'
>;

export function filterConditions(f: Filters): SQL[] {
  const c: SQL[] = [];
  if (f.cityId) c.push(eq(venues.cityId, f.cityId));
  if (f.areaId) c.push(eq(venues.areaId, f.areaId));
  if (f.venueId) c.push(eq(sessions.venueId, f.venueId));
  if (f.circleId) c.push(eq(sessions.circleId, f.circleId));
  if (f.program) c.push(eq(programs.key, f.program));
  if (f.kind) c.push(eq(sessions.kind, f.kind));
  if (f.section) c.push(eq(sessions.section, f.section));
  if (f.language) c.push(eq(sessions.language, f.language));
  if (f.dayOfWeek?.length) {
    // A recurring session matches on its days; a one-off lecture on the day of its date.
    c.push(
      or(
        arrayOverlaps(sessions.daysOfWeek, f.dayOfWeek),
        and(
          eq(sessions.kind, 'one_off'),
          inArray(sql<number>`extract(dow from ${sessions.startsOn}::date)::int`, f.dayOfWeek),
        ),
      ) as SQL,
    );
  }
  if (f.timeFrom) c.push(gte(sessions.localStartTime, f.timeFrom));
  if (f.timeTo) c.push(lte(sessions.localStartTime, f.timeTo));
  if (f.q) {
    const p = likePattern(f.q);
    c.push(
      or(
        ilike(sessions.titleEn, p),
        ilike(sessions.titleUr, p),
        ilike(venues.nameEn, p),
        ilike(venues.nameUr, p),
      ) as SQL,
    );
  }
  return c;
}

export const distanceKm = (lat: number, lng: number) =>
  sql<number>`(6371 * acos(least(1, greatest(-1,
    cos(radians(${lat})) * cos(radians(${venueLat})) * cos(radians(${venueLng}) - radians(${lng}))
    + sin(radians(${lat})) * sin(radians(${venueLat}))))))`;

const nextStart = (now: Date) =>
  sql`(select min(o.starts_at) from occurrences o where o.session_id = ${sessions.id}
    and o.status = 'scheduled' and o.ends_at >= ${now.toISOString()}::timestamptz)`;

export async function listPublicSessions(
  db: Db,
  now: Date,
  query: SessionListQuery,
): Promise<Page<Session>> {
  const offset = decodeOffsetCursor(query.cursor);
  const order =
    query.lat !== undefined && query.lng !== undefined
      ? [
          asc(distanceKm(query.lat, query.lng)),
          sql`${nextStart(now)} asc nulls last`,
          asc(sessions.id),
        ]
      : [sql`${nextStart(now)} asc nulls last`, asc(sessions.id)];
  const ids = await db
    .select({ id: sessions.id })
    .from(sessions)
    .innerJoin(venues, eq(venues.id, sessions.venueId))
    .innerJoin(areas, eq(areas.id, venues.areaId))
    .innerJoin(programs, eq(programs.id, sessions.programId))
    .leftJoin(circles, eq(circles.id, sessions.circleId))
    .where(and(...publicSessionConditions(), ...filterConditions(query)))
    .orderBy(...order)
    .limit(query.limit + 1)
    .offset(offset);
  const page = offsetPage(ids, query.limit, offset);
  const views = await loadSessions(
    db,
    page.items.map((r) => r.id),
    now,
  );
  return { items: views.map(toPublicSession), nextCursor: page.nextCursor };
}

/** A published, publicly visible session, or `not_found`. */
export async function getPublicSession(db: Db, now: Date, sessionId: string): Promise<Session> {
  const [visible] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .innerJoin(venues, eq(venues.id, sessions.venueId))
    .leftJoin(circles, eq(circles.id, sessions.circleId))
    .where(and(eq(sessions.id, sessionId), ...publicSessionConditions()));
  if (!visible) return fail('not_found');
  const [view] = await loadSessions(db, [sessionId], now);
  if (!view) return fail('not_found');
  return toPublicSession(view);
}

export function specOf(s: typeof sessions.$inferSelect): ScheduleSpec {
  return {
    kind: s.kind,
    localStartTime: toLocalTime(s.localStartTime),
    durationMinutes: s.durationMinutes,
    daysOfWeek: s.daysOfWeek,
    startsOn: s.startsOn,
    endsOn: s.endsOn,
    timezone: s.timezone,
  };
}

export async function getPublicOccurrences(
  db: Db,
  now: Date,
  horizonDays: number,
  sessionId: string,
  query: { from?: string | undefined; to?: string | undefined; limit: number },
): Promise<{ items: Occurrence[] }> {
  const [row] = await selectSessionRecords(db)
    .leftJoin(circles, eq(circles.id, sessions.circleId))
    .where(and(eq(sessions.id, sessionId), ...publicSessionConditions()));
  if (!row) return fail('not_found');
  await topUpOccurrences(db, sessionId, specOf(row.s), now, horizonDays);
  const from = query.from ? new Date(query.from) : now;
  const rows = await db
    .select()
    .from(occurrences)
    .where(
      and(
        eq(occurrences.sessionId, sessionId),
        gte(occurrences.endsAt, from),
        query.to ? lte(occurrences.startsAt, new Date(query.to)) : undefined,
      ),
    )
    .orderBy(asc(occurrences.startsAt))
    .limit(query.limit);
  return { items: rows.map(toOccurrence) };
}

export async function listPublicOccurrences(
  db: Db,
  now: Date,
  query: {
    cursor?: string | undefined;
    limit: number;
    from?: string | undefined;
    to?: string | undefined;
    includeCancelled?: boolean | undefined;
    lat?: number | undefined;
    lng?: number | undefined;
  } & Filters,
): Promise<Page<OccurrenceWithSession>> {
  const offset = decodeOffsetCursor(query.cursor);
  const from = query.from ? new Date(query.from) : now;
  const conditions = [
    ...publicSessionConditions(),
    ...filterConditions(query),
    gte(occurrences.endsAt, from),
    query.to ? lte(occurrences.startsAt, new Date(query.to)) : undefined,
    query.includeCancelled ? undefined : ne(occurrences.status, 'cancelled'),
  ];
  const order =
    query.lat !== undefined && query.lng !== undefined
      ? [asc(distanceKm(query.lat, query.lng)), asc(occurrences.startsAt), asc(occurrences.id)]
      : [asc(occurrences.startsAt), asc(occurrences.id)];
  const rows = await db
    .select({ occurrence: occurrences })
    .from(occurrences)
    .innerJoin(sessions, eq(sessions.id, occurrences.sessionId))
    .innerJoin(venues, eq(venues.id, sessions.venueId))
    .innerJoin(areas, eq(areas.id, venues.areaId))
    .innerJoin(programs, eq(programs.id, sessions.programId))
    .leftJoin(circles, eq(circles.id, sessions.circleId))
    .where(and(...conditions))
    .orderBy(...order)
    .limit(query.limit + 1)
    .offset(offset);
  const page = offsetPage(rows, query.limit, offset);
  return {
    items: await withSessions(
      db,
      now,
      page.items.map((r) => r.occurrence),
    ),
    nextCursor: page.nextCursor,
  };
}

async function withSessions(
  db: Db,
  now: Date,
  rows: (typeof occurrences.$inferSelect)[],
): Promise<OccurrenceWithSession[]> {
  const views = await loadSessions(
    db,
    rows.map((r) => r.sessionId),
    now,
  );
  const bySession = new Map(views.map((v) => [v.id, toPublicSession(v)]));
  return rows.flatMap((r) => {
    const session = bySession.get(r.sessionId);
    return session ? [{ ...toOccurrence(r), session }] : [];
  });
}

export async function getPublicOccurrence(
  db: Db,
  now: Date,
  occurrenceId: string,
): Promise<OccurrenceWithSession> {
  const [row] = await db
    .select({ occurrence: occurrences })
    .from(occurrences)
    .innerJoin(sessions, eq(sessions.id, occurrences.sessionId))
    .innerJoin(venues, eq(venues.id, sessions.venueId))
    .leftJoin(circles, eq(circles.id, sessions.circleId))
    .where(and(eq(occurrences.id, occurrenceId), ...publicSessionConditions()));
  if (!row) return fail('not_found');
  const [item] = await withSessions(db, now, [row.occurrence]);
  if (!item) return fail('not_found');
  return item;
}
