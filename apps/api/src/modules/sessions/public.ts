import {
  and,
  arrayOverlaps,
  asc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  ne,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import type { Occurrence, OccurrenceWithSession, Session, SessionListQuery } from '@qc/contracts';
import type { PgSelect } from 'drizzle-orm/pg-core';
import { schema, type Db } from '../../db';
import { fail } from '../shared/errors';
import { likePattern, venueLat, venueLng } from '../shared/mappers';
import { decodeOffsetCursor, offsetPage, type Page } from '../shared/pagination';
import { topUpOccurrences, withSeasonEnd, type ScheduleSpec } from './occurrences';
import {
  loadSessions,
  occurrenceStartFloor,
  publicSessionConditions,
  toOccurrence,
  toPublicSession,
} from './views';
import { toLocalTime } from '../shared/time';

const { sessions, venues, areas, programs, circles, occurrences, seasons } = schema;

export { publicSessionConditions };

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

/** When a session next starts (its first scheduled occurrence not yet over), or NULL. */
const nextStart = (sessionId: SQL | typeof sessions.id, now: Date) =>
  sql`(select min(o.starts_at) from ${occurrences} o where o.session_id = ${sessionId}
    and o.status = 'scheduled' and o.ends_at >= ${now.toISOString()}::timestamptz
    and o.starts_at >= ${occurrenceStartFloor(now)})`;

/**
 * Load test, Gate 5: the joins a list needs and no more. `areas` only feeds the distance (a
 * venue without its own position falls back to its area's) and `programs` only the program
 * filter. Both are inner joins on NOT NULL foreign keys, so leaving them out changes no result,
 * and each join less is planning time saved on every call.
 */
function withListJoins<T extends PgSelect>(
  query: T,
  needs: { distance: boolean; program: boolean },
): T {
  // The callers select explicit fields, so a join adds tables to the FROM clause and nothing to
  // the result's type; the casts only tell TypeScript so.
  let q: PgSelect = query.innerJoin(venues, eq(venues.id, sessions.venueId));
  if (needs.distance) q = q.innerJoin(areas, eq(areas.id, venues.areaId));
  if (needs.program) q = q.innerJoin(programs, eq(programs.id, sessions.programId));
  return q.leftJoin(circles, eq(circles.id, sessions.circleId)) as unknown as T;
}

export async function listPublicSessions(
  db: Db,
  now: Date,
  query: SessionListQuery,
): Promise<Page<Session>> {
  const offset = decodeOffsetCursor(query.cursor);
  const where = and(...publicSessionConditions(), ...filterConditions(query));
  const program = query.program !== undefined;
  let ids: { id: string }[];
  if (query.lat !== undefined && query.lng !== undefined) {
    // Nearest first, then the soonest start, then id. The next start costs a lookup per session,
    // so it is worked out only for the sessions that can reach this page: those no farther than
    // the (offset + limit + 1)-th nearest. Distance leads the order, so that set holds every row
    // the full ordering would put on the page, and the result is the same (load test, Gate 5).
    const base = db.$with('nearby').as(
      withListJoins(
        db
          .select({
            id: sessions.id,
            dist: sql<number>`${distanceKm(query.lat, query.lng)}`.as('dist'),
          })
          .from(sessions)
          .$dynamic(),
        { distance: true, program },
      ).where(where),
    );
    const reach = offset + query.limit + 1;
    const cutoff = sql`coalesce((select ${base.dist} from ${base} order by ${base.dist}
      offset ${reach - 1} limit 1), 'Infinity'::float8)`;
    ids = await db
      .with(base)
      .select({ id: base.id })
      .from(base)
      .where(lte(base.dist, cutoff))
      .orderBy(asc(base.dist), sql`${nextStart(sql`${base.id}`, now)} asc nulls last`, asc(base.id))
      .limit(query.limit + 1)
      .offset(offset);
  } else {
    ids = await withListJoins(db.select({ id: sessions.id }).from(sessions).$dynamic(), {
      distance: false,
      program,
    })
      .where(where)
      .orderBy(sql`${nextStart(sessions.id, now)} asc nulls last`, asc(sessions.id))
      .limit(query.limit + 1)
      .offset(offset);
  }
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
  const [view] = await loadSessions(db, [sessionId], now, { publicOnly: true });
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

/** How close the stored schedule may come to running out before a public read tops it up. */
export const OCCURRENCE_LAPSE_DAYS = 7;

/**
 * SEC-24: a public read does not write. The worker tops every recurring session up to the horizon
 * each day (`topUpAllOccurrences`), so the stored schedule normally runs about 90 days ahead and
 * this only reads the latest occurrence. It tops up here only as a fallback, when the stored
 * schedule has lapsed to within `OCCURRENCE_LAPSE_DAYS` of now (the daily job has not run for
 * weeks); one top-up restores the horizon, so later reads go back to reading only. A session whose
 * own end date is near plans nothing, so the fallback reads but writes nothing for it. A session in
 * a season stops at the season's last day, exactly as in the daily job (`withSeasonEnd`).
 */
async function topUpIfLapsed(
  db: Db,
  row: typeof sessions.$inferSelect,
  seasonEndsOn: string | null,
  latestStartsAt: Date | null,
  now: Date,
  horizonDays: number,
): Promise<void> {
  if (row.kind !== 'recurring') return;
  const lapseDays = Math.min(OCCURRENCE_LAPSE_DAYS, horizonDays);
  const lapsesAt = now.getTime() + lapseDays * 24 * 60 * 60 * 1000;
  if (latestStartsAt && latestStartsAt.getTime() >= lapsesAt) return;
  await topUpOccurrences(db, row.id, withSeasonEnd(specOf(row), seasonEndsOn), now, horizonDays);
}

export async function getPublicOccurrences(
  db: Db,
  now: Date,
  horizonDays: number,
  sessionId: string,
  query: { from?: string | undefined; to?: string | undefined; limit: number },
): Promise<{ items: Occurrence[] }> {
  // The visibility check and the latest stored occurrence (for the lapse fallback) in one
  // statement (load test, Gate 5: it was two).
  const [row] = await db
    .select({
      s: sessions,
      seasonEndsOn: sql<string | null>`(select se.ends_on::text from ${seasons} se
        where se.id = ${sessions.seasonId})`,
      latestStartsAt: sql<Date | null>`(select max(o.starts_at) from ${occurrences} o
        where o.session_id = ${sessions.id})`.mapWith(occurrences.startsAt),
    })
    .from(sessions)
    .innerJoin(venues, eq(venues.id, sessions.venueId))
    .leftJoin(circles, eq(circles.id, sessions.circleId))
    .where(and(eq(sessions.id, sessionId), ...publicSessionConditions()));
  if (!row) return fail('not_found');
  await topUpIfLapsed(db, row.s, row.seasonEndsOn, row.latestStartsAt, now, horizonDays);
  const from = query.from ? new Date(query.from) : now;
  const rows = await db
    .select()
    .from(occurrences)
    .where(
      and(
        eq(occurrences.sessionId, sessionId),
        gte(occurrences.endsAt, from),
        gte(occurrences.startsAt, occurrenceStartFloor(from)),
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
    // Exact, and lets the starts_at index skip every occurrence that is long over.
    gte(occurrences.startsAt, occurrenceStartFloor(from)),
    query.to ? lte(occurrences.startsAt, new Date(query.to)) : undefined,
    query.includeCancelled ? undefined : ne(occurrences.status, 'cancelled'),
  ];
  const distance = query.lat !== undefined && query.lng !== undefined;
  const order =
    query.lat !== undefined && query.lng !== undefined
      ? [asc(distanceKm(query.lat, query.lng)), asc(occurrences.startsAt), asc(occurrences.id)]
      : [asc(occurrences.startsAt), asc(occurrences.id)];
  const rows = await withListJoins(
    db
      .select({ occurrence: occurrences })
      .from(occurrences)
      .innerJoin(sessions, eq(sessions.id, occurrences.sessionId))
      .$dynamic(),
    { distance, program: query.program !== undefined },
  )
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
