import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import type { AdminOccurrence, Registration, StaffRegistration } from '@qc/contracts';
import { schema } from '@qc/db';
import { createHarness, type Actor, type Harness } from './harness';
import { TEST_PRINCIPAL_HEADER } from '../middleware/test-auth';
import { auditRows, createSession, outboxRows, register } from './fixtures';

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
type StaffPage = Page<StaffRegistration> & {
  totals: { registrations: number; people: number; waitlisted: number };
};

const cancel = (who: Actor, registrationId: string) =>
  h.api('registrations.cancel', { as: who, params: { registrationId } });
const staffList = (as: Actor, sessionId: string, query: Record<string, string | number> = {}) =>
  h.api('registrations.forSession', { as, params: { sessionId }, query });
const status = async (who: Actor, id: string) => {
  const list = (
    await h.api('registrations.listMine', { as: who, query: { includeCancelled: true } })
  ).json<Page<Registration>>();
  return list.items.find((r) => r.id === id);
};

describe('registering', () => {
  it('confirms a registration, shows the session, and queues one WhatsApp confirmation', async () => {
    const session = await createSession(h, { venueId: h.world.venueA1, as: admin });
    const person = await h.person();
    const { status: code, body } = await register(h, person, session.id, {
      areaId: h.world.cityA.areaId,
      partySize: 3,
    });
    expect(code).toBe(201);
    expect(body).toMatchObject({
      sessionId: session.id,
      status: 'confirmed',
      partySize: 3,
      waitlistPosition: null,
      cancelledAt: null,
      occurrenceId: null,
    });
    expect(body.session.id).toBe(session.id);

    const rows = (await outboxRows(h)).filter((r) => r.templateKey === 'registration_confirmation');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      channel: 'whatsapp',
      recipientUserId: person.userId,
      recipientPhoneE164: person.phone,
      idempotencyKey: `registration_confirmation:${body.id}:whatsapp`,
      // The worker checks venue consent against this column.
      venueId: h.world.venueA1,
      providerMessageId: null,
    });
  });

  it('records the WhatsApp checkbox as consent rows, and keeps no message when it is off', async () => {
    const session = await createSession(h, { venueId: h.world.venueA1, as: admin });
    const yes = await h.person();
    const no = await h.person();
    await register(h, yes, session.id, { areaId: h.world.cityA.areaId, allowWhatsapp: true });
    await register(h, no, session.id, { areaId: h.world.cityA.areaId, allowWhatsapp: false });

    const consentsOf = async (userId: string) =>
      h.db.select().from(schema.consents).where(eq(schema.consents.userId, userId));
    const granted = (await consentsOf(yes.userId)).filter((c) => !c.revokedAt);
    expect(granted.map((c) => c.purpose).sort()).toEqual([
      'registration_updates',
      'session_reminders',
    ]);
    expect(granted.every((c) => c.channel === 'whatsapp' && c.source === 'registration')).toBe(
      true,
    );
    expect((await consentsOf(no.userId)).filter((c) => !c.revokedAt)).toEqual([]);

    const outbox = (await outboxRows(h)).filter(
      (r) => r.templateKey === 'registration_confirmation',
    );
    expect(outbox.map((r) => r.recipientUserId)).toEqual([yes.userId]);
  });

  it('asks for a name the first time, then keeps it', async () => {
    const session = await createSession(h, { venueId: h.world.venueA1, as: admin });
    const person = await h.person({ displayName: '-' });
    const missing = await register(h, person, session.id, { areaId: h.world.cityA.areaId });
    expect(missing.status).toBe(400);
    const res = await h.api('registrations.create', {
      as: person,
      body: {
        sessionId: session.id,
        areaId: h.world.cityA.areaId,
        section: 'family',
        partySize: 1,
        allowWhatsapp: false,
        name: 'Maryam Test',
      },
    });
    expect(res.status).toBe(201);
    const [user] = await h.db.select().from(schema.users).where(eq(schema.users.id, person.userId));
    expect(user?.displayName).toBe('Maryam Test');
  });

  it('refuses a second live registration for the same session, and allows it again after cancelling', async () => {
    const session = await createSession(h, { venueId: h.world.venueA1, as: admin });
    const person = await h.person();
    const first = await register(h, person, session.id, { areaId: h.world.cityA.areaId });
    const again = await register(h, person, session.id, { areaId: h.world.cityA.areaId });
    expect(again.status).toBe(409);
    expect(h.logs.join('\n')).not.toContain(person.phone);
    await cancel(person, first.body.id);
    const third = await register(h, person, session.id, { areaId: h.world.cityA.areaId });
    expect(third.status).toBe(201);
  });

  it('answers with a contract code when registration cannot happen', async () => {
    const person = await h.person();
    const area = h.world.cityA.areaId;
    const code = async (res: { body: unknown; status: number }) =>
      (res.body as unknown as { error?: { code: string } }).error?.code;

    const closed = await createSession(h, {
      venueId: h.world.venueA1,
      as: admin,
      registrationEnabled: false,
    });
    expect(await code(await register(h, person, closed.id, { areaId: area }))).toBe(
      'registration_closed',
    );

    const cancelled = await createSession(h, { venueId: h.world.venueA1, as: admin });
    await h.api('adminSessions.update', {
      as: admin,
      params: { sessionId: cancelled.id },
      body: { status: 'cancelled' },
    });
    expect(await code(await register(h, person, cancelled.id, { areaId: area }))).toBe(
      'session_cancelled',
    );

    const unknown = await register(h, person, '00000000-0000-4000-8000-000000000000', {
      areaId: area,
    });
    expect(unknown.status).toBe(404);

    // A draft is invisible to the public, so it answers exactly like a session that does not exist.
    const draft = await createSession(h, { venueId: h.world.venueA1, as: admin, status: 'draft' });
    expect((await register(h, person, draft.id, { areaId: area })).status).toBe(404);

    const open = await createSession(h, { venueId: h.world.venueA1, as: admin, title: 'Open' });
    const badArea = await register(h, person, open.id, {
      areaId: '00000000-0000-4000-8000-000000000000',
    });
    expect(badArea.status).toBe(404);
  });

  it('refuses a past occurrence, and answers not found for an occurrence of another session', async () => {
    const session = await createSession(h, { venueId: h.world.venueA1, as: admin });
    const other = await createSession(h, { venueId: h.world.venueA1, as: admin, title: 'Other' });
    const list = (
      await h.api('adminSessions.occurrences', {
        as: admin,
        params: { sessionId: session.id },
        query: { limit: 100 },
      })
    ).json<{ items: AdminOccurrence[] }>().items;
    const otherList = (
      await h.api('adminSessions.occurrences', {
        as: admin,
        params: { sessionId: other.id },
        query: { limit: 100 },
      })
    ).json<{ items: AdminOccurrence[] }>().items;
    const person = await h.person();

    const wrong = await register(h, person, session.id, {
      areaId: h.world.cityA.areaId,
      occurrenceId: otherList[0]!.id,
    });
    expect(wrong.status).toBe(404);

    h.clock.advanceDays(1);
    const past = await register(h, person, session.id, {
      areaId: h.world.cityA.areaId,
      occurrenceId: list[0]!.id,
    });
    expect((past.body as unknown as { error: { code: string } }).error.code).toBe(
      'occurrence_in_past',
    );
    const future = await register(h, person, session.id, {
      areaId: h.world.cityA.areaId,
      occurrenceId: list[1]!.id,
    });
    expect(future.status).toBe(201);
    expect(future.body.occurrenceId).toBe(list[1]!.id);
  });

  it('needs a signed-in person', async () => {
    const session = await createSession(h, { venueId: h.world.venueA1, as: admin });
    const res = await h.api('registrations.create', {
      body: {
        sessionId: session.id,
        areaId: h.world.cityA.areaId,
        section: 'family',
        partySize: 1,
        allowWhatsapp: false,
      },
    });
    expect(res.status).toBe(401);
  });

  it('keeps names and numbers out of the logs', async () => {
    const session = await createSession(h, { venueId: h.world.venueA1, as: admin });
    const person = await h.person({ displayName: 'Zainab Unlogged' });
    await register(h, person, session.id, { areaId: h.world.cityA.areaId });
    const text = h.logs.join('\n');
    expect(text).not.toContain(person.phone);
    expect(text).not.toContain('Zainab');
  });
});

describe('capacity and the waitlist', () => {
  it('fills the seats, then queues people in order with their position', async () => {
    const session = await createSession(h, { venueId: h.world.venueA1, as: admin, capacity: 2 });
    const people = [await h.person(), await h.person(), await h.person(), await h.person()];
    const results = [];
    for (const p of people) {
      results.push(await register(h, p, session.id, { areaId: h.world.cityA.areaId }));
    }
    expect(results.map((r) => r.body.status)).toEqual([
      'confirmed',
      'confirmed',
      'waitlisted',
      'waitlisted',
    ]);
    expect(results.map((r) => r.body.waitlistPosition)).toEqual([null, null, 1, 2]);

    // A party larger than the whole capacity can never fit.
    const big = await register(h, await h.person(), session.id, {
      areaId: h.world.cityA.areaId,
      partySize: 3,
    });
    expect((big.body as unknown as { error: { code: string } }).error.code).toBe('session_full');
  });

  it('promotes the next waitlisted person when a seat opens, and tells them', async () => {
    const session = await createSession(h, { venueId: h.world.venueA1, as: admin, capacity: 1 });
    const first = await h.person();
    const second = await h.person();
    const third = await h.person();
    const r1 = await register(h, first, session.id, { areaId: h.world.cityA.areaId });
    const r2 = await register(h, second, session.id, { areaId: h.world.cityA.areaId });
    const r3 = await register(h, third, session.id, { areaId: h.world.cityA.areaId });
    // The second person also has the app installed.
    await h.api('devices.register', {
      as: second,
      body: { platform: 'android', provider: 'fcm', token: 'fake-device-token-1', locale: 'en' },
    });

    const cancelled = await cancel(first, r1.body.id);
    expect(cancelled.json<Registration>()).toMatchObject({ status: 'cancelled' });
    expect((await status(second, r2.body.id))?.status).toBe('confirmed');
    const stillWaiting = await status(third, r3.body.id);
    expect(stillWaiting).toMatchObject({ status: 'waitlisted', waitlistPosition: 1 });

    const promoted = (await outboxRows(h)).filter(
      (r) => r.templateKey === 'waitlist_promoted' || r.channel === 'push',
    );
    expect(promoted.filter((r) => r.channel === 'whatsapp').map((r) => r.recipientUserId)).toEqual([
      second.userId,
    ]);
    expect(promoted.filter((r) => r.channel === 'push').map((r) => r.recipientUserId)).toEqual([
      second.userId,
    ]);
  });

  it('lets a smaller party past one that does not fit', async () => {
    const session = await createSession(h, { venueId: h.world.venueA1, as: admin, capacity: 4 });
    const aPerson = await h.person();
    const a = await register(h, aPerson, session.id, {
      areaId: h.world.cityA.areaId,
      partySize: 2,
    });
    await register(h, await h.person(), session.id, { areaId: h.world.cityA.areaId, partySize: 2 });
    const bigPerson = await h.person();
    const smallPerson = await h.person();
    const big = await register(h, bigPerson, session.id, {
      areaId: h.world.cityA.areaId,
      partySize: 3,
    });
    const small = await register(h, smallPerson, session.id, {
      areaId: h.world.cityA.areaId,
      partySize: 1,
    });
    expect([big.body.status, small.body.status]).toEqual(['waitlisted', 'waitlisted']);

    await cancel(aPerson, a.body.id);
    expect(await status(bigPerson, big.body.id)).toMatchObject({
      status: 'waitlisted',
      waitlistPosition: 1,
    });
    expect((await status(smallPerson, small.body.id))?.status).toBe('confirmed');
  });

  it('has no limit when no capacity is set', async () => {
    const session = await createSession(h, { venueId: h.world.venueA1, as: admin });
    for (let i = 0; i < 4; i++) {
      const r = await register(h, await h.person(), session.id, {
        areaId: h.world.cityA.areaId,
        partySize: 20,
      });
      expect(r.body.status).toBe('confirmed');
    }
  });
});

describe('own registrations', () => {
  it('only lets people cancel their own, and cancelling twice is harmless', async () => {
    const session = await createSession(h, { venueId: h.world.venueA1, as: admin });
    const owner = await h.person();
    const stranger = await h.person();
    const r = await register(h, owner, session.id, { areaId: h.world.cityA.areaId });
    const denied = await cancel(stranger, r.body.id);
    expect(denied.status).toBe(404);
    expect((await cancel(owner, r.body.id)).status).toBe(200);
    const again = await cancel(owner, r.body.id);
    expect(again.status).toBe(200);
    expect(again.json<Registration>().status).toBe('cancelled');
  });

  it('lists the newest first, hides cancelled ones by default, and pages', async () => {
    const person = await h.person();
    const sessions = [];
    for (let i = 0; i < 3; i++) {
      sessions.push(
        await createSession(h, { venueId: h.world.venueA1, as: admin, title: `Circle ${i}` }),
      );
    }
    const made: Registration[] = [];
    for (const s of sessions) {
      made.push((await register(h, person, s.id, { areaId: h.world.cityA.areaId })).body);
      h.clock.advanceMinutes(1);
    }
    await cancel(person, made[0]!.id);

    const live = (await h.api('registrations.listMine', { as: person })).json<Page<Registration>>();
    expect(live.items.map((r) => r.id)).toEqual([made[2]!.id, made[1]!.id]);
    const all = (
      await h.api('registrations.listMine', {
        as: person,
        query: { includeCancelled: true, limit: 2 },
      })
    ).json<Page<Registration>>();
    expect(all.items.map((r) => r.id)).toEqual([made[2]!.id, made[1]!.id]);
    expect(all.nextCursor).not.toBeNull();
    const next = (
      await h.api('registrations.listMine', {
        as: person,
        query: { includeCancelled: true, limit: 2, cursor: all.nextCursor! },
      })
    ).json<Page<Registration>>();
    expect(next.items.map((r) => r.id)).toEqual([made[0]!.id]);
    expect(next.nextCursor).toBeNull();
  });

  it('can limit the list to sessions that still lie ahead', async () => {
    const person = await h.person();
    const oneOff = await h.api('adminSessions.create', {
      as: admin,
      body: {
        kind: 'one_off',
        venueId: h.world.venueA1,
        program: 'dora',
        title: { en: 'One evening', ur: null },
        section: 'family',
        language: 'en',
        localStartTime: '20:00',
        durationMinutes: 60,
        date: '2026-10-17',
      },
    });
    const id = oneOff.json<{ id: string }>().id;
    await register(h, person, id, { areaId: h.world.cityA.areaId });
    expect(
      (await h.api('registrations.listMine', { as: person, query: { upcomingOnly: true } })).json<
        Page<Registration>
      >().items,
    ).toHaveLength(1);
    h.clock.advanceDays(5);
    expect(
      (await h.api('registrations.listMine', { as: person, query: { upcomingOnly: true } })).json<
        Page<Registration>
      >().items,
    ).toHaveLength(0);
    expect(
      (await h.api('registrations.listMine', { as: person })).json<Page<Registration>>().items,
    ).toHaveLength(1);
  });

  it('never shows another person registrations', async () => {
    const session = await createSession(h, { venueId: h.world.venueA1, as: admin });
    const owner = await h.person();
    const other = await h.person();
    await register(h, owner, session.id, { areaId: h.world.cityA.areaId });
    const list = (await h.api('registrations.listMine', { as: other })).json<Page<Registration>>();
    expect(list.items).toEqual([]);
  });
});

describe('what coordinators see', () => {
  it('shows names, numbers, totals and the WhatsApp choice to staff in scope', async () => {
    const coordinator = await h.venueCoordinator(h.world.venueA1);
    const session = await createSession(h, { venueId: h.world.venueA1, as: admin, capacity: 3 });
    const a = await h.person({ displayName: 'Ayesha Test' });
    const b = await h.person({ displayName: 'Temp Name' });
    const c = await h.person({ displayName: 'Hira Test' });
    await register(h, a, session.id, {
      areaId: h.world.cityA.areaId,
      partySize: 2,
      allowWhatsapp: true,
    });
    await register(h, b, session.id, {
      areaId: h.world.cityA.areaId,
      partySize: 1,
      allowWhatsapp: false,
    });
    await register(h, c, session.id, {
      areaId: h.world.cityA.areaId,
      partySize: 2,
      allowWhatsapp: true,
    });
    // One account never gave a name: staff see no name rather than the placeholder dash.
    await h.db.update(schema.users).set({ displayName: '-' }).where(eq(schema.users.id, b.userId));

    const res = (await staffList(coordinator, session.id)).json<StaffPage>();
    expect(
      res.items.map((r) => [r.name, r.phone, r.partySize, r.status, r.allowsWhatsapp]),
    ).toEqual([
      ['Ayesha Test', a.phone, 2, 'confirmed', true],
      [null, b.phone, 1, 'confirmed', false],
      ['Hira Test', c.phone, 2, 'waitlisted', true],
    ]);
    expect(res.totals).toEqual({ registrations: 3, people: 3, waitlisted: 1 });

    const waiting = (
      await staffList(coordinator, session.id, { status: 'waitlisted' })
    ).json<StaffPage>();
    expect(waiting.items.map((r) => r.name)).toEqual(['Hira Test']);

    const paged = (await staffList(coordinator, session.id, { limit: 2 })).json<StaffPage>();
    expect(paged.items).toHaveLength(2);
    expect(paged.nextCursor).not.toBeNull();
  });

  it('leaves out cancelled registrations unless asked', async () => {
    const coordinator = await h.venueCoordinator(h.world.venueA1);
    const session = await createSession(h, { venueId: h.world.venueA1, as: admin });
    const person = await h.person();
    const r = await register(h, person, session.id, { areaId: h.world.cityA.areaId });
    await cancel(person, r.body.id);
    expect((await staffList(coordinator, session.id)).json<StaffPage>().items).toEqual([]);
    const withCancelled = (
      await staffList(coordinator, session.id, { status: 'cancelled' })
    ).json<StaffPage>();
    expect(withCancelled.items).toHaveLength(1);
  });

  it('keeps coordinators out of other venues, and ordinary people out of everything', async () => {
    const session = await createSession(h, { venueId: h.world.venueA1, as: admin });
    for (const who of [
      await h.venueCoordinator(h.world.venueA2),
      await h.cityCoordinator(h.world.cityB.id),
      await h.person(),
    ]) {
      expect((await staffList(who, session.id)).status).toBe(403);
      expect(
        (await h.api('registrations.export', { as: who, params: { sessionId: session.id } }))
          .status,
      ).toBe(403);
    }
    expect((await staffList(await h.cityCoordinator(h.world.cityA.id), session.id)).status).toBe(
      200,
    );
  });

  it('answers not_found to staff in scope for an unknown session, and forbidden to everyone else', async () => {
    const nil = '00000000-0000-4000-8000-000000000000';
    expect((await staffList(admin, nil)).status).toBe(404);
    expect((await staffList(await h.person(), nil)).status).toBe(403);
  });
});

describe('the CSV export', () => {
  it('starts with a byte order mark, quotes cells, defuses formulas and keeps phone numbers whole', async () => {
    const coordinator = await h.venueCoordinator(h.world.venueA1);
    const session = await createSession(h, { venueId: h.world.venueA1, as: admin });
    const evil = await h.person({ displayName: '=HYPERLINK("http://example.invalid")' });
    const comma = await h.person({ displayName: 'Khan, Sana' });
    const urdu = await h.person({ displayName: 'فاطمہ ٹیسٹ' });
    for (const p of [evil, comma, urdu])
      await register(h, p, session.id, { areaId: h.world.cityA.areaId });

    const res = await h.api('registrations.export', {
      as: coordinator,
      params: { sessionId: session.id },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    expect(res.headers.get('content-disposition')).toContain(`registrations-${session.id}.csv`);
    // Response text decoding drops a byte order mark, so read the raw bytes.
    const raw = await h.app.request(`/v1/admin/sessions/${session.id}/registrations/export`, {
      headers: { [TEST_PRINCIPAL_HEADER]: JSON.stringify(coordinator.principal) },
    });
    const bytes = new Uint8Array(await raw.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(
      res.text.startsWith('name,phone,section,party_size,status,whatsapp,registered_at\r\n'),
    ).toBe(true);
    const lines = res.text.trimEnd().split('\r\n');
    expect(lines).toHaveLength(4);
    expect(lines[1]).toContain(`"'=HYPERLINK(""http://example.invalid"")"`);
    expect(lines[1]).toContain(`,${evil.phone},`);
    expect(lines[2]).toContain('"Khan, Sana"');
    expect(lines[3]).toContain('فاطمہ ٹیسٹ');
    expect(lines.every((l) => !l.includes(",'+92"))).toBe(true);
  });

  it('writes an audit row for every export, without the contents', async () => {
    const session = await createSession(h, { venueId: h.world.venueA1, as: admin });
    const person = await h.person({ displayName: 'Audit Subject' });
    await register(h, person, session.id, { areaId: h.world.cityA.areaId });
    await h.api('registrations.export', { as: admin, params: { sessionId: session.id } });
    const rows = (await auditRows(h)).filter((r) => r.action === 'registration.export');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      actorUserId: admin.userId,
      entityId: session.id,
      venueId: h.world.venueA1,
      cityId: h.world.cityA.id,
    });
    expect(JSON.stringify(rows[0])).not.toContain('Audit Subject');
    expect(JSON.stringify(rows[0])).not.toContain(person.phone);
  });
});

describe('repeat confirmations (SEC-03)', () => {
  const confirmations = async (userId?: string) =>
    (await outboxRows(h)).filter(
      (r) =>
        r.templateKey === 'registration_confirmation' &&
        (userId === undefined || r.recipientUserId === userId),
    );
  const occurrencesOf = async (sessionId: string) =>
    (
      await h.api('adminSessions.occurrences', {
        as: admin,
        params: { sessionId },
        query: { limit: 100 },
      })
    ).json<{ items: AdminOccurrence[] }>().items;

  it('queues one paid confirmation however often a person cancels and registers again within a day', async () => {
    const session = await createSession(h, { venueId: h.world.venueA1, as: admin });
    const person = await h.person();
    for (let round = 0; round < 5; round++) {
      const res = await register(h, person, session.id, { areaId: h.world.cityA.areaId });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('confirmed');
      await cancel(person, res.body.id);
      h.clock.advanceMinutes(30);
    }
    expect(await confirmations(person.userId)).toHaveLength(1);
    expect(h.logs.join('\n')).not.toContain(person.phone);
  });

  it('confirms again once the day has passed', async () => {
    const session = await createSession(h, { venueId: h.world.venueA1, as: admin });
    const person = await h.person();
    const first = await register(h, person, session.id, { areaId: h.world.cityA.areaId });
    await cancel(person, first.body.id);
    h.clock.advanceMinutes(23 * 60);
    const second = await register(h, person, session.id, { areaId: h.world.cityA.areaId });
    expect(second.status).toBe(201);
    expect(await confirmations(person.userId)).toHaveLength(1);
    await cancel(person, second.body.id);
    h.clock.advanceMinutes(61);
    const third = await register(h, person, session.id, { areaId: h.world.cityA.areaId });
    expect(third.status).toBe(201);
    const rows = await confirmations(person.userId);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.idempotencyKey)).toContain(
      `registration_confirmation:${third.body.id}:whatsapp`,
    );
  });

  it('confirms a different occurrence, and keeps people and sessions apart', async () => {
    const session = await createSession(h, { venueId: h.world.venueA1, as: admin });
    const other = await createSession(h, { venueId: h.world.venueA1, as: admin, title: 'Other' });
    const [occ1, occ2] = await occurrencesOf(session.id);
    const person = await h.person();
    const neighbour = await h.person();

    const a = await register(h, person, session.id, {
      areaId: h.world.cityA.areaId,
      occurrenceId: occ1!.id,
    });
    await cancel(person, a.body.id);
    // The same occurrence again: suppressed.
    const b = await register(h, person, session.id, {
      areaId: h.world.cityA.areaId,
      occurrenceId: occ1!.id,
    });
    expect(b.status).toBe(201);
    expect(await confirmations(person.userId)).toHaveLength(1);
    await cancel(person, b.body.id);
    // Another occurrence of the session: a new confirmation with the right date.
    await register(h, person, session.id, {
      areaId: h.world.cityA.areaId,
      occurrenceId: occ2!.id,
    });
    expect(await confirmations(person.userId)).toHaveLength(2);
    // Another session, and another person on the first session, are not affected.
    await register(h, person, other.id, { areaId: h.world.cityA.areaId });
    await register(h, neighbour, session.id, {
      areaId: h.world.cityA.areaId,
      occurrenceId: occ1!.id,
    });
    expect(await confirmations(person.userId)).toHaveLength(3);
    expect(await confirmations(neighbour.userId)).toHaveLength(1);
  });

  it('still confirms when the earlier registration sent nothing (WhatsApp was off)', async () => {
    const session = await createSession(h, { venueId: h.world.venueA1, as: admin });
    const person = await h.person();
    const quiet = await register(h, person, session.id, {
      areaId: h.world.cityA.areaId,
      allowWhatsapp: false,
    });
    expect(await confirmations(person.userId)).toHaveLength(0);
    await cancel(person, quiet.body.id);
    await register(h, person, session.id, { areaId: h.world.cityA.areaId, allowWhatsapp: true });
    expect(await confirmations(person.userId)).toHaveLength(1);
  });
});
