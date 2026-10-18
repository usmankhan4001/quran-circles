import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { and, eq, gt } from 'drizzle-orm';
import type {
  AdminOccurrence,
  AdminSession,
  Occurrence,
  OccurrenceWithSession,
  Session,
  Update,
} from '@qc/contracts';
import { fanOutPendingUpdatePushes, schema } from '@qc/db';
import { topUpAllOccurrences } from '../jobs';
import { createHarness, type Actor, type Harness } from './harness';
import { auditRows, createOneOff, createSession, outboxRows, register } from './fixtures';

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
const issuesOf = (res: { json: <T>() => T }) =>
  res.json<{ error: { issues?: { path: string; code: string }[] } }>().error.issues ?? [];
const occurrencesOf = async (sessionId: string, query: Record<string, string | number> = {}) =>
  (
    await h.api('adminSessions.occurrences', {
      as: admin,
      params: { sessionId },
      query: { limit: 100, ...query },
    })
  ).json<{ items: AdminOccurrence[] }>().items;

describe('creating sessions', () => {
  it('creates a weekly session and plans its occurrences to the 90 day horizon, in Pakistan time', async () => {
    const session = await createSession(h, { venueId: h.world.venueA1, as: admin });
    expect(session).toMatchObject({
      kind: 'recurring',
      status: 'published',
      timezone: 'Asia/Karachi',
      localStartTime: '18:00',
      daysOfWeek: [5],
      cityId: h.world.cityA.id,
      areaId: h.world.cityA.areaId,
      program: 'circles',
    });
    // 18:00 in Pakistan (UTC+5, no daylight saving) is 13:00 UTC.
    expect(session.nextOccurrence?.startsAt).toBe('2026-10-16T13:00:00.000Z');
    expect(session.nextOccurrence?.endsAt).toBe('2026-10-16T14:00:00.000Z');
    const list = await occurrencesOf(session.id);
    expect(list).toHaveLength(13);
    expect(list.at(-1)?.startsAt).toBe('2027-01-08T13:00:00.000Z');
    expect(new Set(list.map((o) => o.startsAt)).size).toBe(13);
  });

  it('plans a one-off lecture as a single occurrence on its date', async () => {
    const lecture = await createOneOff(h, {
      venueId: h.world.venueA1,
      as: admin,
      date: '2026-11-02',
    });
    expect(lecture).toMatchObject({
      kind: 'one_off',
      daysOfWeek: [],
      startsOn: '2026-11-02',
      endsOn: '2026-11-02',
    });
    const list = await occurrencesOf(lecture.id);
    expect(list.map((o) => o.startsAt)).toEqual(['2026-11-02T15:00:00.000Z']);
  });

  it('starts planning at the start date when it is in the future, and stops at an end date', async () => {
    const session = await createSession(h, {
      venueId: h.world.venueA1,
      as: admin,
      startsOn: '2026-11-06',
    });
    const list = await occurrencesOf(session.id);
    expect(list[0]?.startsAt).toBe('2026-11-06T13:00:00.000Z');

    const ended = await h.api('adminSessions.create', {
      as: admin,
      body: {
        kind: 'recurring',
        venueId: h.world.venueA1,
        program: 'circles',
        title: { en: 'Short run' },
        section: 'women',
        language: 'ur',
        localStartTime: '09:30',
        durationMinutes: 45,
        daysOfWeek: [1, 3],
        startsOn: '2026-10-19',
        endsOn: '2026-10-28',
      },
    });
    const shortList = await occurrencesOf(ended.json<AdminSession>().id);
    expect(shortList.map((o) => o.startsAt)).toEqual([
      '2026-10-19T04:30:00.000Z',
      '2026-10-21T04:30:00.000Z',
      '2026-10-26T04:30:00.000Z',
      '2026-10-28T04:30:00.000Z',
    ]);
  });

  it('records an audit row for the creation without the title', async () => {
    const coordinator = await h.venueCoordinator(h.world.venueA1);
    const session = await createSession(h, {
      venueId: h.world.venueA1,
      as: coordinator,
      title: 'Secret circle name',
    });
    const rows = (await auditRows(h)).filter((r) => r.action === 'session.create');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      actorUserId: coordinator.userId,
      entityId: session.id,
      venueId: h.world.venueA1,
      cityId: h.world.cityA.id,
    });
    expect(JSON.stringify(rows[0]?.meta)).not.toContain('Secret');
  });

  it('answers not found for unknown references and refuses bad dates', async () => {
    const base = {
      kind: 'recurring' as const,
      venueId: h.world.venueA1,
      program: 'circles' as const,
      title: { en: 'X circle' },
      section: 'family' as const,
      language: 'en' as const,
      localStartTime: '18:00',
      durationMinutes: 60,
      daysOfWeek: [5],
      startsOn: '2026-10-16',
    };
    const badEnd = await h.api('adminSessions.create', {
      as: admin,
      body: { ...base, endsOn: '2026-10-01' },
    });
    expect(badEnd.status).toBe(400);
    expect(issuesOf(badEnd)).toEqual([{ path: 'endsOn', code: 'invalid_range' }]);
    // Ending on the day it starts is fine.
    const sameDay = await h.api('adminSessions.create', {
      as: admin,
      body: { ...base, endsOn: base.startsOn },
    });
    expect(sameDay.status).toBe(201);
    const nilId = '00000000-0000-4000-8000-000000000000';
    const badCircle = await h.api('adminSessions.create', {
      as: admin,
      body: { ...base, circleId: nilId },
    });
    expect(badCircle.status).toBe(404);
    const badSeason = await h.api('adminSessions.create', {
      as: admin,
      body: { ...base, seasonId: nilId },
    });
    expect(badSeason.status).toBe(404);
    const badVenue = await h.api('adminSessions.create', {
      as: admin,
      body: { ...base, venueId: nilId },
    });
    expect(badVenue.status).toBe(404);
    const badTime = await h.api('adminSessions.create', {
      as: admin,
      body: { ...base, localStartTime: '25:99' },
    });
    expect(badTime.status).toBe(400);
  });
});

describe('public sessions', () => {
  it('shows published sessions and hides drafts and sessions of archived venues', async () => {
    const live = await createSession(h, {
      venueId: h.world.venueA1,
      as: admin,
      title: 'Live circle',
    });
    const draft = await createSession(h, {
      venueId: h.world.venueA1,
      as: admin,
      title: 'Draft circle',
      status: 'draft',
    });
    const hidden = await createSession(h, {
      venueId: h.world.venueA2,
      as: admin,
      title: 'Hidden circle',
    });
    await h.api('adminVenues.archive', { as: admin, params: { venueId: h.world.venueA2 } });

    const list = (await h.api('sessions.list')).json<Page<Session>>();
    expect(list.items.map((s) => s.id)).toEqual([live.id]);
    expect((await h.api('sessions.get', { params: { sessionId: live.id } })).status).toBe(200);
    expect((await h.api('sessions.get', { params: { sessionId: draft.id } })).status).toBe(404);
    expect((await h.api('sessions.get', { params: { sessionId: hidden.id } })).status).toBe(404);
    expect((await h.api('sessions.occurrences', { params: { sessionId: draft.id } })).status).toBe(
      404,
    );
  });

  it('filters by city, venue, area, program, section, language, day and time, and text', async () => {
    const a = await createSession(h, {
      venueId: h.world.venueA1,
      as: admin,
      title: 'Women morning',
      section: 'women',
      language: 'ur',
      localStartTime: '08:00',
      daysOfWeek: [1],
    });
    const b = await createSession(h, {
      venueId: h.world.venueB1,
      as: admin,
      title: 'Family evening',
      section: 'family',
      language: 'en',
      localStartTime: '19:30',
      daysOfWeek: [5],
      program: 'dora',
    });
    const ids = async (query: Record<string, string | number | string[]>) =>
      (await h.api('sessions.list', { query })).json<Page<Session>>().items.map((s) => s.id);

    expect(await ids({ cityId: h.world.cityB.id })).toEqual([b.id]);
    expect(await ids({ venueId: h.world.venueA1 })).toEqual([a.id]);
    expect(await ids({ areaId: h.world.cityB.areaId })).toEqual([b.id]);
    expect(await ids({ program: 'dora' })).toEqual([b.id]);
    expect(await ids({ section: 'women' })).toEqual([a.id]);
    expect(await ids({ language: 'en' })).toEqual([b.id]);
    expect(await ids({ dayOfWeek: ['1'] })).toEqual([a.id]);
    expect((await ids({ dayOfWeek: ['1', '5'] })).sort()).toEqual([a.id, b.id].sort());
    expect(await ids({ timeFrom: '18:00' })).toEqual([b.id]);
    expect(await ids({ timeTo: '12:00' })).toEqual([a.id]);
    expect(await ids({ q: 'evening' })).toEqual([b.id]);
    expect(await ids({ q: 'venue a1' })).toEqual([a.id]);
    expect(await ids({ kind: 'one_off' })).toEqual([]);
  });

  it('matches a one-off lecture on the day of its date', async () => {
    // 2026-11-02 is a Monday.
    const lecture = await createOneOff(h, {
      venueId: h.world.venueA1,
      as: admin,
      date: '2026-11-02',
    });
    const monday = (await h.api('sessions.list', { query: { dayOfWeek: ['1'] } })).json<
      Page<Session>
    >();
    expect(monday.items.map((s) => s.id)).toEqual([lecture.id]);
    const tuesday = (await h.api('sessions.list', { query: { dayOfWeek: ['2'] } })).json<
      Page<Session>
    >();
    expect(tuesday.items).toEqual([]);
  });

  it('lists sooner sessions first, then pages', async () => {
    const later = await createSession(h, {
      venueId: h.world.venueA1,
      as: admin,
      title: 'Later',
      daysOfWeek: [6],
    });
    const sooner = await createSession(h, {
      venueId: h.world.venueA1,
      as: admin,
      title: 'Sooner',
      daysOfWeek: [5],
    });
    const page = (await h.api('sessions.list', { query: { limit: 1 } })).json<Page<Session>>();
    expect(page.items.map((s) => s.id)).toEqual([sooner.id]);
    const next = (
      await h.api('sessions.list', { query: { limit: 1, cursor: page.nextCursor! } })
    ).json<Page<Session>>();
    expect(next.items.map((s) => s.id)).toEqual([later.id]);
    expect(next.nextCursor).toBeNull();
  });

  it('lists occurrences across sessions in time order with their session, and respects the window', async () => {
    const one = await createSession(h, {
      venueId: h.world.venueA1,
      as: admin,
      title: 'One',
      daysOfWeek: [5],
    });
    const two = await createOneOff(h, {
      venueId: h.world.venueB1,
      as: admin,
      date: '2026-10-17',
      localStartTime: '07:00',
    });
    const all = (await h.api('occurrences.list', { query: { limit: 3 } })).json<
      Page<OccurrenceWithSession>
    >();
    expect(all.items.map((o) => o.startsAt)).toEqual([
      '2026-10-16T13:00:00.000Z',
      '2026-10-17T02:00:00.000Z',
      '2026-10-23T13:00:00.000Z',
    ]);
    expect(all.items.map((o) => o.session.id)).toEqual([one.id, two.id, one.id]);

    const window = (
      await h.api('occurrences.list', {
        query: { from: '2026-10-17T00:00:00.000Z', to: '2026-10-18T00:00:00.000Z' },
      })
    ).json<Page<OccurrenceWithSession>>();
    expect(window.items.map((o) => o.session.id)).toEqual([two.id]);

    const one0 = (
      await h.api('occurrences.get', { params: { occurrenceId: all.items[0]!.id } })
    ).json<OccurrenceWithSession>();
    expect(one0.session.id).toBe(one.id);
    expect(
      (
        await h.api('occurrences.get', {
          params: { occurrenceId: '00000000-0000-4000-8000-000000000000' },
        })
      ).status,
    ).toBe(404);
  });

  it('writes nothing on a public read while the stored schedule is ahead (SEC-24); the daily job adds the dates', async () => {
    const session = await createSession(h, { venueId: h.world.venueA1, as: admin });
    expect(await occurrencesOf(session.id)).toHaveLength(13);
    const stored = async () =>
      (await h.db.select().from(schema.occurrences)).filter((o) => o.sessionId === session.id)
        .length;

    h.clock.advanceDays(30);
    const read = await h.api('sessions.occurrences', {
      params: { sessionId: session.id },
      query: { limit: 100, from: '2026-10-01T00:00:00.000Z' },
    });
    expect(read.status).toBe(200);
    expect(read.json<{ items: Occurrence[] }>().items).toHaveLength(13);
    expect(await stored()).toBe(13);

    await topUpAllOccurrences(h.db, h.clock.now(), 90);
    expect(await stored()).toBeGreaterThan(13);
  });

  it('tops up a lapsed schedule once as a fallback, without recreating a cancelled one', async () => {
    const session = await createSession(h, { venueId: h.world.venueA1, as: admin });
    const before = await occurrencesOf(session.id);
    expect(before).toHaveLength(13);
    const second = before[1]!;
    await h.api('adminOccurrences.update', {
      as: admin,
      params: { occurrenceId: second.id },
      body: { status: 'cancelled' },
    });

    // The daily job has not run for 80 days: the last stored date is now under a week away.
    h.clock.advanceDays(80);
    const topped = (
      await h.api('sessions.occurrences', {
        params: { sessionId: session.id },
        query: { limit: 100, from: '2026-10-01T00:00:00.000Z' },
      })
    ).json<{ items: Occurrence[] }>().items;
    expect(topped.length).toBeGreaterThan(13);
    expect(new Set(topped.map((o) => o.startsAt)).size).toBe(topped.length);
    expect(topped.find((o) => o.id === second.id)?.status).toBe('cancelled');
    const again = (
      await h.api('sessions.occurrences', {
        params: { sessionId: session.id },
        query: { limit: 100, from: '2026-10-01T00:00:00.000Z' },
      })
    ).json<{ items: Occurrence[] }>().items;
    expect(again.length).toBe(topped.length);
  });
});

describe('editing sessions', () => {
  it('edits details and audits the field names only', async () => {
    const session = await createSession(h, { venueId: h.world.venueA1, as: admin });
    const res = await h.api('adminSessions.update', {
      as: admin,
      params: { sessionId: session.id },
      body: {
        title: { en: 'Renamed circle', ur: null },
        section: 'women',
        registrationEnabled: false,
        description: { en: 'About it', ur: null },
      },
    });
    expect(res.json<AdminSession>()).toMatchObject({
      section: 'women',
      registration: { enabled: false },
    });
    expect(res.json<AdminSession>().title.en).toBe('Renamed circle');
    const row = (await auditRows(h)).find((r) => r.action === 'session.update');
    expect(row?.meta).toEqual({
      fields: ['title', 'description', 'section', 'registrationEnabled'],
    });
  });

  it('turns capacity on and off', async () => {
    const session = await createSession(h, { venueId: h.world.venueA1, as: admin });
    expect(session.registration).toEqual({
      enabled: true,
      capacity: null,
      seatsTaken: null,
      full: false,
    });
    const on = (
      await h.api('adminSessions.update', {
        as: admin,
        params: { sessionId: session.id },
        body: { capacity: 10 },
      })
    ).json<AdminSession>();
    expect(on.registration).toEqual({ enabled: true, capacity: 10, seatsTaken: 0, full: false });
    const off = (
      await h.api('adminSessions.update', {
        as: admin,
        params: { sessionId: session.id },
        body: { capacity: null },
      })
    ).json<AdminSession>();
    expect(off.registration.capacity).toBeNull();
  });

  it('answers not_found for an unknown session', async () => {
    const res = await h.api('adminSessions.update', {
      as: admin,
      params: { sessionId: '00000000-0000-4000-8000-000000000000' },
      body: { section: 'men' },
    });
    expect(res.status).toBe(404);
  });

  it('lists admin sessions by scope, including drafts, with status and venue filters', async () => {
    const a = await createSession(h, { venueId: h.world.venueA1, as: admin, status: 'draft' });
    const b = await createSession(h, { venueId: h.world.venueB1, as: admin });
    const city = await h.cityCoordinator(h.world.cityA.id);
    const cityList = (await h.api('adminSessions.list', { as: city })).json<Page<AdminSession>>();
    expect(cityList.items.map((s) => s.id)).toEqual([a.id]);
    const all = (await h.api('adminSessions.list', { as: admin })).json<Page<AdminSession>>();
    expect(all.items.map((s) => s.id).sort()).toEqual([a.id, b.id].sort());
    const drafts = (
      await h.api('adminSessions.list', { as: admin, query: { status: 'draft' } })
    ).json<Page<AdminSession>>();
    expect(drafts.items.map((s) => s.id)).toEqual([a.id]);
    const byVenue = (
      await h.api('adminSessions.list', { as: admin, query: { venueId: h.world.venueB1 } })
    ).json<Page<AdminSession>>();
    expect(byVenue.items.map((s) => s.id)).toEqual([b.id]);
  });
});

describe('changing the time', () => {
  it('moves future occurrences in place from the date, keeps earlier ones, and posts an update', async () => {
    const coordinator = await h.venueCoordinator(h.world.venueA1);
    const session = await createSession(h, { venueId: h.world.venueA1, as: coordinator });
    const before = await occurrencesOf(session.id);
    const person = await h.person();
    await register(h, person, session.id, {
      areaId: h.world.cityA.areaId,
      occurrenceId: before[2]!.id,
    });

    const res = await h.api('adminSessions.changeSchedule', {
      as: coordinator,
      params: { sessionId: session.id },
      body: { localStartTime: '19:30', effectiveFrom: '2026-10-30', notify: true },
    });
    expect(res.status).toBe(200);
    const body = res.json<{
      session: Session;
      occurrencesChanged: number;
      updatePostedId: string | null;
    }>();
    expect(body.session.localStartTime).toBe('19:30');
    expect(body.occurrencesChanged).toBe(11);
    expect(body.updatePostedId).toBeTruthy();

    const after = await occurrencesOf(session.id);
    expect(after.map((o) => o.id)).toEqual(before.map((o) => o.id));
    // The first two Fridays keep their old time; the rest move to 19:30 (14:30 UTC).
    expect(after.slice(0, 2).map((o) => o.startsAt)).toEqual(
      before.slice(0, 2).map((o) => o.startsAt),
    );
    expect(after[2]?.startsAt).toBe('2026-10-30T14:30:00.000Z');
    expect(after[2]?.endsAt).toBe('2026-10-30T15:30:00.000Z');

    const update = (await h.api('adminUpdates.list', { as: coordinator })).json<
      Page<Update & { recipients: number }>
    >().items[0]!;
    expect(update).toMatchObject({
      id: body.updatePostedId,
      kind: 'time_change',
      sessionId: session.id,
      scope: { type: 'venue', venueId: h.world.venueA1 },
    });
    const row = (await auditRows(h)).find((r) => r.action === 'session.change_schedule');
    expect(row?.meta).toMatchObject({
      effectiveFrom: '2026-10-30',
      occurrencesChanged: 11,
      notify: true,
    });
  });

  it('queues a WhatsApp message for consented registrants and a push for people with a device', async () => {
    const session = await createSession(h, { venueId: h.world.venueA1, as: admin });
    const yes = await h.person({ displayName: 'Consenting Person' });
    const no = await h.person({ displayName: 'Silent Person' });
    await register(h, yes, session.id, { areaId: h.world.cityA.areaId, allowWhatsapp: true });
    await register(h, no, session.id, { areaId: h.world.cityA.areaId, allowWhatsapp: false });
    await h.api('devices.register', {
      as: no,
      body: { platform: 'android', provider: 'fcm', token: 'tok-silent-person-0001', locale: 'en' },
    });

    await h.api('adminSessions.changeSchedule', {
      as: admin,
      params: { sessionId: session.id },
      body: { localStartTime: '17:00', effectiveFrom: '2026-10-16', notify: true },
    });
    // WhatsApp rows are written in the request; the update's push rows by the worker afterwards.
    expect((await outboxRows(h)).filter((r) => r.channel === 'push')).toEqual([]);
    expect(await fanOutPendingUpdatePushes(h.db)).toMatchObject({ updates: 1, rows: 1 });
    const rows = (await outboxRows(h)).filter(
      (r) => r.templateKey === 'session_changed' || r.channel === 'push',
    );
    const whatsapp = rows.filter(
      (r) => r.channel === 'whatsapp' && r.templateKey === 'session_changed',
    );
    expect(whatsapp.map((r) => r.recipientUserId)).toEqual([yes.userId]);
    expect(whatsapp[0]?.recipientPhoneE164).toBe(yes.phone);
    expect(whatsapp[0]?.costCategory).toBe('utility');
    const push = rows.filter((r) => r.channel === 'push');
    expect(push.map((r) => r.recipientUserId)).toEqual([no.userId]);
    // Idempotent keys: one message per person and update.
    expect(new Set(rows.map((r) => r.idempotencyKey)).size).toBe(rows.length);
  });

  it('posts nothing when notify is off or nothing moved', async () => {
    const session = await createSession(h, { venueId: h.world.venueA1, as: admin });
    const quiet = await h.api('adminSessions.changeSchedule', {
      as: admin,
      params: { sessionId: session.id },
      body: { localStartTime: '17:00', effectiveFrom: '2026-10-16', notify: false },
    });
    expect(
      quiet.json<{ occurrencesChanged: number; updatePostedId: string | null }>(),
    ).toMatchObject({ updatePostedId: null });
    expect(quiet.json<{ occurrencesChanged: number }>().occurrencesChanged).toBeGreaterThan(0);

    const same = await h.api('adminSessions.changeSchedule', {
      as: admin,
      params: { sessionId: session.id },
      body: { localStartTime: '17:00', effectiveFrom: '2026-10-16', notify: true },
    });
    expect(
      same.json<{ occurrencesChanged: number; updatePostedId: string | null }>(),
    ).toMatchObject({ occurrencesChanged: 0, updatePostedId: null });
    expect(
      (await h.api('adminUpdates.list', { as: admin })).json<Page<Update>>().items,
    ).toHaveLength(0);
  });

  it('adds and cancels days when the days change, leaving history alone', async () => {
    const session = await createSession(h, {
      venueId: h.world.venueA1,
      as: admin,
      daysOfWeek: [5],
    });
    await h.api('adminSessions.changeSchedule', {
      as: admin,
      params: { sessionId: session.id },
      body: { daysOfWeek: [6], effectiveFrom: '2026-10-23', notify: false },
    });
    const list = await occurrencesOf(session.id, { from: '2026-10-01T00:00:00.000Z' });
    const live = list.filter((o) => o.status === 'scheduled');
    expect(live[0]?.startsAt).toBe('2026-10-16T13:00:00.000Z');
    // Fridays from the 23rd are cancelled, Saturdays added.
    expect(list.find((o) => o.startsAt === '2026-10-23T13:00:00.000Z')?.status).toBe('cancelled');
    expect(live.some((o) => o.startsAt === '2026-10-24T13:00:00.000Z')).toBe(true);
    expect(
      live
        .filter((o) => new Date(o.startsAt).getTime() > Date.parse('2026-10-23T00:00:00Z'))
        .every((o) => new Date(o.startsAt).getUTCDay() === 6),
    ).toBe(true);
  });

  it('refuses a cancelled session, days for a one-off, and a date after the lecture', async () => {
    const session = await createSession(h, { venueId: h.world.venueA1, as: admin });
    const lecture = await createOneOff(h, {
      venueId: h.world.venueA1,
      as: admin,
      date: '2026-11-02',
    });
    const days = await h.api('adminSessions.changeSchedule', {
      as: admin,
      params: { sessionId: lecture.id },
      body: { daysOfWeek: [1], effectiveFrom: '2026-10-20', notify: false },
    });
    expect(days.status).toBe(400);
    const late = await h.api('adminSessions.changeSchedule', {
      as: admin,
      params: { sessionId: lecture.id },
      body: { localStartTime: '21:00', effectiveFrom: '2026-11-05', notify: false },
    });
    expect(late.status).toBe(400);
    const moved = await h.api('adminSessions.changeSchedule', {
      as: admin,
      params: { sessionId: lecture.id },
      body: { localStartTime: '21:00', effectiveFrom: '2026-10-20', notify: false },
    });
    expect(moved.status).toBe(200);
    expect((await occurrencesOf(lecture.id))[0]?.startsAt).toBe('2026-11-02T16:00:00.000Z');

    await h.api('adminSessions.update', {
      as: admin,
      params: { sessionId: session.id },
      body: { status: 'cancelled' },
    });
    const cancelled = await h.api('adminSessions.changeSchedule', {
      as: admin,
      params: { sessionId: session.id },
      body: { localStartTime: '17:00', effectiveFrom: '2026-10-20', notify: false },
    });
    expect(cancelled.status).toBe(409);
    expect(cancelled.json<{ error: { code: string } }>().error.code).toBe('session_cancelled');
  });

  it('refuses an end date before the session starts with invalid_range, as the import does', async () => {
    const session = await createSession(h, { venueId: h.world.venueA1, as: admin });
    const backwards = await h.api('adminSessions.changeSchedule', {
      as: admin,
      params: { sessionId: session.id },
      body: { endsOn: '2026-10-01', effectiveFrom: '2026-10-20', notify: false },
    });
    expect(backwards.status).toBe(400);
    expect(issuesOf(backwards)).toEqual([{ path: 'endsOn', code: 'invalid_range' }]);
    const ends = await h.api('adminSessions.changeSchedule', {
      as: admin,
      params: { sessionId: session.id },
      body: { endsOn: session.startsOn, effectiveFrom: '2026-10-20', notify: false },
    });
    expect(ends.status).toBe(200);
  });
});

describe('cancelling', () => {
  it('cancelling a session cancels future occurrences, posts a cancellation and queues messages', async () => {
    const session = await createSession(h, { venueId: h.world.venueA1, as: admin });
    const person = await h.person();
    await register(h, person, session.id, { areaId: h.world.cityA.areaId });
    const res = await h.api('adminSessions.update', {
      as: admin,
      params: { sessionId: session.id },
      body: { status: 'cancelled' },
    });
    expect(res.json<AdminSession>().status).toBe('cancelled');

    const list = await occurrencesOf(session.id);
    expect(list.every((o) => o.status === 'cancelled')).toBe(true);
    const updates = (await h.api('adminUpdates.list', { as: admin })).json<Page<Update>>().items;
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({ kind: 'cancellation', sessionId: session.id });
    const cancelled = (await outboxRows(h)).filter((r) => r.templateKey === 'session_cancelled');
    expect(cancelled.map((r) => r.recipientUserId)).toEqual([person.userId]);
    // A cancelled session is gone from the public list but its page says why.
    expect((await h.api('sessions.list')).json<Page<Session>>().items).toEqual([]);
  });

  it('archiving cancels future occurrences quietly', async () => {
    const session = await createSession(h, { venueId: h.world.venueA1, as: admin });
    await h.api('adminSessions.update', {
      as: admin,
      params: { sessionId: session.id },
      body: { status: 'archived' },
    });
    expect((await occurrencesOf(session.id)).every((o) => o.status === 'cancelled')).toBe(true);
    expect((await h.api('adminUpdates.list', { as: admin })).json<Page<Update>>().items).toEqual(
      [],
    );
  });
});

describe('occurrences', () => {
  it('sets portion and recap and shows them to the public', async () => {
    const session = await createSession(h, { venueId: h.world.venueA1, as: admin });
    const first = (await occurrencesOf(session.id))[0]!;
    const res = await h.api('adminOccurrences.update', {
      as: admin,
      params: { occurrenceId: first.id },
      body: {
        portion: { kind: 'para', para: 3 },
        portionLabel: 'Para 3 with tafsir',
        recapNote: 'We finished Al-Baqarah 253 to 286',
        recapLocale: 'en',
      },
    });
    expect(res.status).toBe(200);
    const pub = (
      await h.api('occurrences.get', { params: { occurrenceId: first.id } })
    ).json<OccurrenceWithSession>();
    expect(pub.portion).toEqual({ kind: 'para', para: 3 });
    expect(pub.recapNote).toContain('Al-Baqarah');
    expect(pub).not.toHaveProperty('headcount');
    const row = (await auditRows(h)).find((r) => r.action === 'occurrence.update');
    expect(row?.meta).toEqual({
      fields: ['portion', 'portionLabel', 'recapNote', 'recapLocale'],
      notify: false,
    });
  });

  it('cancelling one occurrence with notify posts a cancellation; without it stays quiet', async () => {
    const session = await createSession(h, { venueId: h.world.venueA1, as: admin });
    const list = await occurrencesOf(session.id);
    await h.api('adminOccurrences.update', {
      as: admin,
      params: { occurrenceId: list[0]!.id },
      body: { status: 'cancelled' },
    });
    expect(
      (await h.api('adminUpdates.list', { as: admin })).json<Page<Update>>().items,
    ).toHaveLength(0);
    await h.api('adminOccurrences.update', {
      as: admin,
      params: { occurrenceId: list[1]!.id },
      body: { status: 'cancelled', notify: true },
    });
    const updates = (await h.api('adminUpdates.list', { as: admin })).json<Page<Update>>().items;
    expect(updates.map((u) => u.kind)).toEqual(['cancellation']);
    expect((await auditRows(h)).filter((r) => r.action === 'occurrence.cancel')).toHaveLength(2);
    // Cancelled occurrences drop out of the public list unless asked for.
    const publicList = (await h.api('occurrences.list', { query: { limit: 3 } })).json<
      Page<OccurrenceWithSession>
    >();
    expect(publicList.items.every((o) => o.status === 'scheduled')).toBe(true);
    const withCancelled = (
      await h.api('occurrences.list', { query: { limit: 3, includeCancelled: true } })
    ).json<Page<OccurrenceWithSession>>();
    expect(withCancelled.items[0]?.status).toBe('cancelled');
  });

  it('moves one occurrence and tells people when asked', async () => {
    const session = await createSession(h, { venueId: h.world.venueA1, as: admin });
    const person = await h.person();
    await register(h, person, session.id, { areaId: h.world.cityA.areaId });
    const first = (await occurrencesOf(session.id))[0]!;
    const res = await h.api('adminOccurrences.update', {
      as: admin,
      params: { occurrenceId: first.id },
      body: {
        startsAt: '2026-10-16T14:00:00.000Z',
        endsAt: '2026-10-16T15:00:00.000Z',
        notify: true,
      },
    });
    expect(res.json<{ occurrence: AdminOccurrence }>().occurrence.startsAt).toBe(
      '2026-10-16T14:00:00.000Z',
    );
    const changed = (await outboxRows(h)).filter((r) => r.templateKey === 'session_changed');
    expect(changed).toHaveLength(1);
  });

  it('refuses an end before the start, a clash with another occurrence, and a cancelled session', async () => {
    const session = await createSession(h, { venueId: h.world.venueA1, as: admin });
    const list = await occurrencesOf(session.id);
    const bad = await h.api('adminOccurrences.update', {
      as: admin,
      params: { occurrenceId: list[0]!.id },
      body: { startsAt: '2026-10-16T14:00:00.000Z', endsAt: '2026-10-16T13:00:00.000Z' },
    });
    expect(bad.status).toBe(400);
    const clash = await h.api('adminOccurrences.update', {
      as: admin,
      params: { occurrenceId: list[0]!.id },
      body: { startsAt: list[1]!.startsAt, endsAt: list[1]!.endsAt },
    });
    expect(clash.status).toBe(400);
    await h.api('adminSessions.update', {
      as: admin,
      params: { sessionId: session.id },
      body: { status: 'cancelled' },
    });
    const gone = await h.api('adminOccurrences.update', {
      as: admin,
      params: { occurrenceId: list[0]!.id },
      body: { recapNote: 'x' },
    });
    expect(gone.json<{ error: { code: string } }>().error.code).toBe('session_cancelled');
  });

  it('lists headcounts for the tick list within a window', async () => {
    const session = await createSession(h, { venueId: h.world.venueA1, as: admin });
    const first = (await occurrencesOf(session.id))[0]!;
    await h.api('adminAttendance.put', {
      as: admin,
      params: { occurrenceId: first.id },
      body: { headcount: 12, entries: [] },
    });
    const list = await occurrencesOf(session.id, { to: '2026-10-25T00:00:00.000Z' });
    expect(list.map((o) => o.headcount)).toEqual([12, null]);
  });
});

describe('who reads what', () => {
  it('keeps staff-only data out of the public views', async () => {
    const session = await createSession(h, { venueId: h.world.venueA1, as: admin });
    const publicView = (await h.api('sessions.get', { params: { sessionId: session.id } })).json<
      Record<string, unknown>
    >();
    expect(publicView).not.toHaveProperty('circleStatus');
    const rows = await h.db.select().from(schema.occurrences);
    expect(rows.length).toBeGreaterThan(0);
    const occurrences = (
      await h.api('sessions.occurrences', { params: { sessionId: session.id } })
    ).json<{ items: Record<string, unknown>[] }>().items;
    expect(occurrences[0]).not.toHaveProperty('headcount');
  });
});

describe('reading one session', () => {
  it('returns the same entry the list shows, to anyone whose scope holds it', async () => {
    const session = await createSession(h, { venueId: h.world.venueA1, as: admin });
    const listed = (await h.api('adminSessions.list', { as: admin })).json<{
      items: AdminSession[];
    }>().items[0];
    for (const who of [
      admin,
      await h.cityCoordinator(h.world.cityA.id),
      await h.venueCoordinator(h.world.venueA1),
    ]) {
      const res = await h.api('adminSessions.get', { as: who, params: { sessionId: session.id } });
      expect(res.status).toBe(200);
      expect(res.json<AdminSession>()).toEqual(listed);
    }
  });

  it('answers not found outside the scope or for an unknown id, and forbidden to non-staff', async () => {
    const session = await createSession(h, { venueId: h.world.venueA1, as: admin });
    const nil = '00000000-0000-4000-8000-000000000000';
    const get = (who: Actor, sessionId: string) =>
      h.api('adminSessions.get', { as: who, params: { sessionId } });
    expect((await get(await h.venueCoordinator(h.world.venueA2), session.id)).status).toBe(404);
    expect((await get(await h.cityCoordinator(h.world.cityB.id), session.id)).status).toBe(404);
    expect((await get(admin, nil)).status).toBe(404);
    expect((await get(await h.person(), session.id)).status).toBe(403);
  });
});

describe('the daily occurrence top-up', () => {
  it('fills every live recurring session up to the horizon, and does nothing on a second run', async () => {
    const weekly = await createSession(h, { venueId: h.world.venueA1, as: admin });
    const cancelled = await createSession(h, {
      venueId: h.world.venueA2,
      as: admin,
      title: 'Cancelled',
    });
    await h.api('adminSessions.update', {
      as: admin,
      params: { sessionId: cancelled.id },
      body: { status: 'cancelled' },
    });
    const count = async (sessionId: string) =>
      (await h.db.select().from(schema.occurrences)).filter((o) => o.sessionId === sessionId)
        .length;
    const before = await count(weekly.id);
    const cancelledBefore = await count(cancelled.id);

    h.clock.advanceDays(28);
    const first = await topUpAllOccurrences(h.db, h.clock.now(), 90);
    expect(first.occurrencesAdded).toBe(4);
    expect(await count(weekly.id)).toBe(before + 4);
    expect(await count(cancelled.id)).toBe(cancelledBefore);

    const second = await topUpAllOccurrences(h.db, h.clock.now(), 90);
    expect(second.occurrencesAdded).toBe(0);
  });

  it('stops at the last day of the season the session belongs to', async () => {
    const session = await createSession(h, { venueId: h.world.venueA1, as: admin });
    const [row] = await h.db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.id, session.id));
    const [season] = await h.db
      .insert(schema.seasons)
      .values({
        programId: row!.programId,
        name: 'Short season',
        startsOn: '2026-10-01',
        endsOn: '2026-11-06',
      })
      .returning();
    await h.db
      .update(schema.sessions)
      .set({ seasonId: season!.id })
      .where(eq(schema.sessions.id, session.id));
    // Start from the first occurrence only, as if the session had been made with a short horizon.
    await h.db
      .delete(schema.occurrences)
      .where(
        and(
          eq(schema.occurrences.sessionId, session.id),
          gt(schema.occurrences.startsAt, new Date('2026-10-17T00:00:00Z')),
        ),
      );
    h.clock.advanceDays(1);
    await topUpAllOccurrences(h.db, h.clock.now(), 90);
    const dates = (await h.db.select().from(schema.occurrences))
      .filter((o) => o.sessionId === session.id)
      .map((o) => o.startsAt.toISOString().slice(0, 10))
      .sort();
    expect(dates).toEqual(['2026-10-16', '2026-10-23', '2026-10-30', '2026-11-06']);
  });
});
