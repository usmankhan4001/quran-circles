import { and, asc, eq, isNull } from 'drizzle-orm';
import type { Localized, Me } from '@qc/contracts';
import { schema } from '@qc/db';
import type { AuthDb } from '../../auth/types';

/**
 * A new account has no name (`users.display_name` is NULL) until registration asks for it.
 * Accounts made before migration 0008 hold a one-character dash instead; it is read as no name.
 * `PersonName` needs two characters or more, so a real name is never the dash.
 */
const LEGACY_PLACEHOLDER = '-';

const named = (value: string | null): string | null =>
  value === null || value.trim() === '' || value === LEGACY_PLACEHOLDER ? null : value;

const localized = (en: string | null, ur: string | null): Localized | null =>
  en ? { en, ur: ur ? ur : null } : null;

/** The signed-in person as the contract's `Me`, with live (non-revoked) roles. Null if no such user. */
export async function loadMe(db: AuthDb, userId: string): Promise<Me | null> {
  const { users, profiles, roleAssignments, cities, venues } = schema;
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return null;
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  const assignments = await db
    .select({
      id: roleAssignments.id,
      role: roleAssignments.role,
      scopeType: roleAssignments.scopeType,
      cityId: roleAssignments.cityId,
      venueId: roleAssignments.venueId,
      createdAt: roleAssignments.createdAt,
      cityEn: cities.nameEn,
      cityUr: cities.nameUr,
      venueEn: venues.nameEn,
      venueUr: venues.nameUr,
    })
    .from(roleAssignments)
    .leftJoin(cities, eq(cities.id, roleAssignments.cityId))
    .leftJoin(venues, eq(venues.id, roleAssignments.venueId))
    .where(and(eq(roleAssignments.userId, userId), isNull(roleAssignments.revokedAt)))
    .orderBy(asc(roleAssignments.createdAt), asc(roleAssignments.id));

  return {
    id: user.id,
    phone: user.phoneE164,
    displayName: named(user.displayName),
    locale: user.locale,
    createdAt: user.createdAt.toISOString(),
    profile: {
      areaId: profile?.areaId ?? null,
      ageBand: profile?.ageBand ?? null,
      profession: profile?.profession ?? null,
      education: profile?.education ?? null,
      priorReading: profile?.priorReading ?? null,
      preferredLanguage: profile?.preferredLanguage ?? null,
      // rc.4: the same mapping as `GET /v1/me` (modules/me/profile.ts). The columns are both set or
      // both NULL (profiles_daily_goal_shape_chk), so one without the other is read as no goal.
      dailyGoal:
        profile?.dailyGoalUnit && profile.dailyGoalAmount !== null
          ? { unit: profile.dailyGoalUnit, amount: profile.dailyGoalAmount }
          : null,
      memorisationReviseAfterDays: profile?.memorisationReviseAfterDays ?? null,
    },
    roles: assignments.map((a) => ({
      id: a.id,
      role: a.role,
      scopeType: a.scopeType,
      cityId: a.cityId,
      venueId: a.venueId,
      scopeName:
        a.scopeType === 'venue'
          ? localized(a.venueEn, a.venueUr)
          : a.scopeType === 'city'
            ? localized(a.cityEn, a.cityUr)
            : null,
      createdAt: a.createdAt.toISOString(),
    })),
  };
}
