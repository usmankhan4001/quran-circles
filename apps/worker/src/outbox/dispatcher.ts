import { DEFAULT_RETRY_POLICY, type Logger, type RetryPolicy } from '@qc/messaging';
import type { Clock, Db } from '../db';
import { claimDue, reclaimStale } from './repo';

export interface SendJob {
  outboxId: string;
  /** The row's `attempts` when it was claimed. A job for an older attempt is ignored. */
  attempt: number;
}

/** Where claimed rows go to be sent: pg-boss in the worker, an inline runner in tests. */
export interface SendQueue {
  enqueue(job: SendJob): Promise<void>;
}

export interface DispatcherOptions {
  db: Db;
  queue: SendQueue;
  logger: Logger;
  now: Clock;
  /** Rows claimed per tick. */
  batchSize?: number;
  /** How long a claim lasts before a crashed worker's rows are handed out again. */
  leaseMs?: number;
  retry?: RetryPolicy;
}

export interface Dispatcher {
  /** One pass: recover rows from dead workers, claim due rows, hand them to the queue. */
  tick(): Promise<{ claimed: number; reclaimed: number; dead: number }>;
}

export function createDispatcher(options: DispatcherOptions): Dispatcher {
  const batchSize = options.batchSize ?? 50;
  const leaseMs = options.leaseMs ?? 5 * 60_000;
  const maxAttempts = (options.retry ?? DEFAULT_RETRY_POLICY).maxAttempts;
  return {
    async tick() {
      const now = options.now();
      const reclaimed = await reclaimStale(options.db, { now, maxAttempts });
      if (reclaimed.requeued + reclaimed.dead > 0) {
        options.logger.warn('outbox.reclaimed', { requeued: reclaimed.requeued, dead: reclaimed.dead });
      }
      const rows = await claimDue(options.db, { now, limit: batchSize, leaseMs });
      for (const row of rows) {
        await options.queue.enqueue({ outboxId: row.id, attempt: row.attempts });
      }
      return { claimed: rows.length, reclaimed: reclaimed.requeued, dead: reclaimed.dead };
    },
  };
}
