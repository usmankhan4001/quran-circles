import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PushProvider } from '@qc/messaging';
import { tables } from '../db';
import { createTestDb, type TestDb } from '../test/db';
import { createHarness, pushDraft, whatsappDraft, type Harness } from '../test/harness';
import { seedDevice, seedUser } from '../test/seed';
import { createDispatcher, type Dispatcher, type SendLane } from './dispatcher';
import { processClaimedRow, processJob, processJobs } from './processor';
import { reclaimStale, takeForSending } from './repo';

/**
 * The load-test livelock (quality, WP12): a push burst bigger than the senders could finish within
 * one lease had its leases run out on the queue, was reclaimed, and then the queue spent its slots
 * on stale jobs. These tests pin the fix: claims are capped per lane, stale jobs cost no send, a
 * sender renews the lease when it starts, and nothing is ever sent twice.
 */

const LEASE = 5 * 60_000;

let test: TestDb;
let h: Harness;

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

const dispatcher = (
  maxInFlight: Partial<Record<SendLane, number>>,
  over: { batchSize?: number } = {},
): Dispatcher =>
  createDispatcher({
    db: test.db,
    queue: h.queue,
    logger: h.logger,
    now: h.clock.now,
    retry: h.deps.retry!,
    leaseMs: LEASE,
    maxInFlight,
    ...over,
  });

/** `count` push rows due now, for people with one device each, inserted in bulk. */
async function burst(count: number): Promise<void> {
  const users = await test.db
    .insert(tables.users)
    .values(
      Array.from({ length: count }, (_, i) => ({
        phoneE164: `+92314${String(i).padStart(7, '0')}`,
        phoneVerifiedAt: new Date('2026-01-01T00:00:00Z'),
        displayName: 'Burst Person',
      })),
    )
    .returning({ id: tables.users.id });
  await test.db.insert(tables.devices).values(
    users.map((u, i) => ({
      userId: u.id,
      platform: 'android' as const,
      provider: 'fcm' as const,
      token: `fake-burst-token-${i}`,
      locale: 'en' as const,
    })),
  );
  await test.db
    .insert(tables.messageOutbox)
    .values(users.map((u, i) => pushDraft(`burst:${i}`, u.id, h.clock.now())));
}

const statusCounts = async (): Promise<Record<string, number>> => {
  const rows = await test.db
    .select({ status: tables.messageOutbox.status, n: sql<number>`count(*)::int` })
    .from(tables.messageOutbox)
    .groupBy(tables.messageOutbox.status);
  return Object.fromEntries(rows.map((r) => [r.status, r.n]));
};

const workerLost = () => h.logger.lines.filter((l) => l.event === 'outbox.worker_lost');

/**
 * Drives a burst with a sender that finishes `perStep` jobs per step while the clock moves
 * `stepMs`: a sender much slower than the backlog. Returns how many steps it took.
 */
async function drain(d: Dispatcher, perStep: number, stepMs: number): Promise<number> {
  for (let step = 1; step <= 500; step++) {
    await d.tick();
    if (h.queue.jobs.length === 0) {
      const left = await statusCounts();
      if (!left.queued && !left.sending) return step;
    }
    const result = await processJobs(h.deps, h.queue.jobs.splice(0, perStep), { parallel: 5 });
    expect(result.failure).toBeUndefined();
    h.clock.advance(stepMs);
  }
  throw new Error('the burst never drained');
}

describe('the in-flight limit', () => {
  it('claims no more than the lane limit; the rest wait queued with no attempt spent', async () => {
    await burst(30);
    const d = dispatcher({ push: 10 }, { batchSize: 4 });
    expect(await d.tick()).toEqual({ claimed: 10, reclaimed: 0, dead: 0, saturated: true });
    expect(await statusCounts()).toEqual({ sending: 10, queued: 20 });
    const waiting = await test.db
      .select({ attempts: tables.messageOutbox.attempts })
      .from(tables.messageOutbox)
      .where(eq(tables.messageOutbox.status, 'queued'));
    expect(waiting.every((r) => r.attempts === 0)).toBe(true);

    // Still full: nothing more is claimed until the senders finish some.
    expect(await d.tick()).toMatchObject({ claimed: 0, saturated: true });
    await processJobs(h.deps, h.queue.jobs.splice(0, 6), { parallel: 3 });
    expect(await d.tick()).toMatchObject({ claimed: 6, saturated: true });
    expect(h.queue.lanes.every((lane) => lane === 'push')).toBe(true);
  });

  it('is not saturated when everything due fits', async () => {
    await burst(3);
    expect(await dispatcher({}).tick()).toEqual({
      claimed: 3,
      reclaimed: 0,
      dead: 0,
      saturated: false,
    });
  });

  it('keeps WhatsApp on its own lane, so a full push lane never holds it up', async () => {
    await burst(5);
    const user = await seedUser(test.db);
    await h.queue_(
      whatsappDraft('wa:1', 'session_changed', user.id, h.clock.now(), '+923001234567'),
    );
    const result = await dispatcher({ push: 2, message: 10 }).tick();
    expect(result).toMatchObject({ claimed: 3, saturated: true });
    expect(h.queue.lanes).toEqual(['message', 'push']);
    const [waJob] = h.queue.jobs;
    expect((await h.row(waJob!.outboxId)).channel).toBe('whatsapp');
  });

  it('caps WhatsApp and SMS on their own limit too', async () => {
    const user = await seedUser(test.db);
    for (let i = 0; i < 4; i++) {
      await h.queue_(whatsappDraft(`wa:cap:${i}`, 'session_changed', user.id, h.clock.now()));
    }
    expect(await dispatcher({ message: 3 }).tick()).toMatchObject({ claimed: 3, saturated: true });
  });
});

describe('a burst bigger than one lease of sending', () => {
  it('drains with a slow sender: every row sent once, no lease runs out', async () => {
    await burst(600);
    // 30 sends per 20 s step (1.5 a second): 600 rows take 400 s, longer than the 5 minute lease.
    await drain(dispatcher({ push: 200 }), 30, 20_000);
    expect(await statusCounts()).toEqual({ sent: 600 });
    expect(h.push.sent).toHaveLength(600);
    expect(new Set(h.push.sent.map((s) => s.target.token)).size).toBe(600);
    expect(workerLost()).toEqual([]);
    const attempts = await test.db
      .selectDistinct({ attempts: tables.messageOutbox.attempts })
      .from(tables.messageOutbox);
    expect(attempts).toEqual([{ attempts: 1 }]);
  });

  it('without the limit the same burst loses leases (the old livelock), and still sends nothing twice', async () => {
    await burst(600);
    await drain(dispatcher({ push: 100_000 }), 30, 20_000);
    expect(await statusCounts()).toEqual({ sent: 600 });
    // Leases ran out on the queue: logged as an error, and the stale jobs were dropped unsent.
    expect(workerLost().length).toBeGreaterThan(0);
    expect(workerLost()[0]?.level).toBe('error');
    expect(h.push.sent).toHaveLength(600);
    expect(new Set(h.push.sent.map((s) => s.target.token)).size).toBe(600);
  });
});

describe('taking a batch for sending', () => {
  it('drops stale and duplicate jobs in one statement, with no send', async () => {
    await burst(3);
    await dispatcher({}).tick();
    const [j1, j2, j3] = h.queue.jobs;
    expect(await processJob(h.deps, j1!)).toEqual({ outcome: 'sent' });

    const result = await processJobs(
      h.deps,
      [
        j1!, // already sent
        j2!,
        j2!, // the same job twice in one batch
        { outboxId: '00000000-0000-4000-8000-000000000999', attempt: 1 }, // no such row
        { ...j3!, attempt: 0 }, // an older attempt
      ],
      { parallel: 4 },
    );
    expect(result.outcomes).toEqual({ sent: 1, requeued: 0, failed: 0, dead: 0 });
    expect(result.skipped).toBe(4);
    expect(h.push.sent).toHaveLength(2);
    expect((await h.row(j3!.outboxId)).status).toBe('sending');
  });

  it('sends a claim once when its job reaches two senders at the same time', async () => {
    await burst(1);
    await dispatcher({}).tick();
    const [job] = h.queue.jobs;
    const results = await Promise.all([
      processJobs(h.deps, [job!], { parallel: 2 }),
      processJobs(h.deps, [job!], { parallel: 2 }),
      processJob(h.deps, job!),
    ]);
    expect(h.push.sent).toHaveLength(1);
    expect(results[0].outcomes.sent + results[1].outcomes.sent).toBeLessThanOrEqual(1);
    expect((await h.row(job!.outboxId)).status).toBe('sent');
  });

  it('renews the lease when sending starts, so a row being sent is not reclaimed', async () => {
    await burst(1);
    await dispatcher({}).tick();
    const [job] = h.queue.jobs;
    expect(job!.lease).toBe(new Date(h.clock.now().getTime() + LEASE).toISOString());

    h.clock.advance(4 * 60_000);
    const [taken] = await takeForSending(test.db, [job!], {
      leaseUntil: new Date(h.clock.now().getTime() + LEASE),
    });
    expect(taken?.nextAttemptAt.toISOString()).toBe(
      new Date(h.clock.now().getTime() + LEASE).toISOString(),
    );
    // Past the claim's lease, but not the sender's: not reclaimed.
    h.clock.advance(2 * 60_000);
    expect(await reclaimStale(test.db, { now: h.clock.now(), maxAttempts: 3 })).toEqual({
      requeued: 0,
      dead: 0,
    });
    // The same job again no longer matches.
    expect(await takeForSending(test.db, [job!], { leaseUntil: h.clock.now() })).toEqual([]);
    expect(await processClaimedRow(h.deps, taken!)).toEqual({ outcome: 'sent' });
    expect(h.push.sent).toHaveLength(1);
  });

  it('takes a row with a frozen clock only once (the renewed lease always moves)', async () => {
    await burst(1);
    await dispatcher({}).tick();
    const [job] = h.queue.jobs;
    // The same instant as the claim: the renewed lease would equal the claim's without the bump.
    const until = new Date(job!.lease!);
    expect(await takeForSending(test.db, [job!], { leaseUntil: until })).toHaveLength(1);
    expect(await takeForSending(test.db, [job!], { leaseUntil: until })).toEqual([]);
  });

  it('still sends a job queued before leases were carried, once', async () => {
    await burst(1);
    await dispatcher({}).tick();
    const [job] = h.queue.jobs;
    const legacy = { outboxId: job!.outboxId, attempt: job!.attempt };
    expect((await processJobs(h.deps, [legacy])).outcomes.sent).toBe(1);
    expect((await processJobs(h.deps, [legacy])).skipped).toBe(1);
    expect(h.push.sent).toHaveLength(1);
  });

  it('sends a reclaimed row once, by its new job, and logs the lost lease as an error', async () => {
    await burst(1);
    const d = dispatcher({});
    await d.tick();
    const [oldJob] = h.queue.jobs.splice(0);
    h.clock.advance(LEASE + 1_000);
    expect(await d.tick()).toMatchObject({ claimed: 1, reclaimed: 1 });
    const [newJob] = h.queue.jobs.splice(0);
    expect(newJob!.attempt).toBe(2);
    expect(workerLost()).toHaveLength(1);
    expect(workerLost()[0]).toMatchObject({ level: 'error', fields: { requeued: 1, dead: 0 } });

    const result = await processJobs(h.deps, [oldJob!, newJob!], { parallel: 2 });
    expect(result).toMatchObject({ skipped: 1, outcomes: { sent: 1 } });
    expect(h.push.sent).toHaveLength(1);
  });

  it('an exception on one row fails the batch after the others are sent; the row is recovered later', async () => {
    const user = await seedUser(test.db);
    await seedDevice(test.db, user.id, { token: 'fake-token-that-throws' });
    await h.queue_(pushDraft('boom', user.id, h.clock.now()));
    await burst(3);
    const d = dispatcher({});
    await d.tick();
    const fake = h.deps.push;
    const throwing: PushProvider = {
      send: (target, payload) =>
        target.token === 'fake-token-that-throws'
          ? Promise.reject(new Error('provider client crashed'))
          : fake.send(target, payload),
    };
    const result = await processJobs({ ...h.deps, push: throwing }, h.queue.jobs.splice(0), {
      parallel: 4,
    });
    expect(result.failure).toBeInstanceOf(Error);
    expect(result.outcomes.sent).toBe(3);
    expect(h.logger.lines.some((l) => l.event === 'outbox.job_failed')).toBe(true);
    const boom = await h.rowByKey('boom');
    expect(boom?.status).toBe('sending');

    // Its lease runs out, it is reclaimed, and sent by the next job.
    h.clock.advance(LEASE + 1_000);
    await d.tick();
    expect((await processJobs(h.deps, h.queue.jobs.splice(0))).outcomes.sent).toBe(1);
    expect((await h.rowByKey('boom'))?.status).toBe('sent');
    expect(h.push.sent).toHaveLength(4);
  });
});
