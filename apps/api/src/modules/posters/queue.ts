import { POSTER_RENDER_QUEUE, PosterRenderJob } from '@qc/contracts';

/**
 * How the API hands a render to the worker: one `PosterRenderJob { posterIds }` on the pg-boss
 * queue `POSTER_RENDER_QUEUE` (`poster-render`), which the worker drains (contract 1.0.0-rc.5). The
 * queue's retry, expiry and dead-letter policy belong to the worker, which creates the queue.
 */
export interface PosterQueue {
  enqueue(job: PosterRenderJob): Promise<void>;
}

/**
 * The part of a pg-boss instance the API uses. `PgBoss#send(name, data)` has this shape, so a
 * `PgBoss` can be passed as is without the API depending on pg-boss.
 */
export interface PosterJobSender {
  send(name: string, data: object): Promise<string | null>;
}

/** Sends each job to the `poster-render` pg-boss queue. A refused send (null id) is an error. */
export function pgBossPosterQueue(boss: PosterJobSender): PosterQueue {
  return {
    async enqueue(job) {
      const data = PosterRenderJob.parse(job);
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
