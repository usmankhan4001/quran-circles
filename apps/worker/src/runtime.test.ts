import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PgBoss, fromPglite } from 'pg-boss';
import { POSTER_RENDER_QUEUE } from '@qc/contracts';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { tables } from './db';
import {
  AUTH_PURGE_CRON,
  AUTH_PURGE_QUEUE,
  AUTH_PURGE_TIMEZONE,
  AYAH_CRON,
  AYAH_QUEUE,
  AYAH_TIMEZONE,
  POSTER_DEAD_QUEUE,
  POSTER_QUEUE,
  RECONCILE_QUEUE,
  SEND_QUEUE,
  TOP_UP_CRON,
  TOP_UP_QUEUE,
  TOP_UP_TIMEZONE,
  startRuntime,
  type Runtime,
} from './runtime';
import { LocalDiskPosterStorage, type PosterStorage } from './posters/storage';
import { createTestDb, type TestDb } from './test/db';
import { FAKE_RENDERER_TOKEN, FakeRenderer } from './test/fake-renderer';
import { createHarness, pushDraft, whatsappDraft, type Harness } from './test/harness';
import {
  seedAuthSession,
  seedDevice,
  seedOccurrence,
  seedOtpChallenge,
  seedPoster,
  seedPosterTemplate,
  seedRegistration,
  seedUser,
  seedWorld,
} from './test/seed';

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

  it('registers the morning ayah at 06:30 Pakistan time, once however often it starts', async () => {
    await start();
    await runtime!.stop({ timeoutMs: 5_000 });
    boss = new PgBoss({ db: fromPglite(test.pg), backend: 'pglite', schedule: true });
    boss.on('error', () => {});
    await boss.start();
    await start();
    const schedules = (await boss.getSchedules()).filter((s) => s.name === AYAH_QUEUE);
    expect(schedules).toHaveLength(1);
    expect(schedules[0]).toMatchObject({ cron: AYAH_CRON, timezone: AYAH_TIMEZONE, key: 'daily' });
    expect(AYAH_CRON).toBe('30 6 * * *');
    expect(AYAH_TIMEZONE).toBe('Asia/Karachi');
  });

  it('does not register the morning ayah schedule when told not to', async () => {
    await boss.unschedule(AYAH_QUEUE, 'daily');
    await start({ scheduleAyah: false });
    expect((await boss.getSchedules()).some((s) => s.name === AYAH_QUEUE)).toBe(false);
  });

  it('queues the morning ayah on demand and when a job reaches its queue, once per person', async () => {
    h.clock.set(new Date('2026-11-02T01:30:00Z')); // 06:30 in Pakistan
    // No schedule here, so a make-up run cannot race the on-demand one.
    await boss.unschedule(AYAH_QUEUE, 'daily');
    const rt = await start({ webBase: 'https://example.org', scheduleAyah: false });
    await test.db
      .insert(tables.featureFlags)
      .values({ key: 'ayah_of_the_day', cityId: null, enabled: true });
    const user = await seedUser(test.db);
    await seedDevice(test.db, user.id);
    expect(await rt.ayahNow()).toMatchObject({ date: '2026-11-02', queued: 1 });
    const row = await h.rowByKey(`ayah_daily:2026-11-02:${user.id}:push`);
    expect(JSON.stringify(row?.payload)).toContain('https://example.org/quran?surah=');

    const done = () => Promise.resolve(h.logger.lines.filter((l) => l.event === 'ayah_daily.run'));
    const before = (await done()).length;
    await boss.send(AYAH_QUEUE, {});
    const lines = await until(done, (l) => l.length === before + 1);
    expect(lines.at(-1)!.fields).toMatchObject({ queued: 0, alreadyQueued: 1 });
  });

  it('registers the daily sign-in purge at 03:00 Pakistan time, once however often it starts', async () => {
    await start();
    await runtime!.stop({ timeoutMs: 5_000 });
    boss = new PgBoss({ db: fromPglite(test.pg), backend: 'pglite', schedule: true });
    boss.on('error', () => {});
    await boss.start();
    await start();
    const schedules = (await boss.getSchedules()).filter((s) => s.name === AUTH_PURGE_QUEUE);
    expect(schedules).toHaveLength(1);
    expect(schedules[0]).toMatchObject({
      cron: AUTH_PURGE_CRON,
      timezone: AUTH_PURGE_TIMEZONE,
      key: 'daily',
    });
    expect(AUTH_PURGE_QUEUE).toBe('auth-purge');
    expect(AUTH_PURGE_CRON).toBe('0 3 * * *');
    expect(AUTH_PURGE_TIMEZONE).toBe('Asia/Karachi');
  });

  it('does not register the sign-in purge schedule when told not to', async () => {
    await boss.unschedule(AUTH_PURGE_QUEUE, 'daily');
    await start({ scheduleAuthPurge: false });
    expect((await boss.getSchedules()).some((s) => s.name === AUTH_PURGE_QUEUE)).toBe(false);
  });

  it('purges on demand and when a job reaches its queue, keeping live sessions', async () => {
    await boss.unschedule(AUTH_PURGE_QUEUE, 'daily');
    const rt = await start({ scheduleAuthPurge: false });
    const now = h.clock.now().getTime();
    const day = 24 * 3_600_000;
    const user = await seedUser(test.db);
    await seedOtpChallenge(test.db, {
      expiresAt: new Date(now - 2 * day),
      consumedAt: new Date(now - 2 * day),
    });
    await seedAuthSession(test.db, { userId: user.id, expiresAt: new Date(now - 31 * day) });
    await seedAuthSession(test.db, {
      userId: user.id,
      expiresAt: new Date(now + day),
      revokedAt: new Date(now - 31 * day),
    });
    const live = await seedAuthSession(test.db, {
      userId: user.id,
      expiresAt: new Date(now + 30 * day),
    });

    expect(await rt.authPurgeNow()).toEqual({ challenges: 1, sessions: 2 });

    await seedOtpChallenge(test.db, { expiresAt: new Date(now - 3 * day) });
    // A confirmation that finished before payloads were redacted (SEC-06) still names the person.
    const old = await h.queue_(
      whatsappDraft(
        'registration_confirmation:old:whatsapp',
        'registration_confirmation',
        user.id,
        h.clock.now(),
      ),
    );
    await test.db
      .update(tables.messageOutbox)
      .set({ status: 'sent', sentAt: h.clock.now() })
      .where(eq(tables.messageOutbox.id, old.id));
    const done = () => Promise.resolve(h.logger.lines.filter((l) => l.event === 'auth.purged'));
    const redactedLines = () =>
      Promise.resolve(h.logger.lines.filter((l) => l.event === 'outbox.payloads_redacted'));
    await boss.send(AUTH_PURGE_QUEUE, {});
    const lines = await until(done, (l) => l.length === 2);
    expect(lines.map((l) => l.fields)).toEqual([
      { challenges: 1, sessions: 2 },
      { challenges: 1, sessions: 0 },
    ]);
    const sessions = await test.db.select().from(tables.authSessions);
    expect(sessions.map((s) => s.id)).toEqual([live.id]);
    expect(await test.db.select().from(tables.otpChallenges)).toHaveLength(0);
    expect((await until(redactedLines, (l) => l.length === 1)).map((l) => l.fields)).toEqual([
      { rows: 1 },
    ]);
    expect((await h.row(old.id)).payload).toEqual({
      channel: 'whatsapp',
      template: 'registration_confirmation',
      locale: 'en',
      redacted: true,
    });
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

describe('poster-render queue', () => {
  let fake: FakeRenderer;
  let dir: string;
  let storage: LocalDiskPosterStorage;

  beforeAll(async () => {
    fake = await new FakeRenderer().start();
  });
  afterAll(async () => {
    await fake.stop();
  });
  beforeEach(async () => {
    fake.reset();
    dir = await mkdtemp(path.join(tmpdir(), 'qc-runtime-posters-'));
    storage = new LocalDiskPosterStorage(dir);
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const configured = (over: { storage?: PosterStorage } = {}) => ({
    posters: {
      renderer: { url: fake.url, token: FAKE_RENDERER_TOKEN, timeoutMs: 5_000 },
      storage: over.storage ?? storage,
      missing: [],
    },
    posterRetryDelaySeconds: 1,
  });

  const queuedPoster = async () => {
    const world = await seedWorld(test.db);
    const template = await seedPosterTemplate(test.db, { key: 'cloud' });
    return seedPoster(test.db, { sessionId: world.session.id, templateId: template.id });
  };
  const posterRow = async (id: string) => {
    const [r] = await test.db.select().from(tables.posters).where(eq(tables.posters.id, id));
    if (!r) throw new Error('poster not found');
    return r;
  };

  it('uses the contract queue name, retry 3 with backoff, 120 s expiry and a dead letter', async () => {
    await start(configured());
    expect(POSTER_QUEUE).toBe(POSTER_RENDER_QUEUE);
    expect(await boss.getQueue(POSTER_QUEUE)).toMatchObject({
      retryLimit: 3,
      retryBackoff: true,
      expireInSeconds: 120,
      deadLetter: POSTER_DEAD_QUEUE,
    });
  });

  it('applies its settings to a queue the API created first', async () => {
    await boss.deleteQueue(POSTER_QUEUE).catch(() => {});
    await boss.createQueue(POSTER_QUEUE, { retryLimit: 0, expireInSeconds: 900 });
    await start(configured());
    expect(await boss.getQueue(POSTER_QUEUE)).toMatchObject({
      retryLimit: 3,
      expireInSeconds: 120,
      deadLetter: POSTER_DEAD_QUEUE,
    });
  });

  it('renders a job the API put on the queue, once even when it is sent twice', async () => {
    await start(configured());
    const poster = await queuedPoster();
    await boss.send(POSTER_QUEUE, { posterIds: [poster.id] });
    const ready = await until(
      () => posterRow(poster.id),
      (r) => r.status === 'ready',
    );
    expect(await storage.get(ready.storageKey!)).not.toBeNull();

    await boss.send(POSTER_QUEUE, { posterIds: [poster.id] });
    const done = () => Promise.resolve(h.logger.lines.filter((l) => l.event === 'posters.render'));
    const lines = await until(done, (l) => l.length === 2);
    expect(lines[1]!.fields).toMatchObject({ skipped: 1, renderCalls: 0 });
    expect(fake.requests).toHaveLength(1);
  });

  it('retries a busy renderer through pg-boss, then fills the row', async () => {
    await start(configured());
    const poster = await queuedPoster();
    fake.next({ kind: 'status', status: 503, body: { error: { code: 'busy' } } });
    await boss.send(POSTER_QUEUE, { posterIds: [poster.id] });
    const ready = await until(
      () => posterRow(poster.id),
      (r) => r.status === 'ready',
    );
    expect(ready.failureCode).toBeNull();
    expect(fake.requests).toHaveLength(2);
  });

  it('does not retry text_too_long', async () => {
    await start(configured());
    const poster = await queuedPoster();
    fake.always({ kind: 'status', status: 422, body: { error: { code: 'text_too_long' } } });
    await boss.send(POSTER_QUEUE, { posterIds: [poster.id] });
    await until(
      () => posterRow(poster.id),
      (r) => r.status === 'failed',
    );
    await new Promise((r) => setTimeout(r, 2_500));
    expect((await posterRow(poster.id)).failureCode).toBe('text_too_long');
    expect(fake.requests).toHaveLength(1);
  });

  it('fails the rows of a job that ran out of retries in the dead-letter queue', async () => {
    const failing: PosterStorage = {
      put: () => Promise.reject(new Error('disk full')),
      get: () => Promise.resolve(null),
      delete: () => Promise.resolve(),
    };
    await start(configured({ storage: failing }));
    const poster = await queuedPoster();
    await boss.send(POSTER_QUEUE, { posterIds: [poster.id] });
    const failed = await until(
      () => posterRow(poster.id),
      (r) => r.status === 'failed',
      40_000,
    );
    expect(failed.failureCode).toBe('render_failed');
    expect(fake.requests).toHaveLength(4); // the first try and three retries
    expect(h.logger.lines.some((l) => l.event === 'posters.job_dead')).toBe(true);
  }, 60_000);

  it('starts without poster settings; a job then fails its rows and says what is missing', async () => {
    await start({ posterRetryDelaySeconds: 1 });
    const poster = await queuedPoster();
    await boss.send(POSTER_QUEUE, { posterIds: [poster.id] });
    const failed = await until(
      () => posterRow(poster.id),
      (r) => r.status === 'failed',
    );
    expect(failed.failureCode).toBe('render_failed');
    const line = h.logger.lines.find((l) => l.event === 'posters.render');
    expect(line).toMatchObject({
      level: 'error',
      fields: { notConfigured: true, missing: 'RENDERER_URL,RENDERER_TOKEN,POSTER_STORAGE_DIR' },
    });
    // The rest of the worker still runs.
    const user = await seedUser(test.db);
    await seedDevice(test.db, user.id);
    const row = await h.queue_(pushDraft('boss-posters-off', user.id, h.clock.now()));
    await runtime!.dispatchNow();
    await until(
      () => h.row(row.id),
      (r) => r.status === 'sent',
    );
  });

  it('logs and drops a malformed job without retrying it', async () => {
    await start(configured());
    await boss.send(POSTER_QUEUE, { posterIds: 'nope' });
    const invalid = () =>
      Promise.resolve(h.logger.lines.filter((l) => l.event === 'posters.job_invalid'));
    await until(invalid, (l) => l.length === 1);
    await new Promise((r) => setTimeout(r, 2_500));
    expect(await invalid()).toHaveLength(1);
  });

  it('renders on demand through the runtime', async () => {
    const rt = await start(configured());
    const poster = await queuedPoster();
    expect(await rt.renderPostersNow({ posterIds: [poster.id] })).toMatchObject({ ready: 1 });
  });
});
