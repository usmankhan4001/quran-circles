import { PgBoss, fromPglite } from 'pg-boss';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { tables } from './db';
import { RECONCILE_QUEUE, SEND_QUEUE, startRuntime, type Runtime } from './runtime';
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
