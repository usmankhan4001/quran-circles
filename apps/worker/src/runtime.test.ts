import { PgBoss, fromPglite } from 'pg-boss';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { tables } from './db';
import {
  RECONCILE_QUEUE,
  SEND_QUEUE,
  TOP_UP_CRON,
  TOP_UP_QUEUE,
  TOP_UP_TIMEZONE,
  startRuntime,
  type Runtime,
} from './runtime';
import { createTestDb, type TestDb } from './test/db';
import { createHarness, pushDraft, type Harness } from './test/harness';
import { seedDevice, seedOccurrence, seedRegistration, seedUser, seedWorld } from './test/seed';

/** Real pg-boss on in-process Postgres: the queue, retries, schedule and shutdown, no network. */

let test: TestDb;
let h: Harness;
let boss: PgBoss;
let runtime: Runtime | undefined;

beforeAll(async () => {
  test = await createTestDb();
}, 120_000);

afterAll(async () => {
  await test.pg.close();
});

beforeEach(async () => {
  await test.reset();
  h = createHarness(test.db);
  // A fresh pg-boss per test over the same in-process database; `runtime.stop` stops it.
  boss = new PgBoss({ db: fromPglite(test.pg), backend: 'pglite', schedule: true });
  boss.on('error', () => {});
  await boss.start();
});

afterEach(async () => {
  await runtime?.stop({ timeoutMs: 5_000 });
  runtime = undefined;
});

const start = async (
  over: Parameters<typeof startRuntime>[0] extends infer O ? Partial<O> : never = {},
) =>
  (runtime = await startRuntime({
    db: test.db,
    boss,
    processor: h.deps,
    logger: h.logger,
    now: h.clock.now,
    retry: h.deps.retry!,
    dispatchIntervalMs: 0,
    workPollingSeconds: 0.5,
    ...over,
  }));

async function until<T>(read: () => Promise<T>, done: (v: T) => boolean, ms = 20_000): Promise<T> {
  const deadline = Date.now() + ms;
  for (;;) {
    const value = await read();
    if (done(value)) return value;
    if (Date.now() > deadline) throw new Error('timed out waiting for the queue');
    await new Promise((r) => setTimeout(r, 200));
  }
}

describe('pg-boss runtime', () => {
  it('sends a due row through the queue, once', async () => {
    const rt = await start();
    const user = await seedUser(test.db);
    await seedDevice(test.db, user.id);
    const row = await h.queue_(pushDraft('boss-1', user.id, h.clock.now()));

    expect(await rt.dispatchNow()).toMatchObject({ claimed: 1 });
    const sent = await until(
      () => h.row(row.id),
      (r) => r.status === 'sent',
    );
    expect(sent.attempts).toBe(1);
    expect(h.push.sent).toHaveLength(1);

    // Nothing is left to claim and a second pass sends nothing more.
    expect(await rt.dispatchNow()).toMatchObject({ claimed: 0 });
    expect(h.push.sent).toHaveLength(1);
  });

  it('sends once even when the same job is on the queue twice', async () => {
    const rt = await start();
    const user = await seedUser(test.db);
    await seedDevice(test.db, user.id);
    const row = await h.queue_(pushDraft('boss-dup', user.id, h.clock.now()));
    await rt.dispatchNow();
    await boss.send(SEND_QUEUE, { outboxId: row.id, attempt: 1 });
    await boss.send(SEND_QUEUE, { outboxId: row.id, attempt: 1 });
    await until(
      () => h.row(row.id),
      (r) => r.status === 'sent',
    );
    await new Promise((r) => setTimeout(r, 2_000));
    expect(h.push.sent).toHaveLength(1);
  });

  it('ignores a job for a row that no longer exists or has already been handled', async () => {
    await start();
    await boss.send(SEND_QUEUE, { outboxId: '00000000-0000-4000-8000-000000000998', attempt: 1 });
    await new Promise((r) => setTimeout(r, 2_000));
    expect(h.push.sent).toHaveLength(0);
    expect(h.logger.dump()).not.toContain('outbox.job_failed');
  });

  it('retries a failed send with the row backoff, then sends it', async () => {
    const rt = await start();
    const user = await seedUser(test.db);
    await seedDevice(test.db, user.id);
    const row = await h.queue_(pushDraft('boss-retry', user.id, h.clock.now()));
    h.push.failNext({ status: 'transient_failure', code: 'fcm_unavailable' });

    await rt.dispatchNow();
    const waiting = await until(
      () => h.row(row.id),
      (r) => r.status === 'queued' && r.attempts === 1,
    );
    expect(waiting.lastErrorCode).toBe('fcm_unavailable');
    expect(waiting.nextAttemptAt.getTime()).toBeGreaterThan(h.clock.now().getTime());

    h.clock.advance(61_000);
    await rt.dispatchNow();
    const done = await until(
      () => h.row(row.id),
      (r) => r.status === 'sent',
    );
    expect(done.attempts).toBe(2);
    expect(h.push.sent).toHaveLength(2); // the failed call and the good one
  });

  it('recovers a row left in sending by a crashed worker', async () => {
    const rt = await start();
    const user = await seedUser(test.db);
    await seedDevice(test.db, user.id);
    const row = await h.queue_(pushDraft('boss-crash', user.id, h.clock.now()));
    await test.db
      .update(tables.messageOutbox)
      .set({
        status: 'sending',
        attempts: 1,
        nextAttemptAt: new Date(h.clock.now().getTime() - 60_000),
      })
      .where(eq(tables.messageOutbox.id, row.id));
    expect(await rt.dispatchNow()).toMatchObject({ reclaimed: 1, claimed: 1 });
    await until(
      () => h.row(row.id),
      (r) => r.status === 'sent',
    );
  });

  it('reconciles reminders on demand and registers the every-minute schedule', async () => {
    const rt = await start();
    const world = await seedWorld(test.db);
    const startsAt = new Date(h.clock.now().getTime() + 5 * 3_600_000);
    await seedOccurrence(test.db, world.session.id, startsAt);
    const user = await seedUser(test.db);
    await seedDevice(test.db, user.id);
    await seedRegistration(test.db, {
      userId: user.id,
      sessionId: world.session.id,
      areaId: world.area.id,
    });

    expect(await rt.reconcileNow()).toMatchObject({ inserted: 1 });
    expect(await rt.reconcileNow()).toMatchObject({ inserted: 0, unchanged: 1 });

    const schedules = await boss.getSchedules();
    expect(schedules.some((s) => s.name === RECONCILE_QUEUE && s.cron === '* * * * *')).toBe(true);
  });

  it('logs a reconcile that reached the queue once, not twice', async () => {
    await start({ scheduleReminders: false });
    const world = await seedWorld(test.db);
    await seedOccurrence(
      test.db,
      world.session.id,
      new Date(h.clock.now().getTime() + 5 * 3_600_000),
    );
    const user = await seedUser(test.db);
    await seedDevice(test.db, user.id);
    await seedRegistration(test.db, {
      userId: user.id,
      sessionId: world.session.id,
      areaId: world.area.id,
    });
    const reminders = async () =>
      (await test.db.select().from(tables.messageOutbox)).filter(
        (r) => r.templateKey === 'session_reminder',
      );

    await boss.send(RECONCILE_QUEUE, {});
    await until(reminders, (rows) => rows.length === 1);
    // Let the job finish (it logs before it returns), then make sure nothing else arrives.
    await new Promise((r) => setTimeout(r, 500));
    const lines = h.logger.lines.filter((l) => l.event === 'reminders.reconciled');
    expect(lines).toHaveLength(1);
    expect(lines[0]!.fields).toMatchObject({ inserted: 1 });
  });

  it('registers the daily occurrence top-up in Pakistan time, once however often it starts', async () => {
    await start();
    await runtime!.stop({ timeoutMs: 5_000 });
    // A restart (or a second node) registers the same schedule again rather than adding one.
    boss = new PgBoss({ db: fromPglite(test.pg), backend: 'pglite', schedule: true });
    boss.on('error', () => {});
    await boss.start();
    await start();
    const schedules = (await boss.getSchedules()).filter((s) => s.name === TOP_UP_QUEUE);
    expect(schedules).toHaveLength(1);
    expect(schedules[0]).toMatchObject({
      cron: TOP_UP_CRON,
      timezone: TOP_UP_TIMEZONE,
      key: 'daily',
    });
    expect(TOP_UP_CRON).toBe('30 0 * * *');
  });

  it('does not register the top-up schedule when told not to', async () => {
    // pg-boss keeps schedules in its own schema, which outlives the per-test table reset.
    await boss.unschedule(TOP_UP_QUEUE, 'daily');
    await start({ scheduleTopUp: false });
    expect((await boss.getSchedules()).some((s) => s.name === TOP_UP_QUEUE)).toBe(false);
  });

  it('tops up occurrences on demand with the configured horizon, adding nothing on a second run', async () => {
    const rt = await start({ occurrenceHorizonDays: 28 });
    const world = await seedWorld(test.db);
    expect(await rt.topUpNow()).toEqual({ sessions: 1, occurrencesAdded: 4 });
    expect(await rt.topUpNow()).toEqual({ sessions: 1, occurrencesAdded: 0 });
    const rows = await test.db
      .select()
      .from(tables.occurrences)
      .where(eq(tables.occurrences.sessionId, world.session.id));
    expect(rows).toHaveLength(4);
  });

  it('runs the top-up when a job reaches its queue, with the 90 day default, and twice is safe', async () => {
    await start();
    const world = await seedWorld(test.db);
    const count = async () =>
      (
        await test.db
          .select()
          .from(tables.occurrences)
          .where(eq(tables.occurrences.sessionId, world.session.id))
      ).length;
    await boss.send(TOP_UP_QUEUE, {});
    expect(await until(count, (n) => n > 0)).toBe(13);
    const done = () =>
      Promise.resolve(h.logger.lines.filter((l) => l.event === 'occurrences.topped_up'));
    await until(done, (lines) => lines.length === 1);

    await boss.send(TOP_UP_QUEUE, {});
    const lines = await until(done, (l) => l.length === 2);
    expect(lines[1]!.fields).toEqual({ sessions: 1, occurrencesAdded: 0, horizonDays: 90 });
    expect(await count()).toBe(13);
  });

  it('stops cleanly: no further polling after stop', async () => {
    const rt = await start({ dispatchIntervalMs: 50 });
    await new Promise((r) => setTimeout(r, 200));
    await rt.stop({ timeoutMs: 5_000 });
    runtime = undefined;
    const user = await seedUser(test.db);
    await seedDevice(test.db, user.id);
    const row = await h.queue_(pushDraft('boss-stopped', user.id, h.clock.now()));
    await new Promise((r) => setTimeout(r, 300));
    expect((await h.row(row.id)).status).toBe('queued');
  });
});
