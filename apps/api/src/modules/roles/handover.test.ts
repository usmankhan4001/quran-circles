import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { schema } from '@qc/db';
import { requireAction } from '../../auth';
import { PHONE_A, PHONE_B, createHarness, type Harness } from '../../auth/testing/harness';
import { createInvite, resolveRoleTarget, type InviteDeps } from './service';

vi.setConfig({ testTimeout: 30_000, hookTimeout: 60_000 });

/**
 * SEC-22 end to end, with real access tokens: a handover by invite ends the previous coordinator's
 * access on their very next request, before the new coordinator has accepted anything.
 */
let h: Harness;
beforeAll(async () => {
  h = await createHarness({
    extend: (app) => {
      app.get('/test/me', requireAction('me.read'), (c) =>
        c.json({ principal: c.get('principal') }),
      );
    },
  });
}, 60_000);
afterAll(async () => {
  await h.close();
});
beforeEach(async () => {
  await h.reset();
});

const deps = (): InviteDeps => ({
  now: h.clock.now(),
  ttlDays: 7,
  limits: { perImport: 100, perActorPerDay: 200 },
});

async function liveRoles(token: string): Promise<{ role: string }[]> {
  const res = await h.get('/test/me', { token });
  expect(res.status).toBe(200);
  const body = (await res.json()) as { principal: { assignments: { role: string }[] } };
  return body.principal.assignments;
}

describe('handing a place over by invite (SEC-22)', () => {
  for (const kind of ['venue', 'city'] as const) {
    it(`ends the previous ${kind} coordinator's access at once, before the invite is accepted`, async () => {
      const admin = await h.createUser();
      await h.grantRole(admin.id, 'national_admin');
      const role = kind === 'venue' ? 'venue_coordinator' : 'city_coordinator';
      const place = kind === 'venue' ? { venueId: h.world.venueA1 } : { cityId: h.world.cityA.id };

      const holder = await h.signIn(PHONE_B);
      const old = await h.grantRole(holder.body.me.id, role, place);
      expect(await liveRoles(holder.body.accessToken)).toMatchObject([{ role }]);

      const target = await resolveRoleTarget(h.db, { role, ...place });
      if (!target) throw new Error('target not found');
      const made = await createInvite(h.db, deps(), admin.id, target, {
        role,
        phone: PHONE_A,
        replacesAssignmentId: old.id,
        ...place,
      } as Parameters<typeof createInvite>[4]);
      expect(made.status).toBe('pending');

      // The same access token, the very next request: the role is gone.
      expect(await liveRoles(holder.body.accessToken)).toEqual([]);
      const [ended] = await h.db
        .select()
        .from(schema.roleAssignments)
        .where(eq(schema.roleAssignments.id, old.id));
      expect(ended?.revokedAt).not.toBeNull();

      // The new coordinator gets the role when they sign in; the old one stays ended.
      const incoming = await h.signIn(PHONE_A);
      expect(incoming.body.me.roles).toMatchObject([{ role }]);
      expect(await liveRoles(holder.body.accessToken)).toEqual([]);
      const revokes = (await h.db.select().from(schema.auditLog)).filter(
        (r) => r.action === 'role.revoke',
      );
      expect(revokes).toHaveLength(1);
      expect(revokes[0]).toMatchObject({
        actorUserId: admin.id,
        entityId: old.id,
        meta: { role, reason: 'handover', inviteId: made.id },
      });
    });
  }

  it('leaves the holder alone when the invite is refused', async () => {
    const admin = await h.createUser();
    await h.grantRole(admin.id, 'national_admin');
    const holder = await h.signIn(PHONE_B);
    const old = await h.grantRole(holder.body.me.id, 'venue_coordinator', {
      venueId: h.world.venueA1,
    });
    const target = await resolveRoleTarget(h.db, {
      role: 'venue_coordinator',
      venueId: h.world.venueA2,
    });
    if (!target) throw new Error('target not found');
    // The assignment is at another venue than the invite: not found, nothing ends.
    await expect(
      createInvite(h.db, deps(), admin.id, target, {
        role: 'venue_coordinator',
        venueId: h.world.venueA2,
        phone: PHONE_A,
        replacesAssignmentId: old.id,
      }),
    ).rejects.toMatchObject({ code: 'not_found' });
    expect(await liveRoles(holder.body.accessToken)).toMatchObject([{ role: 'venue_coordinator' }]);
  });
});
