import { POSTER_RENDER_QUEUE, PosterRenderJob } from '@qc/contracts';

/**
 * How the API hands a render to the worker: one `PosterRenderJob { posterIds }` on the pg-boss
 * queue `POSTER_RENDER_QUEUE` (`poster-render`), which the worker drains (contract 1.0.0-rc.5). The
 * queue's retry, expiry and dead-letter policy belong to the worker, which re-applies them with
 * `updateQueue` every time it starts.
 */
export interface PosterQueue {
  enqueue(job: PosterRenderJob): Promise<void>;
}

/** The worker's dead-letter queue for `poster-render` (`POSTER_DEAD_QUEUE` in apps/worker). */
export const POSTER_RENDER_DEAD_QUEUE = 'poster-render-dead';

/** pg-boss queue options, the subset the API passes when it creates the poster queues. */
export interface PosterQueueOptions {
  retryLimit?: number;
  retryDelay?: number;
  retryBackoff?: boolean;
  retryDelayMax?: number;
  expireInSeconds?: number;
  retentionSeconds?: number;
  deleteAfterSeconds?: number;
  deadLetter?: string;
}

/**
 * The same settings the worker gives `poster-render` (apps/worker/src/runtime.ts, `startRuntime`),
 * so a job sent before the worker's first start already has the worker's retries, expiry and
 * dead letter. The worker stays the owner: it applies its own values again on every start.
 */
export const POSTER_RENDER_QUEUE_OPTIONS: PosterQueueOptions = {
  retryLimit: 3,
  retryDelay: 15,
  retryBackoff: true,
  retryDelayMax: 600,
  expireInSeconds: 120,
  retentionSeconds: 24 * 3600,
  deleteAfterSeconds: 7 * 24 * 3600,
  deadLetter: POSTER_RENDER_DEAD_QUEUE,
};
export const POSTER_RENDER_DEAD_QUEUE_OPTIONS: PosterQueueOptions = {
  retentionSeconds: 30 * 24 * 3600,
};

/**
 * The part of a pg-boss instance the API uses. `PgBoss#send(name, data)` and
 * `PgBoss#createQueue(name, options)` have these shapes, so a `PgBoss` can be passed as is
 * (`sender.ts` starts the server's) and tests can pass a stand-in. pg-boss's `createQueue` only
 * inserts a queue that is missing (`ON CONFLICT DO NOTHING`), so calling it is always safe.
 */
export interface PosterJobSender {
  send(name: string, data: object): Promise<string | null>;
  createQueue?(name: string, options?: PosterQueueOptions): Promise<void>;
}

/** A pg-boss poster queue that can also be made ready ahead of the first send. */
export interface PgBossPosterQueue extends PosterQueue {
  /**
   * Creates `poster-render` (and its dead-letter queue first) if they are missing. Done once; a
   * failure is not remembered, so the next call (or the next `enqueue`) tries again.
   */
  ensureQueue(): Promise<void>;
}

/**
 * Sends each job to the `poster-render` pg-boss queue. A refused send (null id) is an error.
 * Before the first send it makes sure the queue exists: a poster requested before the worker's
 * first start used to fail, because only the worker created the queue.
 */
export function pgBossPosterQueue(boss: PosterJobSender): PgBossPosterQueue {
  let ready: Promise<void> | null = null;
  const ensureQueue = (): Promise<void> => {
    const create = boss.createQueue?.bind(boss);
    if (!create) return Promise.resolve();
    ready ??= (async () => {
      // The dead-letter queue has to exist before a queue can point at it.
      await create(POSTER_RENDER_DEAD_QUEUE, POSTER_RENDER_DEAD_QUEUE_OPTIONS);
      await create(POSTER_RENDER_QUEUE, POSTER_RENDER_QUEUE_OPTIONS);
    })().catch((error: unknown) => {
      ready = null;
      throw error;
    });
    return ready;
  };
  return {
    ensureQueue,
    async enqueue(job) {
      const data = PosterRenderJob.parse(job);
      await ensureQueue();
      const id = await boss.send(POSTER_RENDER_QUEUE, data);
      if (!id) throw new Error('poster-render job was not accepted');
    },
  };
}

/** Keeps the jobs in memory, for tests. `fail` makes the next sends throw. */
export interface MemoryPosterQueue extends PosterQueue {
  readonly jobs: PosterRenderJob[];
  fail: boolean;
}

export function memoryPosterQueue(): MemoryPosterQueue {
  const queue: MemoryPosterQueue = {
    jobs: [],
    fail: false,
    async enqueue(job) {
      if (queue.fail) throw new Error('queue unavailable');
      queue.jobs.push(PosterRenderJob.parse(job));
    },
  };
  return queue;
}

/**
 * The queue before the server has wired one: every send fails, so the new posters are marked
 * failed (and can be regenerated) instead of waiting forever for a render that was never asked for.
 */
export const unwiredPosterQueue: PosterQueue = {
  async enqueue() {
    throw new Error('no poster-render queue is configured');
  },
};
