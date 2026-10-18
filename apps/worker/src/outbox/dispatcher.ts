import { DEFAULT_RETRY_POLICY, type Logger, type RetryPolicy } from '@qc/messaging';
import type { Clock, Db } from '../db';
import { DEFAULT_LEASE_MS, claimDue, countInFlight, reclaimStale, type SendLane } from './repo';

export type { SendLane } from './repo';

export interface SendJob {
  outboxId: string;
  /** The row's `attempts` when it was claimed. A job for an older attempt is ignored. */
  attempt: number;
  /**
   * The claim's lease end (ISO). The sender takes the row only while it is still on this lease, so
   * the same claim is sent once even if its job is delivered twice.
   */
  lease?: string;
}

/** Where claimed rows go to be sent: pg-boss in the worker, an inline runner in tests. */
export interface SendQueue {
  /** Hands over the jobs of one claim, all of the same lane. */
  enqueue(jobs: readonly SendJob[], lane: SendLane): Promise<void>;
}

/**
 * How many rows of a lane may be claimed and not yet finished, across every worker. The dispatcher
 * claims no more than this, so a burst waits as `queued` rows (no lease, no attempt spent) instead
 * of as claimed rows whose leases run out before a sender reaches them (the load-test livelock).
 *
 * The defaults keep the work in flight well inside one lease (5 minutes): 2,000 pushes drain in
 * about 20 s at the target 100 a second, and would still finish in time at 7 a second; 100 WhatsApp
 * or SMS messages finish in time at a third of a message a second.
 */
export const DEFAULT_MAX_IN_FLIGHT: Readonly<Record<SendLane, number>> = {
  push: 2000,
  message: 100,
};

/** Rows claimed per statement. A tick claims several batches while there is room. */
export const DEFAULT_CLAIM_BATCH = 500;

export interface DispatcherOptions {
  db: Db;
  queue: SendQueue;
  logger: Logger;
  now: Clock;
  /** Rows claimed per statement. Default `DEFAULT_CLAIM_BATCH`. */
  batchSize?: number;
  /** How long a claim lasts before a crashed worker's rows are handed out again. */
  leaseMs?: number;
  /** In-flight limits per lane. Defaults in `DEFAULT_MAX_IN_FLIGHT`. */
  maxInFlight?: Partial<Record<SendLane, number>>;
  retry?: RetryPolicy;
}

export interface TickResult {
  claimed: number;
  /** Rows whose lease ran out (`worker_lost`) and went back to `queued`. */
  reclaimed: number;
  /** Rows whose lease ran out on their last attempt and went to `dead`. */
  dead: number;
  /** True when a lane hit its in-flight limit: more rows may be due, so look again soon. */
  saturated: boolean;
}

export interface Dispatcher {
  /** One pass: recover rows from dead workers, claim due rows up to the limits, queue them. */
  tick(): Promise<TickResult>;
}

/** WhatsApp and SMS first: there are few of them, and a reminder must not wait behind a burst. */
const LANES: readonly SendLane[] = ['message', 'push'];

export function createDispatcher(options: DispatcherOptions): Dispatcher {
  const batchSize = Math.max(1, options.batchSize ?? DEFAULT_CLAIM_BATCH);
  const leaseMs = options.leaseMs ?? DEFAULT_LEASE_MS;
  const maxAttempts = (options.retry ?? DEFAULT_RETRY_POLICY).maxAttempts;
  const limits: Record<SendLane, number> = { ...DEFAULT_MAX_IN_FLIGHT, ...options.maxInFlight };
  return {
    async tick() {
      const now = options.now();
      const reclaimed = await reclaimStale(options.db, { now, maxAttempts });
      if (reclaimed.requeued + reclaimed.dead > 0) {
        // A lease ran out before the row was finished: a worker died, or the senders fell behind.
        // Either needs a person to look, so this is an error, counted in the health metrics.
        options.logger.error('outbox.worker_lost', {
          requeued: reclaimed.requeued,
          dead: reclaimed.dead,
        });
      }
      let claimed = 0;
      let saturated = false;
      for (const lane of LANES) {
        let room = limits[lane] - (await countInFlight(options.db, lane));
        while (room > 0) {
          const want = Math.min(room, batchSize);
          const rows = await claimDue(options.db, { now, limit: want, leaseMs, lane });
          if (rows.length > 0) {
            await options.queue.enqueue(
              rows.map((row) => ({
                outboxId: row.id,
                attempt: row.attempts,
                lease: row.nextAttemptAt.toISOString(),
              })),
              lane,
            );
          }
          claimed += rows.length;
          room -= rows.length;
          if (rows.length < want) break;
        }
        if (room <= 0) saturated = true;
      }
      return { claimed, reclaimed: reclaimed.requeued, dead: reclaimed.dead, saturated };
    },
  };
}
