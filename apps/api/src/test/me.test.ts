import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import type { Bookmark, CircleRequest, Consent, Device, Follow, Me } from '@qc/contracts';
import type { ReadingPosition } from '../modules/shared/types';
import { schema } from '@qc/db';
import { createHarness, type Actor, type Harness } from './harness';
import { createCircle, createSession, outboxRows, register } from './fixtures';

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

const code = (res: { json<T>(): T }) => res.json<{ error: { code: string } }>().error.code;
const nil = '00000000-0000-4000-8000-000000000000';

describe('the profile', () => {
  it('shows the signed-in person their own details, including the number', async () => {
    const person = await h.person({ displayName: 'Noor Test', locale: 'ur' });
    const me = (await h.api('me.get', { as: person })).json<Me>();
    expect(me).toMatchObject({
      id: person.userId,
      phone: person.phone,
      displayName: 'Noor Test',
      locale: 'ur',
      roles: [],
      profile: { areaId: null, ageBand: null, profession: null },
    });
  });

  it('shows no name for an account that never gave one', async () => {
    const person = await h.person({ displayName: '-' });
    expect((await h.api('me.get', { as: person })).json<Me>().displayName).toBeNull();
  });

  it('lists the roles with the name of the city or venue', async () => {
    const coordinator = await h.venueCoordinator(h.world.venueA1);
    const me = (await h.api('me.get', { as: coordinator })).json<Me>();
    expect(me.roles).toHaveLength(1);
    expect(me.roles[0]).toMatchObject({
      role: 'venue_coordinator',
      scopeType: 'venue',
      venueId: h.world.venueA1,
      scopeName: { en: 'Venue A1' },
    });
    const city = await h.cityCoordinator(h.world.cityB.id);
    expect((await h.api('me.get', { as: city })).json<Me>().roles[0]?.scopeName).toMatchObject({
      en: 'City B',
    });
    const national = (await h.api('me.get', { as: admin })).json<Me>();
    expect(national.roles[0]).toMatchObject({ role: 'national_admin', scopeName: null });
  });

  it('updates name, language and profile fields, and keeps what was not sent', async () => {
    const person = await h.person();
    const first = await h.api('me.update', {
      as: person,
      body: {
        displayName: '  Hafsa Test ',
        locale: 'ur',
        areaId: h.world.cityA.areaId,
        ageBand: '25_34',
        profession: 'Teacher',
      },
    });
    expect(first.status).toBe(200);
    expect(first.json<Me>()).toMatchObject({
      displayName: 'Hafsa Test',
      locale: 'ur',
      profile: { areaId: h.world.cityA.areaId, ageBand: '25_34', profession: 'Teacher' },
    });
    const second = (
      await h.api('me.update', { as: person, body: { education: 'Masters' } })
    ).json<Me>();
    expect(second).toMatchObject({
      displayName: 'Hafsa Test',
      profile: { areaId: h.world.cityA.areaId, profession: 'Teacher', education: 'Masters' },
    });
    const cleared = (
      await h.api('me.update', { as: person, body: { areaId: null, profession: null } })
    ).json<Me>();
    expect(cleared.profile).toMatchObject({ areaId: null, profession: null, education: 'Masters' });
  });

  it('refuses an unknown area, an empty name and an unknown field value', async () => {
    const person = await h.person();
    expect((await h.api('me.update', { as: person, body: { areaId: nil } })).status).toBe(400);
    expect((await h.api('me.update', { as: person, body: { displayName: '   ' } })).status).toBe(
      400,
    );
    expect((await h.api('me.update', { as: person, body: { locale: 'fr' } })).status).toBe(400);
  });

  it('needs a signed-in person', async () => {
    expect((await h.api('me.get')).status).toBe(401);
    expect((await h.api('me.update', { body: {} })).status).toBe(401);
  });
});

describe('consents', () => {
  const set = (who: Actor, body: Record<string, unknown>) =>
    h.api('consents.set', { as: who, body });

  it('records a grant, keeps repeating it harmless, and stamps a revoke', async () => {
    const person = await h.person();
    const granted = await set(person, {
      channel: 'whatsapp',
      purpose: 'registration_updates',
      granted: true,
    });
    expect(granted.json<Consent>()).toMatchObject({
      channel: 'whatsapp',
      purpose: 'registration_updates',
      revokedAt: null,
    });
    const again = await set(person, {
      channel: 'whatsapp',
      purpose: 'registration_updates',
      granted: true,
    });
    expect(again.json<Consent>().id).toBe(granted.json<Consent>().id);

    h.clock.advanceMinutes(10);
    const revoked = await set(person, {
      channel: 'whatsapp',
      purpose: 'registration_updates',
      granted: false,
    });
    expect(revoked.json<Consent>().id).toBe(granted.json<Consent>().id);
    expect(revoked.json<Consent>().revokedAt).not.toBeNull();

    // Granting again after a revoke is a new row: the history stays.
    h.clock.advanceMinutes(10);
    const regranted = await set(person, {
      channel: 'whatsapp',
      purpose: 'registration_updates',
      granted: true,
    });
    expect(regranted.json<Consent>().id).not.toBe(granted.json<Consent>().id);
    const list = (await h.api('consents.list', { as: person })).json<{ items: Consent[] }>().items;
    expect(list).toHaveLength(2);
    expect(list.filter((c) => c.revokedAt === null)).toHaveLength(1);
  });

  it('scopes a consent to a venue, and refuses a venue that does not exist', async () => {
    const person = await h.person();
    const res = await set(person, {
      channel: 'push',
      purpose: 'venue_alerts',
      venueId: h.world.venueA1,
      granted: true,
    });
    expect(res.json<Consent>().venueId).toBe(h.world.venueA1);
    expect(
      (await set(person, { channel: 'push', purpose: 'venue_alerts', venueId: nil, granted: true }))
        .status,
    ).toBe(400);
  });

  it('shows only the person own consents', async () => {
    const a = await h.person();
    const b = await h.person();
    await set(a, { channel: 'whatsapp', purpose: 'session_reminders', granted: true });
    expect((await h.api('consents.list', { as: b })).json<{ items: Consent[] }>().items).toEqual(
      [],
    );
  });
});

describe('follows', () => {
  const alerts = async (userId: string, venueId: string) =>
    (await h.db.select().from(schema.consents).where(eq(schema.consents.userId, userId)))
      .filter((c) => c.purpose === 'venue_alerts' && c.venueId === venueId && !c.revokedAt)
      .map((c) => c.channel)
      .sort();

  it('follows a venue with alerts on, which is the consent for push and WhatsApp alerts', async () => {
    const person = await h.person();
    const res = await h.api('follows.create', {
      as: person,
      body: { target: 'venue', venueId: h.world.venueA1 },
    });
    expect(res.status).toBe(201);
    expect(res.json<Follow>()).toMatchObject({
      venueId: h.world.venueA1,
      circleId: null,
      alertsEnabled: true,
      name: { en: 'Venue A1' },
    });
    expect(await alerts(person.userId, h.world.venueA1)).toEqual(['push', 'whatsapp']);
    const list = (await h.api('follows.list', { as: person })).json<{ items: Follow[] }>().items;
    expect(list).toHaveLength(1);
  });

  it('records no consent when the follow starts with alerts off', async () => {
    const person = await h.person();
    await h.api('follows.create', {
      as: person,
      body: { target: 'venue', venueId: h.world.venueA1, alertsEnabled: false },
    });
    expect(await alerts(person.userId, h.world.venueA1)).toEqual([]);
  });

  it('refuses a duplicate follow, and answers not found for an unknown or archived venue', async () => {
    const person = await h.person();
    const body = { target: 'venue', venueId: h.world.venueA1 };
    await h.api('follows.create', { as: person, body });
    const dup = await h.api('follows.create', { as: person, body });
    expect(dup.status).toBe(409);
    expect(code(dup)).toBe('conflict');
    expect(
      (await h.api('follows.create', { as: person, body: { target: 'venue', venueId: nil } }))
        .status,
    ).toBe(404);
    await h.api('adminVenues.archive', { as: admin, params: { venueId: h.world.venueA2 } });
    expect(
      (
        await h.api('follows.create', {
          as: person,
          body: { target: 'venue', venueId: h.world.venueA2 },
        })
      ).status,
    ).toBe(404);
  });

  it('follows a published circle, but not one still waiting for approval', async () => {
    const coordinator = await h.venueCoordinator(h.world.venueA1);
    const pending = await createCircle(h, { venueId: h.world.venueA1, as: coordinator });
    expect(pending.status).toBe('pending_approval');
    const live = await createCircle(h, {
      venueId: h.world.venueA1,
      as: admin,
      name: 'Open circle',
    });
    const person = await h.person();
    expect(
      (
        await h.api('follows.create', {
          as: person,
          body: { target: 'circle', circleId: pending.id },
        })
      ).status,
    ).toBe(404);
    const res = await h.api('follows.create', {
      as: person,
      body: { target: 'circle', circleId: live.id },
    });
    expect(res.status).toBe(201);
    expect(res.json<Follow>()).toMatchObject({
      circleId: live.id,
      venueId: null,
      name: { en: 'Open circle' },
    });
    expect(await alerts(person.userId, h.world.venueA1)).toEqual(['push', 'whatsapp']);
  });

  it('turns alerts off and on, and withdraws the consent only when no follow wants them', async () => {
    const person = await h.person();
    const circle = await createCircle(h, { venueId: h.world.venueA1, as: admin });
    const venueFollow = (
      await h.api('follows.create', {
        as: person,
        body: { target: 'venue', venueId: h.world.venueA1 },
      })
    ).json<Follow>();
    const circleFollow = (
      await h.api('follows.create', { as: person, body: { target: 'circle', circleId: circle.id } })
    ).json<Follow>();

    await h.api('follows.update', {
      as: person,
      params: { followId: venueFollow.id },
      body: { alertsEnabled: false },
    });
    // The circle follow at the same venue still wants alerts.
    expect(await alerts(person.userId, h.world.venueA1)).toEqual(['push', 'whatsapp']);
    const off = await h.api('follows.update', {
      as: person,
      params: { followId: circleFollow.id },
      body: { alertsEnabled: false },
    });
    expect(off.json<Follow>().alertsEnabled).toBe(false);
    expect(await alerts(person.userId, h.world.venueA1)).toEqual([]);

    h.clock.advanceMinutes(5);
    await h.api('follows.update', {
      as: person,
      params: { followId: venueFollow.id },
      body: { alertsEnabled: true },
    });
    expect(await alerts(person.userId, h.world.venueA1)).toEqual(['push', 'whatsapp']);
  });

  it('removes a follow and its alert consent, and only the owner may', async () => {
    const owner = await h.person();
    const other = await h.person();
    const follow = (
      await h.api('follows.create', {
        as: owner,
        body: { target: 'venue', venueId: h.world.venueA1 },
      })
    ).json<Follow>();
    expect(
      (await h.api('follows.delete', { as: other, params: { followId: follow.id } })).status,
    ).toBe(404);
    expect(
      (
        await h.api('follows.update', {
          as: other,
          params: { followId: follow.id },
          body: { alertsEnabled: false },
        })
      ).status,
    ).toBe(404);
    expect(
      (await h.api('follows.delete', { as: owner, params: { followId: follow.id } })).status,
    ).toBe(204);
    expect((await h.api('follows.list', { as: owner })).json<{ items: Follow[] }>().items).toEqual(
      [],
    );
    expect(await alerts(owner.userId, h.world.venueA1)).toEqual([]);
    expect(
      (await h.api('follows.delete', { as: owner, params: { followId: follow.id } })).status,
    ).toBe(404);
  });
});

describe('devices', () => {
  const reg = (who: Actor, token: string, extra: Record<string, unknown> = {}) =>
    h.api('devices.register', {
      as: who,
      body: { platform: 'android', provider: 'fcm', token, locale: 'en', ...extra },
    });

  it('registers a device without ever returning the token', async () => {
    const person = await h.person();
    const res = await reg(person, 'fake-token-aaaaaaaa');
    expect(res.status).toBe(200);
    expect(res.text).not.toContain('fake-token-aaaaaaaa');
    expect(res.json<Device>()).toMatchObject({
      platform: 'android',
      provider: 'fcm',
      locale: 'en',
    });
  });

  it('refreshes the same token instead of adding a second device', async () => {
    const person = await h.person();
    const first = (await reg(person, 'fake-token-bbbbbbbb')).json<Device>();
    h.clock.advanceMinutes(30);
    const second = (await reg(person, 'fake-token-bbbbbbbb', { locale: 'ur' })).json<Device>();
    expect(second.id).toBe(first.id);
    expect(second.locale).toBe('ur');
    expect(second.lastSeenAt > first.lastSeenAt).toBe(true);
    expect(await h.db.select().from(schema.devices)).toHaveLength(1);
  });

  it('moves a token to the next person who signs in on that phone', async () => {
    const before = await h.person();
    const after = await h.person();
    await reg(before, 'fake-token-cccccccc');
    await reg(after, 'fake-token-cccccccc');
    const rows = await h.db.select().from(schema.devices);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.userId).toBe(after.userId);
  });

  it('removes only the own device', async () => {
    const owner = await h.person();
    const other = await h.person();
    const device = (await reg(owner, 'fake-token-dddddddd')).json<Device>();
    expect(
      (await h.api('devices.remove', { as: other, params: { deviceId: device.id } })).status,
    ).toBe(404);
    expect(
      (await h.api('devices.remove', { as: owner, params: { deviceId: device.id } })).status,
    ).toBe(204);
    expect(await h.db.select().from(schema.devices)).toHaveLength(0);
  });

  it('refuses a token that is too short and an unknown provider', async () => {
    const person = await h.person();
    expect((await reg(person, 'short')).status).toBe(400);
    expect((await reg(person, 'fake-token-eeeeeeee', { provider: 'onesignal' })).status).toBe(400);
  });
});

describe('bookmarks and reading position', () => {
  const add = (who: Actor, body: Record<string, unknown>) =>
    h.api('bookmarks.create', { as: who, body });

  it('saves an ayah, a surah and a para bookmark and lists the newest first', async () => {
    const person = await h.person();
    const ayah = await add(person, { kind: 'ayah', surah: 2, ayah: 255, note: 'Ayat al-Kursi' });
    expect(ayah.status).toBe(201);
    expect(ayah.json<Bookmark>()).toMatchObject({
      kind: 'ayah',
      surah: 2,
      ayah: 255,
      para: null,
      note: 'Ayat al-Kursi',
    });
    h.clock.advanceMinutes(1);
    await add(person, { kind: 'surah', surah: 18 });
    h.clock.advanceMinutes(1);
    await add(person, { kind: 'para', para: 30 });
    const list = (await h.api('bookmarks.list', { as: person })).json<{ items: Bookmark[] }>()
      .items;
    expect(list.map((b) => b.kind)).toEqual(['para', 'surah', 'ayah']);
  });

  it('refuses a bookmark that does not match its kind, and a duplicate', async () => {
    const person = await h.person();
    expect((await add(person, { kind: 'ayah', surah: 2 })).status).toBe(400);
    expect((await add(person, { kind: 'surah', surah: 2, ayah: 1 })).status).toBe(400);
    expect((await add(person, { kind: 'para', surah: 1 })).status).toBe(400);
    expect((await add(person, { kind: 'surah', surah: 115 })).status).toBe(400);
    await add(person, { kind: 'surah', surah: 36 });
    const dup = await add(person, { kind: 'surah', surah: 36 });
    expect(dup.status).toBe(409);
  });

  it('lets two people save the same bookmark, and deletes only the own', async () => {
    const a = await h.person();
    const b = await h.person();
    const mine = (await add(a, { kind: 'surah', surah: 1 })).json<Bookmark>();
    expect((await add(b, { kind: 'surah', surah: 1 })).status).toBe(201);
    expect(
      (await h.api('bookmarks.delete', { as: b, params: { bookmarkId: mine.id } })).status,
    ).toBe(404);
    expect(
      (await h.api('bookmarks.delete', { as: a, params: { bookmarkId: mine.id } })).status,
    ).toBe(204);
    expect((await h.api('bookmarks.list', { as: a })).json<{ items: Bookmark[] }>().items).toEqual(
      [],
    );
    expect(
      (await h.api('bookmarks.list', { as: b })).json<{ items: Bookmark[] }>().items,
    ).toHaveLength(1);
  });

  it('imports bookmarks once, skipping the bad and the repeated', async () => {
    const person = await h.person();
    await add(person, { kind: 'surah', surah: 67 });
    const res = await h.api('bookmarks.import', {
      as: person,
      body: {
        items: [
          { kind: 'surah', surah: 67 },
          { kind: 'surah', surah: 55 },
          { kind: 'ayah', surah: 2, ayah: 286 },
          { kind: 'ayah', surah: 2 },
          { kind: 'para', para: 1 },
          { kind: 'para', para: 1 },
        ],
      },
    });
    expect(res.json<{ imported: number; skipped: number }>()).toEqual({ imported: 3, skipped: 3 });
    expect(
      (await h.api('bookmarks.list', { as: person })).json<{ items: Bookmark[] }>().items,
    ).toHaveLength(4);
  });

  it('refuses an import of more than 500 bookmarks', async () => {
    const person = await h.person();
    const items = Array.from({ length: 501 }, () => ({ kind: 'surah', surah: 1 }));
    expect((await h.api('bookmarks.import', { as: person, body: { items } })).status).toBe(400);
  });

  it('starts the reading position at the beginning, then remembers it', async () => {
    const person = await h.person();
    const start = (await h.api('readingPosition.get', { as: person })).json<ReadingPosition>();
    expect(start).toMatchObject({ surah: 1, ayah: 1 });
    h.clock.advanceMinutes(5);
    const put = await h.api('readingPosition.put', { as: person, body: { surah: 18, ayah: 10 } });
    expect(put.json<ReadingPosition>()).toMatchObject({ surah: 18, ayah: 10 });
    h.clock.advanceMinutes(5);
    await h.api('readingPosition.put', { as: person, body: { surah: 19, ayah: 1 } });
    expect(
      (await h.api('readingPosition.get', { as: person })).json<ReadingPosition>(),
    ).toMatchObject({ surah: 19, ayah: 1 });
    expect(
      (await h.api('readingPosition.put', { as: person, body: { surah: 0, ayah: 1 } })).status,
    ).toBe(400);
    expect(
      (await h.api('readingPosition.put', { as: person, body: { surah: 1, ayah: 287 } })).status,
    ).toBe(400);
  });
});

describe('circle requests', () => {
  const ask = (who: Actor, body: Record<string, unknown>) =>
    h.api('circleRequests.create', { as: who, body });

  it('records a request for the area with sorted unique days, valid for 90 days', async () => {
    const person = await h.person();
    const res = await ask(person, {
      areaId: h.world.cityA.areaId,
      days: [5, 1, 5],
      section: 'women',
      language: 'ur',
    });
    expect(res.status).toBe(201);
    const request = res.json<CircleRequest>();
    expect(request).toMatchObject({
      areaId: h.world.cityA.areaId,
      days: [1, 5],
      section: 'women',
      language: 'ur',
      status: 'active',
    });
    expect(new Date(request.expiresAt).getTime() - h.clock.now().getTime()).toBe(
      90 * 24 * 3_600_000,
    );
  });

  it('allows one active request per area, and a new one after the old one lapses', async () => {
    const person = await h.person();
    await ask(person, { areaId: h.world.cityA.areaId });
    const dup = await ask(person, { areaId: h.world.cityA.areaId });
    expect(dup.status).toBe(409);
    expect(code(dup)).toBe('circle_request_exists');
    expect((await ask(person, { areaId: h.world.cityA.areaId2 })).status).toBe(201);

    h.clock.advanceDays(91);
    const list = (await h.api('circleRequests.list', { as: person })).json<{
      items: CircleRequest[];
    }>().items;
    expect(list.map((r) => r.status)).toEqual(['expired', 'expired']);
    expect((await ask(person, { areaId: h.world.cityA.areaId })).status).toBe(201);
  });

  it('cancels a request, harmlessly twice, and only for its owner', async () => {
    const owner = await h.person();
    const other = await h.person();
    const request = (await ask(owner, { areaId: h.world.cityB.areaId })).json<CircleRequest>();
    expect(
      (await h.api('circleRequests.cancel', { as: other, params: { requestId: request.id } }))
        .status,
    ).toBe(404);
    const cancelled = await h.api('circleRequests.cancel', {
      as: owner,
      params: { requestId: request.id },
    });
    expect(cancelled.json<CircleRequest>().status).toBe('cancelled');
    const again = await h.api('circleRequests.cancel', {
      as: owner,
      params: { requestId: request.id },
    });
    expect(again.json<CircleRequest>().status).toBe('cancelled');
    expect((await ask(owner, { areaId: h.world.cityB.areaId })).status).toBe(201);
  });

  it('refuses an unknown area and a day that is not a weekday', async () => {
    const person = await h.person();
    expect((await ask(person, { areaId: nil })).status).toBe(400);
    expect((await ask(person, { areaId: h.world.cityA.areaId, days: [7] })).status).toBe(400);
  });

  it('keeps only the area, never a precise location', async () => {
    const person = await h.person();
    await ask(person, { areaId: h.world.cityA.areaId });
    const [row] = await h.db.select().from(schema.circleRequests);
    expect(Object.keys(row ?? {})).not.toEqual(expect.arrayContaining(['lat', 'lng']));
  });
});

describe('deleting the account', () => {
  it('needs the explicit confirmation', async () => {
    const person = await h.person();
    expect((await h.api('me.delete', { as: person, body: { confirm: false } })).status).toBe(400);
    expect((await h.api('me.delete', { as: person, body: {} })).status).toBe(400);
    expect((await h.api('me.get', { as: person })).status).toBe(200);
  });

  it('removes the person and their private data, and keeps counts anonymous', async () => {
    const session = await createSession(h, { venueId: h.world.venueA1, as: admin });
    const person = await h.person({ displayName: 'Leaving Person' });
    const bystander = await h.person();
    const reg = await register(h, person, session.id, { areaId: h.world.cityA.areaId });
    await register(h, bystander, session.id, { areaId: h.world.cityA.areaId });
    await h.api('follows.create', {
      as: person,
      body: { target: 'venue', venueId: h.world.venueA1 },
    });
    await h.api('bookmarks.create', { as: person, body: { kind: 'surah', surah: 1 } });
    await h.api('circleRequests.create', { as: person, body: { areaId: h.world.cityA.areaId } });
    await h.api('devices.register', {
      as: person,
      body: { platform: 'ios', provider: 'apns', token: 'fake-token-ffffffff', locale: 'en' },
    });
    await h.db.insert(schema.coordinatorInvites).values({
      phoneE164: person.phone,
      role: 'venue_coordinator',
      scopeType: 'venue',
      venueId: h.world.venueA1,
      invitedBy: admin.userId,
      expiresAt: new Date(h.clock.now().getTime() + 86_400_000),
      createdAt: h.clock.now(),
    });
    // A coordinator typed this person's name on the tick list.
    const occurrence = (
      await h.db
        .select()
        .from(schema.occurrences)
        .where(eq(schema.occurrences.sessionId, session.id))
    )[0]!;
    await h.api('adminAttendance.put', {
      as: admin,
      params: { occurrenceId: occurrence.id },
      body: {
        headcount: 2,
        entries: [{ registrationId: reg.body.id, name: 'Typed Name', count: 1 }],
      },
    });

    const res = await h.api('me.delete', { as: person, body: { confirm: true } });
    expect(res.status).toBe(204);

    expect(
      await h.db.select().from(schema.users).where(eq(schema.users.id, person.userId)),
    ).toEqual([]);
    for (const table of [
      schema.follows,
      schema.bookmarks,
      schema.circleRequests,
      schema.devices,
      schema.consents,
    ]) {
      const rows = await h.db.select().from(table);
      expect(rows.filter((r) => (r as { userId: string }).userId === person.userId)).toEqual([]);
    }
    expect(await h.db.select().from(schema.coordinatorInvites)).toEqual([]);

    const kept = await h.db
      .select()
      .from(schema.registrations)
      .where(eq(schema.registrations.id, reg.body.id));
    expect(kept).toHaveLength(1);
    expect(kept[0]).toMatchObject({ userId: null });
    expect(kept[0]?.anonymisedAt).not.toBeNull();
    const entries = await h.db.select().from(schema.attendance);
    expect(entries.map((e) => e.name)).toEqual([null]);

    const outbox = (await outboxRows(h)).filter((r) => r.idempotencyKey.includes(reg.body.id));
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({
      recipientPhoneE164: null,
      payload: {},
      status: 'dead',
      lastErrorCode: 'account_deleted',
    });
    expect(JSON.stringify(await outboxRows(h))).not.toContain(person.phone);
    expect(JSON.stringify(await outboxRows(h))).not.toContain('Leaving Person');
  });

  it('leaves other people untouched', async () => {
    const session = await createSession(h, { venueId: h.world.venueA1, as: admin });
    const leaving = await h.person();
    const staying = await h.person();
    await register(h, leaving, session.id, { areaId: h.world.cityA.areaId });
    const kept = await register(h, staying, session.id, { areaId: h.world.cityA.areaId });
    await h.api('me.delete', { as: leaving, body: { confirm: true } });
    const rows = await h.db
      .select()
      .from(schema.registrations)
      .where(eq(schema.registrations.id, kept.body.id));
    expect(rows[0]?.userId).toBe(staying.userId);
    expect((await outboxRows(h)).filter((r) => r.recipientUserId === staying.userId)).toHaveLength(
      1,
    );
  });

  it('will not remove the last national admin, but will once another exists', async () => {
    const refused = await h.api('me.delete', { as: admin, body: { confirm: true } });
    expect(refused.status).toBe(409);
    expect(refused.json<{ error: { code: string } }>().error.code).toBe('last_national_admin');
    expect((await h.api('me.get', { as: admin })).status).toBe(200);

    await h.nationalAdmin();
    expect((await h.api('me.delete', { as: admin, body: { confirm: true } })).status).toBe(204);
  });

  it('leaves the old principal with nothing to read', async () => {
    const person = await h.person();
    await h.api('me.delete', { as: person, body: { confirm: true } });
    const res = await h.api('me.get', { as: person });
    expect(res.status).toBe(401);
  });
});
