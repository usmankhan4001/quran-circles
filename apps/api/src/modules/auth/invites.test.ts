import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { ApiError, RequestCodeResponse, SignInResponse } from '@qc/contracts';
import { schema } from '@qc/db';
import { PHONE_A, PHONE_B, createHarness, type Harness } from '../../auth/testing/harness';

vi.setConfig({ testTimeout: 30_000, hookTimeout: 60_000 });

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
}, 60_000);
afterAll(async () => {
  await h.close();
});
beforeEach(async () => {
  await h.reset();
});

type InviteShape = {
  phone?: string;
  role: 'national_admin' | 'city_coordinator' | 'venue_coordinator';
  cityId?: string;
  venueId?: string;
  displayName?: string;
  status?: 'pending' | 'accepted' | 'revoked' | 'expired';
  expiresInSeconds?: number;
  invitedBy?: string;
};

async function invite(shape: InviteShape) {
  const [row] = await h.db
    .insert(schema.coordinatorInvites)
    .values({
      phoneE164: shape.phone ?? PHONE_A,
      displayName: shape.displayName ?? null,
      role: shape.role,
      scopeType:
        shape.role === 'national_admin'
          ? 'national'
          : shape.role === 'city_coordinator'
            ? 'city'
            : 'venue',
      cityId: shape.cityId ?? null,
      venueId: shape.venueId ?? null,
      invitedBy: shape.invitedBy ?? null,
      status: shape.status ?? 'pending',
      createdAt: h.clock.now(),
      expiresAt: new Date(h.clock.now().getTime() + (shape.expiresInSeconds ?? 7 * 86400) * 1000),
    })
    .returning();
  if (!row) throw new Error('invite not created');
  return row;
}

const inviteRow = async (id: string) => {
  const [row] = await h.db
    .select()
    .from(schema.coordinatorInvites)
    .where(eq(schema.coordinatorInvites.id, id));
  return row;
};
const assignments = () => h.db.select().from(schema.roleAssignments);
const audits = () => h.db.select().from(schema.auditLog);

describe('coordinator invites at sign-in', () => {
  it('makes a venue coordinator of a new account, atomically with the account', async () => {
    const admin = await h.createUser();
    const row = await invite({
      role: 'venue_coordinator',
      venueId: h.world.venueA1,
      displayName: 'Bilal Ahmed',
      invitedBy: admin.id,
    });
    const result = await h.signIn(PHONE_A);
    expect(result.status).toBe(200);
    const body = SignInResponse.parse(result.body);
    expect(body.isNewAccount).toBe(true);
    expect(body.me.displayName).toBe('Bilal Ahmed');
    expect(body.me.roles).toHaveLength(1);
    expect(body.me.roles[0]).toMatchObject({
      role: 'venue_coordinator',
      scopeType: 'venue',
      venueId: h.world.venueA1,
      scopeName: { en: 'Venue A1' },
    });

    const accepted = await inviteRow(row.id);
    expect(accepted?.status).toBe('accepted');
    expect(accepted?.acceptedBy).toBe(body.me.id);
    expect(accepted?.acceptedAt?.getTime()).toBe(h.clock.now().getTime());

    const [assignment] = await assignments();
    expect(assignment).toMatchObject({
      userId: body.me.id,
      role: 'venue_coordinator',
      venueId: h.world.venueA1,
      grantedBy: admin.id,
      revokedAt: null,
    });
  });

  it('writes an audit row that names the scope but no personal data', async () => {
    const row = await invite({ role: 'venue_coordinator', venueId: h.world.venueA1 });
    const { body } = await h.signIn(PHONE_A);
    const [entry] = await audits();
    expect(entry).toMatchObject({
      actorUserId: body.me.id,
      action: 'role.accept_invite',
      entityType: 'role_assignment',
      scopeType: 'venue',
      venueId: h.world.venueA1,
      cityId: h.world.cityA.id,
    });
    expect(entry?.meta).toEqual({ inviteId: row.id, role: 'venue_coordinator', assigned: true });
    expect(JSON.stringify(entry)).not.toContain(PHONE_A);
    expect(JSON.stringify(entry)).not.toContain(PHONE_A.slice(1));
  });

  it('accepts a city coordinator invite and a national admin invite', async () => {
    await invite({ role: 'city_coordinator', cityId: h.world.cityB.id });
    const city = await h.signIn(PHONE_A);
    expect(city.body.me.roles).toMatchObject([
      { role: 'city_coordinator', scopeType: 'city', scopeName: { en: 'City B' } },
    ]);

    await invite({ phone: PHONE_B, role: 'national_admin' });
    const national = await h.signIn(PHONE_B);
    expect(national.body.me.roles).toMatchObject([
      { role: 'national_admin', scopeType: 'national', scopeName: null },
    ]);
  });

  it('adds the role to an existing account and keeps its name', async () => {
    const user = await h.createUser({ phoneE164: PHONE_A, displayName: 'Amina Khan' });
    await invite({
      role: 'city_coordinator',
      cityId: h.world.cityA.id,
      displayName: 'Someone Else',
    });
    const { body } = await h.signIn(PHONE_A);
    expect(body.isNewAccount).toBe(false);
    expect(body.me.id).toBe(user.id);
    expect(body.me.displayName).toBe('Amina Khan');
    expect(body.me.roles).toHaveLength(1);
  });

  it('accepts several pending invites for one number together', async () => {
    await invite({ role: 'venue_coordinator', venueId: h.world.venueA1 });
    await invite({ role: 'venue_coordinator', venueId: h.world.venueA2 });
    const { body } = await h.signIn(PHONE_A);
    expect(body.me.roles).toHaveLength(2);
    expect(await audits()).toHaveLength(2);
  });

  it('ignores invites for other numbers, and revoked or already accepted ones', async () => {
    await invite({ phone: PHONE_B, role: 'national_admin' });
    await invite({ role: 'city_coordinator', cityId: h.world.cityA.id, status: 'revoked' });
    await invite({ role: 'city_coordinator', cityId: h.world.cityB.id, status: 'accepted' });
    const { body } = await h.signIn(PHONE_A);
    expect(body.me.roles).toEqual([]);
    expect(await assignments()).toHaveLength(0);
  });

  it('does not duplicate a role the person already holds', async () => {
    const user = await h.createUser({ phoneE164: PHONE_A });
    await h.grantRole(user.id, 'venue_coordinator', { venueId: h.world.venueA1 });
    const row = await invite({ role: 'venue_coordinator', venueId: h.world.venueA1 });
    const { body } = await h.signIn(PHONE_A);
    expect(body.me.roles).toHaveLength(1);
    expect((await inviteRow(row.id))?.status).toBe('accepted');
    const [entry] = await audits();
    expect(entry?.meta).toMatchObject({ assigned: false });
  });

  it('accepts the invite once: a retired code cannot, the newest code does', async () => {
    const row = await invite({ role: 'venue_coordinator', venueId: h.world.venueA1 });
    const first = RequestCodeResponse.parse(await (await h.requestCode(PHONE_A)).json());
    const retiredCode = h.sender.last?.code ?? '';
    h.clock.advance(61);
    const second = RequestCodeResponse.parse(await (await h.requestCode(PHONE_A)).json());
    const newestCode = h.sender.last?.code ?? '';
    const [retired, newest] = await Promise.all([
      h.post('/v1/auth/verify', { challengeId: first.challengeId, code: retiredCode }),
      h.post('/v1/auth/verify', { challengeId: second.challengeId, code: newestCode }),
    ]);
    expect(retired.status).toBe(400);
    expect(newest.status).toBe(200);
    expect(await assignments()).toHaveLength(1);
    expect((await inviteRow(row.id))?.status).toBe('accepted');
  });

  it('tells the person when their invitation has lapsed, without losing the code', async () => {
    const row = await invite({
      role: 'venue_coordinator',
      venueId: h.world.venueA1,
      expiresInSeconds: 3600,
    });
    h.clock.advance(7200);
    const asked = RequestCodeResponse.parse(await (await h.requestCode(PHONE_A)).json());
    const code = h.sender.last?.code ?? '';
    const refused = await h.post('/v1/auth/verify', { challengeId: asked.challengeId, code });
    expect(refused.status).toBe(410);
    expect(ApiError.parse(await refused.json()).error.code).toBe('invite_expired');

    expect((await inviteRow(row.id))?.status).toBe('expired');
    expect(await h.db.select().from(schema.users)).toHaveLength(0);
    expect(await h.db.select().from(schema.authSessions)).toHaveLength(0);
    expect(await assignments()).toHaveLength(0);

    // The same code now signs the person in as an ordinary attendee.
    const retry = await h.post('/v1/auth/verify', { challengeId: asked.challengeId, code });
    expect(retry.status).toBe(200);
    expect(SignInResponse.parse(await retry.json()).me.roles).toEqual([]);
  });

  it('accepts a live invite and quietly drops a lapsed one for the same number', async () => {
    const lapsed = await invite({
      role: 'city_coordinator',
      cityId: h.world.cityB.id,
      expiresInSeconds: 60,
    });
    h.clock.advance(120);
    const live = await invite({ role: 'venue_coordinator', venueId: h.world.venueA2 });
    const { status, body } = await h.signIn(PHONE_A);
    expect(status).toBe(200);
    expect(body.me.roles).toHaveLength(1);
    expect(body.me.roles[0]?.role).toBe('venue_coordinator');
    expect((await inviteRow(lapsed.id))?.status).toBe('expired');
    expect((await inviteRow(live.id))?.status).toBe('accepted');
  });

  it('refuses a suspended account its invite and does not accept it', async () => {
    await h.createUser({ phoneE164: PHONE_A, status: 'suspended' });
    const row = await invite({ role: 'city_coordinator', cityId: h.world.cityA.id });
    const { status } = await h.signIn(PHONE_A);
    expect(status).toBe(403);
    expect((await inviteRow(row.id))?.status).toBe('pending');
    expect(await assignments()).toHaveLength(0);
  });

  it('leaves the invite pending when the sign-in fails part-way', async () => {
    const row = await invite({ role: 'venue_coordinator', venueId: h.world.venueA1 });
    await h.pg.exec(`
      CREATE FUNCTION fail_session() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'boom'; END; $$ LANGUAGE plpgsql;
      CREATE TRIGGER fail_session BEFORE INSERT ON auth_sessions FOR EACH ROW EXECUTE FUNCTION fail_session();
    `);
    try {
      const { status } = await h.signIn(PHONE_A);
      expect(status).toBe(500);
    } finally {
      await h.pg.exec('DROP TRIGGER fail_session ON auth_sessions; DROP FUNCTION fail_session();');
    }
    expect((await inviteRow(row.id))?.status).toBe('pending');
    expect(await assignments()).toHaveLength(0);
    expect(await audits()).toHaveLength(0);
    expect(await h.db.select().from(schema.users)).toHaveLength(0);
  });

  it('a role from an invite shows up with live roles only', async () => {
    await invite({ role: 'venue_coordinator', venueId: h.world.venueA1 });
    const first = await h.signIn(PHONE_A);
    await h.db
      .update(schema.roleAssignments)
      .set({ revokedAt: h.clock.now() })
      .where(and(eq(schema.roleAssignments.userId, first.body.me.id)));
    h.clock.advance(120);
    const again = await h.signIn(PHONE_A);
    expect(again.body.me.roles).toEqual([]);
  });
});
