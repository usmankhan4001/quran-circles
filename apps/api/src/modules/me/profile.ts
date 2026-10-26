import { and, eq, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import type { Me, ProfileUpdate } from '@qc/contracts';
import { schema, type Db } from '../../db';
import { fail, invalid } from '../shared/errors';
import { localized } from '../shared/mappers';
import { visibleName } from '../shared/names';

const {
  users,
  profiles,
  roleAssignments,
  cities,
  venues,
  areas,
  registrations,
  attendance,
  messageOutbox,
  coordinatorInvites,
  otpChallenges,
  legacyRegistrations,
  legacyWhatsappSubscribers,
} = schema;

export async function getMe(db: Db, userId: string): Promise<Me> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) return fail('unauthenticated');
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId));
  const assignments = await db
    .select()
    .from(roleAssignments)
    .where(and(eq(roleAssignments.userId, userId), isNull(roleAssignments.revokedAt)));

  const cityIds = assignments.flatMap((a) => (a.cityId ? [a.cityId] : []));
  const venueIds = assignments.flatMap((a) => (a.venueId ? [a.venueId] : []));
  // One after another: `db` may be a transaction, whose single client runs one query at a time.
  const cityRows = cityIds.length
    ? await db.select().from(cities).where(inArray(cities.id, cityIds))
    : [];
  const venueRows = venueIds.length
    ? await db.select().from(venues).where(inArray(venues.id, venueIds))
    : [];
  const cityName = new Map(cityRows.map((c) => [c.id, localized(c.nameEn, c.nameUr)]));
  const venueName = new Map(venueRows.map((v) => [v.id, localized(v.nameEn, v.nameUr)]));

  return {
    id: user.id,
    email: user.email,
    phone: user.phoneE164,
    displayName: visibleName(user.displayName),
    locale: user.locale,
    createdAt: user.createdAt.toISOString(),
    profile: {
      areaId: profile?.areaId ?? null,
      ageBand: profile?.ageBand ?? null,
      profession: profile?.profession ?? null,
      education: profile?.education ?? null,
      priorReading: profile?.priorReading ?? null,
      preferredLanguage: profile?.preferredLanguage ?? null,
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
      scopeName: a.venueId
        ? (venueName.get(a.venueId) ?? null)
        : a.cityId
          ? (cityName.get(a.cityId) ?? null)
          : null,
      createdAt: a.createdAt.toISOString(),
    })),
  };
}

export async function updateMe(db: Db, userId: string, patch: ProfileUpdate): Promise<Me> {
  if (patch.areaId) {
    const [area] = await db.select({ id: areas.id }).from(areas).where(eq(areas.id, patch.areaId));
    if (!area) invalid('areaId');
  }
  await db.transaction(async (tx) => {
    const userSet: Partial<typeof users.$inferInsert> = {};
    if (patch.phone !== undefined) {
      const [me] = await tx.select().from(users).where(eq(users.id, userId));
      if (me && patch.phone !== me.phoneE164) {
        // A number that signs the person in (no verified email yet) is not changed from here.
        if (!me.emailVerifiedAt) invalid('phone', 'invalid_reference');
        const [taken] = await tx
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.phoneE164, patch.phone), ne(users.id, userId)));
        if (taken) invalid('phone', 'phone_in_use');
        userSet.phoneE164 = patch.phone;
        // A typed number is not proved by a code.
        userSet.phoneVerifiedAt = null;
      }
    }
    if (patch.displayName !== undefined) userSet.displayName = patch.displayName;
    if (patch.locale !== undefined) userSet.locale = patch.locale;
    if (Object.keys(userSet).length) {
      await tx.update(users).set(userSet).where(eq(users.id, userId));
    }
    const profileSet: Partial<typeof profiles.$inferInsert> = {};
    if (patch.areaId !== undefined) profileSet.areaId = patch.areaId;
    if (patch.ageBand !== undefined) profileSet.ageBand = patch.ageBand;
    if (patch.profession !== undefined) profileSet.profession = patch.profession;
    if (patch.education !== undefined) profileSet.education = patch.education;
    if (patch.priorReading !== undefined) profileSet.priorReading = patch.priorReading;
    if (patch.preferredLanguage !== undefined)
      profileSet.preferredLanguage = patch.preferredLanguage;
    if (patch.dailyGoal !== undefined) {
      // Both columns or neither (profiles_daily_goal_shape_chk); null clears the goal.
      profileSet.dailyGoalUnit = patch.dailyGoal?.unit ?? null;
      profileSet.dailyGoalAmount = patch.dailyGoal?.amount ?? null;
    }
    if (patch.memorisationReviseAfterDays !== undefined)
      profileSet.memorisationReviseAfterDays = patch.memorisationReviseAfterDays;
    if (Object.keys(profileSet).length) {
      await tx
        .insert(profiles)
        .values({ userId, ...profileSet })
        .onConflictDoUpdate({ target: profiles.userId, set: profileSet });
    }
  });
  return getMe(db, userId);
}

/**
 * Deletes the account and its personal data. What stays is anonymous: registrations lose their
 * person (user_id NULL, anonymised_at set) so attendance counts survive; sent-message rows lose
 * the recipient number and content and keep their status and cost for reporting. The person's
 * V1 (Ramadan 2026) legacy rows, which hold their name and number, are deleted (SEC-05).
 */
export async function deleteAccount(db: Db, userId: string, now: Date): Promise<void> {
  await db.transaction(async (tx) => {
    const [user] = await tx.select().from(users).where(eq(users.id, userId));
    if (!user) return;

    const myAdmin = await tx
      .select({ id: roleAssignments.id })
      .from(roleAssignments)
      .where(
        and(
          eq(roleAssignments.userId, userId),
          eq(roleAssignments.role, 'national_admin'),
          isNull(roleAssignments.revokedAt),
        ),
      );
    if (myAdmin.length > 0) {
      const [others] = await tx
        .select({ n: sql<number>`count(*)`.mapWith(Number) })
        .from(roleAssignments)
        .where(
          and(
            eq(roleAssignments.role, 'national_admin'),
            isNull(roleAssignments.revokedAt),
            ne(roleAssignments.userId, userId),
          ),
        );
      // The platform must keep at least one national admin.
      if ((others?.n ?? 0) === 0) return fail('last_national_admin');
    }

    const mine = await tx
      .select({ id: registrations.id })
      .from(registrations)
      .where(eq(registrations.userId, userId));
    const registrationIds = mine.map((r) => r.id);
    if (registrationIds.length) {
      // A coordinator may have typed the person's name on the tick list.
      await tx
        .update(attendance)
        .set({ name: null })
        .where(inArray(attendance.registrationId, registrationIds));
    }
    await tx
      .update(registrations)
      .set({ userId: null, anonymisedAt: now })
      .where(eq(registrations.userId, userId));

    await tx
      .update(messageOutbox)
      .set({
        payload: {},
        recipientPhoneE164: null,
        status: sql`case when ${messageOutbox.status} in ('queued', 'sending', 'failed') then 'dead' else ${messageOutbox.status} end`,
        lastErrorCode: sql`case when ${messageOutbox.status} in ('queued', 'sending', 'failed') then 'account_deleted' else ${messageOutbox.lastErrorCode} end`,
      })
      .where(eq(messageOutbox.recipientUserId, userId));

    await tx
      .delete(coordinatorInvites)
      .where(
        user.email
          ? or(
              eq(coordinatorInvites.phoneE164, user.phoneE164),
              eq(coordinatorInvites.email, user.email),
            )
          : eq(coordinatorInvites.phoneE164, user.phoneE164),
      );
    await tx
      .delete(otpChallenges)
      .where(
        user.email
          ? or(
              eq(otpChallenges.phoneE164, user.phoneE164),
              eq(otpChallenges.email, user.email),
              eq(otpChallenges.claimedPhoneE164, user.phoneE164),
            )
          : or(
              eq(otpChallenges.phoneE164, user.phoneE164),
              eq(otpChallenges.claimedPhoneE164, user.phoneE164),
            ),
      );
    // V1 legacy rows (SEC-05): both tables keep the E.164 number in `phone_raw` (ADR 0004), so
    // the match is exact. Deleted rather than anonymised: they hold nothing but the person's
    // name, number and V1 answers, and no V2 row refers to them.
    await tx.delete(legacyRegistrations).where(eq(legacyRegistrations.phoneRaw, user.phoneE164));
    await tx
      .delete(legacyWhatsappSubscribers)
      .where(eq(legacyWhatsappSubscribers.phoneRaw, user.phoneE164));
    // Profile, devices, follows, consents, bookmarks, reading position, reading days,
    // memorisation, circle requests, feed read marks, role assignments and sign-in sessions go
    // with the user row (cascade). The national `community_days` totals hold no user id and stay.
    await tx.delete(users).where(eq(users.id, userId));
  });
}
