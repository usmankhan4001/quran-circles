import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import type { Invite } from '@qc/contracts';
import type { StaffRoleAssignment } from '../modules/shared/types';
import { schema } from '@qc/db';
import { createHarness, type Actor, type Harness } from './harness';
import { auditRows, outboxRows } from './fixtures';

let h: Harness;
let admin: Actor;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(() => h.close());
beforeEach(async () => {
  await h.reset();
  admin = await h.nationalAdmin();
});

type Page<T> = { items: T[]; nextCursor: string | null };
const nil = '00000000-0000-4000-8000-000000000000';
const DAY = 24 * 3_600_000;
const code = (res: { json<T>(): T }) => res.json<{ error: { code: string } }>().error.code;

let phoneCounter = 0;
const newPhone = () => `+9230010${String(++phoneCounter).padStart(5, '0')}`;

const invite = (as: Actor | null, body: Record<string, unknown>) =>
  h.api('adminRoles.invite', { ...(as ? { as } : {}), body });
const venueInvite = (
  as: Actor,
  venueId: string,
  phone = newPhone(),
  extra: Record<string, unknown> = {},
) => invite(as, { role: 'venue_coordinator', venueId, phone, ...extra });
const assign = (as: Actor, body: Record<string, unknown>) =>
  h.api('adminRoles.assign', { as, body });
const revoke = (as: Actor, assignmentId: string) =>
  h.api('adminRoles.revoke', { as, params: { assignmentId } });
const liveAssignments = async (userId: string) =>
  (
    await h.db
      .select()
      .from(schema.roleAssignments)
      .where(eq(schema.roleAssignments.userId, userId))
  ).filter((a) => !a.revokedAt);

describe('inviting someone by phone', () => {
  it('creates a pending invite that lapses after seven days, and sends the invitation on WhatsApp', async () => {
    const phone = newPhone();
    const res = await venueInvite(admin, h.world.venueA1, phone, { displayName: 'Bilal Test' });
    expect(res.status).toBe(201);
    const made = res.json<Invite>();
    expect(made).toMatchObject({
      phone,
      displayName: 'Bilal Test',
      role: 'venue_coordinator',
      scopeType: 'venue',
      venueId: h.world.venueA1,
      cityId: null,
      status: 'pending',
    });
    expect(new Date(made.expiresAt).getTime() - h.clock.now().getTime()).toBe(7 * DAY);

    const rows = (await outboxRows(h)).filter((r) => r.templateKey === 'coordinator_invite');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      channel: 'whatsapp',
      recipientPhoneE164: phone,
      recipientUserId: null,
      idempotencyKey: `coordinator_invite:${made.id}:whatsapp`,
      sentBy: admin.userId,
    });
    expect(rows[0]?.payload).toMatchObject({
      template: 'coordinator_invite',
      variables: { scopeName: 'Venue A1' },
    });
  });

  it('writes the invitation in the language of a person who already has an account', async () => {
    const existing = await h.person({ locale: 'ur' });
    await venueInvite(admin, h.world.venueA1, existing.phone);
    const [row] = (await outboxRows(h)).filter((r) => r.templateKey === 'coordinator_invite');
    expect(row).toMatchObject({ recipientUserId: existing.userId, locale: 'ur' });
    expect(row?.payload).toMatchObject({ variables: { scopeName: 'Venue A1 ur' } });
  });

  it('audits the invite with the role only, never the number', async () => {
    const phone = newPhone();
    const made = (await venueInvite(admin, h.world.venueA1, phone)).json<Invite>();
    const rows = (await auditRows(h)).filter((r) => r.action === 'role.invite');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      actorUserId: admin.userId,
      entityId: made.id,
      venueId: h.world.venueA1,
      cityId: h.world.cityA.id,
      meta: { role: 'venue_coordinator' },
    });
    expect(JSON.stringify(await auditRows(h))).not.toContain(phone);
    expect(h.logs.join('\n')).not.toContain(phone);
  });

  it('refuses someone who already holds the role, and a second pending invite', async () => {
    const holder = await h.venueCoordinator(h.world.venueA1);
    const refused = await venueInvite(admin, h.world.venueA1, holder.phone);
    expect(refused.status).toBe(409);
    expect(code(refused)).toBe('role_already_assigned');

    const phone = newPhone();
    expect((await venueInvite(admin, h.world.venueA1, phone)).status).toBe(201);
    const twice = await venueInvite(admin, h.world.venueA1, phone);
    expect(twice.status).toBe(409);
    expect(code(twice)).toBe('conflict');
    // The same number may be invited to a different venue.
    expect((await venueInvite(admin, h.world.venueA2, phone)).status).toBe(201);
  });

  it('allows a fresh invite once the old one has lapsed', async () => {
    const phone = newPhone();
    const first = (await venueInvite(admin, h.world.venueA1, phone)).json<Invite>();
    h.clock.advanceDays(8);
    const second = await venueInvite(admin, h.world.venueA1, phone);
    expect(second.status).toBe(201);
    const list = (await h.api('adminRoles.invites', { as: admin })).json<{ items: Invite[] }>()
      .items;
    expect(list.find((i) => i.id === first.id)?.status).toBe('expired');
    expect(list.find((i) => i.id === second.json<Invite>().id)?.status).toBe('pending');
  });

  it('invites to city and national roles too, with the right scope', async () => {
    const city = (
      await invite(admin, { role: 'city_coordinator', cityId: h.world.cityB.id, phone: newPhone() })
    ).json<Invite>();
    expect(city).toMatchObject({ scopeType: 'city', cityId: h.world.cityB.id, venueId: null });
    const national = (
      await invite(admin, { role: 'national_admin', phone: newPhone() })
    ).json<Invite>();
    expect(national).toMatchObject({ scopeType: 'national', cityId: null, venueId: null });
    const [row] = (await outboxRows(h)).filter(
      (r) => r.idempotencyKey === `coordinator_invite:${national.id}:whatsapp`,
    );
    expect(row?.payload).toMatchObject({ variables: { scopeName: 'Quran Circles' } });
  });

  it('follows the scope rules for every kind of inviter', async () => {
    const cityA = await h.cityCoordinator(h.world.cityA.id);
    const venueA1 = await h.venueCoordinator(h.world.venueA1);
    const person = await h.person();
    const cases: [string, Actor | null, Record<string, unknown>, number][] = [
      ['national invites national', admin, { role: 'national_admin' }, 201],
      ['national invites city', admin, { role: 'city_coordinator', cityId: h.world.cityB.id }, 201],
      [
        'city invites venue in own city',
        cityA,
        { role: 'venue_coordinator', venueId: h.world.venueA2 },
        201,
      ],
      [
        'city invites venue elsewhere',
        cityA,
        { role: 'venue_coordinator', venueId: h.world.venueB1 },
        403,
      ],
      ['city invites city', cityA, { role: 'city_coordinator', cityId: h.world.cityA.id }, 403],
      ['city invites national', cityA, { role: 'national_admin' }, 403],
      [
        'venue invites venue',
        venueA1,
        { role: 'venue_coordinator', venueId: h.world.venueA1 },
        403,
      ],
      ['person invites', person, { role: 'venue_coordinator', venueId: h.world.venueA1 }, 403],
      ['nobody invites', null, { role: 'venue_coordinator', venueId: h.world.venueA1 }, 401],
    ];
    for (const [name, who, body, status] of cases) {
      expect((await invite(who, { ...body, phone: newPhone() })).status, name).toBe(status);
    }
  });

  it('answers an unknown venue with a field error for staff and forbidden for everyone else', async () => {
    const cityA = await h.cityCoordinator(h.world.cityA.id);
    expect((await venueInvite(cityA, nil)).status).toBe(400);
    expect((await venueInvite(await h.person(), nil)).status).toBe(403);
  });

  it('refuses a number that is not E.164', async () => {
    expect((await venueInvite(admin, h.world.venueA1, '0300 1234567')).status).toBe(400);
    expect((await venueInvite(admin, h.world.venueA1, 'abc')).status).toBe(400);
  });
});

describe('listing and revoking invites', () => {
  it('shows each coordinator the invites in their city, and nothing to venue coordinators', async () => {
    const a = (await venueInvite(admin, h.world.venueA1)).json<Invite>();
    const b = (await venueInvite(admin, h.world.venueB1)).json<Invite>();
    const c = (
      await invite(admin, { role: 'city_coordinator', cityId: h.world.cityA.id, phone: newPhone() })
    ).json<Invite>();
    const ids = async (who: Actor) =>
      (await h.api('adminRoles.invites', { as: who }))
        .json<{ items: Invite[] }>()
        .items.map((i) => i.id)
        .sort();
    expect(await ids(admin)).toEqual([a.id, b.id, c.id].sort());
    expect(await ids(await h.cityCoordinator(h.world.cityA.id))).toEqual([a.id, c.id].sort());
    expect(await ids(await h.cityCoordinator(h.world.cityB.id))).toEqual([b.id]);
    expect(
      (await h.api('adminRoles.invites', { as: await h.venueCoordinator(h.world.venueA1) })).status,
    ).toBe(403);
    expect((await h.api('adminRoles.invites', { as: await h.person() })).status).toBe(403);
  });

  it('revokes a pending invite, harmlessly twice, and audits it', async () => {
    const made = (await venueInvite(admin, h.world.venueA1)).json<Invite>();
    expect(
      (await h.api('adminRoles.revokeInvite', { as: admin, params: { inviteId: made.id } })).status,
    ).toBe(204);
    expect(
      (await h.api('adminRoles.revokeInvite', { as: admin, params: { inviteId: made.id } })).status,
    ).toBe(204);
    const list = (await h.api('adminRoles.invites', { as: admin })).json<{ items: Invite[] }>()
      .items;
    expect(list[0]?.status).toBe('revoked');
    expect((await auditRows(h)).filter((r) => r.action === 'role.revoke_invite')).toHaveLength(1);
    // A revoked invite frees the number for a new one.
    expect((await venueInvite(admin, h.world.venueA1, made.phone)).status).toBe(201);
  });

  it('answers invite_expired for a lapsed invite, and not_found for an accepted one', async () => {
    const lapsed = (await venueInvite(admin, h.world.venueA1)).json<Invite>();
    h.clock.advanceDays(8);
    const res = await h.api('adminRoles.revokeInvite', {
      as: admin,
      params: { inviteId: lapsed.id },
    });
    expect(res.status).toBe(410);
    expect(code(res)).toBe('invite_expired');

    const accepted = (await venueInvite(admin, h.world.venueA2)).json<Invite>();
    await h.db
      .update(schema.coordinatorInvites)
      .set({ status: 'accepted' })
      .where(eq(schema.coordinatorInvites.id, accepted.id));
    expect(
      (await h.api('adminRoles.revokeInvite', { as: admin, params: { inviteId: accepted.id } }))
        .status,
    ).toBe(404);
  });

  it('is limited to people who may invite there', async () => {
    const made = (await venueInvite(admin, h.world.venueA1)).json<Invite>();
    for (const who of [
      await h.cityCoordinator(h.world.cityB.id),
      await h.venueCoordinator(h.world.venueA1),
      await h.person(),
    ]) {
      expect(
        (await h.api('adminRoles.revokeInvite', { as: who, params: { inviteId: made.id } })).status,
      ).toBe(403);
    }
    expect(
      (
        await h.api('adminRoles.revokeInvite', {
          as: await h.cityCoordinator(h.world.cityA.id),
          params: { inviteId: made.id },
        })
      ).status,
    ).toBe(204);
    expect(
      (await h.api('adminRoles.revokeInvite', { as: admin, params: { inviteId: nil } })).status,
    ).toBe(404);
    expect(
      (await h.api('adminRoles.revokeInvite', { as: await h.person(), params: { inviteId: nil } }))
        .status,
    ).toBe(403);
  });
});

describe('assigning roles', () => {
  it('gives an existing person a venue role and shows it with names', async () => {
    const person = await h.person({ displayName: 'Idris Test' });
    const res = await assign(admin, {
      role: 'venue_coordinator',
      venueId: h.world.venueA1,
      userId: person.userId,
    });
    expect(res.status).toBe(201);
    expect(res.json<StaffRoleAssignment>()).toMatchObject({
      userId: person.userId,
      userName: 'Idris Test',
      phone: person.phone,
      role: 'venue_coordinator',
      scopeType: 'venue',
      venueId: h.world.venueA1,
      scopeName: { en: 'Venue A1' },
      revokedAt: null,
    });
    expect((await liveAssignments(person.userId)).map((a) => a.role)).toEqual([
      'venue_coordinator',
    ]);
    const rows = (await auditRows(h)).filter((r) => r.action === 'role.assign');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      venueId: h.world.venueA1,
      meta: { role: 'venue_coordinator', replacesAssignmentId: null },
    });
  });

  it('refuses the same role twice, and an unknown person', async () => {
    const person = await h.person();
    const body = { role: 'city_coordinator', cityId: h.world.cityA.id, userId: person.userId };
    expect((await assign(admin, body)).status).toBe(201);
    const twice = await assign(admin, body);
    expect(twice.status).toBe(409);
    expect(code(twice)).toBe('role_already_assigned');
    expect((await assign(admin, { ...body, userId: nil })).status).toBe(400);
  });

  it('lets a city coordinator assign venue coordinators in the city only', async () => {
    const cityA = await h.cityCoordinator(h.world.cityA.id);
    const person = await h.person();
    expect(
      (
        await assign(cityA, {
          role: 'venue_coordinator',
          venueId: h.world.venueA2,
          userId: person.userId,
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await assign(cityA, {
          role: 'venue_coordinator',
          venueId: h.world.venueB1,
          userId: person.userId,
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await assign(cityA, {
          role: 'city_coordinator',
          cityId: h.world.cityA.id,
          userId: person.userId,
        })
      ).status,
    ).toBe(403);
    expect((await assign(cityA, { role: 'national_admin', userId: person.userId })).status).toBe(
      403,
    );
    expect(
      (
        await assign(await h.venueCoordinator(h.world.venueA1), {
          role: 'venue_coordinator',
          venueId: h.world.venueA1,
          userId: person.userId,
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await assign(person, {
          role: 'venue_coordinator',
          venueId: h.world.venueA1,
          userId: person.userId,
        })
      ).status,
    ).toBe(403);
  });

  it('answers an unknown venue with a field error for staff and forbidden for everyone else', async () => {
    const person = await h.person();
    const cityA = await h.cityCoordinator(h.world.cityA.id);
    expect(
      (await assign(cityA, { role: 'venue_coordinator', venueId: nil, userId: person.userId }))
        .status,
    ).toBe(400);
    expect(
      (await assign(person, { role: 'venue_coordinator', venueId: nil, userId: person.userId }))
        .status,
    ).toBe(403);
  });

  it('hands a venue over in one step and keeps the history', async () => {
    const outgoing = await h.venueCoordinator(h.world.venueA1);
    const incoming = await h.person();
    const [old] = await liveAssignments(outgoing.userId);
    const res = await assign(admin, {
      role: 'venue_coordinator',
      venueId: h.world.venueA1,
      userId: incoming.userId,
      replacesAssignmentId: old!.id,
    });
    expect(res.status).toBe(201);
    expect(await liveAssignments(outgoing.userId)).toEqual([]);
    expect((await liveAssignments(incoming.userId)).map((a) => a.venueId)).toEqual([
      h.world.venueA1,
    ]);
    const actions = (await auditRows(h))
      .filter((r) => r.action.startsWith('role.'))
      .map((r) => r.action);
    expect(actions.sort()).toEqual(['role.assign', 'role.revoke']);
    const history = (
      await h.api('adminRoles.list', {
        as: admin,
        query: { venueId: h.world.venueA1, includeRevoked: true },
      })
    ).json<Page<StaffRoleAssignment>>().items;
    expect(history).toHaveLength(2);
    expect(history.filter((a) => a.revokedAt !== null)).toHaveLength(1);
  });

  it('refuses a handover that points at the wrong, a revoked or the same assignment, and changes nothing', async () => {
    const holder = await h.venueCoordinator(h.world.venueA1);
    const elsewhere = await h.venueCoordinator(h.world.venueA2);
    const incoming = await h.person();
    const [here] = await liveAssignments(holder.userId);
    const [there] = await liveAssignments(elsewhere.userId);
    const body = { role: 'venue_coordinator', venueId: h.world.venueA1, userId: incoming.userId };
    expect((await assign(admin, { ...body, replacesAssignmentId: there!.id })).status).toBe(400);
    expect((await assign(admin, { ...body, replacesAssignmentId: nil })).status).toBe(400);
    expect(
      (await assign(admin, { ...body, userId: holder.userId, replacesAssignmentId: here!.id }))
        .status,
    ).toBe(400);
    expect(await liveAssignments(incoming.userId)).toEqual([]);
    expect((await liveAssignments(holder.userId)).length).toBe(1);
    expect((await liveAssignments(elsewhere.userId)).length).toBe(1);

    await revoke(admin, here!.id);
    expect((await assign(admin, { ...body, replacesAssignmentId: here!.id })).status).toBe(400);
  });

  it('puts a second person at the same venue when no handover is asked for', async () => {
    await h.venueCoordinator(h.world.venueA1);
    const second = await h.person();
    expect(
      (
        await assign(admin, {
          role: 'venue_coordinator',
          venueId: h.world.venueA1,
          userId: second.userId,
        })
      ).status,
    ).toBe(201);
    const list = (
      await h.api('adminRoles.list', { as: admin, query: { venueId: h.world.venueA1 } })
    ).json<Page<StaffRoleAssignment>>();
    expect(list.items).toHaveLength(2);
  });
});

describe('listing role assignments', () => {
  it('shows each coordinator the assignments in their city, hides revoked ones by default, and pages', async () => {
    const cityA = await h.cityCoordinator(h.world.cityA.id);
    const venueA1 = await h.venueCoordinator(h.world.venueA1);
    const venueB1 = await h.venueCoordinator(h.world.venueB1);
    const [gone] = await liveAssignments(venueB1.userId);
    await revoke(admin, gone!.id);
    const users = async (who: Actor, query: Record<string, string | number | boolean> = {}) =>
      (await h.api('adminRoles.list', { as: who, query }))
        .json<Page<StaffRoleAssignment>>()
        .items.map((a) => a.userId);

    expect((await users(admin)).sort()).toEqual(
      [admin.userId, cityA.userId, venueA1.userId].sort(),
    );
    expect((await users(cityA)).sort()).toEqual([cityA.userId, venueA1.userId].sort());
    expect(await users(admin, { includeRevoked: true })).toContain(venueB1.userId);
    expect(await users(admin, { cityId: h.world.cityA.id })).not.toContain(admin.userId);
    expect((await h.api('adminRoles.list', { as: venueA1 })).status).toBe(403);

    const first = (await h.api('adminRoles.list', { as: admin, query: { limit: 2 } })).json<
      Page<StaffRoleAssignment>
    >();
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).not.toBeNull();
  });

  it('never shows the number of a person to anyone outside the scope', async () => {
    await h.venueCoordinator(h.world.venueB1);
    const cityA = await h.cityCoordinator(h.world.cityA.id);
    const res = await h.api('adminRoles.list', { as: cityA });
    const phones = res.json<Page<StaffRoleAssignment>>().items.map((a) => a.phone);
    expect(phones).toEqual([cityA.phone]);
  });
});

describe('revoking a role', () => {
  it('ends the role at once, keeps the history, and audits it', async () => {
    const coordinator = await h.venueCoordinator(h.world.venueA1);
    const [row] = await liveAssignments(coordinator.userId);
    h.clock.advanceMinutes(5);
    expect((await revoke(admin, row!.id)).status).toBe(204);
    expect(await liveAssignments(coordinator.userId)).toEqual([]);
    const [kept] = await h.db
      .select()
      .from(schema.roleAssignments)
      .where(eq(schema.roleAssignments.id, row!.id));
    expect(kept?.revokedAt?.toISOString()).toBe(h.clock.now().toISOString());
    expect((await auditRows(h)).filter((r) => r.action === 'role.revoke')).toHaveLength(1);
    // Revoking again changes nothing and adds nothing.
    expect((await revoke(admin, row!.id)).status).toBe(204);
    expect((await auditRows(h)).filter((r) => r.action === 'role.revoke')).toHaveLength(1);
  });

  it('follows the scope rules for every kind of caller', async () => {
    const target = await h.venueCoordinator(h.world.venueA1);
    const [row] = await liveAssignments(target.userId);
    const cityCoordinator = await h.cityCoordinator(h.world.cityA.id);
    const [cityRow] = await liveAssignments(cityCoordinator.userId);
    for (const who of [
      await h.cityCoordinator(h.world.cityB.id),
      await h.venueCoordinator(h.world.venueA2),
      await h.person(),
    ]) {
      expect((await revoke(who, row!.id)).status).toBe(403);
    }
    // A city coordinator cannot remove a city coordinator, only a national admin can.
    expect((await revoke(cityCoordinator, cityRow!.id)).status).toBe(403);
    expect((await revoke(cityCoordinator, row!.id)).status).toBe(204);
    expect((await revoke(admin, cityRow!.id)).status).toBe(204);
    expect((await revoke(admin, nil)).status).toBe(404);
    expect((await revoke(await h.person(), nil)).status).toBe(403);
  });

  it('keeps the last national admin', async () => {
    const [mine] = await liveAssignments(admin.userId);
    const refused = await revoke(admin, mine!.id);
    expect(refused.status).toBe(409);
    expect(code(refused)).toBe('last_national_admin');
    expect(await liveAssignments(admin.userId)).toHaveLength(1);

    const second = await h.nationalAdmin();
    expect((await revoke(admin, mine!.id)).status).toBe(204);
    const [theirs] = await liveAssignments(second.userId);
    expect((await revoke(second, theirs!.id)).status).toBe(409);
  });

  it('cannot be tricked into removing both admins at the same time', async () => {
    const other = await h.nationalAdmin();
    const [a] = await liveAssignments(admin.userId);
    const [b] = await liveAssignments(other.userId);
    const results = await Promise.all([revoke(admin, b!.id), revoke(other, a!.id)]);
    expect(results.map((r) => r.status).sort()).toEqual([204, 409]);
    const live = (await h.db.select().from(schema.roleAssignments)).filter((r) => !r.revokedAt);
    expect(live).toHaveLength(1);
  });
});
