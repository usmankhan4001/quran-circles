import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  builtInAyahFor,
  type AdminOccurrence,
  type AyahOfTheDay,
  type CommunityToday,
  type DailyAyahEntry,
  type Me,
  type MemorisationEntry,
  type ReadingDay,
} from '@qc/contracts';
import { schema } from '@qc/db';
import { createHarness, type Actor, type ApiResult, type Harness } from './harness';
import {
  READING_FEATURES,
  auditRows,
  createCircle,
  createSession,
  register,
  setFeatures,
} from './fixtures';

/**
 * Contract 1.0.0-rc.4: days read, the community total, the ayah of the day (public and staff
 * picks), the memorisation tracker, and the profile fields that go with them. The clock starts on
 * Friday 2026-10-16, 10:00 Pakistan time (05:00 UTC).
 */

let h: Harness;
let admin: Actor;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(() => h.close());
beforeEach(async () => {
  await h.reset();
  admin = await h.nationalAdmin();
  // Each feature ships behind its switch; the API refuses a switched-off one (see the end).
  await setFeatures(h, READING_FEATURES);
});

const TODAY = '2026-10-16';
const YESTERDAY = '2026-10-15';
const NIL = '00000000-0000-4000-8000-000000000000';

const code = (res: ApiResult) => res.json<{ error: { code: string } }>().error.code;
const issues = (res: ApiResult) =>
  res.json<{ error: { issues?: { path: string; code: string }[] } }>().error.issues ?? [];

const record = (as: Actor, body: unknown) => h.api('readingDays.record', { as, body });
const listDays = (as: Actor, from: string, to: string) =>
  h.api('readingDays.list', { as, query: { from, to } });
const community = async () => (await h.api('community.today')).json<CommunityToday>();

describe('readingDays.record', () => {
  it('records today by default and answers the whole day', async () => {
    const person = await h.person();
    const res = await record(person, { source: 'reader', pages: 3, ayahs: 40 });
    expect(res.status).toBe(200);
    expect(res.json<ReadingDay>()).toEqual({
      date: TODAY,
      sources: ['reader'],
      pages: 3,
      ayahs: 40,
    });
  });

  it('keeps the larger totals on a repeat, and sums sources in the fixed order', async () => {
    const person = await h.person();
    await record(person, { source: 'reader', pages: 5, ayahs: 10 });
    await record(person, { source: 'reader', pages: 2, ayahs: 30 });
    await record(person, { source: 'manual' });
    const res = await record(person, { source: 'goal', pages: 1 });
    expect(res.json<ReadingDay>()).toEqual({
      date: TODAY,
      sources: ['reader', 'goal', 'manual'],
      pages: 6,
      ayahs: 30,
    });
    const rows = await h.db
      .select()
      .from(schema.readingDays)
      .where(eq(schema.readingDays.userId, person.userId));
    expect(rows).toHaveLength(3);
  });

  it('accepts yesterday and refuses any other date by the server clock', async () => {
    const person = await h.person();
    expect((await record(person, { source: 'manual', date: YESTERDAY })).status).toBe(200);
    for (const date of ['2026-10-14', '2026-10-17', '2025-10-16']) {
      const res = await record(person, { source: 'manual', date });
      expect(res.status, date).toBe(400);
      expect(code(res)).toBe('validation_failed');
      expect(issues(res)).toEqual([{ path: 'date', code: 'out_of_range' }]);
    }
  });

  it('uses the Pakistan date just after midnight, not the UTC date', async () => {
    const person = await h.person();
    h.clock.set(new Date('2026-10-16T19:30:00.000Z')); // 00:30 on the 17th in Pakistan
    const res = await record(person, { source: 'reader', pages: 1 });
    expect(res.json<ReadingDay>().date).toBe('2026-10-17');
    // The day before (the 16th) is still "yesterday"; the 15th is not.
    expect((await record(person, { source: 'reader', date: TODAY })).status).toBe(200);
    expect((await record(person, { source: 'reader', date: YESTERDAY })).status).toBe(400);
  });

  it('refuses the attendance source, negative or too large totals, and a missing source', async () => {
    const person = await h.person();
    for (const body of [
      { source: 'attendance' },
      { source: 'reader', pages: -1 },
      { source: 'reader', pages: 605 },
      { source: 'reader', ayahs: 6237 },
      { pages: 1 },
    ]) {
      const res = await record(person, body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(code(res)).toBe('validation_failed');
    }
    expect(await h.db.select().from(schema.readingDays)).toEqual([]);
  });

  it('needs a signed-in person, and answers unauthenticated for an account that is gone', async () => {
    expect((await h.api('readingDays.record', { body: { source: 'reader' } })).status).toBe(401);
    const ghost = { userId: NIL, assignments: [] };
    const res = await h.api('readingDays.record', { as: ghost, body: { source: 'reader' } });
    expect(res.status).toBe(401);
    expect(await h.db.select().from(schema.communityDays)).toEqual([]);
  });
});

describe('community total', () => {
  it('answers zeros before anyone reads, publicly and cacheable', async () => {
    const res = await h.api('community.today');
    expect(res.status).toBe(200);
    expect(res.json<CommunityToday>()).toEqual({ date: TODAY, readersToday: 0, pagesTogether: 0 });
    expect(res.headers.get('cache-control')).toBe('public, max-age=60');
  });

  it('counts each person once a day and adds only the pages increase', async () => {
    const a = await h.person();
    const b = await h.person();
    await record(a, { source: 'reader', pages: 2 });
    expect(await community()).toMatchObject({ readersToday: 1, pagesTogether: 2 });
    await record(a, { source: 'reader', pages: 5 }); // +3
    await record(a, { source: 'reader', pages: 4 }); // smaller: nothing
    await record(a, { source: 'manual' }); // same person, another source: not a new reader
    await record(a, { source: 'goal', pages: 1 }); // another source's pages: +1
    expect(await community()).toMatchObject({ readersToday: 1, pagesTogether: 6 });
    await record(b, { source: 'manual' });
    expect(await community()).toEqual({ date: TODAY, readersToday: 2, pagesTogether: 6 });
  });

  it('counts yesterday into yesterday and starts over on a new day', async () => {
    const a = await h.person();
    await record(a, { source: 'reader', date: YESTERDAY, pages: 4 });
    expect(await community()).toMatchObject({ readersToday: 0, pagesTogether: 0 });
    const [row] = await h.db
      .select()
      .from(schema.communityDays)
      .where(eq(schema.communityDays.day, YESTERDAY));
    expect(row).toMatchObject({ readers: 1, pages: 4 });
    h.clock.advanceDays(1);
    expect(await community()).toEqual({
      date: '2026-10-17',
      readersToday: 0,
      pagesTogether: 0,
    });
  });

  it('stores no user id in the national table', async () => {
    await record(await h.person(), { source: 'reader', pages: 1 });
    const [row] = await h.db.select().from(schema.communityDays);
    expect(Object.keys(row!).sort()).toEqual(['day', 'pages', 'readers', 'updatedAt']);
  });
});

describe('readingDays.list', () => {
  it('lists own days in date order, leaving out days without reading and other people', async () => {
    const person = await h.person();
    const other = await h.person();
    await record(person, { source: 'reader', date: YESTERDAY, pages: 2 });
    await record(person, { source: 'manual' });
    await record(person, { source: 'reader', pages: 1, ayahs: 7 });
    await record(other, { source: 'reader', pages: 9 });
    const res = await listDays(person, '2026-10-01', '2026-10-31');
    expect(res.json<{ items: ReadingDay[] }>().items).toEqual([
      { date: YESTERDAY, sources: ['reader'], pages: 2, ayahs: 0 },
      { date: TODAY, sources: ['reader', 'manual'], pages: 1, ayahs: 7 },
    ]);
    const narrow = await listDays(person, TODAY, TODAY);
    expect(narrow.json<{ items: ReadingDay[] }>().items.map((d) => d.date)).toEqual([TODAY]);
    expect((await listDays(await h.person(), TODAY, TODAY)).json()).toEqual({ items: [] });
  });

  it('gives staff their own days only, never anyone else', async () => {
    const person = await h.person();
    await record(person, { source: 'reader', pages: 3 });
    for (const staff of [
      admin,
      await h.cityCoordinator(h.world.cityA.id),
      await h.venueCoordinator(h.world.venueA1),
    ]) {
      expect((await listDays(staff, TODAY, TODAY)).json()).toEqual({ items: [] });
    }
  });

  it('refuses a backwards range and one longer than 366 days', async () => {
    const person = await h.person();
    const backwards = await listDays(person, '2026-10-16', '2026-10-15');
    expect(backwards.status).toBe(400);
    expect(issues(backwards)).toEqual([{ path: 'from', code: 'invalid_range' }]);
    const long = await listDays(person, '2025-10-15', '2026-10-16');
    expect(long.status).toBe(400);
    expect(issues(long)).toEqual([{ path: 'to', code: 'too_big' }]);
    expect((await listDays(person, '2025-10-16', '2026-10-16')).status).toBe(200);
    const malformed = await h.api('readingDays.list', { as: person, query: { from: 'x' } });
    expect(malformed.status).toBe(400);
  });
});

describe('attendance adds a day read', () => {
  async function occurrence() {
    const session = await createSession(h, { venueId: h.world.venueA1, as: admin });
    const items = (
      await h.api('adminSessions.occurrences', {
        as: admin,
        params: { sessionId: session.id },
        query: { limit: 10 },
      })
    ).json<{ items: AdminOccurrence[] }>().items;
    return { session, today: items[0]!, next: items[1]! };
  }
  const mark = (occurrenceId: string, body: unknown) =>
    h.api('adminAttendance.put', { as: admin, params: { occurrenceId }, body });

  it("adds an attendance day for each named registrant on the occurrence's Pakistan date", async () => {
    const { session, today } = await occurrence();
    const person = await h.person();
    const reg = await register(h, person, session.id, { areaId: h.world.cityA.areaId });
    const res = await mark(today.id, {
      headcount: 5,
      entries: [
        { registrationId: reg.body.id, name: null, count: 1 },
        { registrationId: null, name: 'Typed Guest', count: 1 },
      ],
    });
    expect(res.status).toBe(200);
    expect((await listDays(person, TODAY, TODAY)).json()).toEqual({
      items: [{ date: TODAY, sources: ['attendance'], pages: 0, ayahs: 0 }],
    });
    expect(await community()).toMatchObject({ readersToday: 1, pagesTogether: 0 });

    // Saving again, or reading in the app the same day, does not count the person twice.
    await mark(today.id, {
      headcount: 6,
      entries: [{ registrationId: reg.body.id, name: null, count: 1 }],
    });
    await record(person, { source: 'reader', pages: 2 });
    expect(await community()).toMatchObject({ readersToday: 1, pagesTogether: 2 });
    expect((await h.db.select().from(schema.readingDays)).map((r) => r.source).sort()).toEqual([
      'attendance',
      'reader',
    ]);
  });

  it('adds nothing for a headcount, typed names, or an occurrence still ahead', async () => {
    const { session, today, next } = await occurrence();
    const person = await h.person();
    const reg = await register(h, person, session.id, { areaId: h.world.cityA.areaId });
    await mark(today.id, {
      headcount: 3,
      entries: [{ registrationId: null, name: 'Typed Guest', count: 2 }],
    });
    await mark(next.id, {
      headcount: 3,
      entries: [{ registrationId: reg.body.id, name: null, count: 1 }],
    });
    expect(await h.db.select().from(schema.readingDays)).toEqual([]);
    expect(await community()).toMatchObject({ readersToday: 0 });
  });

  it('writes nothing when the save is refused', async () => {
    const { session, today } = await occurrence();
    const person = await h.person();
    const reg = await register(h, person, session.id, { areaId: h.world.cityA.areaId });
    const res = await mark(today.id, {
      headcount: 1,
      entries: [{ registrationId: reg.body.id, name: null, count: 2 }],
    });
    expect(res.status).toBe(400);
    expect(await h.db.select().from(schema.readingDays)).toEqual([]);
  });
});

describe('ayahOfTheDay.get', () => {
  const get = (query: Record<string, string | readonly string[]> = {}) =>
    h.api('ayahOfTheDay.get', { query });
  const put = (as: Actor, body: unknown) => h.api('adminDailyAyahs.put', { as, body });

  it('falls back to the built-in list for a signed-out visitor with no picks', async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.json<AyahOfTheDay>()).toEqual({
      date: TODAY,
      ...builtInAyahFor(TODAY),
      source: 'built_in',
      venueId: null,
      circleId: null,
    });
    expect(res.json<AyahOfTheDay>().surah).toBe(builtInAyahFor(TODAY).surah);
  });

  it('applies the rule: one followed pick, else national, else built-in', async () => {
    const circle = await createCircle(h, { venueId: h.world.venueA2, as: admin });
    await put(admin, { date: TODAY, scope: { type: 'national' }, surah: 2, ayah: 255 });
    await put(admin, {
      date: TODAY,
      scope: { type: 'venue', venueId: h.world.venueA1 },
      surah: 94,
      ayah: 5,
    });
    await put(admin, {
      date: TODAY,
      scope: { type: 'circle', circleId: circle.id },
      surah: 112,
      ayah: 1,
    });

    expect((await get()).json<AyahOfTheDay>()).toMatchObject({ source: 'national', surah: 2 });
    expect((await get({ venueId: [h.world.venueA1] })).json<AyahOfTheDay>()).toEqual({
      date: TODAY,
      surah: 94,
      ayah: 5,
      source: 'venue',
      venueId: h.world.venueA1,
      circleId: null,
    });
    expect((await get({ circleId: [circle.id] })).json<AyahOfTheDay>()).toEqual({
      date: TODAY,
      surah: 112,
      ayah: 1,
      source: 'circle',
      venueId: h.world.venueA2,
      circleId: circle.id,
    });
    // Two followed picks: neither wins, the national pick does.
    const both = await get({ venueId: [h.world.venueA1], circleId: [circle.id] });
    expect(both.json<AyahOfTheDay>()).toMatchObject({ source: 'national' });
    // Following a venue with no pick, or an id that names nothing, changes nothing.
    expect((await get({ venueId: [h.world.venueB1, NIL] })).json<AyahOfTheDay>().source).toBe(
      'national',
    );
    // Another date has none of today's picks.
    const tomorrow = await get({ date: '2026-10-17', venueId: [h.world.venueA1] });
    expect(tomorrow.json<AyahOfTheDay>()).toMatchObject({ date: '2026-10-17', source: 'built_in' });
  });

  it('refuses malformed ids and more than 50 of them', async () => {
    expect((await get({ venueId: ['not-a-uuid'] })).status).toBe(400);
    const many = Array.from({ length: 51 }, () => NIL);
    expect((await get({ circleId: many })).status).toBe(400);
    expect((await get({ date: '16-10-2026' })).status).toBe(400);
  });
});

describe('adminDailyAyahs', () => {
  const put = (as: Actor | null, body: unknown) => h.api('adminDailyAyahs.put', { as, body });
  const list = (as: Actor, query: Record<string, string> = {}) =>
    h.api('adminDailyAyahs.list', {
      as,
      query: { from: '2026-10-01', to: '2026-10-31', ...query },
    });
  const del = (as: Actor, dailyAyahId: string) =>
    h.api('adminDailyAyahs.delete', { as, params: { dailyAyahId } });
  const pickAudit = async () => (await auditRows(h)).filter((r) => r.entityType === 'daily_ayah');

  it('sets a national pick, records who set it, and audits it once', async () => {
    const res = await put(admin, {
      date: '2026-10-20',
      scope: { type: 'national' },
      surah: 2,
      ayah: 286,
    });
    expect(res.status).toBe(200);
    const entry = res.json<DailyAyahEntry>();
    expect(entry).toMatchObject({
      date: '2026-10-20',
      scopeType: 'national',
      cityId: null,
      venueId: null,
      circleId: null,
      surah: 2,
      ayah: 286,
    });
    const [row] = await h.db.select().from(schema.dailyAyahs);
    expect(row?.setBy).toBe(admin.userId);
    const audit = await pickAudit();
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      action: 'daily_ayah.set',
      entityId: entry.id,
      scopeType: 'national',
      actorUserId: admin.userId,
    });
  });

  it('replaces the pick for the same date and scope, auditing a change but not a repeat', async () => {
    const coordinator = await h.venueCoordinator(h.world.venueA1);
    const body = {
      date: '2026-10-20',
      scope: { type: 'venue', venueId: h.world.venueA1 },
      surah: 1,
      ayah: 1,
    };
    const first = (await put(coordinator, body)).json<DailyAyahEntry>();
    expect(first).toMatchObject({ cityId: h.world.cityA.id, venueId: h.world.venueA1 });
    h.clock.advanceMinutes(5);
    const second = (await put(admin, { ...body, ayah: 7 })).json<DailyAyahEntry>();
    expect(second.id).toBe(first.id);
    expect(second.ayah).toBe(7);
    expect(Date.parse(second.updatedAt)).toBeGreaterThan(Date.parse(first.updatedAt));
    const [row] = await h.db.select().from(schema.dailyAyahs);
    expect(row?.setBy).toBe(admin.userId);
    await put(admin, { ...body, ayah: 7 });
    const audit = await pickAudit();
    expect(audit.map((a) => [a.action, a.venueId, a.cityId])).toEqual([
      ['daily_ayah.set', h.world.venueA1, h.world.cityA.id],
      ['daily_ayah.set', h.world.venueA1, h.world.cityA.id],
    ]);
    expect(audit[1]?.meta).toMatchObject({ replaced: true, surah: 1, ayah: 7 });
    // A pick for another scope on the same date is a separate row.
    await put(admin, { ...body, scope: { type: 'national' } });
    expect(await h.db.select().from(schema.dailyAyahs)).toHaveLength(2);
  });

  it('checks a circle pick at its venue and stores the venue and city', async () => {
    const circle = await createCircle(h, { venueId: h.world.venueA1, as: admin });
    const body = {
      date: '2026-10-20',
      scope: { type: 'circle', circleId: circle.id },
      surah: 103,
      ayah: 3,
    };
    const city = await h.cityCoordinator(h.world.cityA.id);
    const res = await put(city, body);
    expect(res.status).toBe(200);
    expect(res.json<DailyAyahEntry>()).toMatchObject({
      scopeType: 'circle',
      circleId: circle.id,
      venueId: h.world.venueA1,
      cityId: h.world.cityA.id,
    });
    expect((await put(await h.venueCoordinator(h.world.venueA2), body)).status).toBe(403);
    expect((await put(await h.cityCoordinator(h.world.cityB.id), body)).status).toBe(403);
  });

  it('allows a national pick only for a national admin', async () => {
    const body = { date: '2026-10-20', scope: { type: 'national' }, surah: 1, ayah: 1 };
    for (const actor of [
      await h.person(),
      await h.venueCoordinator(h.world.venueA1),
      await h.cityCoordinator(h.world.cityA.id),
    ]) {
      const res = await put(actor, body);
      expect(res.status).toBe(403);
      expect(code(res)).toBe('forbidden');
    }
    expect((await put(null, body)).status).toBe(401);
    expect(await h.db.select().from(schema.dailyAyahs)).toEqual([]);
    expect(await pickAudit()).toEqual([]);
  });

  it('answers not_found for an unknown venue or circle to staff, forbidden to everyone else', async () => {
    const coordinator = await h.venueCoordinator(h.world.venueA1);
    const venueBody = {
      date: '2026-10-20',
      scope: { type: 'venue', venueId: NIL },
      surah: 1,
      ayah: 1,
    };
    const circleBody = {
      date: '2026-10-20',
      scope: { type: 'circle', circleId: NIL },
      surah: 1,
      ayah: 1,
    };
    for (const body of [venueBody, circleBody]) {
      expect(code(await put(admin, body))).toBe('not_found');
      expect(code(await put(coordinator, body))).toBe('not_found');
      expect(code(await put(await h.person(), body))).toBe('forbidden');
    }
  });

  it('refuses an ayah that does not exist in the surah and a malformed scope', async () => {
    for (const body of [
      { date: '2026-10-20', scope: { type: 'national' }, surah: 1, ayah: 8 },
      { date: '2026-10-20', scope: { type: 'national' }, surah: 115, ayah: 1 },
      { date: '2026-10-20', scope: { type: 'venue' }, surah: 1, ayah: 1 },
      { date: '2026-10-20', scope: { type: 'city', cityId: h.world.cityA.id }, surah: 1, ayah: 1 },
    ]) {
      const res = await put(admin, body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(code(res)).toBe('validation_failed');
    }
    const res = await put(admin, {
      date: '2026-10-20',
      scope: { type: 'national' },
      surah: 1,
      ayah: 8,
    });
    expect(issues(res)).toContainEqual({ path: 'ayah', code: 'custom' });
  });

  it('lists national picks to all staff and place picks in scope only', async () => {
    const circleA2 = await createCircle(h, { venueId: h.world.venueA2, as: admin });
    await put(admin, { date: '2026-10-20', scope: { type: 'national' }, surah: 2, ayah: 255 });
    await put(admin, {
      date: '2026-10-20',
      scope: { type: 'venue', venueId: h.world.venueA1 },
      surah: 1,
      ayah: 1,
    });
    await put(admin, {
      date: '2026-10-19',
      scope: { type: 'circle', circleId: circleA2.id },
      surah: 1,
      ayah: 2,
    });
    await put(admin, {
      date: '2026-10-20',
      scope: { type: 'venue', venueId: h.world.venueB1 },
      surah: 1,
      ayah: 3,
    });
    await put(admin, { date: '2026-11-05', scope: { type: 'national' }, surah: 1, ayah: 4 });

    const seen = async (as: Actor, query: Record<string, string> = {}) => {
      const res = await list(as, query);
      expect(res.status).toBe(200);
      // Dates come in order; two picks of one date and scope have no defined order, so sort.
      const items = res.json<{ items: DailyAyahEntry[] }>().items;
      const dates = items.map((i) => i.date);
      expect(dates).toEqual([...dates].sort());
      return items.map((i) => `${i.date} ${i.scopeType} ${i.ayah}`).sort();
    };
    expect(await seen(admin)).toEqual([
      '2026-10-19 circle 2',
      '2026-10-20 national 255',
      '2026-10-20 venue 1',
      '2026-10-20 venue 3',
    ]);
    expect(await seen(await h.cityCoordinator(h.world.cityA.id))).toEqual([
      '2026-10-19 circle 2',
      '2026-10-20 national 255',
      '2026-10-20 venue 1',
    ]);
    expect(await seen(await h.venueCoordinator(h.world.venueA1))).toEqual([
      '2026-10-20 national 255',
      '2026-10-20 venue 1',
    ]);
    expect(await seen(await h.venueCoordinator(h.world.venueB1))).toEqual([
      '2026-10-20 national 255',
      '2026-10-20 venue 3',
    ]);
    // Filters narrow; a place filter leaves national picks out; an unknown place matches nothing.
    expect(await seen(admin, { scopeType: 'venue' })).toEqual([
      '2026-10-20 venue 1',
      '2026-10-20 venue 3',
    ]);
    expect(await seen(admin, { venueId: h.world.venueA2 })).toEqual(['2026-10-19 circle 2']);
    expect(await seen(admin, { circleId: circleA2.id })).toEqual(['2026-10-19 circle 2']);
    expect(await seen(admin, { venueId: NIL })).toEqual([]);
    expect(
      await seen(await h.venueCoordinator(h.world.venueA1), { venueId: h.world.venueB1 }),
    ).toEqual([]);
  });

  it('refuses a list for a caller with no staff role and a bad range', async () => {
    const attendee = await h.person();
    expect((await list(attendee)).status).toBe(403);
    const backwards = await list(admin, { from: '2026-10-31', to: '2026-10-01' });
    expect(issues(backwards)).toEqual([{ path: 'from', code: 'invalid_range' }]);
    const long = await list(admin, { from: '2025-01-01', to: '2026-10-31' });
    expect(issues(long)).toEqual([{ path: 'to', code: 'too_big' }]);
  });

  it('deletes a pick in scope with an audit row; out of scope is forbidden, unknown is not_found', async () => {
    const pick = (
      await put(admin, {
        date: '2026-10-20',
        scope: { type: 'venue', venueId: h.world.venueA1 },
        surah: 1,
        ayah: 1,
      })
    ).json<DailyAyahEntry>();
    const national = (
      await put(admin, { date: '2026-10-20', scope: { type: 'national' }, surah: 1, ayah: 2 })
    ).json<DailyAyahEntry>();

    expect((await del(await h.person(), pick.id)).status).toBe(403);
    expect((await del(await h.venueCoordinator(h.world.venueA2), pick.id)).status).toBe(403);
    const coordinator = await h.venueCoordinator(h.world.venueA1);
    expect((await del(coordinator, national.id)).status).toBe(403);
    expect(code(await del(coordinator, NIL))).toBe('not_found');
    expect(code(await del(await h.person(), NIL))).toBe('forbidden');

    expect((await del(coordinator, pick.id)).status).toBe(204);
    expect(code(await del(coordinator, pick.id))).toBe('not_found');
    expect((await del(admin, national.id)).status).toBe(204);
    expect(await h.db.select().from(schema.dailyAyahs)).toEqual([]);
    const deletes = (await pickAudit()).filter((a) => a.action === 'daily_ayah.delete');
    expect(deletes.map((a) => [a.entityId, a.actorUserId, a.scopeType])).toEqual([
      [pick.id, coordinator.userId, 'venue'],
      [national.id, admin.userId, 'national'],
    ]);
    // The day falls back to the next rule.
    const res = await h.api('ayahOfTheDay.get', { query: { date: '2026-10-20' } });
    expect(res.json<AyahOfTheDay>().source).toBe('built_in');
  });
});

describe('memorisation', () => {
  const put = (as: Actor, surah: number | string, body: unknown) =>
    h.api('memorisation.put', { as, params: { surah: String(surah) }, body });
  const list = async (as: Actor) =>
    (await h.api('memorisation.list', { as })).json<{
      items: MemorisationEntry[];
      reviseAfterDays: number;
    }>();

  it('starts empty with the default revise setting', async () => {
    expect(await list(await h.person())).toEqual({ items: [], reviseAfterDays: 14 });
  });

  it('stamps lastRevisedAt on markRevised and on a first memorised mark only', async () => {
    const person = await h.person();
    const learning = (await put(person, 67, { status: 'learning' })).json<MemorisationEntry>();
    expect(learning).toMatchObject({ surah: 67, status: 'learning', lastRevisedAt: null });

    h.clock.advanceMinutes(10);
    const memorised = (await put(person, 67, { status: 'memorised' })).json<MemorisationEntry>();
    const stamped = h.clock.now().toISOString();
    expect(memorised.lastRevisedAt).toBe(stamped);

    h.clock.advanceDays(3);
    const revising = (await put(person, 67, { status: 'revising' })).json<MemorisationEntry>();
    expect(revising).toMatchObject({ status: 'revising', lastRevisedAt: stamped });
    const again = (await put(person, 67, { status: 'memorised' })).json<MemorisationEntry>();
    expect(again.lastRevisedAt).toBe(stamped);

    h.clock.advanceDays(1);
    const revised = (
      await put(person, 67, { status: 'memorised', markRevised: true })
    ).json<MemorisationEntry>();
    expect(revised.lastRevisedAt).toBe(h.clock.now().toISOString());
    expect(revised.updatedAt).toBe(h.clock.now().toISOString());

    const fresh = (
      await put(person, 1, { status: 'learning', markRevised: true })
    ).json<MemorisationEntry>();
    expect(fresh.lastRevisedAt).toBe(h.clock.now().toISOString());
  });

  it('lists in surah order, own entries only, with the profile setting', async () => {
    const person = await h.person();
    const other = await h.person();
    await put(person, 114, { status: 'memorised' });
    await put(person, 36, { status: 'learning' });
    await put(other, 2, { status: 'learning' });
    await h.api('me.update', { as: person, body: { memorisationReviseAfterDays: 30 } });
    const mine = await list(person);
    expect(mine.items.map((i) => i.surah)).toEqual([36, 114]);
    expect(mine.reviseAfterDays).toBe(30);
    expect((await list(admin)).items).toEqual([]);
  });

  it('deletes with 204 whether or not the surah was marked', async () => {
    const person = await h.person();
    await put(person, 18, { status: 'learning' });
    const del = () => h.api('memorisation.delete', { as: person, params: { surah: '18' } });
    expect((await del()).status).toBe(204);
    expect((await del()).status).toBe(204);
    expect((await list(person)).items).toEqual([]);
  });

  it('refuses a surah outside 1 to 114 and an unknown status', async () => {
    const person = await h.person();
    for (const [surah, body] of [
      [0, { status: 'learning' }],
      [115, { status: 'learning' }],
      ['abc', { status: 'learning' }],
      [1, { status: 'forgotten' }],
      [1, { status: 'memorised', markRevised: 'yes' }],
    ] as const) {
      const res = await put(person, surah, body);
      expect(res.status, `${surah} ${JSON.stringify(body)}`).toBe(400);
    }
    const del = await h.api('memorisation.delete', { as: person, params: { surah: '115' } });
    expect(del.status).toBe(400);
    expect(await h.db.select().from(schema.memorisation)).toEqual([]);
  });
});

describe('profile fields and account deletion', () => {
  it('reads and writes the daily goal and the revise setting; null clears them', async () => {
    const person = await h.person();
    const before = (await h.api('me.get', { as: person })).json<Me>();
    expect(before.profile).toMatchObject({ dailyGoal: null, memorisationReviseAfterDays: null });

    const set = await h.api('me.update', {
      as: person,
      body: { dailyGoal: { unit: 'pages', amount: 2 }, memorisationReviseAfterDays: 7 },
    });
    expect(set.json<Me>().profile).toMatchObject({
      dailyGoal: { unit: 'pages', amount: 2 },
      memorisationReviseAfterDays: 7,
    });
    // Leaving a field out keeps it.
    await h.api('me.update', { as: person, body: { profession: 'Teacher' } });
    expect((await h.api('me.get', { as: person })).json<Me>().profile.dailyGoal).toEqual({
      unit: 'pages',
      amount: 2,
    });

    const cleared = await h.api('me.update', {
      as: person,
      body: { dailyGoal: null, memorisationReviseAfterDays: null },
    });
    expect(cleared.json<Me>().profile).toMatchObject({
      dailyGoal: null,
      memorisationReviseAfterDays: null,
    });
  });

  it('refuses an out-of-range goal or setting', async () => {
    const person = await h.person();
    for (const body of [
      { dailyGoal: { unit: 'pages', amount: 0 } },
      { dailyGoal: { unit: 'pages', amount: 605 } },
      { dailyGoal: { unit: 'juz', amount: 1 } },
      { dailyGoal: { unit: 'pages' } },
      { memorisationReviseAfterDays: 0 },
      { memorisationReviseAfterDays: 366 },
    ]) {
      expect((await h.api('me.update', { as: person, body })).status, JSON.stringify(body)).toBe(
        400,
      );
    }
  });

  it('deletes reading days and memorisation with the account and keeps the national total', async () => {
    const person = await h.person();
    const staying = await h.person();
    await record(person, { source: 'reader', pages: 4 });
    await record(staying, { source: 'manual' });
    await h.api('memorisation.put', {
      as: person,
      params: { surah: '1' },
      body: { status: 'memorised' },
    });
    const res = await h.api('me.delete', { as: person, body: { confirm: true } });
    expect(res.status).toBe(204);
    expect(
      await h.db
        .select()
        .from(schema.readingDays)
        .where(eq(schema.readingDays.userId, person.userId)),
    ).toEqual([]);
    expect(
      await h.db
        .select()
        .from(schema.memorisation)
        .where(eq(schema.memorisation.userId, person.userId)),
    ).toEqual([]);
    expect(await h.db.select().from(schema.readingDays)).toHaveLength(1);
    expect(await community()).toEqual({ date: TODAY, readersToday: 2, pagesTogether: 4 });
  });
});

describe('feature switches (enforced by the API, not only the apps)', () => {
  type Feature = (typeof READING_FEATURES)[number];
  type Call = [string, (who: Actor | null) => Promise<ApiResult>];
  const asOf = (who: Actor | null) => (who ? { as: who } : {});
  const pick = { date: TODAY, scope: { type: 'national' }, surah: 1, ayah: 1 };
  const calls: Record<Feature, Call[]> = {
    reading_days: [
      [
        'readingDays.record',
        (who) => h.api('readingDays.record', { ...asOf(who), body: { source: 'manual' } }),
      ],
      [
        'readingDays.list',
        (who) => h.api('readingDays.list', { ...asOf(who), query: { from: TODAY, to: TODAY } }),
      ],
    ],
    community_today: [['community.today', (who) => h.api('community.today', asOf(who))]],
    ayah_of_the_day: [
      ['ayahOfTheDay.get', (who) => h.api('ayahOfTheDay.get', asOf(who))],
      [
        'adminDailyAyahs.list',
        (who) => h.api('adminDailyAyahs.list', { ...asOf(who), query: { from: TODAY, to: TODAY } }),
      ],
      ['adminDailyAyahs.put', (who) => h.api('adminDailyAyahs.put', { ...asOf(who), body: pick })],
      [
        'adminDailyAyahs.delete',
        (who) => h.api('adminDailyAyahs.delete', { ...asOf(who), params: { dailyAyahId: NIL } }),
      ],
    ],
    memorisation: [
      ['memorisation.list', (who) => h.api('memorisation.list', asOf(who))],
      [
        'memorisation.put',
        (who) =>
          h.api('memorisation.put', {
            ...asOf(who),
            params: { surah: '1' },
            body: { status: 'learning' },
          }),
      ],
      [
        'memorisation.delete',
        (who) => h.api('memorisation.delete', { ...asOf(who), params: { surah: '1' } }),
      ],
    ],
  };

  for (const key of READING_FEATURES) {
    it(`refuses every ${key} endpoint with forbidden while the switch is off, for every kind of caller`, async () => {
      const callers: [string, Actor | null][] = [
        ['national admin', admin],
        ['city coordinator', await h.cityCoordinator(h.world.cityA.id)],
        ['venue coordinator', await h.venueCoordinator(h.world.venueA1)],
        ['person', await h.person()],
        ['nobody', null],
      ];
      const on: Record<string, number> = {};
      for (const [endpoint, call] of calls[key]) {
        for (const [name, who] of callers) on[`${endpoint}/${name}`] = (await call(who)).status;
      }
      await setFeatures(h, [key], false);
      for (const [endpoint, call] of calls[key]) {
        for (const [name, who] of callers) {
          const res = await call(who);
          const label = `${endpoint} as ${name}`;
          // Sign-in is still checked first (401); then the switch, before anything else.
          if (on[`${endpoint}/${name}`] === 401) expect(res.status, label).toBe(401);
          else expect(code(res), label).toBe('forbidden');
        }
      }
      // With the switch on, the same calls got past it: some caller was let in on each endpoint
      // (deleting an unknown pick is then not_found, not forbidden).
      for (const [endpoint] of calls[key]) {
        const statuses = callers.map(([name]) => on[`${endpoint}/${name}`]);
        expect(
          statuses.some((s) => s !== undefined && s !== 401 && s !== 403),
          endpoint,
        ).toBe(true);
      }
      // The other switches are untouched.
      for (const other of READING_FEATURES.filter((k) => k !== key)) {
        const [, call] = calls[other][0]!;
        expect((await call(admin)).status, other).toBeLessThan(300);
      }
    });
  }

  it('writes nothing while a switch is off', async () => {
    const person = await h.person();
    await setFeatures(h, ['reading_days', 'memorisation', 'ayah_of_the_day'], false);
    expect(code(await record(person, { source: 'manual' }))).toBe('forbidden');
    expect(
      code(
        await h.api('memorisation.put', {
          as: person,
          params: { surah: '1' },
          body: { status: 'learning' },
        }),
      ),
    ).toBe('forbidden');
    expect(code(await h.api('adminDailyAyahs.put', { as: admin, body: pick }))).toBe('forbidden');
    expect(await h.db.select().from(schema.readingDays)).toEqual([]);
    expect(await h.db.select().from(schema.communityDays)).toEqual([]);
    expect(await h.db.select().from(schema.memorisation)).toEqual([]);
    expect(await h.db.select().from(schema.dailyAyahs)).toEqual([]);
    expect((await auditRows(h)).filter((r) => r.entityType === 'daily_ayah')).toEqual([]);
  });

  it('counts a switch that is on for one city only as on, as GET /v1/config shows it for that city', async () => {
    await setFeatures(h, ['community_today'], false);
    expect(code(await h.api('community.today'))).toBe('forbidden');
    await setFeatures(h, ['community_today'], true, h.world.cityB.id);
    expect((await h.api('community.today')).status).toBe(200);
    const config = await h.api('config.get', { query: { cityId: h.world.cityB.id } });
    expect(
      config.json<{ featureFlags: Record<string, boolean> }>().featureFlags['community_today'],
    ).toBe(true);
  });

  it('treats a switch with no row at all as off, like GET /v1/config', async () => {
    await h.db.delete(schema.featureFlags);
    const config = (await h.api('config.get')).json<{ featureFlags: Record<string, boolean> }>();
    for (const key of READING_FEATURES) expect(config.featureFlags[key], key).toBe(false);
    expect(code(await h.api('community.today'))).toBe('forbidden');
    expect(code(await h.api('ayahOfTheDay.get'))).toBe('forbidden');
    expect(code(await record(await h.person(), { source: 'manual' }))).toBe('forbidden');
    expect(code(await h.api('memorisation.list', { as: await h.person() }))).toBe('forbidden');
  });
});
