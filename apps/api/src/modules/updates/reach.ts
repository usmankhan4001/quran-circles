import { and, eq, inArray, isNotNull, ne } from 'drizzle-orm';
import { schema, type Db } from '../../db';

const { registrations, sessions, follows, circles, profiles, areas, venues, users } = schema;

export type UpdateScopeRef =
  | { type: 'national' }
  | { type: 'city'; cityId: string }
  | { type: 'venue'; venueId: string; cityId: string };

const uniq = <T>(values: T[]): T[] => [...new Set(values)];

/**
 * Who is connected to a venue: registered for one of its sessions, following it, or following one
 * of its circles. Cancelled registrations do not count.
 */
export async function venueConnectedUserIds(
  db: Db,
  venueIds: readonly string[],
): Promise<string[]> {
  if (venueIds.length === 0) return [];
  const ids = [...venueIds];
  // One after another, here and below: `db` may be a transaction (F-02).
  const registered = await db
    .selectDistinct({ userId: registrations.userId })
    .from(registrations)
    .innerJoin(sessions, eq(sessions.id, registrations.sessionId))
    .where(
      and(
        inArray(sessions.venueId, ids),
        ne(registrations.status, 'cancelled'),
        isNotNull(registrations.userId),
      ),
    );
  const followedVenue = await db
    .selectDistinct({ userId: follows.userId })
    .from(follows)
    .where(inArray(follows.venueId, ids));
  const followedCircle = await db
    .selectDistinct({ userId: follows.userId })
    .from(follows)
    .innerJoin(circles, eq(circles.id, follows.circleId))
    .where(inArray(circles.venueId, ids));
  return uniq([
    ...registered.flatMap((r) => (r.userId ? [r.userId] : [])),
    ...followedVenue.map((r) => r.userId),
    ...followedCircle.map((r) => r.userId),
  ]);
}

/** People in a city: connected to one of its venues, or with their profile area in the city. */
async function cityUserIds(db: Db, cityId: string): Promise<string[]> {
  const cityVenues = await db
    .select({ id: venues.id })
    .from(venues)
    .where(eq(venues.cityId, cityId));
  const connected = await venueConnectedUserIds(
    db,
    cityVenues.map((v) => v.id),
  );
  const inCity = await db
    .selectDistinct({ userId: profiles.userId })
    .from(profiles)
    .innerJoin(areas, eq(areas.id, profiles.areaId))
    .where(eq(areas.cityId, cityId));
  return uniq([...connected, ...inCity.map((r) => r.userId)]);
}

/**
 * The people an update reaches: everyone for a national update; for a city or venue update the
 * people connected to it. Suspended accounts are left out.
 */
export async function reachUserIds(db: Db, scope: UpdateScopeRef): Promise<string[]> {
  let ids: string[];
  if (scope.type === 'national') {
    const rows = await db.select({ id: users.id }).from(users).where(eq(users.status, 'active'));
    return rows.map((r) => r.id);
  }
  if (scope.type === 'city') ids = await cityUserIds(db, scope.cityId);
  else ids = await venueConnectedUserIds(db, [scope.venueId]);
  if (ids.length === 0) return [];
  const active: string[] = [];
  for (let i = 0; i < ids.length; i += 1000) {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(and(inArray(users.id, ids.slice(i, i + 1000)), eq(users.status, 'active')));
    active.push(...rows.map((r) => r.id));
  }
  return active;
}

/** The venues and cities a person is connected to, for building their feed. */
export async function connectedScopes(
  db: Db,
  userId: string,
  cityHint?: string,
): Promise<{ cityIds: string[]; venueIds: string[] }> {
  const registered = await db
    .selectDistinct({ venueId: sessions.venueId })
    .from(registrations)
    .innerJoin(sessions, eq(sessions.id, registrations.sessionId))
    .where(and(eq(registrations.userId, userId), ne(registrations.status, 'cancelled')));
  const followedVenue = await db
    .select({ venueId: follows.venueId })
    .from(follows)
    .where(and(eq(follows.userId, userId), isNotNull(follows.venueId)));
  const followedCircle = await db
    .select({ venueId: circles.venueId })
    .from(follows)
    .innerJoin(circles, eq(circles.id, follows.circleId))
    .where(eq(follows.userId, userId));
  const home = await db
    .select({ cityId: areas.cityId })
    .from(profiles)
    .innerJoin(areas, eq(areas.id, profiles.areaId))
    .where(eq(profiles.userId, userId));
  const venueIds = uniq([
    ...registered.map((r) => r.venueId),
    ...followedVenue.flatMap((r) => (r.venueId ? [r.venueId] : [])),
    ...followedCircle.map((r) => r.venueId),
  ]);
  const venueCities = venueIds.length
    ? await db
        .selectDistinct({ cityId: venues.cityId })
        .from(venues)
        .where(inArray(venues.id, venueIds))
    : [];
  const cityIds = uniq([
    ...venueCities.map((r) => r.cityId),
    ...home.map((r) => r.cityId),
    ...(cityHint ? [cityHint] : []),
  ]);
  return { cityIds, venueIds };
}
