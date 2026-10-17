import { and, eq } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  assertBootstrapAllowed,
  BOOTSTRAP_INVITE_TTL_DAYS,
  bootstrapNationalAdmin,
  BootstrapRefusedError,
  parseBootstrapArgs,
  type BootstrapRefusal,
} from './bootstrap-admin';
import * as schema from './schema/index';
import { createMigratedDb, factory, nextPhone, type TestDb } from './test/helpers';

const NOW = new Date('2026-10-17T09:00:00Z');
const DEV = { APP_ENV: 'development' };
const PROD = { APP_ENV: 'production' };

let test: TestDb;

beforeAll(async () => {
  test = await createMigratedDb();
});

beforeEach(async () => {
  // Each test starts with no invites, roles or audit rows. Users from earlier tests stay; they
  // hold no role once role_assignments is empty.
  await test.pg.exec(
    'DELETE FROM audit_log; DELETE FROM coordinator_invites; DELETE FROM role_assignments;',
  );
});

const invites = () => test.db.select().from(schema.coordinatorInvites);
const audits = () => test.db.select().from(schema.auditLog);

async function refusal(promise: Promise<unknown>): Promise<BootstrapRefusal> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof BootstrapRefusedError) return error.reason;
    throw error;
  }
  throw new Error('expected a refusal');
}

async function nationalAdmin(status: 'active' | 'suspended' = 'active', revoked = false) {
  const user = await factory(test).user({ status });
  await test.db.insert(schema.roleAssignments).values({
    userId: user.id,
    role: 'national_admin',
    scopeType: 'national',
    revokedAt: revoked ? NOW : null,
  });
  return user;
}

describe('bootstrapNationalAdmin', () => {
  it('creates the pending national-admin invite the API would, with an audit row', async () => {
    const phone = nextPhone();
    const result = await bootstrapNationalAdmin(test.db, { phone, env: DEV, now: NOW });

    const [invite] = await invites();
    expect(invite).toMatchObject({
      id: result.inviteId,
      phoneE164: phone,
      role: 'national_admin',
      scopeType: 'national',
      cityId: null,
      venueId: null,
      invitedBy: null,
      replacesAssignmentId: null,
      status: 'pending',
      acceptedBy: null,
    });
    expect(invite!.expiresAt.getTime() - NOW.getTime()).toBe(
      BOOTSTRAP_INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
    );
    expect(result.expiresAt).toEqual(invite!.expiresAt);
    expect(result.replacedInviteId).toBeNull();

    const [audit] = await audits();
    expect(audit).toMatchObject({
      actorUserId: null,
      action: 'role.invite',
      entityType: 'invite',
      entityId: result.inviteId,
      scopeType: 'national',
      cityId: null,
      venueId: null,
      meta: {
        role: 'national_admin',
        replacesInviteId: null,
        replacesAssignmentId: null,
        source: 'bootstrap-admin',
        forceAdditional: false,
      },
    });
    // The number is never in the audit trail.
    expect(JSON.stringify(audit)).not.toContain(phone);
  });

  it('is picked up by the sign-in query: pending, national, not yet expired', async () => {
    const phone = nextPhone();
    await bootstrapNationalAdmin(test.db, { phone, env: DEV, now: NOW });
    const live = await test.db
      .select()
      .from(schema.coordinatorInvites)
      .where(
        and(
          eq(schema.coordinatorInvites.phoneE164, phone),
          eq(schema.coordinatorInvites.status, 'pending'),
        ),
      );
    expect(live).toHaveLength(1);
    expect(live[0]!.expiresAt > NOW).toBe(true);
  });

  it('refuses when an active national admin exists, and writes nothing', async () => {
    await nationalAdmin();
    const phone = nextPhone();
    expect(await refusal(bootstrapNationalAdmin(test.db, { phone, env: DEV, now: NOW }))).toBe(
      'admin_exists',
    );
    expect(await invites()).toHaveLength(0);
    expect(await audits()).toHaveLength(0);
  });

  it('adds another admin with forceAdditional, and records that it was forced', async () => {
    await nationalAdmin();
    const result = await bootstrapNationalAdmin(test.db, {
      phone: nextPhone(),
      forceAdditional: true,
      env: DEV,
      now: NOW,
    });
    expect((await invites()).map((i) => i.id)).toEqual([result.inviteId]);
    const [audit] = await audits();
    expect(audit!.meta).toMatchObject({ forceAdditional: true });
  });

  it('does not count a revoked assignment or a suspended account as an active admin', async () => {
    await nationalAdmin('active', true);
    await nationalAdmin('suspended');
    const result = await bootstrapNationalAdmin(test.db, {
      phone: nextPhone(),
      env: DEV,
      now: NOW,
    });
    expect(result.inviteId).toBeTruthy();
  });

  it('refuses a number that already holds the role, even with forceAdditional', async () => {
    const admin = await nationalAdmin();
    expect(
      await refusal(
        bootstrapNationalAdmin(test.db, {
          phone: admin.phoneE164,
          forceAdditional: true,
          env: DEV,
          now: NOW,
        }),
      ),
    ).toBe('already_admin');
    expect(await invites()).toHaveLength(0);
  });

  it('refuses in production without confirmation, and allows it with confirmation', async () => {
    const phone = nextPhone();
    expect(await refusal(bootstrapNationalAdmin(test.db, { phone, env: PROD, now: NOW }))).toBe(
      'production',
    );
    expect(
      await refusal(
        bootstrapNationalAdmin(test.db, { phone, env: { NODE_ENV: ' Production ' }, now: NOW }),
      ),
    ).toBe('production');
    expect(await invites()).toHaveLength(0);

    const result = await bootstrapNationalAdmin(test.db, {
      phone,
      env: PROD,
      confirmProduction: true,
      now: NOW,
    });
    expect((await invites()).map((i) => i.id)).toEqual([result.inviteId]);
  });

  it('refuses a number that is not E.164, without echoing it', async () => {
    for (const phone of ['03001234567', '+0300123', 'not a number', '']) {
      const error = await bootstrapNationalAdmin(test.db, { phone, env: DEV, now: NOW }).catch(
        (e: unknown) => e,
      );
      expect(error).toBeInstanceOf(BootstrapRefusedError);
      expect((error as BootstrapRefusedError).reason).toBe('invalid_phone');
      if (phone) expect((error as Error).message).not.toContain(phone);
    }
    expect(await invites()).toHaveLength(0);
  });

  it('a second run for the same number replaces the pending invite, like a resend', async () => {
    const phone = nextPhone();
    const first = await bootstrapNationalAdmin(test.db, { phone, env: DEV, now: NOW });
    const later = new Date(NOW.getTime() + 60_000);
    const second = await bootstrapNationalAdmin(test.db, { phone, env: DEV, now: later });
    expect(second.replacedInviteId).toBe(first.inviteId);

    const rows = await invites();
    expect(rows.find((r) => r.id === first.inviteId)?.status).toBe('revoked');
    expect(rows.find((r) => r.id === second.inviteId)?.status).toBe('pending');
    const secondAudit = (await audits()).find((a) => a.entityId === second.inviteId);
    expect(secondAudit?.meta).toMatchObject({ replacesInviteId: first.inviteId });
  });

  it('retires a lapsed invite for the number before creating the new one', async () => {
    const phone = nextPhone();
    const old = await bootstrapNationalAdmin(test.db, { phone, env: DEV, now: NOW });
    const muchLater = new Date(NOW.getTime() + (BOOTSTRAP_INVITE_TTL_DAYS + 1) * 86_400_000);
    const fresh = await bootstrapNationalAdmin(test.db, { phone, env: DEV, now: muchLater });
    expect(fresh.replacedInviteId).toBeNull();
    const rows = await invites();
    expect(rows.find((r) => r.id === old.inviteId)?.status).toBe('expired');
    expect(rows.find((r) => r.id === fresh.inviteId)?.status).toBe('pending');
  });

  it('leaves a pending invite for a city role on the same number alone', async () => {
    const phone = nextPhone();
    const city = await factory(test).city();
    await test.db.insert(schema.coordinatorInvites).values({
      phoneE164: phone,
      role: 'city_coordinator',
      scopeType: 'city',
      cityId: city.id,
      expiresAt: new Date(NOW.getTime() + 86_400_000),
    });
    await bootstrapNationalAdmin(test.db, { phone, env: DEV, now: NOW });
    const rows = await invites();
    expect(rows.filter((r) => r.status === 'pending')).toHaveLength(2);
  });
});

describe('assertBootstrapAllowed', () => {
  it('allows development, test and staging, refuses production unless confirmed', () => {
    expect(() => assertBootstrapAllowed({ APP_ENV: 'staging' })).not.toThrow();
    expect(() => assertBootstrapAllowed({})).not.toThrow();
    expect(() => assertBootstrapAllowed(PROD)).toThrow(BootstrapRefusedError);
    expect(() => assertBootstrapAllowed({ NODE_ENV: 'production' })).toThrow(/--yes/);
    expect(() => assertBootstrapAllowed(PROD, true)).not.toThrow();
  });
});

describe('parseBootstrapArgs', () => {
  it('reads the phone and the flags', () => {
    expect(parseBootstrapArgs(['--phone', '+923000000001'])).toEqual({
      phone: '+923000000001',
      forceAdditional: false,
      yes: false,
    });
    expect(
      parseBootstrapArgs(['--', '--phone=+923000000001', '--force-additional', '--yes']),
    ).toEqual({ phone: '+923000000001', forceAdditional: true, yes: true });
    expect(parseBootstrapArgs(['-y', '--phone', '+923000000001']).yes).toBe(true);
  });

  it('needs a phone', () => {
    expect(() => parseBootstrapArgs([])).toThrow(/--phone is required/);
    expect(() => parseBootstrapArgs(['--phone'])).toThrow(/--phone needs a number/);
    expect(() => parseBootstrapArgs(['--phone='])).toThrow(/--phone needs a number/);
  });

  it('refuses unknown arguments without echoing them', () => {
    expect(() => parseBootstrapArgs(['+923000000001'])).toThrow(/Unknown argument/);
    try {
      parseBootstrapArgs(['+923000000001']);
    } catch (error) {
      expect((error as Error).message).not.toContain('+923000000001');
    }
  });
});
