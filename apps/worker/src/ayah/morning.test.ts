import { eq, like } from 'drizzle-orm';
import { builtInAyahFor, parseDeepLink, PushPayload } from '@qc/contracts';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { tables, type Db } from '../db';
import { createTestDb, type TestDb } from '../test/db';
import { createHarness, type Harness } from '../test/harness';
import { seedConsent, seedDevice, seedUser, seedWorld, type World } from '../test/seed';
import { ayahDailyKey, runMorningAyah, type AyahJobOptions } from './morning';

let test: TestDb;
let h: Harness;

/** 06:30 Pakistan time on 2 November 2026, when the schedule fires. */
const MORNING = new Date('2026-11-02T01:30:00Z');
const DATE = '2026-11-02';

beforeAll(async () => {
  test = await createTestDb();
}, 120_000);

afterAll(async () => {
  await test.pg.close();
});

beforeEach(async () => {
  await test.reset();
  h = createHarness(test.db);
  h.clock.set(MORNING);
});

const run = (over: Partial<AyahJobOptions> = {}) =>
  runMorningAyah({ db: test.db, logger: h.logger, now: h.clock.now, ...over });

const setFlag = async (enabled: boolean, cityId: string | null = null) => {
  await test.db.insert(tables.featureFlags).values({ key: 'ayah_of_the_day', cityId, enabled });
};

/** An active person with one working device, optionally living in an area. */
const person = async (over: { locale?: 'en' | 'ur'; areaId?: string } = {}) => {
  const user = await seedUser(test.db, { locale: over.locale ?? 'en' });
  await seedDevice(test.db, user.id);
  if (over.areaId)
    await test.db.insert(tables.profiles).values({ userId: user.id, areaId: over.areaId });
  return user;
};

const ayahRows = async () =>
  test.db
    .select()
    .from(tables.messageOutbox)
    .where(like(tables.messageOutbox.idempotencyKey, 'ayah_daily:%'));

const pushOf = (row: { payload: unknown }) =>
  PushPayload.parse((row.payload as { push: unknown }).push);

const pick = (
  world: World,
  over: Partial<typeof tables.dailyAyahs.$inferInsert> & { surah: number; ayah: number },
) =>
  test.db.insert(tables.dailyAyahs).values({
    day: DATE,
    scopeType: 'venue',
    cityId: world.city.id,
    venueId: world.venue.id,
    ...over,
  });

describe('the morning ayah job', () => {
  it('queues one push per person with the built-in ayah, in their language, linking to the reader', async () => {
    await setFlag(true);
    const en = await person({ locale: 'en' });
    const ur = await person({ locale: 'ur' });
    const builtIn = builtInAyahFor(DATE);

    expect(await run()).toEqual({
      date: DATE,
      skipped: null,
      candidates: 2,
      queued: 2,
      alreadyQueued: 0,
      flagOff: 0,
      consentOff: 0,
    });

    const enRow = await h.rowByKey(ayahDailyKey(DATE, en.id));
    const urRow = await h.rowByKey(ayahDailyKey(DATE, ur.id));
    expect(enRow).toMatchObject({
      channel: 'push',
      status: 'queued',
      templateKey: null,
      locale: 'en',
      recipientUserId: en.id,
      recipientPhoneE164: null,
      costCategory: 'free',
      venueId: null,
      nextAttemptAt: MORNING,
    });
    expect(ayahDailyKey(DATE, en.id)).toBe(`ayah_daily:${DATE}:${en.id}:push`);
    const enPush = pushOf(enRow!);
    expect(enPush.title).toBe('Ayah of the day');
    expect(enPush.body).toBe(`Surah ${builtIn.surah}, ayah ${builtIn.ayah}. Tap to read it.`);
    expect(enPush.data.type).toBe('ayah_of_the_day');
    expect(parseDeepLink(enPush.data.deepLink)).toEqual({ type: 'quran', ...builtIn });
    const urPush = pushOf(urRow!);
    expect(urPush.title).toBe('آج کی آیت');
    expect(urPush.body).toContain(`سورہ نمبر ${builtIn.surah}`);
    expect(urPush.data.deepLink).toBe(enPush.data.deepLink);
  });

  it('uses the web origin for links when one is configured', async () => {
    await setFlag(true);
    const user = await person();
    await run({ webBase: 'https://example.org/' });
    const push = pushOf((await h.rowByKey(ayahDailyKey(DATE, user.id)))!);
    const { surah, ayah } = builtInAyahFor(DATE);
    expect(push.data.deepLink).toBe(`https://example.org/quran?surah=${surah}&ayah=${ayah}`);
  });

  it("resolves each person's ayah from the places they follow and the day's picks", async () => {
    await setFlag(true);
    const world = await seedWorld(test.db, { circle: true });
    const other = await seedWorld(test.db);
    await test.db
      .insert(tables.dailyAyahs)
      .values({ day: DATE, scopeType: 'national', surah: 2, ayah: 255 });
    await pick(world, { surah: 13, ayah: 28 });
    await pick(other, { surah: 94, ayah: 5 });
    // A pick for another day never counts.
    await pick(world, { day: '2026-11-03', surah: 1, ayah: 1 });

    const venueFollower = await person();
    await test.db
      .insert(tables.follows)
      .values({ userId: venueFollower.id, venueId: world.venue.id });
    const followsBoth = await person();
    await test.db.insert(tables.follows).values([
      { userId: followsBoth.id, venueId: world.venue.id },
      { userId: followsBoth.id, venueId: other.venue.id },
    ]);
    const followsNothing = await person();

    expect((await run()).queued).toBe(3);
    const ayahFor = async (userId: string) =>
      parseDeepLink(pushOf((await h.rowByKey(ayahDailyKey(DATE, userId)))!).data.deepLink);
    expect(await ayahFor(venueFollower.id)).toEqual({ type: 'quran', surah: 13, ayah: 28 });
    // Two followed picks the same day: the national pick decides.
    expect(await ayahFor(followsBoth.id)).toEqual({ type: 'quran', surah: 2, ayah: 255 });
    expect(await ayahFor(followsNothing.id)).toEqual({ type: 'quran', surah: 2, ayah: 255 });
  });

  it('sends nothing while the flag is off or missing, and logs that once', async () => {
    await person();
    expect(await run()).toMatchObject({ skipped: 'flag_off', queued: 0, candidates: 0 });
    await setFlag(false);
    expect(await run()).toMatchObject({ skipped: 'flag_off', queued: 0 });
    expect(await ayahRows()).toHaveLength(0);
    expect(h.logger.lines.filter((l) => l.event === 'ayah_daily.run')).toHaveLength(2);
    expect(h.logger.lines[0]?.fields).toMatchObject({ skipped: 'flag_off', queued: 0 });
  });

  it("follows the API's flag rule: a city's own row overrides the global row", async () => {
    const off = await seedWorld(test.db);
    const on = await seedWorld(test.db);
    const inOffCity = await person({ areaId: off.area.id });
    const inOnCity = await person({ areaId: on.area.id });
    const noCity = await person();

    // Global off, one city on: only that city's people.
    await setFlag(true, on.city.id);
    expect(await run()).toMatchObject({ candidates: 3, queued: 1, flagOff: 2 });
    expect(await h.rowByKey(ayahDailyKey(DATE, inOnCity.id))).toBeDefined();

    // Global on, one city off: everyone except that city.
    await setFlag(true);
    await setFlag(false, off.city.id);
    expect(await run()).toMatchObject({ queued: 1, alreadyQueued: 1, flagOff: 1 });
    expect(await h.rowByKey(ayahDailyKey(DATE, noCity.id))).toBeDefined();
    expect(await h.rowByKey(ayahDailyKey(DATE, inOffCity.id))).toBeUndefined();
  });

  it('respects the morning ayah preference: no row means on, a revoked row means off', async () => {
    await setFlag(true);
    const noRow = await person();
    const revoked = await person();
    await seedConsent(test.db, revoked.id, {
      channel: 'push',
      purpose: 'ayah_daily',
      revokedAt: new Date('2026-10-20T00:00:00Z'),
    });
    const turnedBackOn = await person();
    await seedConsent(test.db, turnedBackOn.id, {
      channel: 'push',
      purpose: 'ayah_daily',
      revokedAt: new Date('2026-10-20T00:00:00Z'),
    });
    await seedConsent(test.db, turnedBackOn.id, {
      channel: 'push',
      purpose: 'ayah_daily',
      grantedAt: new Date('2026-10-25T00:00:00Z'),
    });
    // Turning other alerts off does not touch the morning ayah.
    const remindersOff = await person();
    await seedConsent(test.db, remindersOff.id, {
      channel: 'push',
      purpose: 'session_reminders',
      revokedAt: new Date('2026-10-20T00:00:00Z'),
    });

    expect(await run()).toMatchObject({ candidates: 4, queued: 3, consentOff: 1 });
    expect(await h.rowByKey(ayahDailyKey(DATE, revoked.id))).toBeUndefined();
    for (const user of [noRow, turnedBackOn, remindersOff]) {
      expect(await h.rowByKey(ayahDailyKey(DATE, user.id))).toBeDefined();
    }
  });

  it('skips people with no device, only revoked devices, or an inactive account', async () => {
    await setFlag(true);
    await seedUser(test.db);
    const revokedDevice = await seedUser(test.db);
    await seedDevice(test.db, revokedDevice.id, { revokedAt: new Date('2026-10-01T00:00:00Z') });
    const suspended = await seedUser(test.db, { status: 'suspended' });
    await seedDevice(test.db, suspended.id);
    const twoDevices = await person();
    await seedDevice(test.db, twoDevices.id, { platform: 'ios', provider: 'apns' });

    expect(await run()).toMatchObject({ candidates: 1, queued: 1 });
    const rows = await ayahRows();
    expect(rows.map((r) => r.recipientUserId)).toEqual([twoDevices.id]);
  });

  it('queues nothing new on a second run the same day, and a new push the next morning', async () => {
    await setFlag(true);
    await person();
    await person();
    expect((await run()).queued).toBe(2);
    expect(await run()).toMatchObject({ queued: 0, alreadyQueued: 2 });
    expect(await ayahRows()).toHaveLength(2);

    h.clock.advance(24 * 3_600_000);
    expect(await run()).toMatchObject({ date: '2026-11-03', queued: 2, alreadyQueued: 0 });
    expect(await ayahRows()).toHaveLength(4);
  });

  it('reads people in pages and queues everyone exactly once', async () => {
    await setFlag(true);
    const people = [];
    for (let i = 0; i < 5; i++) people.push(await person());
    expect(await run({ batchSize: 2 })).toMatchObject({ candidates: 5, queued: 5 });
    const rows = await ayahRows();
    expect(new Set(rows.map((r) => r.recipientUserId))).toEqual(new Set(people.map((p) => p.id)));
  });

  it('fails the run when the database fails, and the retry finishes without duplicates', async () => {
    await setFlag(true);
    for (let i = 0; i < 3; i++) await person();
    let inserts = 0;
    // The second page's insert fails, as if the connection dropped mid-run.
    const flaky = new Proxy(test.db, {
      get(target, prop, receiver) {
        if (prop === 'insert' && ++inserts === 2) throw new Error('connection lost');
        const value: unknown = Reflect.get(target, prop, receiver);
        return typeof value === 'function' ? (value as () => unknown).bind(target) : value;
      },
    }) as Db;
    await expect(run({ db: flaky, batchSize: 2 })).rejects.toThrow('connection lost');
    expect(await ayahRows()).toHaveLength(2);

    expect(await run({ batchSize: 2 })).toMatchObject({ queued: 1, alreadyQueued: 2 });
    expect(await ayahRows()).toHaveLength(3);
  });

  it('does not send a "morning" ayah when a make-up run starts after noon', async () => {
    await setFlag(true);
    await person();
    h.clock.set(new Date('2026-11-02T07:00:00Z')); // 12:00 in Pakistan
    expect(await run()).toMatchObject({ skipped: 'too_late', queued: 0 });
    expect(await ayahRows()).toHaveLength(0);
    h.clock.set(new Date('2026-11-02T06:59:00Z')); // 11:59
    expect((await run()).queued).toBe(1);
  });

  it('logs one line per run with counts only: no names, numbers or message text', async () => {
    await setFlag(true);
    const user = await person();
    await run();
    await run();
    const lines = h.logger.lines.filter((l) => l.event === 'ayah_daily.run');
    expect(lines.map((l) => l.fields)).toEqual([
      { candidates: 1, queued: 1, alreadyQueued: 0, flagOff: 0, consentOff: 0 },
      { candidates: 1, queued: 0, alreadyQueued: 1, flagOff: 0, consentOff: 0 },
    ]);
    expect(h.logger.lines).toHaveLength(2);
    const dump = h.logger.dump();
    for (const secret of [
      user.phoneE164,
      'Test Person',
      'Ayah of the day',
      'Tap to read',
      user.id,
    ]) {
      expect(dump).not.toContain(secret);
    }
  });
});

describe('sending the morning ayah', () => {
  it('goes out once through the push provider', async () => {
    await setFlag(true);
    const user = await person();
    await run();
    await h.run();
    await h.run();
    expect(h.push.sent).toHaveLength(1);
    expect(h.push.sent[0]?.payload.data.type).toBe('ayah_of_the_day');
    expect((await h.rowByKey(ayahDailyKey(DATE, user.id)))?.status).toBe('sent');
  });

  it('is blocked at send time when the person turned it off after it was queued', async () => {
    await setFlag(true);
    const user = await person();
    await run();
    await seedConsent(test.db, user.id, {
      channel: 'push',
      purpose: 'ayah_daily',
      grantedAt: new Date('2026-10-01T00:00:00Z'),
      revokedAt: new Date('2026-11-02T01:00:00Z'),
    });
    await h.run();
    expect(h.push.sent).toHaveLength(0);
    expect(await h.rowByKey(ayahDailyKey(DATE, user.id))).toMatchObject({
      status: 'failed',
      lastErrorCode: 'gate_push_opted_out',
    });
  });

  it('is blocked at send time when the last device was removed after it was queued', async () => {
    await setFlag(true);
    const user = await person();
    await run();
    await test.db
      .update(tables.devices)
      .set({ revokedAt: new Date('2026-11-02T01:00:00Z') })
      .where(eq(tables.devices.userId, user.id));
    await h.run();
    expect(h.push.sent).toHaveLength(0);
    expect((await h.rowByKey(ayahDailyKey(DATE, user.id)))?.lastErrorCode).toBe(
      'gate_no_working_push',
    );
  });
});
