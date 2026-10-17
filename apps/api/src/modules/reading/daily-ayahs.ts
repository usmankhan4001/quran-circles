import { and, eq, gte, inArray, lte, or, sql, type SQL } from 'drizzle-orm';
import {
  DAILY_AYAH_SCOPES,
  dailyAyahResource,
  pakistanDate,
  readingRangeIssue,
  resolveDailyAyah,
  type AyahOfTheDay,
  type DailyAyahEntry,
  type DailyAyahPut,
  type DailyAyahScope,
  type ResourceScope,
  type ScopeAction,
  type ScopeFilter,
} from '@qc/contracts';
import { schema, type Db } from '../../db';
import { nationalScope, venueScope, writeAudit, type AuditScope } from '../shared/audit';
import { fail } from '../shared/errors';

const { dailyAyahs, venues, circles } = schema;

type DailyAyahRow = typeof dailyAyahs.$inferSelect;

const ACTION: ScopeAction = 'daily_ayah.manage';

/** The decisions a pick handler needs from the request (`HandlerCtx`). */
export interface PickGuard {
  authorize(action: ScopeAction, resource?: ResourceScope): void;
  unknownRef(action: ScopeAction): never;
  missing(action: ScopeAction): never;
}

const SCOPE_ORDER = new Map<DailyAyahScope, number>(DAILY_AYAH_SCOPES.map((s, i) => [s, i]));

const toEntry = (row: DailyAyahRow): DailyAyahEntry => ({
  id: row.id,
  date: row.day,
  scopeType: row.scopeType,
  cityId: row.cityId,
  venueId: row.venueId,
  circleId: row.circleId,
  surah: row.surah,
  ayah: row.ayah,
  updatedAt: row.updatedAt.toISOString(),
});

/** The venue a stored pick is checked at: its own venue, or the circle's venue. */
const placeOf = (row: Pick<DailyAyahRow, 'cityId' | 'venueId'>) =>
  row.cityId && row.venueId ? { cityId: row.cityId, venueId: row.venueId } : null;

const auditScopeOf = (place: { cityId: string; venueId: string } | null): AuditScope =>
  place ? venueScope({ id: place.venueId, cityId: place.cityId }) : nationalScope;

interface ResolvedTarget {
  scopeType: DailyAyahScope;
  cityId: string | null;
  venueId: string | null;
  circleId: string | null;
}

/** Looks up the venue or circle a pick is for; an unknown one is `not_found` for staff. */
async function resolveTarget(
  db: Db,
  guard: PickGuard,
  scope: DailyAyahPut['scope'],
): Promise<ResolvedTarget> {
  if (scope.type === 'national') {
    return { scopeType: 'national', cityId: null, venueId: null, circleId: null };
  }
  if (scope.type === 'venue') {
    const [venue] = await db
      .select({ id: venues.id, cityId: venues.cityId })
      .from(venues)
      .where(eq(venues.id, scope.venueId));
    if (!venue) return guard.unknownRef(ACTION);
    return { scopeType: 'venue', cityId: venue.cityId, venueId: venue.id, circleId: null };
  }
  const [circle] = await db
    .select({ id: circles.id, venueId: circles.venueId, cityId: venues.cityId })
    .from(circles)
    .innerJoin(venues, eq(venues.id, circles.venueId))
    .where(eq(circles.id, scope.circleId));
  if (!circle) return guard.unknownRef(ACTION);
  return {
    scopeType: 'circle',
    cityId: circle.cityId,
    venueId: circle.venueId,
    circleId: circle.id,
  };
}

/**
 * `PUT /v1/admin/daily-ayahs`: sets or replaces the pick for one date and scope. Authorised at
 * `dailyAyahResource` (a national pick needs a national admin; a circle pick is checked at its
 * venue). Records who set it and writes one audit row when something changed.
 */
export async function putDailyAyah(
  db: Db,
  guard: PickGuard,
  actorId: string,
  now: Date,
  body: DailyAyahPut,
): Promise<DailyAyahEntry> {
  const target = await resolveTarget(db, guard, body.scope);
  const place = placeOf(target);
  guard.authorize(ACTION, dailyAyahResource(target.scopeType, place));

  return db.transaction(async (tx) => {
    // One writer per date and scope, so two first-time puts cannot both insert.
    const key = `daily_ayah:${body.date}:${target.scopeType}:${target.circleId ?? target.venueId ?? ''}`;
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${key}))`);

    const placeCondition =
      target.scopeType === 'circle' && target.circleId
        ? eq(dailyAyahs.circleId, target.circleId)
        : target.scopeType === 'venue' && target.venueId
          ? eq(dailyAyahs.venueId, target.venueId)
          : undefined;
    const [existing] = await tx
      .select()
      .from(dailyAyahs)
      .where(
        and(
          eq(dailyAyahs.day, body.date),
          eq(dailyAyahs.scopeType, target.scopeType),
          placeCondition,
        ),
      );

    if (existing && existing.surah === body.surah && existing.ayah === body.ayah) {
      return toEntry(existing);
    }

    let row: DailyAyahRow | undefined;
    if (existing) {
      [row] = await tx
        .update(dailyAyahs)
        .set({ surah: body.surah, ayah: body.ayah, setBy: actorId, updatedAt: now })
        .where(eq(dailyAyahs.id, existing.id))
        .returning();
    } else {
      [row] = await tx
        .insert(dailyAyahs)
        .values({
          day: body.date,
          scopeType: target.scopeType,
          cityId: target.cityId,
          venueId: target.venueId,
          circleId: target.circleId,
          surah: body.surah,
          ayah: body.ayah,
          setBy: actorId,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
    }
    if (!row) return fail('internal_error');

    await writeAudit(tx, {
      actorUserId: actorId,
      action: 'daily_ayah.set',
      entityType: 'daily_ayah',
      entityId: row.id,
      scope: auditScopeOf(place),
      meta: {
        date: row.day,
        scopeType: row.scopeType,
        circleId: row.circleId,
        surah: row.surah,
        ayah: row.ayah,
        replaced: existing !== undefined,
      },
    });
    return toEntry(row);
  });
}

/** `DELETE /v1/admin/daily-ayahs/{id}`: checked like a put for the pick's scope. */
export async function deleteDailyAyah(
  db: Db,
  guard: PickGuard,
  actorId: string,
  id: string,
): Promise<void> {
  const [row] = await db.select().from(dailyAyahs).where(eq(dailyAyahs.id, id));
  if (!row) return guard.missing(ACTION);
  const place = placeOf(row);
  guard.authorize(ACTION, dailyAyahResource(row.scopeType, place));

  await db.transaction(async (tx) => {
    const removed = await tx
      .delete(dailyAyahs)
      .where(eq(dailyAyahs.id, row.id))
      .returning({ id: dailyAyahs.id });
    // Someone else removed it in between: nothing changed, so nothing to audit.
    if (removed.length === 0) return;
    await writeAudit(tx, {
      actorUserId: actorId,
      action: 'daily_ayah.delete',
      entityType: 'daily_ayah',
      entityId: row.id,
      scope: auditScopeOf(place),
      meta: {
        date: row.day,
        scopeType: row.scopeType,
        circleId: row.circleId,
        surah: row.surah,
        ayah: row.ayah,
      },
    });
  });
}

export interface AdminDailyAyahsQuery {
  from: string;
  to: string;
  scopeType?: DailyAyahScope;
  venueId?: string;
  circleId?: string;
}

/**
 * `GET /v1/admin/daily-ayahs`: national picks for every staff caller, venue and circle picks in
 * the caller's `scopeFilter`. A venue or circle filter that names nothing (or a place out of
 * scope) simply matches no picks: the endpoint has no `not_found`.
 */
export async function listDailyAyahs(
  db: Db,
  filter: ScopeFilter,
  q: AdminDailyAyahsQuery,
): Promise<{ items: DailyAyahEntry[] }> {
  const issue = readingRangeIssue(q);
  if (issue) fail('validation_failed', { issues: [issue] });

  const visible: (SQL | undefined)[] = [eq(dailyAyahs.scopeType, 'national')];
  if (filter.cityIds.length) visible.push(inArray(dailyAyahs.cityId, filter.cityIds));
  if (filter.venueIds.length) visible.push(inArray(dailyAyahs.venueId, filter.venueIds));

  const rows = await db
    .select()
    .from(dailyAyahs)
    .where(
      and(
        gte(dailyAyahs.day, q.from),
        lte(dailyAyahs.day, q.to),
        q.scopeType ? eq(dailyAyahs.scopeType, q.scopeType) : undefined,
        q.venueId ? eq(dailyAyahs.venueId, q.venueId) : undefined,
        q.circleId ? eq(dailyAyahs.circleId, q.circleId) : undefined,
        filter.national ? undefined : or(...visible),
      ),
    );
  rows.sort(
    (a, b) =>
      a.day.localeCompare(b.day) ||
      (SCOPE_ORDER.get(a.scopeType) ?? 0) - (SCOPE_ORDER.get(b.scopeType) ?? 0) ||
      a.id.localeCompare(b.id),
  );
  return { items: rows.map(toEntry) };
}

/** `GET /v1/ayah-of-the-day`: the picks that could apply that day, through `resolveDailyAyah`. */
export async function ayahOfTheDay(
  db: Db,
  now: Date,
  q: { date?: string; venueId?: string[]; circleId?: string[] },
): Promise<AyahOfTheDay> {
  const date = q.date ?? pakistanDate(now);
  const followedVenueIds = [...new Set(q.venueId ?? [])];
  const followedCircleIds = [...new Set(q.circleId ?? [])];

  const candidates: (SQL | undefined)[] = [eq(dailyAyahs.scopeType, 'national')];
  if (followedVenueIds.length) {
    candidates.push(
      and(eq(dailyAyahs.scopeType, 'venue'), inArray(dailyAyahs.venueId, followedVenueIds)),
    );
  }
  if (followedCircleIds.length) {
    candidates.push(
      and(eq(dailyAyahs.scopeType, 'circle'), inArray(dailyAyahs.circleId, followedCircleIds)),
    );
  }
  const picks = await db
    .select({
      date: dailyAyahs.day,
      scopeType: dailyAyahs.scopeType,
      venueId: dailyAyahs.venueId,
      circleId: dailyAyahs.circleId,
      surah: dailyAyahs.surah,
      ayah: dailyAyahs.ayah,
    })
    .from(dailyAyahs)
    .where(and(eq(dailyAyahs.day, date), or(...candidates)));
  return resolveDailyAyah({ date, picks, followedVenueIds, followedCircleIds });
}
