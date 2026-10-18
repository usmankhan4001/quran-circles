import { and, eq, inArray, isNotNull, ne } from 'drizzle-orm';
import { schema, type Db } from '../../db';

const { registrations, sessions, follows, circles, profiles, areas, venues } = schema;

/**
 * Who an update reaches lives in `@qc/db` (`packages/db/src/jobs/update-push.ts`), because the
 * worker writes the push rows after the post and must pick exactly the same people as the count
 * the API answers with (load test finding, migration 0011).
 */
export { reachUserIds, venueConnectedUserIds, type UpdateScopeRef } from '@qc/db';

const uniq = <T>(values: T[]): T[] => [...new Set(values)];

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
