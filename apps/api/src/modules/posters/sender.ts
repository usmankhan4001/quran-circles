import type { ConstructorOptions, StopOptions } from 'pg-boss';
import type { Logger } from '../../middleware/logger';
import {
  pgBossPosterQueue,
  unwiredPosterQueue,
  type PosterJobSender,
  type PosterQueue,
} from './queue';

/**
 * How the server's pg-boss instance is built: a sender only. No maintenance (`supervise`) and no
 * cron (`schedule`), which are the worker's; a small pool, since the API only inserts jobs. Schema
 * install stays on (pg-boss's default, versioned and lock-guarded, the worker's exact version), so a
 * first deploy where the API starts before the worker can still send once the worker has created
 * the queue. The API never creates or changes a queue: the worker owns `poster-render`'s options.
 */
export function posterSenderOptions(connectionString: string): ConstructorOptions {
  return { connectionString, max: 2, supervise: false, schedule: false, instanceName: 'api' };
}

/** The part of a `PgBoss` the server uses. A `PgBoss` fits it as is. */
export interface PosterBoss extends PosterJobSender {
  start(): Promise<unknown>;
  stop(options?: StopOptions): Promise<void>;
  on(event: 'error', listener: (error: Error) => void): unknown;
}

export interface PosterSender {
  /** `pgBossPosterQueue(boss)` when pg-boss started, else the queue that refuses every job. */
  queue: PosterQueue;
  started: boolean;
  /** Stops pg-boss and closes its pool. Never throws. */
  stop(): Promise<void>;
}

const errorName = (error: unknown): string => (error instanceof Error ? error.name : 'unknown');

/**
 * Starts `boss` for sending poster jobs. If it cannot start, the API still serves: the poster queue
 * refuses every job, so new posters come back `failed` / `render_failed` (and can be regenerated
 * after a restart), and one line is logged. Error names only, never connection details.
 */
export async function startPosterSender(boss: PosterBoss, logger: Logger): Promise<PosterSender> {
  // Without a listener an 'error' event would end the process.
  boss.on('error', (error) => logger.error('posters.queue_error', { error: errorName(error) }));
  const stop = async (): Promise<void> => {
    try {
      await boss.stop({ graceful: false, close: true, timeout: 5_000 });
    } catch (error) {
      logger.warn('posters.queue_stop_failed', { error: errorName(error) });
    }
  };
  try {
    await boss.start();
  } catch (error) {
    logger.error('posters.queue_unavailable', { error: errorName(error) });
    return { queue: unwiredPosterQueue, started: false, stop };
  }
  return { queue: pgBossPosterQueue(boss), started: true, stop };
}
