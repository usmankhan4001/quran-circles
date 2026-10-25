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
      venueId: h.world.venueA1,
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

  it('refuses someone who already holds the role', async () => {
    const holder = await h.venueCoordinator(h.world.venueA1);
    const refused = await venueInvite(admin, h.world.venueA1, holder.phone);
    expect(refused.status).toBe(409);
    expect(code(refused)).toBe('role_already_assigned');
  });

  it('treats a second invite to the same place as a resend: a fresh invite replaces the pending one', async () => {
    const phone = newPhone();
    const first = (await venueInvite(admin, h.world.venueA1, phone)).json<Invite>();
    h.clock.advanceDays(3);
    const again = await venueInvite(admin, h.world.venueA1, phone);
    expect(again.status).toBe(201);
    const second = again.json<Invite>();
    expect(second.id).not.toBe(first.id);
    expect(second.status).toBe('pending');
    expect(new Date(second.expiresAt).getTime()).toBe(h.clock.now().getTime() + 7 * DAY);

    const list = (await h.api('adminRoles.invites', { as: admin })).json<{ items: Invite[] }>()
      .items;
    expect(list.find((i) => i.id === first.id)?.status).toBe('revoked');
    const keys = (await outboxRows(h)).map((r) => r.idempotencyKey);
    expect(keys).toContain(`coordinator_invite:${first.id}:whatsapp`);
    expect(keys).toContain(`coordinator_invite:${second.id}:whatsapp`);
    const audit = (await auditRows(h)).filter((r) => r.action === 'role.invite');
    expect(audit.at(-1)?.meta).toMatchObject({ replacesInviteId: first.id });

    // The same number may be invited to a different venue without touching either invite.
    expect((await venueInvite(admin, h.world.venueA2, phone)).status).toBe(201);
    const after = (await h.api('adminRoles.invites', { as: admin })).json<{ items: Invite[] }>()
      .items;
    expect(after.find((i) => i.id === second.id)?.status).toBe('pending');
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

  it('answers an unknown venue with not found for staff and forbidden for everyone else', async () => {
    const cityA = await h.cityCoordinator(h.world.cityA.id);
    expect((await venueInvite(cityA, nil)).status).toBe(404);
    expect((await venueInvite(await h.person(), nil)).status).toBe(403);
  });

  it("stores a handover on the invite, ends the old holder's access at once, and answers not found for an assignment that is unknown, ended or elsewhere", async () => {
    const holder = await h.venueCoordinator(h.world.venueA1);
    const elsewhere = await h.venueCoordinator(h.world.venueB1);
    const [old] = await liveAssignments(holder.userId);
    const [far] = await liveAssignments(elsewhere.userId);
    const cityA = await h.cityCoordinator(h.world.cityA.id);
    const made = await venueInvite(cityA, h.world.venueA1, newPhone(), {
      replacesAssignmentId: old!.id,
    });
    expect(made.status).toBe(201);
    const [row] = await h.db
      .select()
      .from(schema.coordinatorInvites)
      .where(eq(schema.coordinatorInvites.id, made.json<Invite>().id));
    expect(row?.replacesAssignmentId).toBe(old!.id);
    expect((await auditRows(h)).find((r) => r.action === 'role.invite')?.meta).toMatchObject({
      replacesAssignmentId: old!.id,
    });
    // SEC-22: the old holder loses the role now, before anyone accepts the invite, and it is audited.
    expect(await liveAssignments(holder.userId)).toHaveLength(0);
    expect((await auditRows(h)).find((r) => r.action === 'role.revoke')).toMatchObject({
      actorUserId: cityA.userId,
      entityId: old!.id,
      venueId: h.world.venueA1,
      cityId: h.world.cityA.id,
      meta: { role: 'venue_coordinator', reason: 'handover', inviteId: made.json<Invite>().id },
    });

    for (const replacesAssignmentId of [nil, far!.id]) {
      const res = await venueInvite(cityA, h.world.venueA1, newPhone(), { replacesAssignmentId });
      expect(res.status, replacesAssignmentId).toBe(404);
    }
    await revoke(admin, old!.id);
    expect(
      (await venueInvite(cityA, h.world.venueA1, newPhone(), { replacesAssignmentId: old!.id }))
        .status,
    ).toBe(404);
    // Someone with no right to invite there is refused before any lookup.
    const venueCoord = await h.venueCoordinator(h.world.venueA2);
    expect(
      (await venueInvite(venueCoord, h.world.venueA1, newPhone(), { replacesAssignmentId: nil }))
        .status,
    ).toBe(403);
  });

  it('keeps the handover when a pending handover invite is resent', async () => {
    const holder = await h.venueCoordinator(h.world.venueA1);
    const [old] = await liveAssignments(holder.userId);
    const phone = newPhone();
    await venueInvite(admin, h.world.venueA1, phone, { replacesAssignmentId: old!.id });
    const resent = (await venueInvite(admin, h.world.venueA1, phone)).json<Invite>();
    const [row] = await h.db
      .select()
      .from(schema.coordinatorInvites)
      .where(eq(schema.coordinatorInvites.id, resent.id));
    expect(row?.replacesAssignmentId).toBe(old!.id);
    expect(resent.replacesAssignmentId).toBe(old!.id);
  });

  it('refuses a number that is not E.164', async () => {
    expect((await venueInvite(admin, h.world.venueA1, '0300 1234567')).status).toBe(400);
    expect((await venueInvite(admin, h.world.venueA1, 'abc')).status).toBe(400);
  });
});

describe('the handover on the invite response (contract rc.3)', () => {
  const listed = async (who: Actor) =>
    (await h.api('adminRoles.invites', { as: who })).json<{ items: Invite[] }>().items;

  it('returns null for a plain invite, at every kind of place', async () => {
    const venue = (await venueInvite(admin, h.world.venueA1)).json<Invite>();
    const city = (
      await invite(admin, { role: 'city_coordinator', cityId: h.world.cityB.id, phone: newPhone() })
    ).json<Invite>();
    const national = (
      await invite(admin, { role: 'national_admin', phone: newPhone() })
    ).json<Invite>();
    for (const made of [venue, city, national]) expect(made.replacesAssignmentId).toBeNull();
    expect((await listed(admin)).map((i) => i.replacesAssignmentId)).toEqual([null, null, null]);
  });

  it('returns the replaced assignment on create and in the list, to everyone who may see the invite', async () => {
    const holder = await h.venueCoordinator(h.world.venueA1);
    const [old] = await liveAssignments(holder.userId);
    const cityA = await h.cityCoordinator(h.world.cityA.id);
    const made = (
      await venueInvite(cityA, h.world.venueA1, newPhone(), { replacesAssignmentId: old!.id })
    ).json<Invite>();
    expect(made.replacesAssignmentId).toBe(old!.id);
    for (const who of [admin, cityA]) {
      expect((await listed(who)).find((i) => i.id === made.id)?.replacesAssignmentId).toBe(old!.id);
    }
    // Outside the city the invite (and so the link) is not listed at all.
    expect(await listed(await h.cityCoordinator(h.world.cityB.id))).toEqual([]);

    const cityHolder = await h.cityCoordinator(h.world.cityB.id);
    const [oldCity] = await liveAssignments(cityHolder.userId);
    const cityInvite = (
      await invite(admin, {
        role: 'city_coordinator',
        cityId: h.world.cityB.id,
        phone: newPhone(),
        replacesAssignmentId: oldCity!.id,
      })
    ).json<Invite>();
    expect(cityInvite.replacesAssignmentId).toBe(oldCity!.id);
  });

  it('lets a resend of a lapsed handover invite carry the link the list returned', async () => {
    const holder = await h.venueCoordinator(h.world.venueA1);
    const [old] = await liveAssignments(holder.userId);
    const phone = newPhone();
    const first = (
      await venueInvite(admin, h.world.venueA1, phone, { replacesAssignmentId: old!.id })
    ).json<Invite>();
    h.clock.advanceDays(8);
    const lapsed = (await listed(admin)).find((i) => i.id === first.id)!;
    expect(lapsed).toMatchObject({ status: 'expired', replacesAssignmentId: old!.id });

    // What the console's Resend sends: the same number, role and place, plus the link.
    const resent = await venueInvite(admin, h.world.venueA1, phone, {
      replacesAssignmentId: lapsed.replacesAssignmentId,
    });
    expect(resent.status).toBe(201);
    expect(resent.json<Invite>()).toMatchObject({
      status: 'pending',
      replacesAssignmentId: old!.id,
    });
  });

  it('does not invent a handover for a lapsed invite resent without the link', async () => {
    const holder = await h.venueCoordinator(h.world.venueA1);
    const [old] = await liveAssignments(holder.userId);
    const phone = newPhone();
    await venueInvite(admin, h.world.venueA1, phone, { replacesAssignmentId: old!.id });
    h.clock.advanceDays(8);
    const resent = (await venueInvite(admin, h.world.venueA1, phone)).json<Invite>();
    expect(resent.replacesAssignmentId).toBeNull();
  });

  it('accepts the link again on a resend to the same number, but not for another number', async () => {
    const holder = await h.venueCoordinator(h.world.venueA1);
    const [old] = await liveAssignments(holder.userId);
    const phone = newPhone();
    const first = (
      await venueInvite(admin, h.world.venueA1, phone, { replacesAssignmentId: old!.id })
    ).json<Invite>();
    expect(await liveAssignments(holder.userId)).toHaveLength(0);

    // The console's Resend copies the link of an assignment the handover already ended.
    const explicit = await venueInvite(admin, h.world.venueA1, phone, {
      replacesAssignmentId: old!.id,
    });
    expect(explicit.status).toBe(201);
    expect(explicit.json<Invite>().replacesAssignmentId).toBe(old!.id);
    expect((await listed(admin)).find((i) => i.id === first.id)?.status).toBe('revoked');
    // Nothing is ended twice.
    expect((await auditRows(h)).filter((r) => r.action === 'role.revoke')).toHaveLength(1);

    // An ended assignment cannot be borrowed as the handover of an invite to someone else.
    const other = await venueInvite(admin, h.world.venueA1, newPhone(), {
      replacesAssignmentId: old!.id,
    });
    expect(other.status).toBe(404);
  });

  it("ends a city coordinator's access at once when the city is handed over, before acceptance", async () => {
    const holder = await h.cityCoordinator(h.world.cityB.id);
    const [old] = await liveAssignments(holder.userId);
    const made = await invite(admin, {
      role: 'city_coordinator',
      cityId: h.world.cityB.id,
      phone: newPhone(),
      replacesAssignmentId: old!.id,
    });
    expect(made.status).toBe(201);
    expect(made.json<Invite>().status).toBe('pending');
    expect(await liveAssignments(holder.userId)).toHaveLength(0);
    expect((await auditRows(h)).find((r) => r.action === 'role.revoke')).toMatchObject({
      actorUserId: admin.userId,
      entityId: old!.id,
      cityId: h.world.cityB.id,
      venueId: null,
      meta: { role: 'city_coordinator', reason: 'handover' },
    });
  });

  it("keeps the old holder's access when the handover is refused, and for a plain invite", async () => {
    const holder = await h.venueCoordinator(h.world.venueA1);
    const [old] = await liveAssignments(holder.userId);
    const cases: [string, Actor | null, Record<string, unknown>, number][] = [
      ['person', await h.person(), { replacesAssignmentId: old!.id }, 403],
      ['nobody', null, { replacesAssignmentId: old!.id }, 401],
      [
        'venue coordinator',
        await h.venueCoordinator(h.world.venueA2),
        { replacesAssignmentId: old!.id },
        403,
      ],
      [
        'city coordinator elsewhere',
        await h.cityCoordinator(h.world.cityB.id),
        { replacesAssignmentId: old!.id },
        403,
      ],
      ['the holder themself', holder, { replacesAssignmentId: old!.id }, 403],
      ['plain invite by an admin', admin, {}, 201],
    ];
    for (const [name, who, extra, status] of cases) {
      const res = await invite(who, {
        role: 'venue_coordinator',
        venueId: h.world.venueA1,
        phone: newPhone(),
        ...extra,
      });
      expect(res.status, name).toBe(status);
      expect(await liveAssignments(holder.userId), name).toHaveLength(1);
    }
    // Handing the place to the person who already holds it is refused, and they keep it.
    const self = await venueInvite(admin, h.world.venueA1, holder.phone, {
      replacesAssignmentId: old!.id,
    });
    expect(self.status).toBe(409);
    expect(await liveAssignments(holder.userId)).toHaveLength(1);
    expect((await auditRows(h)).filter((r) => r.action === 'role.revoke')).toHaveLength(0);
  });

  it('follows the scope rules for a handover resend, for every kind of caller', async () => {
    const holder = await h.venueCoordinator(h.world.venueA1);
    const [old] = await liveAssignments(holder.userId);
    const phone = newPhone();
    await venueInvite(admin, h.world.venueA1, phone, { replacesAssignmentId: old!.id });
    const cases: [string, Actor | null, number][] = [
      ['person', await h.person(), 403],
      ['nobody', null, 401],
      ['venue coordinator at the venue', await h.venueCoordinator(h.world.venueA1), 403],
      ['city coordinator elsewhere', await h.cityCoordinator(h.world.cityB.id), 403],
      ['city coordinator of the city', await h.cityCoordinator(h.world.cityA.id), 201],
      ['national admin', admin, 201],
    ];
    for (const [name, who, status] of cases) {
      const res = await invite(who, {
        role: 'venue_coordinator',
        venueId: h.world.venueA1,
        phone,
        replacesAssignmentId: old!.id,
      });
      expect(res.status, name).toBe(status);
      if (status === 201) expect(res.json<Invite>().replacesAssignmentId, name).toBe(old!.id);
    }
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

  it('refuses the same role twice, and answers not found for an unknown person', async () => {
    const person = await h.person();
    const body = { role: 'city_coordinator', cityId: h.world.cityA.id, userId: person.userId };
    expect((await assign(admin, body)).status).toBe(201);
    const twice = await assign(admin, body);
    expect(twice.status).toBe(409);
    expect(code(twice)).toBe('role_already_assigned');
    expect((await assign(admin, { ...body, userId: nil })).status).toBe(404);
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

  it('answers an unknown venue with not found for staff and forbidden for everyone else', async () => {
    const person = await h.person();
    const cityA = await h.cityCoordinator(h.world.cityA.id);
    expect(
      (await assign(cityA, { role: 'venue_coordinator', venueId: nil, userId: person.userId }))
        .status,
    ).toBe(404);
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

  it('answers not found for a handover of an unknown, revoked or elsewhere assignment, refuses the same person, and changes nothing', async () => {
    const holder = await h.venueCoordinator(h.world.venueA1);
    const elsewhere = await h.venueCoordinator(h.world.venueA2);
    const incoming = await h.person();
    const [here] = await liveAssignments(holder.userId);
    const [there] = await liveAssignments(elsewhere.userId);
    const body = { role: 'venue_coordinator', venueId: h.world.venueA1, userId: incoming.userId };
    expect((await assign(admin, { ...body, replacesAssignmentId: there!.id })).status).toBe(404);
    expect((await assign(admin, { ...body, replacesAssignmentId: nil })).status).toBe(404);
    expect(
      (await assign(admin, { ...body, userId: holder.userId, replacesAssignmentId: here!.id }))
        .status,
    ).toBe(400);
    expect(await liveAssignments(incoming.userId)).toEqual([]);
    expect((await liveAssignments(holder.userId)).length).toBe(1);
    expect((await liveAssignments(elsewhere.userId)).length).toBe(1);

    await revoke(admin, here!.id);
    expect((await assign(admin, { ...body, replacesAssignmentId: here!.id })).status).toBe(404);
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
