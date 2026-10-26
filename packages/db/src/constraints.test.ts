import { eq, sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import * as s from './schema/index';
import {
  CHECK_VIOLATION,
  FOREIGN_KEY_VIOLATION,
  NOT_NULL_VIOLATION,
  UNIQUE_VIOLATION,
  buildWorld,
  createMigratedDb,
  nextPhone,
  nextSlug,
  violation,
  type TestDb,
} from './test/helpers';

let test: TestDb;
let db: TestDb['db'];
let world: Awaited<ReturnType<typeof buildWorld>>;

beforeAll(async () => {
  test = await createMigratedDb();
  db = test.db;
  world = await buildWorld(test);
});

const count = async (table: string, where = 'true', params: unknown[] = []) => {
  const { rows } = await test.pg.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM "${table}" WHERE ${where}`,
    params,
  );
  return rows[0]!.n;
};

describe('users and phone numbers', () => {
  it('rejects a second account for the same verified phone number', async () => {
    const phone = nextPhone();
    await world.make.user({ phoneE164: phone });
    const error = await violation(world.make.user({ phoneE164: phone }));
    expect(error).toEqual({ code: UNIQUE_VIOLATION, constraint: 'users_phone_e164_unique' });
  });

  it('requires some verified way in, and a name that is not blank', async () => {
    // A number nobody verified and no verified email: nothing can sign this account in.
    const noVerification = await violation(
      test.pg.query(`INSERT INTO users (phone_e164, display_name) VALUES ($1, 'x')`, [nextPhone()]),
    );
    expect(noVerification).toEqual({ code: CHECK_VIOLATION, constraint: 'users_identity_chk' });
    const blankName = await violation(world.make.user({ displayName: '   ' }));
    expect(blankName).toEqual({ code: CHECK_VIOLATION, constraint: 'users_display_name_chk' });
  });

  it('lets an account made by email hold an unverified WhatsApp number', async () => {
    const byEmail = await world.make.user({
      email: 'reader@example.org',
      emailVerifiedAt: new Date('2026-01-01T00:00:00Z'),
      phoneVerifiedAt: null,
    });
    expect(byEmail.phoneVerifiedAt).toBeNull();
    // An email that is not verified is not a way in.
    const unverifiedEmail = await violation(
      world.make.user({ email: 'other@example.org', phoneVerifiedAt: null }),
    );
    expect(unverifiedEmail.constraint).toBe('users_identity_chk');
  });

  it('keeps one account per email address, lower case only', async () => {
    const at = new Date('2026-01-01T00:00:00Z');
    await world.make.user({ email: 'one@example.org', emailVerifiedAt: at });
    const dup = await violation(world.make.user({ email: 'one@example.org', emailVerifiedAt: at }));
    expect(dup).toEqual({ code: UNIQUE_VIOLATION, constraint: 'users_email_uq' });
    for (const email of [
      'Two@example.org',
      'two@example',
      'two @example.org',
      ' two@example.org',
    ]) {
      const bad = await violation(world.make.user({ email, emailVerifiedAt: at }));
      expect(bad, email).toEqual({ code: CHECK_VIOLATION, constraint: 'users_email_chk' });
    }
    // Many accounts without an email are fine.
    await world.make.user({});
    await world.make.user({});
  });

  it('asks for a code by exactly one of email and number', async () => {
    const both = await violation(
      test.pg.query(
        `INSERT INTO otp_challenges (phone_e164, email, channel, code_hash, expires_at)
         VALUES ($1, 'a@example.org', 'email', 'h', now())`,
        [nextPhone()],
      ),
    );
    expect(both.constraint).toBe('otp_challenges_target_chk');
    const neither = await violation(
      test.pg.query(
        `INSERT INTO otp_challenges (channel, code_hash, expires_at) VALUES ('email', 'h', now())`,
      ),
    );
    expect(neither.constraint).toBe('otp_challenges_target_chk');
    const badClaim = await violation(
      test.pg.query(
        `INSERT INTO otp_challenges (email, claimed_phone_e164, channel, code_hash, expires_at)
         VALUES ('a@example.org', '03001234567', 'email', 'h', now())`,
      ),
    );
    expect(badClaim.constraint).toBe('otp_challenges_claimed_phone_e164_chk');
    await test.pg.query(
      `INSERT INTO otp_challenges (email, claimed_phone_e164, channel, code_hash, expires_at)
       VALUES ('a@example.org', '+923001234567', 'email', 'h', now())`,
    );
  });

  it('lets an account exist without a name until registration asks for one, but never a blank one', async () => {
    const unnamed = await world.make.user({ displayName: null });
    expect(unnamed.displayName).toBeNull();
    // Omitting the column is the same as NULL.
    const { rows } = await test.pg.query<{ display_name: string | null }>(
      `INSERT INTO users (phone_e164, phone_verified_at) VALUES ($1, now()) RETURNING display_name`,
      [nextPhone()],
    );
    expect(rows[0]!.display_name).toBeNull();
    // Giving the name later works; clearing it back to blank does not; NULL again is allowed.
    await db.update(s.users).set({ displayName: 'Ayesha' }).where(eq(s.users.id, unnamed.id));
    const blank = await violation(
      db.update(s.users).set({ displayName: '' }).where(eq(s.users.id, unnamed.id)),
    );
    expect(blank).toEqual({ code: CHECK_VIOLATION, constraint: 'users_display_name_chk' });
    await db.update(s.users).set({ displayName: null }).where(eq(s.users.id, unnamed.id));
  });

  it.each([
    ['a national number with a leading zero', '03001234567'],
    ['no plus sign', '923001234567'],
    ['a plus and a zero country code', '+0923001234567'],
    ['spaces inside', '+92 300 1234567'],
    ['dashes inside', '+92-300-1234567'],
    ['letters inside', '+92300abc4567'],
    ['too short (7 digits)', '+1234567'],
    ['too long (16 digits)', '+1234567890123456'],
    ['empty', ''],
    ['trailing newline', '+923001234567\n'],
  ])('rejects a bad E.164 number: %s', async (_label, phone) => {
    const error = await violation(world.make.user({ phoneE164: phone }));
    expect(error).toEqual({ code: CHECK_VIOLATION, constraint: 'users_phone_e164_chk' });
  });

  it.each(['+923001234567', '+14155550123', '+12345678', '+123456789012345'])(
    'accepts the E.164 number %s',
    async (phone) => {
      await expect(world.make.user({ phoneE164: phone })).resolves.toMatchObject({
        phoneE164: phone,
      });
    },
  );

  it('applies the same E.164 rule to every phone column', async () => {
    const venue = await violation(
      world.make.venue(world.city.id, world.area.id, { contactPhone: '0300' }),
    );
    expect(venue.constraint).toBe('venues_contact_phone_chk');
    await world.make.venue(world.city.id, world.area.id, { contactPhone: '+925190000001' });
    await world.make.venue(world.city.id, world.area.id, { contactPhone: null });

    const otp = await violation(
      test.pg.query(
        `INSERT INTO otp_challenges (phone_e164, channel, code_hash, expires_at)
         VALUES ('0300', 'sms', 'h', now())`,
      ),
    );
    expect(otp.constraint).toBe('otp_challenges_phone_e164_chk');

    const invite = await violation(
      test.pg.query(
        `INSERT INTO coordinator_invites (phone_e164, role, scope_type, expires_at)
         VALUES ('0300', 'national_admin', 'national', now())`,
      ),
    );
    expect(invite.constraint).toBe('coordinator_invites_phone_e164_chk');

    const outbox = await violation(
      test.pg.query(
        `INSERT INTO message_outbox (idempotency_key, channel, cost_category, recipient_phone_e164)
         VALUES ('bad-phone', 'sms', 'free', '0300')`,
      ),
    );
    expect(outbox.constraint).toBe('message_outbox_recipient_phone_e164_chk');
  });

  it('defaults a new account to Urdu and active', async () => {
    const user = await world.make.user();
    expect(user.locale).toBe('ur');
    expect(user.status).toBe('active');
    expect(user.lastSeenAt).toBeNull();
    expect(user.createdAt).toBeInstanceOf(Date);
  });
});

describe('registrations', () => {
  it('rejects a second active registration for the same person and session, and allows one after cancelling', async () => {
    const user = await world.make.user();
    const first = await world.make.registration(user.id, world.session.id, world.area.id);

    const duplicate = await violation(
      world.make.registration(user.id, world.session.id, world.area.id),
    );
    expect(duplicate).toEqual({
      code: UNIQUE_VIOLATION,
      constraint: 'registrations_user_session_active_uq',
    });

    await db
      .update(s.registrations)
      .set({ status: 'cancelled', cancelledAt: new Date() })
      .where(eq(s.registrations.id, first.id));

    const second = await world.make.registration(user.id, world.session.id, world.area.id);
    expect(second.id).not.toBe(first.id);
    expect(second.status).toBe('confirmed');

    // The new one is active, so a third is rejected again.
    expect(
      (await violation(world.make.registration(user.id, world.session.id, world.area.id))).code,
    ).toBe(UNIQUE_VIOLATION);
    // Cancelled history can pile up.
    await db
      .update(s.registrations)
      .set({ status: 'cancelled' })
      .where(eq(s.registrations.id, second.id));
    await world.make.registration(user.id, world.session.id, world.area.id, {
      status: 'cancelled',
    });
    expect(await count('registrations', 'user_id = $1', [user.id])).toBe(3);
  });

  it('counts a waitlisted registration as active', async () => {
    const user = await world.make.user();
    await world.make.registration(user.id, world.session.id, world.area.id, {
      status: 'waitlisted',
    });
    const duplicate = await violation(
      world.make.registration(user.id, world.session.id, world.area.id, { status: 'confirmed' }),
    );
    expect(duplicate.code).toBe(UNIQUE_VIOLATION);
  });

  it('lets one person register for different sessions, and different people for one session', async () => {
    const user = await world.make.user();
    const other = await world.make.session(world.venue.id, world.program.id);
    await world.make.registration(user.id, world.session.id, world.area.id);
    await world.make.registration(user.id, other.id, world.area.id);
    const second = await world.make.user();
    await world.make.registration(second.id, world.session.id, world.area.id);
  });

  it('allows many anonymised registrations (no user) for one session', async () => {
    const session = await world.make.session(world.venue.id, world.program.id);
    await world.make.registration(null, session.id, world.area.id, { anonymisedAt: new Date() });
    await world.make.registration(null, session.id, world.area.id, { anonymisedAt: new Date() });
    expect(await count('registrations', 'session_id = $1', [session.id])).toBe(2);
  });

  it('requires a party size from 1 to 20', async () => {
    const session = await world.make.session(world.venue.id, world.program.id);
    for (const partySize of [0, -1, 21, 100]) {
      const error = await violation(
        world.make.registration(null, session.id, world.area.id, { partySize }),
      );
      expect(error, String(partySize)).toEqual({
        code: CHECK_VIOLATION,
        constraint: 'registrations_party_size_range_chk',
      });
    }
    for (const partySize of [1, 2, 20]) {
      await world.make.registration(null, session.id, world.area.id, { partySize });
    }
  });

  it('requires an area and a session', async () => {
    const noArea = await violation(
      test.pg.query(
        `INSERT INTO registrations (session_id, section, party_size) VALUES ($1, 'family', 1)`,
        [world.session.id],
      ),
    );
    expect(noArea.code).toBe(NOT_NULL_VIOLATION);
    const badSession = await violation(
      test.pg.query(
        `INSERT INTO registrations (session_id, area_id, section, party_size)
         VALUES (gen_random_uuid(), $1, 'family', 1)`,
        [world.area.id],
      ),
    );
    expect(badSession.code).toBe(FOREIGN_KEY_VIOLATION);
  });
});

describe('circle requests', () => {
  const request = (
    userId: string,
    areaId: string,
    status: s.NewCircleRequestRow['status'] = 'active',
  ) =>
    db
      .insert(s.circleRequests)
      .values({ userId, areaId, status, expiresAt: new Date('2026-12-31T00:00:00Z') })
      .returning();

  it('rejects a second active request for the same person and area', async () => {
    const user = await world.make.user();
    await request(user.id, world.area.id);
    const error = await violation(request(user.id, world.area.id));
    expect(error).toEqual({
      code: UNIQUE_VIOLATION,
      constraint: 'circle_requests_user_area_active_uq',
    });
  });

  it('allows a new request after cancelling, and after fulfilment or expiry', async () => {
    const user = await world.make.user();
    const [first] = await request(user.id, world.area.id);
    await db
      .update(s.circleRequests)
      .set({ status: 'cancelled', cancelledAt: new Date() })
      .where(eq(s.circleRequests.id, first!.id));
    const [again] = await request(user.id, world.area.id);
    expect(again!.status).toBe('active');
    await db
      .update(s.circleRequests)
      .set({ status: 'fulfilled' })
      .where(eq(s.circleRequests.id, again!.id));
    const [third] = await request(user.id, world.area.id);
    await db
      .update(s.circleRequests)
      .set({ status: 'expired' })
      .where(eq(s.circleRequests.id, third!.id));
    await request(user.id, world.area.id);
    expect(await count('circle_requests', 'user_id = $1', [user.id])).toBe(4);
  });

  it('allows one active request in each of two areas, and one for each of two people', async () => {
    const user = await world.make.user();
    const other = await world.make.user();
    const area2 = await world.make.area(world.city.id);
    await request(user.id, world.area.id);
    await request(user.id, area2.id);
    await request(other.id, world.area.id);
  });

  it('keeps preferred days within Sunday to Saturday', async () => {
    const user = await world.make.user();
    const bad = await violation(
      db.insert(s.circleRequests).values({
        userId: user.id,
        areaId: world.area.id,
        days: [1, 7],
        expiresAt: new Date('2026-12-31T00:00:00Z'),
      }),
    );
    expect(bad.constraint).toBe('circle_requests_days_range_chk');
    const ok = await db
      .insert(s.circleRequests)
      .values({
        userId: user.id,
        areaId: world.area.id,
        days: [0, 6],
        expiresAt: new Date('2026-12-31T00:00:00Z'),
      })
      .returning();
    expect(ok[0]!.days).toEqual([0, 6]);
  });
});

describe('role assignments', () => {
  const assign = (v: s.NewRoleAssignmentRow) => db.insert(s.roleAssignments).values(v).returning();

  it('accepts each role at its own scope', async () => {
    const admin = await world.make.user();
    const city = await world.make.user();
    const venue = await world.make.user();
    await assign({ userId: admin.id, role: 'national_admin', scopeType: 'national' });
    await assign({
      userId: city.id,
      role: 'city_coordinator',
      scopeType: 'city',
      cityId: world.city.id,
    });
    await assign({
      userId: venue.id,
      role: 'venue_coordinator',
      scopeType: 'venue',
      venueId: world.venue.id,
    });
    // A venue assignment may also record its city.
    const other = await world.make.user();
    await assign({
      userId: other.id,
      role: 'venue_coordinator',
      scopeType: 'venue',
      venueId: world.venue.id,
      cityId: world.city.id,
    });
  });

  it('rejects a venue coordinator with a city scope', async () => {
    const user = await world.make.user();
    const error = await violation(
      assign({
        userId: user.id,
        role: 'venue_coordinator',
        scopeType: 'city',
        cityId: world.city.id,
      }),
    );
    expect(error).toEqual({ code: CHECK_VIOLATION, constraint: 'role_assignments_role_scope_chk' });
  });

  it.each([
    ['city coordinator with a venue scope', 'city_coordinator', 'venue'],
    ['city coordinator with a national scope', 'city_coordinator', 'national'],
    ['national admin with a city scope', 'national_admin', 'city'],
    ['national admin with a venue scope', 'national_admin', 'venue'],
    ['venue coordinator with a national scope', 'venue_coordinator', 'national'],
  ] as const)('rejects a mismatched role and scope: %s', async (_label, role, scopeType) => {
    const user = await world.make.user();
    const error = await violation(
      assign({ userId: user.id, role, scopeType, cityId: world.city.id, venueId: world.venue.id }),
    );
    expect(error.code).toBe(CHECK_VIOLATION);
  });

  it.each([
    ['national with a city', 'national_admin', 'national', true, false],
    ['national with a venue', 'national_admin', 'national', false, true],
    ['city without a city', 'city_coordinator', 'city', false, false],
    ['city with a venue too', 'city_coordinator', 'city', true, true],
    ['venue with only a city', 'venue_coordinator', 'venue', true, false],
    ['venue with nothing', 'venue_coordinator', 'venue', false, false],
  ] as const)(
    'rejects a scope with the wrong shape: %s',
    async (_label, role, scopeType, withCity, withVenue) => {
      const user = await world.make.user();
      const error = await violation(
        assign({
          userId: user.id,
          role,
          scopeType,
          cityId: withCity ? world.city.id : null,
          venueId: withVenue ? world.venue.id : null,
        }),
      );
      expect(error).toEqual({
        code: CHECK_VIOLATION,
        constraint: 'role_assignments_scope_shape_chk',
      });
    },
  );

  it('rejects unknown roles and scope types', async () => {
    const user = await world.make.user();
    const role = await violation(
      test.pg.query(
        `INSERT INTO role_assignments (user_id, role, scope_type) VALUES ($1, 'teacher', 'national')`,
        [user.id],
      ),
    );
    expect(role.constraint).toBe('role_assignments_role_chk');
    const scope = await violation(
      test.pg.query(
        `INSERT INTO role_assignments (user_id, role, scope_type) VALUES ($1, 'national_admin', 'province')`,
        [user.id],
      ),
    );
    // Postgres reports the first failing CHECK; either way it is a CHECK on this table.
    expect(scope.code).toBe(CHECK_VIOLATION);
    expect(scope.constraint).toMatch(/^role_assignments_(scope_type|role_scope)_chk$/);
  });

  it('allows one live assignment per person, role and target, and a new one after revoking', async () => {
    const user = await world.make.user();
    const grant = () =>
      assign({
        userId: user.id,
        role: 'venue_coordinator',
        scopeType: 'venue',
        venueId: world.venue.id,
      });
    const [first] = await grant();
    expect(await violation(grant())).toEqual({
      code: UNIQUE_VIOLATION,
      constraint: 'role_assignments_active_uq',
    });
    // Recording the city on the second row does not get around it.
    expect(
      (
        await violation(
          assign({
            userId: user.id,
            role: 'venue_coordinator',
            scopeType: 'venue',
            venueId: world.venue.id,
            cityId: world.city.id,
          }),
        )
      ).constraint,
    ).toBe('role_assignments_active_uq');

    await db
      .update(s.roleAssignments)
      .set({ revokedAt: new Date() })
      .where(eq(s.roleAssignments.id, first!.id));
    await grant();
    expect(await count('role_assignments', 'user_id = $1', [user.id])).toBe(2);
  });

  it('allows the same person to coordinate different venues and cities', async () => {
    const user = await world.make.user();
    const venue2 = await world.make.venue(world.city.id, world.area.id);
    const city2 = await world.make.city();
    await assign({
      userId: user.id,
      role: 'venue_coordinator',
      scopeType: 'venue',
      venueId: world.venue.id,
    });
    await assign({
      userId: user.id,
      role: 'venue_coordinator',
      scopeType: 'venue',
      venueId: venue2.id,
    });
    await assign({
      userId: user.id,
      role: 'city_coordinator',
      scopeType: 'city',
      cityId: world.city.id,
    });
    await assign({
      userId: user.id,
      role: 'city_coordinator',
      scopeType: 'city',
      cityId: city2.id,
    });
    await assign({ userId: user.id, role: 'national_admin', scopeType: 'national' });
    expect(
      (await violation(assign({ userId: user.id, role: 'national_admin', scopeType: 'national' })))
        .constraint,
    ).toBe('role_assignments_active_uq');
  });

  it('applies the same scope rules to coordinator invites', async () => {
    const invite = (v: Partial<s.NewCoordinatorInviteRow>) =>
      db
        .insert(s.coordinatorInvites)
        .values({
          phoneE164: nextPhone(),
          role: 'venue_coordinator',
          scopeType: 'venue',
          venueId: world.venue.id,
          expiresAt: new Date('2027-01-01T00:00:00Z'),
          ...v,
        })
        .returning();
    await invite({});
    expect(
      (await violation(invite({ scopeType: 'city', cityId: world.city.id, venueId: null })))
        .constraint,
    ).toBe('coordinator_invites_role_scope_chk');
    expect((await violation(invite({ venueId: null }))).constraint).toBe(
      'coordinator_invites_scope_shape_chk',
    );

    // One pending invite per phone, role and target; a new one once the first is accepted.
    const phone = nextPhone();
    const [pending] = await invite({ phoneE164: phone });
    expect((await violation(invite({ phoneE164: phone }))).constraint).toBe(
      'coordinator_invites_pending_uq',
    );
    await db
      .update(s.coordinatorInvites)
      .set({ status: 'accepted', acceptedAt: new Date() })
      .where(eq(s.coordinatorInvites.id, pending!.id));
    await invite({ phoneE164: phone });
  });
});

describe('follows', () => {
  it('needs exactly one target', async () => {
    const user = await world.make.user();
    const circle = await world.make.circle(world.venue.id);
    const none = await violation(db.insert(s.follows).values({ userId: user.id }));
    expect(none).toEqual({ code: CHECK_VIOLATION, constraint: 'follows_one_target_chk' });
    const both = await violation(
      db
        .insert(s.follows)
        .values({ userId: user.id, venueId: world.venue.id, circleId: circle.id }),
    );
    expect(both).toEqual({ code: CHECK_VIOLATION, constraint: 'follows_one_target_chk' });
    await db.insert(s.follows).values({ userId: user.id, venueId: world.venue.id });
    await db.insert(s.follows).values({ userId: user.id, circleId: circle.id });
  });

  it('rejects following the same venue or circle twice', async () => {
    const user = await world.make.user();
    const circle = await world.make.circle(world.venue.id);
    await db.insert(s.follows).values({ userId: user.id, venueId: world.venue.id });
    expect(
      (await violation(db.insert(s.follows).values({ userId: user.id, venueId: world.venue.id })))
        .constraint,
    ).toBe('follows_user_venue_uq');
    await db.insert(s.follows).values({ userId: user.id, circleId: circle.id });
    expect(
      (await violation(db.insert(s.follows).values({ userId: user.id, circleId: circle.id })))
        .constraint,
    ).toBe('follows_user_circle_uq');
    // Someone else may follow the same venue.
    const other = await world.make.user();
    await db.insert(s.follows).values({ userId: other.id, venueId: world.venue.id });
  });

  it('turns alerts on by default', async () => {
    const user = await world.make.user();
    const [follow] = await db
      .insert(s.follows)
      .values({ userId: user.id, venueId: world.venue.id })
      .returning();
    expect(follow!.alertsEnabled).toBe(true);
  });
});

describe('consents', () => {
  const grant = (v: Partial<s.NewConsentRow> & { userId: string }) =>
    db
      .insert(s.consents)
      .values({ channel: 'whatsapp', purpose: 'session_reminders', source: 'test', ...v })
      .returning();

  it('allows one active consent per person, channel, purpose and venue', async () => {
    const user = await world.make.user();
    const [first] = await grant({ userId: user.id });
    expect((await violation(grant({ userId: user.id }))).constraint).toBe('consents_active_uq');
    // A different venue, channel or purpose is a different consent.
    await grant({ userId: user.id, venueId: world.venue.id });
    await grant({ userId: user.id, channel: 'push' });
    await grant({ userId: user.id, purpose: 'announcements' });
    expect((await violation(grant({ userId: user.id, venueId: world.venue.id }))).constraint).toBe(
      'consents_active_uq',
    );
    // Revoking frees the slot and keeps the history.
    await db.update(s.consents).set({ revokedAt: new Date() }).where(eq(s.consents.id, first!.id));
    await grant({ userId: user.id });
    expect(
      await count(
        'consents',
        'user_id = $1 AND venue_id IS NULL AND channel = $2 AND purpose = $3',
        [user.id, 'whatsapp', 'session_reminders'],
      ),
    ).toBe(2);
  });

  it('refuses a revocation before the grant', async () => {
    const user = await world.make.user();
    const error = await violation(
      grant({
        userId: user.id,
        grantedAt: new Date('2026-05-02T00:00:00Z'),
        revokedAt: new Date('2026-05-01T00:00:00Z'),
      }),
    );
    expect(error).toEqual({
      code: CHECK_VIOLATION,
      constraint: 'consents_revoked_after_granted_chk',
    });
    await grant({
      userId: user.id,
      grantedAt: new Date('2026-05-01T00:00:00Z'),
      revokedAt: new Date('2026-05-01T00:00:00Z'),
    });
  });

  it('requires a source', async () => {
    const user = await world.make.user();
    const error = await violation(
      test.pg.query(
        `INSERT INTO consents (user_id, channel, purpose) VALUES ($1, 'whatsapp', 'venue_alerts')`,
        [user.id],
      ),
    );
    expect(error.code).toBe(NOT_NULL_VIOLATION);
  });
});

describe('sessions', () => {
  it('requires a positive capacity when capacity is on', async () => {
    const enabledWithout = await violation(
      world.make.session(world.venue.id, world.program.id, {
        capacityEnabled: true,
        capacity: null,
      }),
    );
    expect(enabledWithout).toEqual({ code: CHECK_VIOLATION, constraint: 'sessions_capacity_chk' });
    for (const capacity of [0, -5]) {
      const bad = await violation(
        world.make.session(world.venue.id, world.program.id, { capacityEnabled: true, capacity }),
      );
      expect(bad.constraint, String(capacity)).toBe('sessions_capacity_chk');
    }
    // A negative capacity is nonsense even when the feature is off.
    const offButNegative = await violation(
      world.make.session(world.venue.id, world.program.id, {
        capacityEnabled: false,
        capacity: -1,
      }),
    );
    expect(offButNegative.constraint).toBe('sessions_capacity_chk');
    const on = await world.make.session(world.venue.id, world.program.id, {
      capacityEnabled: true,
      capacity: 40,
    });
    expect(on.capacity).toBe(40);
    const off = await world.make.session(world.venue.id, world.program.id);
    expect(off.capacityEnabled).toBe(false);
    expect(off.capacity).toBeNull();
  });

  it('keeps one-off lectures free of weekdays and recurring sessions on at least one', async () => {
    const oneOffWithDays = await violation(
      world.make.session(world.venue.id, world.program.id, { kind: 'one_off', daysOfWeek: [5] }),
    );
    expect(oneOffWithDays).toEqual({ code: CHECK_VIOLATION, constraint: 'sessions_kind_days_chk' });
    const recurringWithout = await violation(
      world.make.session(world.venue.id, world.program.id, { kind: 'recurring', daysOfWeek: [] }),
    );
    expect(recurringWithout.constraint).toBe('sessions_kind_days_chk');
    const oneOff = await world.make.session(world.venue.id, world.program.id, {
      kind: 'one_off',
      daysOfWeek: [],
      startsOn: '2026-04-10',
      endsOn: '2026-04-10',
    });
    expect(oneOff.daysOfWeek).toEqual([]);
  });

  it('keeps weekdays within 0 (Sunday) to 6 (Saturday)', async () => {
    for (const daysOfWeek of [[7], [-1], [1, 9]]) {
      const error = await violation(
        world.make.session(world.venue.id, world.program.id, { daysOfWeek }),
      );
      expect(error.constraint, JSON.stringify(daysOfWeek)).toBe('sessions_days_of_week_range_chk');
    }
    const week = await world.make.session(world.venue.id, world.program.id, {
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    });
    expect(week.daysOfWeek).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('checks duration and date order', async () => {
    for (const durationMinutes of [0, -30, 1441]) {
      const error = await violation(
        world.make.session(world.venue.id, world.program.id, { durationMinutes }),
      );
      expect(error.constraint).toBe('sessions_duration_minutes_range_chk');
    }
    const backwards = await violation(
      world.make.session(world.venue.id, world.program.id, {
        startsOn: '2026-03-10',
        endsOn: '2026-03-01',
      }),
    );
    expect(backwards.constraint).toBe('sessions_dates_chk');
  });

  it('stores the start time as a wall-clock time and defaults to Pakistan time', async () => {
    const session = await world.make.session(world.venue.id, world.program.id, {
      localStartTime: '04:45',
    });
    expect(session.localStartTime).toBe('04:45:00');
    expect(session.timezone).toBe('Asia/Karachi');
    expect(session.status).toBe('published');
    expect(session.registrationEnabled).toBe(true);
  });
});

describe('occurrences', () => {
  it('allows one occurrence per session and start time', async () => {
    const session = await world.make.session(world.venue.id, world.program.id);
    const startsAt = new Date('2026-06-01T14:30:00Z');
    const endsAt = new Date('2026-06-01T15:30:00Z');
    await world.make.occurrence(session.id, { startsAt, endsAt });
    expect(
      (await violation(world.make.occurrence(session.id, { startsAt, endsAt }))).constraint,
    ).toBe('occurrences_session_starts_unique');
    await world.make.occurrence(session.id, {
      startsAt: new Date('2026-06-08T14:30:00Z'),
      endsAt: new Date('2026-06-08T15:30:00Z'),
    });
  });

  it('refuses an end before the start and a negative headcount', async () => {
    const session = await world.make.session(world.venue.id, world.program.id);
    const startsAt = new Date('2026-06-01T14:30:00Z');
    expect(
      (await violation(world.make.occurrence(session.id, { startsAt, endsAt: startsAt })))
        .constraint,
    ).toBe('occurrences_times_chk');
    expect(
      (
        await violation(
          world.make.occurrence(session.id, {
            startsAt,
            endsAt: new Date('2026-06-01T16:00:00Z'),
            headcount: -1,
          }),
        )
      ).constraint,
    ).toBe('occurrences_headcount_chk');
  });

  it('keeps instants as UTC and round-trips them exactly', async () => {
    const session = await world.make.session(world.venue.id, world.program.id);
    // 04:45 in Pakistan (UTC+5) is 23:45 UTC the evening before.
    const startsAt = new Date('2026-03-01T23:45:00Z');
    const occurrence = await world.make.occurrence(session.id, {
      startsAt,
      endsAt: new Date('2026-03-02T00:45:00Z'),
      portion: { kind: 'para', number: 3 },
      portionLabel: 'Para 3',
    });
    expect(occurrence.startsAt.toISOString()).toBe('2026-03-01T23:45:00.000Z');
    expect(occurrence.portion).toEqual({ kind: 'para', number: 3 });
    const { rows } = await test.pg.query<{ karachi: string }>(
      `SELECT to_char(starts_at AT TIME ZONE 'Asia/Karachi', 'YYYY-MM-DD HH24:MI') AS karachi
         FROM occurrences WHERE id = $1`,
      [occurrence.id],
    );
    expect(rows[0]!.karachi).toBe('2026-03-02 04:45');
  });
});

describe('places', () => {
  it('keeps slugs unique where they must be', async () => {
    const slug = nextSlug('dup');
    await world.make.venue(world.city.id, world.area.id, { slug });
    expect(
      (await violation(world.make.venue(world.city.id, world.area.id, { slug }))).constraint,
    ).toBe('venues_slug_unique');
    // Area slugs are unique within a city, not across cities.
    const city2 = await world.make.city();
    const areaSlug = nextSlug('same-area');
    await world.make.area(world.city.id, { slug: areaSlug });
    expect((await violation(world.make.area(world.city.id, { slug: areaSlug }))).constraint).toBe(
      'areas_city_slug_unique',
    );
    await world.make.area(city2.id, { slug: areaSlug });
  });

  it('defaults facilities to off, status to active and a city to active in Pakistan time', async () => {
    const venue = await world.make.venue(world.city.id, world.area.id);
    expect(venue).toMatchObject({
      hasWomenSection: false,
      hasParking: false,
      hasWuduArea: false,
      hasElderWheelchairAccess: false,
      isChildFriendly: false,
      status: 'active',
      contactPhone: null,
      entranceNotesEn: null,
      entranceNotesUr: null,
    });
    expect(world.city).toMatchObject({ timezone: 'Asia/Karachi', isActive: true });
  });

  it('keeps map positions on Earth', async () => {
    expect(
      (await violation(world.make.venue(world.city.id, world.area.id, { lat: 91, lng: 0 })))
        .constraint,
    ).toBe('venues_lat_range_chk');
    expect(
      (await violation(world.make.venue(world.city.id, world.area.id, { lat: 0, lng: 181 })))
        .constraint,
    ).toBe('venues_lng_range_chk');
    expect((await violation(world.make.area(world.city.id, { lat: -91 }))).constraint).toBe(
      'areas_lat_range_chk',
    );
    await world.make.venue(world.city.id, world.area.id, { lat: 33.6844, lng: 73.0479 });
  });

  it('refuses to delete a place that still has things in it', async () => {
    const city = await world.make.city();
    const area = await world.make.area(city.id);
    await world.make.venue(city.id, area.id);
    expect((await violation(db.delete(s.areas).where(eq(s.areas.id, area.id)))).code).toBe(
      FOREIGN_KEY_VIOLATION,
    );
    expect((await violation(db.delete(s.cities).where(eq(s.cities.id, city.id)))).code).toBe(
      FOREIGN_KEY_VIOLATION,
    );
  });
});

describe('devices, sessions and codes', () => {
  it('allows each push token once per provider', async () => {
    const user = await world.make.user();
    const device = (provider: s.NewDeviceRow['provider'], token: string) =>
      db
        .insert(s.devices)
        .values({ userId: user.id, platform: 'android', provider, token, locale: 'en' });
    await device('fcm', 'token-1');
    expect((await violation(device('fcm', 'token-1'))).constraint).toBe(
      'devices_provider_token_unique',
    );
    await device('apns', 'token-1');
    await device('fcm', 'token-2');
  });

  it('allows each refresh token hash once', async () => {
    const user = await world.make.user();
    const session = (hash: string) =>
      db.insert(s.authSessions).values({
        userId: user.id,
        refreshTokenHash: hash,
        expiresAt: new Date('2027-01-01T00:00:00Z'),
      });
    await session('hash-1');
    expect((await violation(session('hash-1'))).constraint).toBe(
      'auth_sessions_refresh_token_hash_unique',
    );
  });

  it('starts sign-in codes with zero attempts and refuses a negative count', async () => {
    const [challenge] = await db
      .insert(s.otpChallenges)
      .values({
        phoneE164: nextPhone(),
        channel: 'whatsapp',
        codeHash: 'hash',
        expiresAt: new Date('2027-01-01T00:00:00Z'),
      })
      .returning();
    expect(challenge!.attempts).toBe(0);
    expect(challenge!.consumedAt).toBeNull();
    const bad = await violation(
      test.pg.query(`UPDATE otp_challenges SET attempts = -1 WHERE id = $1`, [challenge!.id]),
    );
    expect(bad.constraint).toBe('otp_challenges_attempts_chk');
  });

  it('keeps the sign-in language on the code, defaulting to Urdu and refusing other values', async () => {
    const challenge = (locale?: string) =>
      test.pg.query<{ locale: string }>(
        locale === undefined
          ? `INSERT INTO otp_challenges (phone_e164, channel, code_hash, expires_at)
             VALUES ($1, 'sms', 'h', now()) RETURNING locale`
          : `INSERT INTO otp_challenges (phone_e164, channel, code_hash, expires_at, locale)
             VALUES ($1, 'sms', 'h', now(), '${locale}') RETURNING locale`,
        [nextPhone()],
      );
    expect((await challenge()).rows[0]!.locale).toBe('ur');
    expect((await challenge('en')).rows[0]!.locale).toBe('en');
    expect((await violation(challenge('fr'))).constraint).toBe('otp_challenges_locale_chk');
    const [typed] = await db
      .insert(s.otpChallenges)
      .values({
        phoneE164: nextPhone(),
        channel: 'whatsapp',
        codeHash: 'h',
        locale: 'en',
        expiresAt: new Date('2027-01-01T00:00:00Z'),
      })
      .returning();
    expect(typed!.locale).toBe('en');
  });

  it('remembers the previous refresh token hash and when it was rotated, both optional', async () => {
    const user = await world.make.user();
    const [fresh] = await db
      .insert(s.authSessions)
      .values({
        userId: user.id,
        refreshTokenHash: nextSlug('rt'),
        expiresAt: new Date('2027-01-01T00:00:00Z'),
      })
      .returning();
    expect(fresh).toMatchObject({ previousRefreshTokenHash: null, rotatedAt: null });
    const rotatedAt = new Date('2026-10-17T10:00:00Z');
    await db
      .update(s.authSessions)
      .set({
        previousRefreshTokenHash: fresh!.refreshTokenHash,
        refreshTokenHash: nextSlug('rt'),
        rotatedAt,
      })
      .where(eq(s.authSessions.id, fresh!.id));
    const [rotated] = await db
      .select()
      .from(s.authSessions)
      .where(eq(s.authSessions.id, fresh!.id));
    expect(rotated!.previousRefreshTokenHash).toBe(fresh!.refreshTokenHash);
    expect(rotated!.rotatedAt).toEqual(rotatedAt);
  });
});

describe('coordinator invites', () => {
  const invite = (v: Partial<s.NewCoordinatorInviteRow> = {}) =>
    db.insert(s.coordinatorInvites).values({
      phoneE164: nextPhone(),
      role: 'venue_coordinator',
      scopeType: 'venue',
      venueId: world.venue.id,
      cityId: world.city.id,
      expiresAt: new Date('2027-01-01T00:00:00Z'),
      ...v,
    });

  it('can name the assignment it replaces, and lets go of it when that assignment is deleted', async () => {
    const holder = await world.make.user();
    const [assignment] = await db
      .insert(s.roleAssignments)
      .values({
        userId: holder.id,
        role: 'venue_coordinator',
        scopeType: 'venue',
        venueId: world.venue.id,
        cityId: world.city.id,
      })
      .returning();
    const [plain] = await invite().returning();
    expect(plain!.replacesAssignmentId).toBeNull();
    const [handover] = await invite({ replacesAssignmentId: assignment!.id }).returning();
    expect(handover!.replacesAssignmentId).toBe(assignment!.id);
    // Deleting the old coordinator's account removes the assignment; the invite stays.
    await db.delete(s.users).where(eq(s.users.id, holder.id));
    const [after] = await db
      .select()
      .from(s.coordinatorInvites)
      .where(eq(s.coordinatorInvites.id, handover!.id));
    expect(after).toMatchObject({ id: handover!.id, replacesAssignmentId: null });
  });

  it('refuses an assignment that does not exist', async () => {
    const error = await violation(
      invite({ replacesAssignmentId: '00000000-0000-4000-8000-000000000003' }),
    );
    expect(error).toEqual({
      code: FOREIGN_KEY_VIOLATION,
      constraint: 'coordinator_invites_replaces_assignment_fk',
    });
  });
});

describe('messaging', () => {
  it('rejects scopes of the wrong shape on updates and the audit log', async () => {
    const update = (v: Partial<s.NewUpdateRow>) =>
      db
        .insert(s.updates)
        .values({ scopeType: 'national', kind: 'announcement', titleEn: 't', bodyEn: 'b', ...v });
    await update({});
    await update({ scopeType: 'city', cityId: world.city.id });
    await update({ scopeType: 'venue', venueId: world.venue.id, cityId: world.city.id });
    await update({ scopeType: 'venue', venueId: world.venue.id });
    expect((await violation(update({ scopeType: 'city' }))).constraint).toBe(
      'updates_scope_shape_chk',
    );
    expect(
      (await violation(update({ scopeType: 'national', cityId: world.city.id }))).constraint,
    ).toBe('updates_scope_shape_chk');
    expect((await violation(update({ scopeType: 'venue' }))).constraint).toBe(
      'updates_scope_shape_chk',
    );

    const audit = (v: Partial<s.NewAuditLogRow>) =>
      db
        .insert(s.auditLog)
        .values({ action: 'venue.update', entityType: 'venue', scopeType: 'national', ...v });
    await audit({});
    await audit({ scopeType: 'venue', venueId: world.venue.id, cityId: world.city.id });
    expect((await violation(audit({ scopeType: 'city' }))).constraint).toBe(
      'audit_log_scope_shape_chk',
    );
  });

  it('refuses an update that expires before it publishes', async () => {
    const error = await violation(
      db.insert(s.updates).values({
        scopeType: 'national',
        kind: 'announcement',
        titleEn: 't',
        bodyEn: 'b',
        publishAt: new Date('2026-05-02T00:00:00Z'),
        expiresAt: new Date('2026-05-01T00:00:00Z'),
      }),
    );
    expect(error.constraint).toBe('updates_expiry_chk');
  });

  it('keeps read state once per person and update', async () => {
    const user = await world.make.user();
    const [update] = await db
      .insert(s.updates)
      .values({ scopeType: 'national', kind: 'announcement', titleEn: 't', bodyEn: 'b' })
      .returning();
    await db.insert(s.updateReads).values({ userId: user.id, updateId: update!.id });
    expect(
      (await violation(db.insert(s.updateReads).values({ userId: user.id, updateId: update!.id })))
        .constraint,
    ).toBe('update_reads_pkey');
  });

  it('allows a template key once per language', async () => {
    const template = (locale: 'en' | 'ur') =>
      db.insert(s.messageTemplates).values({
        key: 'registration.confirmed',
        channel: 'whatsapp',
        locale,
        body: 'x',
        costCategory: 'utility',
      });
    await template('en');
    await template('ur');
    expect((await violation(template('en'))).constraint).toBe(
      'message_templates_key_locale_unique',
    );
  });

  it('makes outbox sends idempotent and keeps the queue index usable', async () => {
    const message = (key: string) =>
      db
        .insert(s.messageOutbox)
        .values({ idempotencyKey: key, channel: 'push', costCategory: 'free' });
    await message('reminder:occ-1:user-1');
    expect((await violation(message('reminder:occ-1:user-1'))).constraint).toBe(
      'message_outbox_idempotency_key_unique',
    );
    const [row] = await db
      .select()
      .from(s.messageOutbox)
      .where(eq(s.messageOutbox.idempotencyKey, 'reminder:occ-1:user-1'));
    expect(row).toMatchObject({
      status: 'queued',
      attempts: 0,
      payload: {},
      recipientPhoneE164: null,
      venueId: null,
      providerMessageId: null,
    });
  });

  it('ties an outbox row to a venue that can be deleted without losing the row', async () => {
    const venue = await world.make.venue(world.city.id, world.area.id);
    const key = nextSlug('outbox-venue');
    await db.insert(s.messageOutbox).values({
      idempotencyKey: key,
      channel: 'whatsapp',
      costCategory: 'utility',
      venueId: venue.id,
      providerMessageId: 'wamid.TEST-1',
    });
    const missing = await violation(
      db.insert(s.messageOutbox).values({
        idempotencyKey: nextSlug('outbox-venue'),
        channel: 'push',
        costCategory: 'free',
        venueId: '00000000-0000-4000-8000-000000000001',
      }),
    );
    expect(missing).toEqual({
      code: FOREIGN_KEY_VIOLATION,
      constraint: 'message_outbox_venue_id_venues_id_fk',
    });
    await db.delete(s.venues).where(eq(s.venues.id, venue.id));
    const [kept] = await db
      .select()
      .from(s.messageOutbox)
      .where(eq(s.messageOutbox.idempotencyKey, key));
    expect(kept).toMatchObject({ venueId: null, providerMessageId: 'wamid.TEST-1' });
  });

  it('finds an outbox row by provider message id through a partial index', async () => {
    const { rows } = await test.pg.query<{ indexdef: string }>(
      `SELECT indexdef FROM pg_indexes WHERE indexname = 'message_outbox_provider_message_id_idx'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.indexdef).toMatch(/\(provider_message_id\)/);
    expect(rows[0]!.indexdef).toMatch(/WHERE \(?provider_message_id IS NOT NULL\)?/);
    expect(rows[0]!.indexdef).not.toMatch(/UNIQUE/);
    // Not unique: the same provider id may legitimately appear on a retried row.
    const row = (key: string) =>
      db.insert(s.messageOutbox).values({
        idempotencyKey: key,
        channel: 'whatsapp',
        costCategory: 'utility',
        providerMessageId: 'wamid.SAME',
      });
    await row(nextSlug('pm'));
    await row(nextSlug('pm'));
  });

  it('keeps feature flags unique globally and per city', async () => {
    const flag = (key: string, cityId: string | null) =>
      db.insert(s.featureFlags).values({ key, cityId, enabled: true });
    const key = nextSlug('flag');
    await flag(key, null);
    expect((await violation(flag(key, null))).constraint).toBe('feature_flags_global_uq');
    await flag(key, world.city.id);
    expect((await violation(flag(key, world.city.id))).constraint).toBe('feature_flags_city_uq');
    const city2 = await world.make.city();
    await flag(key, city2.id);
  });

  it('numbers audit rows in order and defaults meta to an empty object', async () => {
    const [a] = await db
      .insert(s.auditLog)
      .values({ action: 'a', entityType: 'x', scopeType: 'national' })
      .returning();
    const [b] = await db
      .insert(s.auditLog)
      .values({ action: 'b', entityType: 'x', scopeType: 'national' })
      .returning();
    expect(b!.id).toBeGreaterThan(a!.id);
    expect(a!.meta).toEqual({});
    expect(a!.entityId).toBeNull();
  });
});

describe('bookmarks and reading positions', () => {
  const bookmark = (
    v: Partial<s.NewBookmarkRow> & { userId: string; kind: s.NewBookmarkRow['kind'] },
  ) => db.insert(s.bookmarks).values(v);

  it('rejects the same bookmark twice, treating empty parts as equal', async () => {
    const user = await world.make.user();
    await bookmark({ userId: user.id, kind: 'surah', surah: 2 });
    expect(
      (await violation(bookmark({ userId: user.id, kind: 'surah', surah: 2 }))).constraint,
    ).toBe('bookmarks_target_uq');
    await bookmark({ userId: user.id, kind: 'surah', surah: 3 });
    await bookmark({ userId: user.id, kind: 'ayah', surah: 2, ayah: 255 });
    expect(
      (await violation(bookmark({ userId: user.id, kind: 'ayah', surah: 2, ayah: 255 })))
        .constraint,
    ).toBe('bookmarks_target_uq');
    await bookmark({ userId: user.id, kind: 'ayah', surah: 2, ayah: 256 });
    await bookmark({ userId: user.id, kind: 'para', para: 1 });
    expect((await violation(bookmark({ userId: user.id, kind: 'para', para: 1 }))).constraint).toBe(
      'bookmarks_target_uq',
    );
    // Another person can save the same place.
    const other = await world.make.user();
    await bookmark({ userId: other.id, kind: 'surah', surah: 2 });
  });

  it('requires the fields that belong to each kind, and only those', async () => {
    const user = await world.make.user();
    const shape = 'bookmarks_target_shape_chk';
    expect(
      (await violation(bookmark({ userId: user.id, kind: 'ayah', surah: 2 }))).constraint,
    ).toBe(shape);
    expect((await violation(bookmark({ userId: user.id, kind: 'surah' }))).constraint).toBe(shape);
    expect(
      (await violation(bookmark({ userId: user.id, kind: 'surah', surah: 2, ayah: 1 }))).constraint,
    ).toBe(shape);
    expect(
      (await violation(bookmark({ userId: user.id, kind: 'para', surah: 2 }))).constraint,
    ).toBe(shape);
  });

  it('keeps surah, ayah and para numbers in range', async () => {
    const user = await world.make.user();
    expect(
      (await violation(bookmark({ userId: user.id, kind: 'surah', surah: 115 }))).constraint,
    ).toBe('bookmarks_surah_range_chk');
    expect(
      (await violation(bookmark({ userId: user.id, kind: 'surah', surah: 0 }))).constraint,
    ).toBe('bookmarks_surah_range_chk');
    expect(
      (await violation(bookmark({ userId: user.id, kind: 'para', para: 31 }))).constraint,
    ).toBe('bookmarks_para_range_chk');
    expect(
      (await violation(bookmark({ userId: user.id, kind: 'ayah', surah: 2, ayah: 287 })))
        .constraint,
    ).toBe('bookmarks_ayah_range_chk');
    await bookmark({ userId: user.id, kind: 'surah', surah: 114 });
    await bookmark({ userId: user.id, kind: 'para', para: 30 });
  });

  it('keeps one reading position per person', async () => {
    const user = await world.make.user();
    await db.insert(s.readingPositions).values({ userId: user.id, surah: 18, ayah: 10 });
    expect(
      (
        await violation(
          db.insert(s.readingPositions).values({ userId: user.id, surah: 18, ayah: 11 }),
        )
      ).constraint,
    ).toBe('reading_positions_pkey');
    expect(
      (
        await violation(
          db
            .insert(s.readingPositions)
            .values({ userId: (await world.make.user()).id, surah: 0, ayah: 1 }),
        )
      ).constraint,
    ).toBe('reading_positions_surah_range_chk');
  });
});

describe('days read, community total, ayah of the day and memorisation (0009)', () => {
  it('keeps one reading row per person, date and source', async () => {
    const user = await world.make.user();
    const day = (v: Partial<s.NewReadingDayRow> = {}) =>
      db
        .insert(s.readingDays)
        .values({ userId: user.id, day: '2027-02-15', source: 'reader', ...v });
    await day({ pages: 2, ayahs: 30 });
    expect((await violation(day())).constraint).toBe('reading_days_user_day_source_uq');
    await day({ source: 'manual' });
    await day({ day: '2027-02-16' });
    await db.insert(s.readingDays).values({
      userId: (await world.make.user()).id,
      day: '2027-02-15',
      source: 'reader',
    });
    const [row] = await db
      .select()
      .from(s.readingDays)
      .where(sql`${s.readingDays.userId} = ${user.id} AND ${s.readingDays.source} = 'manual'`);
    expect(row).toMatchObject({ pages: 0, ayahs: 0, day: '2027-02-15' });
  });

  it('keeps pages and ayahs within one day of reading, and needs a person', async () => {
    const user = await world.make.user();
    const day = (v: Partial<s.NewReadingDayRow>) =>
      db.insert(s.readingDays).values({ userId: user.id, day: '2027-02-15', source: 'goal', ...v });
    expect((await violation(day({ pages: 605 }))).constraint).toBe('reading_days_pages_range_chk');
    expect((await violation(day({ pages: -1 }))).constraint).toBe('reading_days_pages_range_chk');
    expect((await violation(day({ ayahs: 6237 }))).constraint).toBe('reading_days_ayahs_range_chk');
    await day({ pages: 604, ayahs: 6236 });
    expect(
      (
        await violation(
          db.insert(s.readingDays).values({
            userId: '00000000-0000-4000-8000-0a0000009999',
            day: '2027-02-15',
            source: 'reader',
          }),
        )
      ).code,
    ).toBe(FOREIGN_KEY_VIOLATION);
  });

  it('counts the national total per date, never below zero', async () => {
    await db.insert(s.communityDays).values({ day: '2027-03-01' });
    const [fresh] = await db
      .select()
      .from(s.communityDays)
      .where(eq(s.communityDays.day, '2027-03-01'));
    expect(fresh).toMatchObject({ readers: 0, pages: 0 });
    expect(
      (await violation(db.insert(s.communityDays).values({ day: '2027-03-01' }))).constraint,
    ).toBe('community_days_pkey');
    expect(
      (await violation(db.insert(s.communityDays).values({ day: '2027-03-02', readers: -1 })))
        .constraint,
    ).toBe('community_days_readers_chk');
    expect(
      (await violation(db.insert(s.communityDays).values({ day: '2027-03-02', pages: -1 })))
        .constraint,
    ).toBe('community_days_pages_chk');
    // The API adds to a day with one statement, so two readers at once both count.
    await test.pg.query(
      `INSERT INTO community_days (day, readers, pages) VALUES ('2027-03-01', 1, 4)
       ON CONFLICT (day) DO UPDATE SET readers = community_days.readers + 1, pages = community_days.pages + 4`,
    );
    expect(await count('community_days', `day = '2027-03-01' AND readers = 1 AND pages = 4`)).toBe(
      1,
    );
  });

  describe('ayah of the day picks', () => {
    const pick = (v: Partial<s.NewDailyAyahRow> & { day: string }) =>
      db.insert(s.dailyAyahs).values({ scopeType: 'national', surah: 2, ayah: 255, ...v });

    it('keeps one pick per date and scope, national, venue or circle', async () => {
      const circle = await world.make.circle(world.venue.id);
      await pick({ day: '2027-04-01' });
      expect((await violation(pick({ day: '2027-04-01', ayah: 1 }))).constraint).toBe(
        'daily_ayahs_day_scope_uq',
      );
      const atVenue = {
        scopeType: 'venue' as const,
        cityId: world.city.id,
        venueId: world.venue.id,
      };
      await pick({ day: '2027-04-01', ...atVenue });
      expect((await violation(pick({ day: '2027-04-01', ...atVenue }))).constraint).toBe(
        'daily_ayahs_day_scope_uq',
      );
      const atCircle = { ...atVenue, scopeType: 'circle' as const, circleId: circle.id };
      await pick({ day: '2027-04-01', ...atCircle });
      expect((await violation(pick({ day: '2027-04-01', ...atCircle }))).constraint).toBe(
        'daily_ayahs_day_scope_uq',
      );
      await pick({ day: '2027-04-02' });
    });

    it('requires the place that belongs to each scope, and only that', async () => {
      const circle = await world.make.circle(world.venue.id);
      const shape = 'daily_ayahs_scope_shape_chk';
      const c = world.city.id;
      const v = world.venue.id;
      expect((await violation(pick({ day: '2027-04-03', cityId: c }))).constraint).toBe(shape);
      expect(
        (await violation(pick({ day: '2027-04-03', scopeType: 'venue', cityId: c }))).constraint,
      ).toBe(shape);
      expect(
        (await violation(pick({ day: '2027-04-03', scopeType: 'venue', venueId: v }))).constraint,
      ).toBe(shape);
      expect(
        (
          await violation(
            pick({
              day: '2027-04-03',
              scopeType: 'venue',
              cityId: c,
              venueId: v,
              circleId: circle.id,
            }),
          )
        ).constraint,
      ).toBe(shape);
      expect(
        (
          await violation(
            pick({ day: '2027-04-03', scopeType: 'circle', cityId: c, circleId: circle.id }),
          )
        ).constraint,
      ).toBe(shape);
      expect(
        (await violation(pick({ day: '2027-04-03', scopeType: 'city' as never, cityId: c }))).code,
      ).toBe(CHECK_VIOLATION);
    });

    it('only stores ayat that exist in their surah', async () => {
      expect((await violation(pick({ day: '2027-04-04', surah: 115 }))).constraint).toBe(
        'daily_ayahs_surah_range_chk',
      );
      expect((await violation(pick({ day: '2027-04-04', ayah: 0 }))).constraint).toBe(
        'daily_ayahs_ayah_range_chk',
      );
      expect((await violation(pick({ day: '2027-04-04', ayah: 287 }))).code).toBe(CHECK_VIOLATION);
      expect((await violation(pick({ day: '2027-04-04', surah: 1, ayah: 8 }))).constraint).toBe(
        'daily_ayahs_ayah_in_surah_chk',
      );
      expect((await violation(pick({ day: '2027-04-04', surah: 114, ayah: 7 }))).constraint).toBe(
        'daily_ayahs_ayah_in_surah_chk',
      );
      await pick({ day: '2027-04-04', surah: 114, ayah: 6 });
      await pick({ day: '2027-04-05', surah: 2, ayah: 286 });
      await pick({ day: '2027-04-06', surah: 1, ayah: 7 });
    });

    it('goes with the venue or circle it was set for', async () => {
      const area = await world.make.area(world.city.id);
      const venue = await world.make.venue(world.city.id, area.id);
      const circle = await world.make.circle(venue.id);
      const [p] = await pick({
        day: '2027-04-07',
        scopeType: 'circle',
        cityId: world.city.id,
        venueId: venue.id,
        circleId: circle.id,
      }).returning();
      await db.delete(s.circles).where(eq(s.circles.id, circle.id));
      expect(await count('daily_ayahs', 'id = $1', [p!.id])).toBe(0);
    });
  });

  it('keeps one memorisation row per person and surah, in range and state', async () => {
    const user = await world.make.user();
    const mark = (v: Partial<s.NewMemorisationRow> = {}) =>
      db.insert(s.memorisation).values({ userId: user.id, surah: 67, status: 'learning', ...v });
    await mark();
    expect((await violation(mark({ status: 'memorised' }))).constraint).toBe(
      'memorisation_user_surah_uq',
    );
    expect((await violation(mark({ surah: 0 }))).constraint).toBe('memorisation_surah_range_chk');
    expect((await violation(mark({ surah: 115 }))).constraint).toBe('memorisation_surah_range_chk');
    expect((await violation(mark({ surah: 1, status: 'forgotten' as never }))).constraint).toBe(
      'memorisation_status_chk',
    );
    await mark({ surah: 114, status: 'revising', lastRevisedAt: new Date('2027-02-15T08:00:00Z') });
    await db
      .insert(s.memorisation)
      .values({ userId: (await world.make.user()).id, surah: 67, status: 'memorised' });
  });

  it('stores a daily goal as both unit and amount, or neither, and the revise setting in range', async () => {
    const profile = async (v: Partial<s.NewProfileRow>) =>
      db.insert(s.profiles).values({ userId: (await world.make.user()).id, ...v });
    await profile({
      dailyGoalUnit: 'minutes',
      dailyGoalAmount: 10,
      memorisationReviseAfterDays: 7,
    });
    await profile({});
    expect((await violation(profile({ dailyGoalUnit: 'pages' }))).constraint).toBe(
      'profiles_daily_goal_shape_chk',
    );
    expect((await violation(profile({ dailyGoalAmount: 2 }))).constraint).toBe(
      'profiles_daily_goal_shape_chk',
    );
    expect(
      (await violation(profile({ dailyGoalUnit: 'pages', dailyGoalAmount: 605 }))).constraint,
    ).toBe('profiles_daily_goal_amount_range_chk');
    expect(
      (await violation(profile({ dailyGoalUnit: 'pages', dailyGoalAmount: 0 }))).constraint,
    ).toBe('profiles_daily_goal_amount_range_chk');
    expect((await violation(profile({ memorisationReviseAfterDays: 0 }))).constraint).toBe(
      'profiles_memorisation_revise_after_days_range_chk',
    );
    expect((await violation(profile({ memorisationReviseAfterDays: 366 }))).constraint).toBe(
      'profiles_memorisation_revise_after_days_range_chk',
    );
  });

  it('accepts the ayah_daily preference as a consent purpose', async () => {
    const user = await world.make.user();
    await db
      .insert(s.consents)
      .values({ userId: user.id, channel: 'push', purpose: 'ayah_daily', source: 'profile' });
    expect(await count('consents', `user_id = $1 AND purpose = 'ayah_daily'`, [user.id])).toBe(1);
  });
});

describe('attendance and progress', () => {
  it('counts at least one person per row and keeps the headcount when a registration goes', async () => {
    const session = await world.make.session(world.venue.id, world.program.id);
    const occurrence = await world.make.occurrence(session.id);
    const marker = await world.make.user();
    expect(
      (await violation(db.insert(s.attendance).values({ occurrenceId: occurrence.id, count: 0 })))
        .constraint,
    ).toBe('attendance_count_chk');
    const [dropIn] = await db
      .insert(s.attendance)
      .values({ occurrenceId: occurrence.id, count: 12, markedBy: marker.id })
      .returning();
    expect(dropIn).toMatchObject({ count: 12, name: null });
    const registration = await world.make.registration(null, session.id, world.area.id);
    const [named] = await db
      .insert(s.attendance)
      .values({ occurrenceId: occurrence.id, registrationId: registration.id, name: 'Test Person' })
      .returning();
    expect(named!.count).toBe(1);
    await db.delete(s.registrations).where(eq(s.registrations.id, registration.id));
    const [after] = await db.select().from(s.attendance).where(eq(s.attendance.id, named!.id));
    expect(after!.registrationId).toBeNull();
  });
});

describe('posters and legacy data', () => {
  it('keeps a snapshot of the session details with each poster', async () => {
    const [template] = await db
      .insert(s.posterTemplates)
      .values({ key: nextSlug('tpl'), nameEn: 'n', nameUr: 'n', formats: ['story'] })
      .returning();
    expect(template).toMatchObject({ version: 1, isActive: true, fieldsSchema: {} });
    const snapshot = { titleEn: 'Weekly tafsir', startsOn: '2026-03-01' };
    const [poster] = await db
      .insert(s.posters)
      .values({
        templateId: template!.id,
        sessionId: world.session.id,
        format: 'story',
        locale: 'en',
        sourceSnapshot: snapshot,
      })
      .returning();
    expect(poster).toMatchObject({ status: 'queued', storageKey: null, sourceSnapshot: snapshot });
    const noSnapshot = await violation(
      test.pg.query(
        `INSERT INTO posters (template_id, session_id, format, locale) VALUES ($1, $2, 'story', 'en')`,
        [template!.id, world.session.id],
      ),
    );
    expect(noSnapshot.code).toBe(NOT_NULL_VIOLATION);
  });

  it('keeps the rc.5 poster columns consistent: language, failure code, alt text, replacement', async () => {
    const [template] = await db
      .insert(s.posterTemplates)
      .values({ key: nextSlug('tpl'), nameEn: 'n', nameUr: 'n', formats: ['story'] })
      .returning();
    expect(template!.provisional).toBe(true);
    const base = {
      templateId: template!.id,
      sessionId: world.session.id,
      format: 'story' as const,
      sourceSnapshot: { sessionId: world.session.id },
    };
    const [old] = await db
      .insert(s.posters)
      .values({ ...base, locale: 'ur', language: 'ur_en' })
      .returning();
    expect(old).toMatchObject({ failureCode: null, altText: null, replacesPosterId: null });
    // The leading language must be the locale.
    const mismatch = await violation(
      db.insert(s.posters).values({ ...base, locale: 'en', language: 'ur_en' }),
    );
    expect(mismatch).toEqual({ code: CHECK_VIOLATION, constraint: 'posters_language_locale_chk' });
    // A failure code only on a failed poster.
    const queuedWithCode = await violation(
      db.insert(s.posters).values({ ...base, locale: 'en', failureCode: 'text_too_long' }),
    );
    expect(queuedWithCode.constraint).toBe('posters_failure_code_status_chk');
    const [failed] = await db
      .insert(s.posters)
      .values({ ...base, locale: 'en', status: 'failed', failureCode: 'text_too_long' })
      .returning();
    expect(failed!.failureCode).toBe('text_too_long');
    // Alt text is an object of sentences, never a bare string.
    const notObject = await violation(
      test.pg.query(
        `INSERT INTO posters (template_id, session_id, format, locale, source_snapshot, alt_text)
         VALUES ($1, $2, 'story', 'en', '{}', '"just text"')`,
        [template!.id, world.session.id],
      ),
    );
    expect(notObject.constraint).toBe('posters_alt_text_object_chk');
    const [fresh] = await db
      .insert(s.posters)
      .values({
        ...base,
        locale: 'ur',
        language: 'ur_en',
        status: 'ready',
        altText: { en: 'Poster', ur: 'پوسٹر' },
        replacesPosterId: old!.id,
      })
      .returning();
    expect(fresh!.altText).toEqual({ en: 'Poster', ur: 'پوسٹر' });
    const dangling = await violation(
      db.insert(s.posters).values({
        ...base,
        locale: 'en',
        replacesPosterId: '00000000-0000-4000-8000-00000000dead',
      }),
    );
    expect(dangling.code).toBe(FOREIGN_KEY_VIOLATION);
    // Deleting the replaced poster (the worker's swap) leaves the new one in place.
    await db.delete(s.posters).where(eq(s.posters.id, old!.id));
    const [after] = await db.select().from(s.posters).where(eq(s.posters.id, fresh!.id));
    expect(after!.replacesPosterId).toBeNull();
  });

  it('tags legacy registrations with the season and refuses a repeated source row', async () => {
    const row = (sourceId: string, seasonTag?: string) =>
      db.insert(s.legacyRegistrations).values({
        sourceId,
        ...(seasonTag ? { seasonTag } : {}),
        name: 'Synthetic Person',
        phoneRaw: '0300-0000001',
        cityName: 'Test City',
        venueName: 'Test Masjid',
        raw: { synthetic: true },
      });
    await row('v1-1');
    expect((await violation(row('v1-1'))).constraint).toBe(
      'legacy_registrations_season_source_unique',
    );
    await row('v1-1', 'ramadan-2027');
    const [stored] = await db
      .select()
      .from(s.legacyRegistrations)
      .where(eq(s.legacyRegistrations.sourceId, 'v1-1'));
    expect(stored!.seasonTag).toBe('ramadan-2026');
    // Raw phones are kept as they were: no E.164 rule on legacy data.
    expect(stored!.phoneRaw).toBe('0300-0000001');
  });

  it('marks legacy subscribers as needing re-consent', async () => {
    const [subscriber] = await db
      .insert(s.legacyWhatsappSubscribers)
      .values({ phoneRaw: '+923000000902' })
      .returning();
    expect(subscriber).toMatchObject({
      needsReconsent: true,
      seasonTag: 'ramadan-2026',
      name: null,
      cityId: null,
    });
  });

  it('keeps one legacy subscriber per phone and season, and only E.164 phones', async () => {
    const subscriber = (phoneRaw: string, seasonTag?: string) =>
      db
        .insert(s.legacyWhatsappSubscribers)
        .values({ phoneRaw, ...(seasonTag ? { seasonTag } : {}) });
    await subscriber('+923000000903');
    expect((await violation(subscriber('+923000000903'))).constraint).toBe(
      'legacy_whatsapp_subscribers_season_phone_unique',
    );
    // Another season may hold the same number; ON CONFLICT DO NOTHING now has something to hit.
    await subscriber('+923000000903', 'ramadan-2027');
    const { rowCount } = await test.pg.query(
      `INSERT INTO legacy_whatsapp_subscribers (phone_raw) VALUES ('+923000000903')
       ON CONFLICT (season_tag, phone_raw) DO NOTHING`,
    );
    expect(rowCount).toBe(0);
    for (const bad of ['0300-0000004', '03000000004', '+0923000000004', '+92 300 0000004', '']) {
      expect((await violation(subscriber(bad))).constraint, bad).toBe(
        'legacy_whatsapp_subscribers_phone_raw_chk',
      );
    }
  });

  it('records the city a legacy subscriber signed up for, optionally', async () => {
    const city = await world.make.city();
    const [withCity] = await db
      .insert(s.legacyWhatsappSubscribers)
      .values({ phoneRaw: '+923000000905', cityId: city.id })
      .returning();
    expect(withCity!.cityId).toBe(city.id);
    const missing = await violation(
      db
        .insert(s.legacyWhatsappSubscribers)
        .values({ phoneRaw: '+923000000906', cityId: '00000000-0000-4000-8000-000000000002' }),
    );
    expect(missing).toEqual({
      code: FOREIGN_KEY_VIOLATION,
      constraint: 'legacy_whatsapp_subscribers_city_id_cities_id_fk',
    });
  });
});

describe('deleting an account', () => {
  it('anonymises registrations (keeping the counts) and removes the rest of the person’s data', async () => {
    const session = await world.make.session(world.venue.id, world.program.id);
    const occurrence = await world.make.occurrence(session.id);
    const circle = await world.make.circle(world.venue.id);
    const user = await world.make.user();
    const keeper = await world.make.user();

    const registration = await world.make.registration(user.id, session.id, world.area.id, {
      partySize: 4,
    });
    await world.make.registration(keeper.id, session.id, world.area.id, { partySize: 2 });
    const before = await test.pg.query<{ regs: number; people: number }>(
      `SELECT count(*)::int AS regs, sum(party_size)::int AS people FROM registrations WHERE session_id = $1`,
      [session.id],
    );

    await db
      .insert(s.profiles)
      .values({ userId: user.id, areaId: world.area.id, profession: 'Teacher' });
    await db.insert(s.follows).values({ userId: user.id, venueId: world.venue.id });
    await db.insert(s.follows).values({ userId: user.id, circleId: circle.id });
    await db
      .insert(s.consents)
      .values({ userId: user.id, channel: 'whatsapp', purpose: 'venue_alerts', source: 't' });
    await db.insert(s.devices).values({
      userId: user.id,
      platform: 'ios',
      provider: 'apns',
      token: nextSlug('tok'),
      locale: 'ur',
    });
    await db.insert(s.authSessions).values({
      userId: user.id,
      refreshTokenHash: nextSlug('rt'),
      expiresAt: new Date('2027-01-01T00:00:00Z'),
    });
    await db.insert(s.bookmarks).values({ userId: user.id, kind: 'surah', surah: 1 });
    await db.insert(s.readingPositions).values({ userId: user.id, surah: 1, ayah: 1 });
    await db.insert(s.readingDays).values({ userId: user.id, day: '2027-02-15', source: 'reader' });
    await db.insert(s.memorisation).values({ userId: user.id, surah: 1, status: 'memorised' });
    await db
      .insert(s.communityDays)
      .values({ day: '2027-01-15', readers: 1, pages: 3 })
      .onConflictDoNothing();
    const [pick] = await db
      .insert(s.dailyAyahs)
      .values({ day: '2027-01-15', scopeType: 'national', surah: 2, ayah: 255, setBy: user.id })
      .returning();
    await db.insert(s.circleRequests).values({
      userId: user.id,
      areaId: world.area.id,
      expiresAt: new Date('2027-01-01T00:00:00Z'),
    });
    await db.insert(s.roleAssignments).values({
      userId: user.id,
      role: 'venue_coordinator',
      scopeType: 'venue',
      venueId: world.venue.id,
    });
    const [update] = await db
      .insert(s.updates)
      .values({
        scopeType: 'national',
        kind: 'announcement',
        titleEn: 't',
        bodyEn: 'b',
        authorId: user.id,
      })
      .returning();
    await db.insert(s.updateReads).values({ userId: user.id, updateId: update!.id });
    const [outbox] = await db
      .insert(s.messageOutbox)
      .values({
        idempotencyKey: nextSlug('del'),
        channel: 'whatsapp',
        costCategory: 'utility',
        recipientUserId: user.id,
        sentBy: user.id,
      })
      .returning();
    await db
      .insert(s.auditLog)
      .values({ actorUserId: user.id, action: 'x', entityType: 'y', scopeType: 'national' });
    await db.insert(s.attendance).values({ occurrenceId: occurrence.id, markedBy: user.id });
    await db
      .update(s.circles)
      .set({ createdBy: user.id, approvedBy: user.id })
      .where(eq(s.circles.id, circle.id));

    await db.delete(s.users).where(eq(s.users.id, user.id));

    const after = await test.pg.query<{ regs: number; people: number }>(
      `SELECT count(*)::int AS regs, sum(party_size)::int AS people FROM registrations WHERE session_id = $1`,
      [session.id],
    );
    expect(after.rows[0]).toEqual(before.rows[0]);
    const [kept] = await db
      .select()
      .from(s.registrations)
      .where(eq(s.registrations.id, registration.id));
    expect(kept).toMatchObject({ userId: null, partySize: 4 });

    for (const table of [
      'profiles',
      'follows',
      'consents',
      'devices',
      'auth_sessions',
      'bookmarks',
      'reading_positions',
      'reading_days',
      'memorisation',
      'circle_requests',
      'role_assignments',
      'update_reads',
    ]) {
      expect(await count(table, 'user_id = $1', [user.id]), table).toBe(0);
    }

    // The national total keeps the anonymous count; a pick the person set stays, unattributed.
    expect(await count('community_days', `day = '2027-01-15' AND readers = 1 AND pages = 3`)).toBe(
      1,
    );
    const [pickAfter] = await db.select().from(s.dailyAyahs).where(eq(s.dailyAyahs.id, pick!.id));
    expect(pickAfter).toMatchObject({ setBy: null, surah: 2, ayah: 255 });

    // Things the person made stay, with the author cleared.
    const [feedItem] = await db.select().from(s.updates).where(eq(s.updates.id, update!.id));
    expect(feedItem!.authorId).toBeNull();
    const [sent] = await db
      .select()
      .from(s.messageOutbox)
      .where(eq(s.messageOutbox.id, outbox!.id));
    expect(sent).toMatchObject({ recipientUserId: null, sentBy: null });
    const [circleAfter] = await db.select().from(s.circles).where(eq(s.circles.id, circle.id));
    expect(circleAfter).toMatchObject({ createdBy: null, approvedBy: null });
    expect(await count('audit_log', 'actor_user_id IS NULL AND action = $1', ['x'])).toBe(1);
    expect(
      await count('attendance', 'occurrence_id = $1 AND marked_by IS NULL', [occurrence.id]),
    ).toBe(1);

    // The other person is untouched.
    expect(await count('registrations', 'user_id = $1', [keeper.id])).toBe(1);
  });

  it('is never blocked by a foreign key: every reference to a user cascades or clears', async () => {
    const { rows } = await test.pg.query<{ conname: string; tbl: string; confdeltype: string }>(
      `SELECT conname, conrelid::regclass::text AS tbl, confdeltype
         FROM pg_constraint
        WHERE contype = 'f' AND confrelid = 'users'::regclass`,
    );
    expect(rows.length).toBeGreaterThan(15);
    const blocking = rows.filter((r) => r.confdeltype !== 'c' && r.confdeltype !== 'n');
    expect(blocking).toEqual([]);
  });

  it('removes a deleted account’s sign-in data but keeps other people’s', async () => {
    const user = await world.make.user();
    const other = await world.make.user();
    const [mine] = await db
      .insert(s.authSessions)
      .values({
        userId: user.id,
        refreshTokenHash: nextSlug('rt'),
        expiresAt: new Date('2027-01-01T00:00:00Z'),
      })
      .returning();
    await db.insert(s.authSessions).values({
      userId: other.id,
      refreshTokenHash: nextSlug('rt'),
      expiresAt: new Date('2027-01-01T00:00:00Z'),
    });
    await db.delete(s.users).where(eq(s.users.id, user.id));
    expect(await count('auth_sessions', 'id = $1', [mine!.id])).toBe(0);
    expect(await count('auth_sessions', 'user_id = $1', [other.id])).toBe(1);
  });
});

describe('typed rows', () => {
  it('round-trips a row through Drizzle with the inferred types', async () => {
    const user = await world.make.user({ displayName: 'Typed Person', locale: 'en' });
    const row: s.UserRow = (await db.select().from(s.users).where(eq(s.users.id, user.id)))[0]!;
    expect(row.displayName).toBe('Typed Person');
    expect(row.locale).toBe('en');
    const total = await db.select({ n: sql<number>`count(*)::int` }).from(s.users);
    expect(total[0]!.n).toBeGreaterThan(0);
  });
});
