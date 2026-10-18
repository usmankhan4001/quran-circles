import {
  and,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lt,
  lte,
  notExists,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import type { Update } from '@qc/contracts';
import { schema, type Db } from '../../db';
import { fail } from '../shared/errors';
import { localized } from '../shared/mappers';
import { decodeKeyCursor, encodeKeyCursor } from '../shared/pagination';
import { connectedScopes } from './reach';

const { updates, updateReads } = schema;

const CHUNK = 1000;

/**
 * Which cities and venues feed a person's Updates. A city given as a hint only counts when the
 * person is connected to nothing yet, so a new visitor still sees their city's news.
 */
async function feedScopes(db: Db, userId: string, cityHint: string | undefined) {
  const scopes = await connectedScopes(db, userId);
  if (scopes.cityIds.length === 0 && scopes.venueIds.length === 0 && cityHint) {
    return { cityIds: [cityHint], venueIds: [] as string[] };
  }
  return scopes;
}

/** Published, not expired, and in a scope the person is connected to (national reaches everyone). */
function visibleTo(scopes: { cityIds: string[]; venueIds: string[] }, now: Date): SQL {
  const inScope: (SQL | undefined)[] = [eq(updates.scopeType, 'national')];
  if (scopes.cityIds.length) {
    inScope.push(and(eq(updates.scopeType, 'city'), inArray(updates.cityId, scopes.cityIds)));
  }
  if (scopes.venueIds.length) {
    inScope.push(and(eq(updates.scopeType, 'venue'), inArray(updates.venueId, scopes.venueIds)));
  }
  return and(
    lte(updates.publishAt, now),
    or(isNull(updates.expiresAt), gt(updates.expiresAt, now)),
    or(...inScope),
  ) as SQL;
}

const mine = (userId: string) =>
  and(eq(updateReads.updateId, updates.id), eq(updateReads.userId, userId));

/** Microsecond-exact text of the publish time, so a keyset cursor never skips or repeats a row. */
const publishKey = sql<string>`to_char(${updates.publishAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;

const ISO_MICRO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const feedUpdateColumns = {
  id: updates.id,
  kind: updates.kind,
  scopeType: updates.scopeType,
  cityId: updates.cityId,
  venueId: updates.venueId,
  titleEn: updates.titleEn,
  titleUr: updates.titleUr,
  bodyEn: updates.bodyEn,
  bodyUr: updates.bodyUr,
  sessionId: updates.sessionId,
  publishedAt: updates.publishAt,
  publishKey,
};

export type UpdateRecord = {
  id: string;
  kind: Update['kind'];
  scopeType: Update['scope']['type'];
  cityId: string | null;
  venueId: string | null;
  titleEn: string;
  titleUr: string | null;
  bodyEn: string;
  bodyUr: string | null;
  sessionId: string | null;
  publishedAt: Date;
};

export const toUpdateBase = (r: UpdateRecord): Omit<Update, 'isRead'> => ({
  id: r.id,
  kind: r.kind,
  scope: { type: r.scopeType, cityId: r.cityId, venueId: r.venueId },
  title: localized(r.titleEn, r.titleUr),
  body: localized(r.bodyEn, r.bodyUr),
  sessionId: r.sessionId,
  publishedAt: r.publishedAt.toISOString(),
});

const { registrations, sessions, follows, circles, profiles, areas, venues } = schema;

/**
 * The Updates badge in one statement (load test, Gate 5). Same people, scopes and rule as
 * `feedScopes` plus `visibleTo`: the venues a person is connected to (registrations that are not
 * cancelled, followed venues, followed circles' venues), those venues' cities and the home city of
 * their profile, and the city hint only for someone connected to nothing. Postgres works the
 * scopes out inside the count instead of five lookups and a count, one round trip each.
 * `updates.test.ts` checks it against that step-by-step reading.
 */
export async function unreadCount(db: Db, now: Date, userId: string, cityHint?: string) {
  const connectedVenues = sql`(
    select ${sessions.venueId} from ${registrations}
      inner join ${sessions} on ${sessions.id} = ${registrations.sessionId}
     where ${registrations.userId} = ${userId} and ${registrations.status} <> 'cancelled'
    union
    select ${follows.venueId} from ${follows}
     where ${follows.userId} = ${userId} and ${follows.venueId} is not null
    union
    select ${circles.venueId} from ${follows}
      inner join ${circles} on ${circles.id} = ${follows.circleId}
     where ${follows.userId} = ${userId})`;
  const homeCities = sql`(
    select ${areas.cityId} from ${profiles}
      inner join ${areas} on ${areas.id} = ${profiles.areaId}
     where ${profiles.userId} = ${userId})`;
  const connectedCities = sql`(
    select ${venues.cityId} from ${venues} where ${venues.id} in ${connectedVenues}
    union
    ${homeCities})`;
  const hint =
    cityHint === undefined
      ? undefined
      : sql`(${updates.cityId} = ${cityHint}
          and not exists (select 1 from ${connectedVenues} as v)
          and not exists (select 1 from ${homeCities} as h))`;
  const [row] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(updates)
    .where(
      and(
        lte(updates.publishAt, now),
        or(isNull(updates.expiresAt), gt(updates.expiresAt, now)),
        or(
          eq(updates.scopeType, 'national'),
          and(
            eq(updates.scopeType, 'city'),
            or(sql`${updates.cityId} in ${connectedCities}`, hint),
          ),
          and(eq(updates.scopeType, 'venue'), sql`${updates.venueId} in ${connectedVenues}`),
        ),
        notExists(
          db
            .select({ one: sql`1` })
            .from(updateReads)
            .where(and(eq(updateReads.updateId, updates.id), eq(updateReads.userId, userId))),
        ),
      ),
    );
  return row?.n ?? 0;
}

export async function getFeed(
  db: Db,
  now: Date,
  userId: string,
  query: {
    cursor?: string | undefined;
    limit: number;
    unreadOnly?: boolean | undefined;
    cityId?: string | undefined;
  },
) {
  const scopes = await feedScopes(db, userId, query.cityId);
  const key = decodeKeyCursor(query.cursor, 2);
  if (key && (!ISO_MICRO.test(key[0] ?? '') || !UUID.test(key[1] ?? ''))) {
    fail('validation_failed', { issues: [{ path: 'cursor', code: 'invalid_cursor' }] });
  }
  const after = key
    ? or(
        lt(updates.publishAt, sql`${key[0]}::timestamptz`),
        and(eq(updates.publishAt, sql`${key[0]}::timestamptz`), lt(updates.id, key[1] as string)),
      )
    : undefined;
  const rows = await db
    .select({ ...feedUpdateColumns, readAt: updateReads.readAt, readId: updateReads.updateId })
    .from(updates)
    .leftJoin(updateReads, mine(userId))
    .where(
      and(
        visibleTo(scopes, now),
        after,
        query.unreadOnly ? isNull(updateReads.updateId) : undefined,
      ),
    )
    .orderBy(desc(updates.publishAt), desc(updates.id))
    .limit(query.limit + 1);
  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;
  const last = page[page.length - 1];
  return {
    items: page.map((r) => ({ ...toUpdateBase(r), isRead: r.readId !== null })),
    nextCursor: hasMore && last ? encodeKeyCursor(last.publishKey, last.id) : null,
    unreadCount: await unreadCount(db, now, userId, query.cityId),
  };
}

export async function markRead(
  db: Db,
  now: Date,
  userId: string,
  body: { updateIds: string[] } | { all: true },
): Promise<{ unreadCount: number }> {
  const scopes = await feedScopes(db, userId, undefined);
  const visible = visibleTo(scopes, now);
  let ids: string[];
  if ('all' in body) {
    const rows = await db
      .select({ id: updates.id })
      .from(updates)
      .leftJoin(updateReads, mine(userId))
      .where(and(visible, isNull(updateReads.updateId)))
      .limit(5000);
    ids = rows.map((r) => r.id);
  } else {
    // Only items the person can see; ids from elsewhere are ignored, not an error.
    const rows = await db
      .select({ id: updates.id })
      .from(updates)
      .where(and(visible, inArray(updates.id, [...new Set(body.updateIds)])));
    ids = rows.map((r) => r.id);
  }
  for (let i = 0; i < ids.length; i += CHUNK) {
    await db
      .insert(updateReads)
      .values(ids.slice(i, i + CHUNK).map((updateId) => ({ userId, updateId, readAt: now })))
      .onConflictDoNothing();
  }
  return { unreadCount: await unreadCount(db, now, userId) };
}
