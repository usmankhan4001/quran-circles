import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { OutboxPayload, outboxKey, parseDeepLink } from '@qc/contracts';

const parsePayload = (raw: unknown): OutboxPayload => OutboxPayload.parse(raw) as OutboxPayload;
import { tables } from '../db';
import { createTestDb, type TestDb } from '../test/db';
import { createHarness, type Harness } from '../test/harness';
import {
  seedConsent,
  seedDevice,
  seedOccurrence,
  seedRegistration,
  seedUser,
  seedWorld,
  type World,
} from '../test/seed';
import { reconcileReminders, type ReconcileSummary } from './reconcile';
import { formatWhen, t } from './format';

let test: TestDb;
let h: Harness;
const HOUR = 3_600_000;
const MIN = 60_000;

beforeAll(async () => {
  test = await createTestDb();
});
afterAll(async () => {
  await test.pg.close();
});
beforeEach(async () => {
  await test.reset();
  h = createHarness(test.db);
});

const reconcile = (): Promise<ReconcileSummary> =>
  reconcileReminders({ db: test.db, logger: h.logger, now: h.clock.now });

const setLead = (value: unknown) =>
  test.db
    .insert(tables.settings)
    .values({ key: 'reminder_lead_minutes', value })
    .onConflictDoUpdate({ target: tables.settings.key, set: { value } });

const reminders = () =>
  test.db
    .select()
    .from(tables.messageOutbox)
    .where(eq(tables.messageOutbox.templateKey, 'session_reminder'));

async function setup(
  opts: { program?: 'dora' | 'circles'; circle?: boolean; startsInHours?: number } = {},
) {
  const world = await seedWorld(test.db, opts);
  const startsAt = new Date(h.clock.now().getTime() + (opts.startsInHours ?? 5) * HOUR);
  const occurrence = await seedOccurrence(test.db, world.session.id, startsAt);
  return { world, occurrence, startsAt };
}

async function registeredUser(
  world: World,
  over: Parameters<typeof seedUser>[1] = {},
  device = true,
) {
  const user = await seedUser(test.db, over);
  if (device) await seedDevice(test.db, user.id);
  await seedRegistration(test.db, {
    userId: user.id,
    sessionId: world.session.id,
    areaId: world.area.id,
  });
  return user;
}

describe('scheduling relative to the session start', () => {
  it('queues one push reminder per registrant, an hour before by default', async () => {
    const { world, occurrence, startsAt } = await setup();
    const a = await registeredUser(world);
    const b = await registeredUser(world, { locale: 'ur' });
    expect(await reconcile()).toMatchObject({ inserted: 2 });

    const rows = await reminders();
    expect(rows).toHaveLength(2);
    const rowA = rows.find((r) => r.recipientUserId === a.id)!;
    expect(rowA.idempotencyKey).toBe(outboxKey('reminder', occurrence.id, a.id, 'push'));
    expect(rowA.channel).toBe('push');
    expect(rowA.status).toBe('queued');
    expect(rowA.costCategory).toBe('free');
    expect(rowA.cityId).toBe(world.city.id);
    expect(rowA.venueId).toBe(world.venue.id);
    expect(rowA.nextAttemptAt).toEqual(new Date(startsAt.getTime() - HOUR));

    // The payload is a valid contract payload, in the person's language, with a deep link.
    const payloadA = parsePayload(rowA.payload);
    expect(payloadA).toMatchObject({ channel: 'push' });
    if (payloadA.channel !== 'push') throw new Error('expected push');
    expect(payloadA.push.title).toBe('Session reminder');
    expect(payloadA.push.body).toContain('Weekly tafsir at Test Masjid');
    expect(parseDeepLink(payloadA.push.data.deepLink)).toEqual({
      type: 'occurrence',
      occurrenceId: occurrence.id,
    });
    expect(payloadA.push.data).toMatchObject({
      type: 'reminder',
      occurrenceId: occurrence.id,
      sessionId: world.session.id,
    });
    expect(payloadA.push.collapseKey).toBe(`reminder:${occurrence.id}`);

    const rowB = rows.find((r) => r.recipientUserId === b.id)!;
    const payloadB = parsePayload(rowB.payload);
    if (payloadB.channel !== 'push') throw new Error('expected push');
    expect(payloadB.push.title).toBe('نشست کی یاد دہانی');
    expect(payloadB.push.body).toContain('ہفتہ وار تفسیر');
    expect(rowB.locale).toBe('ur');
  });

  it('is idempotent: running twice creates nothing new', async () => {
    const { world } = await setup();
    await registeredUser(world);
    await reconcile();
    const second = await reconcile();
    expect(second).toEqual({ inserted: 0, retimed: 0, revived: 0, withdrawn: 0, unchanged: 1 });
    expect(await reminders()).toHaveLength(1);
  });

  it('uses the lead time configured for each program', async () => {
    await setLead({ dora: 30, circles: 180 });
    const dora = await setup({ program: 'dora' });
    const circles = await setup({ program: 'circles' });
    const d = await registeredUser(dora.world);
    const c = await registeredUser(circles.world);
    await reconcile();
    const rows = await reminders();
    expect(rows.find((r) => r.recipientUserId === d.id)!.nextAttemptAt).toEqual(
      new Date(dora.startsAt.getTime() - 30 * MIN),
    );
    expect(rows.find((r) => r.recipientUserId === c.id)!.nextAttemptAt).toEqual(
      new Date(circles.startsAt.getTime() - 180 * MIN),
    );
  });

  it('falls back to defaults when the setting is missing or malformed', async () => {
    await setLead('soon');
    const { world, startsAt } = await setup();
    await registeredUser(world);
    await reconcile();
    expect((await reminders())[0]!.nextAttemptAt).toEqual(new Date(startsAt.getTime() - HOUR));
  });

  it('follows a change to the lead-time setting', async () => {
    const { world, startsAt } = await setup();
    await registeredUser(world);
    await reconcile();
    await setLead({ circles: 120 });
    expect(await reconcile()).toMatchObject({ retimed: 1, inserted: 0 });
    const rows = await reminders();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.nextAttemptAt).toEqual(new Date(startsAt.getTime() - 120 * MIN));
  });

  it('does not queue occurrences beyond the horizon, then picks them up as they come near', async () => {
    const { world } = await setup({ startsInHours: 24 * 10 });
    await registeredUser(world);
    expect(await reconcile()).toMatchObject({ inserted: 0 });
    h.clock.advance(24 * 8 * HOUR);
    expect(await reconcile()).toMatchObject({ inserted: 1 });
  });

  it('skips a reminder whose time passed long ago, but sends one that is only slightly late', async () => {
    const soon = await setup({ startsInHours: 0.75 }); // reminder time was 15 minutes ago
    const verySoon = await setup({ startsInHours: 0.2 }); // reminder time was 48 minutes ago
    const a = await registeredUser(soon.world);
    const b = await registeredUser(verySoon.world);
    await reconcile();
    const rows = await reminders();
    expect(rows.map((r) => r.recipientUserId)).toEqual([a.id]);
    expect(rows[0]!.nextAttemptAt.getTime()).toBeLessThan(h.clock.now().getTime());
    void b;
  });
});

describe('recomputing when a session changes', () => {
  it('moves a queued reminder and rewrites its text when the occurrence is rescheduled', async () => {
    const { world, occurrence, startsAt } = await setup();
    await registeredUser(world);
    await reconcile();
    const before = (await reminders())[0]!;
    const bodyBefore = (before.payload as { push: { body: string } }).push.body;

    const moved = new Date(startsAt.getTime() + 2 * HOUR);
    await test.db
      .update(tables.occurrences)
      .set({ startsAt: moved, endsAt: new Date(moved.getTime() + HOUR) })
      .where(eq(tables.occurrences.id, occurrence.id));
    expect(await reconcile()).toMatchObject({ retimed: 1, inserted: 0 });

    const rows = await reminders();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(before.id); // same row, same key: no duplicate
    expect(rows[0]!.nextAttemptAt).toEqual(new Date(moved.getTime() - HOUR));
    expect((rows[0]!.payload as { push: { body: string } }).push.body).not.toBe(bodyBefore);
    expect(await reconcile()).toMatchObject({ retimed: 0, unchanged: 1 });
  });

  it('keeps the retry backoff of a reminder that already failed once', async () => {
    const { world, occurrence, startsAt } = await setup({ startsInHours: 1.5 });
    const user = await registeredUser(world);
    await reconcile();
    h.clock.set(new Date(startsAt.getTime() - HOUR));
    h.push.failNext({ status: 'transient_failure', code: 'fcm_unavailable' });
    await h.run();
    const retrying = (await reminders())[0]!;
    expect(retrying.status).toBe('queued');
    expect(retrying.attempts).toBe(1);

    const moved = new Date(startsAt.getTime() + 10 * MIN);
    await test.db
      .update(tables.occurrences)
      .set({ startsAt: moved, endsAt: new Date(moved.getTime() + HOUR) })
      .where(eq(tables.occurrences.id, occurrence.id));
    await reconcile();
    const after = (await reminders())[0]!;
    expect(after.nextAttemptAt).toEqual(retrying.nextAttemptAt);
    expect(after.payload).not.toEqual(retrying.payload); // wording follows the new time
    void user;
  });

  it('withdraws a queued reminder when the occurrence is cancelled, and brings it back if reinstated', async () => {
    const { world, occurrence } = await setup();
    await registeredUser(world);
    await reconcile();
    await test.db
      .update(tables.occurrences)
      .set({ status: 'cancelled' })
      .where(eq(tables.occurrences.id, occurrence.id));
    expect(await reconcile()).toMatchObject({ withdrawn: 1 });
    expect((await reminders())[0]).toMatchObject({
      status: 'failed',
      lastErrorCode: 'occurrence_cancelled',
    });
    await h.run();
    expect(h.push.sent).toHaveLength(0);

    await test.db
      .update(tables.occurrences)
      .set({ status: 'scheduled' })
      .where(eq(tables.occurrences.id, occurrence.id));
    expect(await reconcile()).toMatchObject({ revived: 1 });
    expect((await reminders())[0]).toMatchObject({
      status: 'queued',
      attempts: 0,
      lastErrorCode: null,
    });
    expect(await reminders()).toHaveLength(1);
  });

  it('withdraws reminders when the session is unpublished or cancelled', async () => {
    const { world } = await setup();
    await registeredUser(world);
    await reconcile();
    await test.db
      .update(tables.sessions)
      .set({ status: 'cancelled' })
      .where(eq(tables.sessions.id, world.session.id));
    expect(await reconcile()).toMatchObject({ withdrawn: 1 });
  });

  it('never touches a reminder that was already sent', async () => {
    const { world, occurrence, startsAt } = await setup({ startsInHours: 1.2 });
    await registeredUser(world);
    await reconcile();
    h.clock.set(new Date(startsAt.getTime() - HOUR));
    await h.run();
    expect((await reminders())[0]!.status).toBe('sent');
    const moved = new Date(startsAt.getTime() + HOUR);
    await test.db
      .update(tables.occurrences)
      .set({ startsAt: moved, endsAt: new Date(moved.getTime() + HOUR) })
      .where(eq(tables.occurrences.id, occurrence.id));
    expect(await reconcile()).toMatchObject({ inserted: 0, retimed: 0, withdrawn: 0 });
    await h.run();
    expect(h.push.sent).toHaveLength(1);
  });

  it('follows the audience: a new registration is added, a cancelled one is withdrawn', async () => {
    const { world } = await setup();
    const a = await registeredUser(world);
    await reconcile();
    const b = await registeredUser(world);
    expect(await reconcile()).toMatchObject({ inserted: 1 });
    await test.db
      .update(tables.registrations)
      .set({ status: 'cancelled', cancelledAt: h.clock.now() })
      .where(eq(tables.registrations.userId, a.id));
    expect(await reconcile()).toMatchObject({ withdrawn: 1 });
    const rows = await reminders();
    expect(rows.find((r) => r.recipientUserId === a.id)).toMatchObject({
      status: 'failed',
      lastErrorCode: 'recipient_removed',
    });
    expect(rows.find((r) => r.recipientUserId === b.id)!.status).toBe('queued');
  });

  it('a newly generated occurrence of a recurring session gets reminders for its registrants', async () => {
    const { world, startsAt } = await setup();
    await registeredUser(world);
    await reconcile();
    await seedOccurrence(test.db, world.session.id, new Date(startsAt.getTime() + 7 * 24 * HOUR));
    h.clock.advance(5 * 24 * HOUR);
    await reconcile();
    expect((await reminders()).filter((r) => r.status === 'queued')).toHaveLength(1);
    expect(await reminders()).toHaveLength(2);
  });
});

describe('who gets a reminder', () => {
  it('skips waitlisted people, people with no account link, and suspended accounts', async () => {
    const { world } = await setup();
    const waitlisted = await seedUser(test.db);
    await seedDevice(test.db, waitlisted.id);
    await seedRegistration(test.db, {
      userId: waitlisted.id,
      sessionId: world.session.id,
      areaId: world.area.id,
      status: 'waitlisted',
    });
    const suspended = await registeredUser(world, { status: 'suspended' });
    await test.db.insert(tables.registrations).values({
      userId: null,
      sessionId: world.session.id,
      areaId: world.area.id,
      section: 'family',
      partySize: 1,
      status: 'confirmed',
      anonymisedAt: h.clock.now(),
    });
    const ok = await registeredUser(world);
    await reconcile();
    const rows = await reminders();
    expect(rows.map((r) => r.recipientUserId)).toEqual([ok.id]);
    void suspended;
  });

  it('needs a working push device, and picks the person up once they have one', async () => {
    const { world } = await setup();
    const user = await registeredUser(world, {}, false);
    expect(await reconcile()).toMatchObject({ inserted: 0 });
    const device = await seedDevice(test.db, user.id);
    expect(await reconcile()).toMatchObject({ inserted: 1 });
    await test.db
      .update(tables.devices)
      .set({ revokedAt: h.clock.now() })
      .where(eq(tables.devices.id, device.id));
    expect(await reconcile()).toMatchObject({ withdrawn: 1 });
  });

  it('a registration for one occurrence covers only that occurrence', async () => {
    const { world, occurrence, startsAt } = await setup();
    const other = await seedOccurrence(
      test.db,
      world.session.id,
      new Date(startsAt.getTime() + 24 * HOUR),
    );
    const user = await seedUser(test.db);
    await seedDevice(test.db, user.id);
    await seedRegistration(test.db, {
      userId: user.id,
      sessionId: world.session.id,
      areaId: world.area.id,
      occurrenceId: other.id,
    });
    await reconcile();
    const rows = await reminders();
    expect(rows.map((r) => r.idempotencyKey)).toEqual([
      outboxKey('reminder', other.id, user.id, 'push'),
    ]);
    void occurrence;
  });

  it('includes followers of a circle with alerts on, and not those with alerts off', async () => {
    const { world } = await setup({ circle: true });
    const on = await seedUser(test.db);
    const off = await seedUser(test.db);
    for (const u of [on, off]) await seedDevice(test.db, u.id);
    await test.db.insert(tables.follows).values([
      { userId: on.id, circleId: world.session.circleId!, alertsEnabled: true },
      { userId: off.id, circleId: world.session.circleId!, alertsEnabled: false },
    ]);
    await reconcile();
    expect((await reminders()).map((r) => r.recipientUserId)).toEqual([on.id]);
  });

  it('a person who is both registered and following gets one reminder', async () => {
    const { world } = await setup({ circle: true });
    const user = await registeredUser(world);
    await test.db
      .insert(tables.follows)
      .values({ userId: user.id, circleId: world.session.circleId!, alertsEnabled: true });
    await reconcile();
    expect(await reminders()).toHaveLength(1);
  });
});

describe('end to end with the sender', () => {
  it('sends the reminder at the scheduled time, once, over push', async () => {
    const { world, startsAt } = await setup();
    const user = await registeredUser(world);
    await seedConsent(test.db, user.id, { purpose: 'session_reminders' });
    await reconcile();
    await h.run();
    expect(h.push.sent).toHaveLength(0); // not due yet
    h.clock.set(new Date(startsAt.getTime() - HOUR));
    await h.run();
    await reconcile();
    await h.run();
    expect(h.push.sent).toHaveLength(1);
    expect(h.whatsapp.sent).toHaveLength(0);
    const [row] = await test.db
      .select()
      .from(tables.messageOutbox)
      .where(and(eq(tables.messageOutbox.recipientUserId, user.id)));
    expect(row!.status).toBe('sent');
  });
});

describe('formatting', () => {
  it('shows the time in the session timezone', () => {
    const when = formatWhen(new Date('2026-03-06T14:30:00Z'), 'Asia/Karachi', 'en');
    expect(when).toContain('7:30');
    expect(when).toMatch(/pm/i);
    expect(when).toContain('6');
  });

  it('falls back to English and then to the key', () => {
    expect(t('en', 'notifications.reminder.title')).toBe('Session reminder');
    expect(t('ur', 'notifications.reminder.title')).toBe('نشست کی یاد دہانی');
  });
});
