import { PGlite } from '@electric-sql/pglite';
import { PgBoss, fromPglite, type StopOptions } from 'pg-boss';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { POSTER_RENDER_QUEUE, type Poster, type PosterRenderJob } from '@qc/contracts';
import { createLogger } from '../middleware/logger';
import { unwiredPosterQueue } from '../modules/posters/queue';
import {
  posterSenderOptions,
  startPosterSender,
  type PosterBoss,
  type PosterSender,
} from '../modules/posters/sender';
import { createSession, seedPosterTemplates } from './fixtures';
import { createHarness } from './harness';

/**
 * The server's pg-boss sender (`index.ts`): real pg-boss on in-process Postgres. A second pg-boss
 * plays the worker: it creates `poster-render` (the worker owns the queue) and fetches the jobs.
 */

const NIL = '00000000-0000-4000-8000-000000000000';

let pg: PGlite;
let worker: PgBoss;
const senders: PosterSender[] = [];

const bossOn = (db: PGlite): PgBoss =>
  new PgBoss({ db: fromPglite(db), backend: 'pglite', supervise: false, schedule: false });

const logs: string[] = [];
const logger = createLogger((line) => logs.push(line), 'debug');

beforeAll(async () => {
  pg = new PGlite();
  worker = bossOn(pg);
  worker.on('error', () => {});
  await worker.start();
}, 120_000);

afterEach(async () => {
  while (senders.length > 0) await senders.pop()?.stop();
  logs.length = 0;
});

afterAll(async () => {
  await worker.stop({ graceful: false, close: false });
  await pg.close();
});

async function sender(): Promise<PosterSender> {
  const started = await startPosterSender(bossOn(pg), logger);
  senders.push(started);
  return started;
}

async function fetchJobs(): Promise<PosterRenderJob[]> {
  const jobs = await worker.fetch<PosterRenderJob>(POSTER_RENDER_QUEUE, { batchSize: 10 });
  return jobs.map((job) => job.data);
}

describe('pg-boss poster sender', () => {
  it('is built as a sender only: no maintenance, no schedules, a small pool', () => {
    expect(posterSenderOptions('postgres://user@db.invalid/qc')).toEqual({
      connectionString: 'postgres://user@db.invalid/qc',
      max: 2,
      supervise: false,
      schedule: false,
      instanceName: 'api',
    });
  });

  it('sends a job the worker fetches, never creates the queue, and sends once the worker has', async () => {
    const s = await sender();
    expect(s.started).toBe(true);
    expect(s.queue).not.toBe(unwiredPosterQueue);

    // Before the worker created the queue the send fails (and the module marks the posters failed).
    await expect(s.queue.enqueue({ posterIds: [NIL] })).rejects.toThrow();
    expect((await worker.getQueues()).map((q) => q.name)).not.toContain(POSTER_RENDER_QUEUE);

    // A missing queue is not remembered: once the worker creates it, the next send goes through.
    await worker.createQueue(POSTER_RENDER_QUEUE, { retryLimit: 3 });
    await s.queue.enqueue({ posterIds: [NIL] });
    expect(await fetchJobs()).toEqual([{ posterIds: [NIL] }]);

    // The worker's queue options are left as the worker set them.
    expect((await worker.getQueue(POSTER_RENDER_QUEUE))?.retryLimit).toBe(3);
    expect(logs).toEqual([]);
  });

  it('carries a real adminPosters.create through to the worker', async () => {
    await worker.createQueue(POSTER_RENDER_QUEUE);
    const s = await sender();
    const h = await createHarness({ posterQueue: s.queue });
    try {
      await h.reset();
      const admin = await h.nationalAdmin();
      await seedPosterTemplates(h);
      const session = await createSession(h, { venueId: h.world.venueA1, as: admin });
      const res = await h.api('adminPosters.create', {
        as: admin,
        params: { sessionId: session.id },
        body: {
          templateKey: 'cloud',
          language: 'en',
          formats: ['story', 'print_a4'],
          fields: { title: { en: 'Friday circle' } },
        },
      });
      expect(res.status).toBe(202);
      const items = res.json<{ items: Poster[] }>().items;
      expect(items.map((p) => p.status)).toEqual(['queued', 'queued']);
      expect(await fetchJobs()).toEqual([{ posterIds: items.map((p) => p.id) }]);
      // The harness's in-memory queue was not used.
      expect(h.posterQueue.jobs).toEqual([]);
    } finally {
      await h.close();
    }
  });

  it('stops pg-boss on shutdown', async () => {
    const boss = bossOn(pg);
    const s = await startPosterSender(boss, logger);
    const stopped = new Promise<void>((resolve) => boss.once('stopped', () => resolve()));
    await s.stop();
    await expect(stopped).resolves.toBeUndefined();
    expect(logs).toEqual([]);
  });
});

/** A stand-in pg-boss for the failure paths a real one cannot be made to take on demand. */
function fakeBoss(over: { start?: () => Promise<unknown>; stop?: () => Promise<void> } = {}) {
  const calls = { stop: [] as (StopOptions | undefined)[], sends: 0 };
  let onError: ((error: Error) => void) | undefined;
  const boss: PosterBoss = {
    start: over.start ?? (async () => boss),
    async stop(options) {
      calls.stop.push(options);
      await over.stop?.();
    },
    on(_event, listener) {
      onError = listener;
      return boss;
    },
    async send() {
      calls.sends += 1;
      return 'job-1';
    },
  };
  return { boss, calls, emitError: (error: Error) => onError?.(error) };
}

class ConnectionRefused extends Error {
  override name = 'ConnectionRefused';
}

describe('pg-boss poster sender failures', () => {
  it('serves without pg-boss: the refusing queue and one log line, no connection details', async () => {
    const { boss, calls } = fakeBoss({
      start: async () => {
        throw new ConnectionRefused('connect ECONNREFUSED db.invalid:5432');
      },
    });
    const s = await startPosterSender(boss, logger);
    expect(s.started).toBe(false);
    expect(s.queue).toBe(unwiredPosterQueue);
    await expect(s.queue.enqueue({ posterIds: [NIL] })).rejects.toThrow();
    expect(calls.sends).toBe(0);
    expect(logs).toHaveLength(1);
    expect(JSON.parse(logs[0]!)).toMatchObject({
      level: 'error',
      msg: 'posters.queue_unavailable',
      error: 'ConnectionRefused',
    });
    expect(logs[0]).not.toContain('db.invalid');
    await s.stop();
    expect(calls.stop).toEqual([{ graceful: false, close: true, timeout: 5_000 }]);
  });

  it('logs pg-boss errors by name instead of letting them end the process', async () => {
    const { boss, emitError } = fakeBoss();
    const s = await startPosterSender(boss, logger);
    expect(s.started).toBe(true);
    emitError(new ConnectionRefused('lost db.invalid'));
    expect(logs.map((l) => JSON.parse(l) as Record<string, unknown>)).toEqual([
      expect.objectContaining({ msg: 'posters.queue_error', error: 'ConnectionRefused' }),
    ]);
    expect(logs.join('')).not.toContain('db.invalid');
  });

  it('never throws from stop, so the rest of the shutdown runs', async () => {
    const { boss } = fakeBoss({
      stop: async () => {
        throw new ConnectionRefused('already gone');
      },
    });
    const s = await startPosterSender(boss, logger);
    await expect(s.stop()).resolves.toBeUndefined();
    expect(JSON.parse(logs[0]!)).toMatchObject({
      level: 'warn',
      msg: 'posters.queue_stop_failed',
      error: 'ConnectionRefused',
    });
  });

  it('a started sender hands jobs to pg-boss', async () => {
    const { boss, calls } = fakeBoss();
    const s = await startPosterSender(boss, logger);
    await s.queue.enqueue({ posterIds: [NIL] });
    expect(calls.sends).toBe(1);
  });
});
