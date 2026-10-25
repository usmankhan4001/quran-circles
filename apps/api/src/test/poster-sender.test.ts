import { PGlite } from '@electric-sql/pglite';
import { PgBoss, fromPglite, type StopOptions } from 'pg-boss';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { POSTER_RENDER_QUEUE, type Poster, type PosterRenderJob } from '@qc/contracts';
import { createLogger } from '../middleware/logger';
import {
  POSTER_RENDER_DEAD_QUEUE,
  POSTER_RENDER_QUEUE_OPTIONS,
  pgBossPosterQueue,
  unwiredPosterQueue,
} from '../modules/posters/queue';
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
 * plays the worker: it fetches the jobs and, in some tests, creates `poster-render` first (the
 * worker owns the queue's settings; the API only creates it when it is missing).
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

/** Back to a database where nobody has created the poster queues yet. */
async function dropPosterQueues(): Promise<void> {
  for (const name of [POSTER_RENDER_QUEUE, POSTER_RENDER_DEAD_QUEUE]) {
    if (await worker.getQueue(name)) await worker.deleteQueue(name);
  }
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

  it("creates the queue at startup, before the worker ever ran, with the worker's settings", async () => {
    await dropPosterQueues();
    expect((await worker.getQueues()).map((q) => q.name)).not.toContain(POSTER_RENDER_QUEUE);
    const s = await sender();
    expect(s.started).toBe(true);
    expect(s.queue).not.toBe(unwiredPosterQueue);

    // A poster requested now is queued, not failed: the job waits for the worker.
    await s.queue.enqueue({ posterIds: [NIL] });
    expect(await fetchJobs()).toEqual([{ posterIds: [NIL] }]);
    expect(await worker.getQueue(POSTER_RENDER_QUEUE)).toMatchObject({
      retryLimit: POSTER_RENDER_QUEUE_OPTIONS.retryLimit,
      expireInSeconds: POSTER_RENDER_QUEUE_OPTIONS.expireInSeconds,
      deadLetter: POSTER_RENDER_DEAD_QUEUE,
    });
    expect(await worker.getQueue(POSTER_RENDER_DEAD_QUEUE)).not.toBeNull();
    expect(logs).toEqual([]);
  });

  it('never changes a queue the worker already made, and starting twice is harmless', async () => {
    await dropPosterQueues();
    await worker.createQueue(POSTER_RENDER_QUEUE, { retryLimit: 5 });
    const first = await sender();
    const second = await sender();
    await first.queue.enqueue({ posterIds: [NIL] });
    await second.queue.enqueue({ posterIds: [NIL] });
    expect(await fetchJobs()).toHaveLength(2);
    // The worker's queue options are left as the worker set them.
    expect((await worker.getQueue(POSTER_RENDER_QUEUE))?.retryLimit).toBe(5);
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
function fakeBoss(
  over: {
    start?: () => Promise<unknown>;
    stop?: () => Promise<void>;
    createQueue?: (name: string) => Promise<void>;
  } = {},
) {
  const calls = {
    stop: [] as (StopOptions | undefined)[],
    sends: 0,
    created: [] as string[],
  };
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
    async createQueue(name) {
      calls.created.push(name);
      await over.createQueue?.(name);
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

  it('still starts when the queue cannot be created, and tries again on the next send', async () => {
    let refuse = true;
    const { boss, calls } = fakeBoss({
      createQueue: async () => {
        if (refuse) throw new ConnectionRefused('no db.invalid');
      },
    });
    const s = await startPosterSender(boss, logger);
    expect(s.started).toBe(true);
    expect(JSON.parse(logs[0]!)).toMatchObject({
      level: 'warn',
      msg: 'posters.queue_create_failed',
      error: 'ConnectionRefused',
    });
    expect(logs.join('')).not.toContain('db.invalid');
    // Still refused: the send is not attempted, so the module marks the posters failed.
    await expect(s.queue.enqueue({ posterIds: [NIL] })).rejects.toThrow();
    expect(calls.sends).toBe(0);
    refuse = false;
    await s.queue.enqueue({ posterIds: [NIL] });
    expect(calls.sends).toBe(1);
    // Created once it worked, dead-letter queue first; not again on later sends.
    await s.queue.enqueue({ posterIds: [NIL] });
    expect(calls.created.slice(-2)).toEqual([POSTER_RENDER_DEAD_QUEUE, POSTER_RENDER_QUEUE]);
    expect(calls.sends).toBe(2);
  });

  it('a queue without createQueue (a bare sender) just sends', async () => {
    const sent: string[] = [];
    const queue = pgBossPosterQueue({
      send: async (name) => {
        sent.push(name);
        return 'id';
      },
    });
    await queue.ensureQueue();
    await queue.enqueue({ posterIds: [NIL] });
    expect(sent).toEqual([POSTER_RENDER_QUEUE]);
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
