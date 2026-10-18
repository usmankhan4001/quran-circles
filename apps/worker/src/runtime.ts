import type { JobWithMetadata, PgBoss } from 'pg-boss';
import { POSTER_RENDER_QUEUE, PosterRenderJob } from '@qc/contracts';
import {
  DEFAULT_OCCURRENCE_HORIZON_DAYS,
  fanOutPendingUpdatePushes,
  type PurgeResult,
  type TopUpSummary,
  type UpdatePushSummary,
} from '@qc/db';
import type { Logger, RetryPolicy } from '@qc/messaging';
import { POSTER_ENV_NAMES } from './config';
import type { Clock, Db } from './db';
import {
  DEFAULT_DISPATCH_INTERVAL_MS,
  DEFAULT_WAKE_INTERVAL_MS,
  createDispatcher,
  type SendJob,
  type SendLane,
  type SendQueue,
  type TickResult,
} from './outbox/dispatcher';
import { processJobs, type BatchResult, type ProcessorDeps } from './outbox/processor';
import { DEFAULT_LEASE_MS, findPendingWork, redactFinishedPayloads } from './outbox/repo';
import { runOccurrenceTopUp } from './occurrences/top-up';
import { runMorningAyah, type AyahJobSummary } from './ayah/morning';
import { runAuthPurge } from './auth/purge';
import { reconcileReminders, type ReconcileSummary } from './reminders/reconcile';
import {
  PosterRenderNotConfiguredError,
  PosterRenderRetryError,
  failQueuedPosters,
  renderPosters,
  type PosterRenderAttempt,
  type PosterRenderDeps,
  type PosterRenderSummary,
} from './posters/render';

/** WhatsApp and SMS sends (and any job queued before push had its own queue). */
export const SEND_QUEUE = 'outbox-send';
/** Push sends: bigger batches, sent in parallel, polled more often. Same dead letter. */
export const PUSH_SEND_QUEUE = 'outbox-send-push';
export const SEND_DEAD_QUEUE = 'outbox-send-dead';
export const RECONCILE_QUEUE = 'reminders-reconcile';
export const TOP_UP_QUEUE = 'occurrences-top-up';
/** 00:30 every day in Pakistan time, after the date has turned over. */
export const TOP_UP_CRON = '30 0 * * *';
export const TOP_UP_TIMEZONE = 'Asia/Karachi';
export const AYAH_QUEUE = 'ayah-daily';
/** 06:30 every day in Pakistan time: after Fajr for most of the year, before the working day. */
export const AYAH_CRON = '30 6 * * *';
export const AYAH_TIMEZONE = 'Asia/Karachi';
export const AUTH_PURGE_QUEUE = 'auth-purge';
/** 03:00 every day in Pakistan time, the quietest hour for sign-ins. */
export const AUTH_PURGE_CRON = '0 3 * * *';
export const AUTH_PURGE_TIMEZONE = 'Asia/Karachi';
/** The API fills it (`POSTER_RENDER_QUEUE` from `@qc/contracts`, `'poster-render'`). */
export const POSTER_QUEUE = POSTER_RENDER_QUEUE;
export const POSTER_DEAD_QUEUE = 'poster-render-dead';
export const POSTER_RETRY_LIMIT = 3;
export const POSTER_EXPIRE_SECONDS = 120;

export interface RuntimeOptions {
  db: Db;
  boss: PgBoss;
  processor: ProcessorDeps;
  logger: Logger;
  now: Clock;
  retry?: RetryPolicy;
  /**
   * The longest the poll loop goes without a full pass (fan-out, reclaim, claim), whatever the wake
   * probe says; with the probe off, how often it passes. Default 30 seconds. 0 turns the loop off
   * (tests drive it).
   */
  dispatchIntervalMs?: number;
  /**
   * How often the loop runs its one-statement wake probe between passes, starting a pass at once
   * when an update's pushes are pending, a row is due or a lease ran out. Default 1 second, at
   * least 100 ms, at most `dispatchIntervalMs`. 0 turns the probe off (a pass every interval).
   */
  wakeIntervalMs?: number;
  /** How often idle queue workers poll, in seconds (pg-boss minimum 0.5). Default 2. */
  workPollingSeconds?: number;
  /** WhatsApp and SMS batches handled at once on this node (one message at a time each). Default 4. */
  sendConcurrency?: number;
  /** Push batches handled at once on this node. Default 4. */
  pushConcurrency?: number;
  /** Push jobs fetched per batch. Default 50. */
  pushBatchSize?: number;
  /** Pushes sent at once within one batch. Default 10. */
  pushParallel?: number;
  /** How often idle push workers poll, in seconds (pg-boss minimum 0.5). Default 0.5. */
  pushPollingSeconds?: number;
  /** Rows claimed and not finished, per lane, across all workers. See `DEFAULT_MAX_IN_FLIGHT`. */
  maxInFlight?: Partial<Record<SendLane, number>>;
  /** Rows claimed per statement. Default 500. */
  claimBatchSize?: number;
  /** How long a claim, or a sender's hold on a row, lasts. Default 5 minutes. */
  leaseMs?: number;
  /**
   * How soon the poll loop looks again while a lane is at its in-flight limit or update pushes are
   * still to be written. Default 1 second (or `dispatchIntervalMs` if that is shorter).
   */
  busyIntervalMs?: number;
  /** Run the reminder reconciliation on a schedule (every minute). Default true. */
  scheduleReminders?: boolean;
  /** Run the occurrence top-up on a schedule (daily). Default true. */
  scheduleTopUp?: boolean;
  /** Queue the morning ayah push on a schedule (daily, 06:30 Pakistan time). Default true. */
  scheduleAyah?: boolean;
  /** Purge spent sign-in codes and dead sessions on a schedule (daily, 03:00 Pakistan time). Default true. */
  scheduleAuthPurge?: boolean;
  /** How many days ahead the top-up keeps occurrences. Default 90, the API's value. */
  occurrenceHorizonDays?: number;
  webBase?: string;
  /**
   * The renderer and the file storage for `poster-render`. Left out, or with nulls, poster jobs fail
   * with `render_failed` and name the missing variables; everything else runs.
   */
  posters?: Pick<PosterRenderDeps, 'renderer' | 'storage' | 'missing'>;
  /** Poster jobs handled at once on this node. Default 2. */
  posterConcurrency?: number;
  /** First retry delay of a poster job, in seconds, doubled each time (pg-boss backoff). Default 15. */
  posterRetryDelaySeconds?: number;
}

/** Counts since the worker started, for `/healthz` and alerts. */
export interface RuntimeStats {
  /** Rows claimed and handed to a queue. */
  claimed: number;
  /** Rows whose lease ran out before they were finished (`outbox.worker_lost`), requeued or dead. */
  workerLost: number;
  /** Of those, rows that had used every attempt and went to `dead`. */
  workerLostDead: number;
  /** Queue jobs dropped because their row was already handled, taken or reclaimed. No send. */
  staleJobs: number;
  /** Rows sent, requeued, failed and dead by this node's senders. */
  sent: number;
  requeued: number;
  failed: number;
  dead: number;
  /** Updates whose push rows this node wrote, and how many rows. */
  updatePushes: number;
  updatePushRows: number;
  /** Full passes of the poll loop, and how many of them the wake probe started. */
  passes: number;
  wakeups: number;
}

export interface Runtime {
  /** One dispatcher pass now. */
  dispatchNow(): Promise<TickResult>;
  /** Writes the push rows of updates posted with `notify` (one update per call by default). */
  fanOutNow(limit?: number): Promise<UpdatePushSummary>;
  /** Counts since start. */
  stats(): RuntimeStats;
  /** One reminder reconciliation now. */
  reconcileNow(): Promise<ReconcileSummary>;
  /** One occurrence top-up now. */
  topUpNow(): Promise<TopUpSummary>;
  /** One morning ayah run now. */
  ayahNow(): Promise<AyahJobSummary>;
  /** One sign-in purge now. */
  authPurgeNow(): Promise<PurgeResult>;
  /** One poster job now, outside the queue. */
  renderPostersNow(
    job: PosterRenderJob,
    attempt?: PosterRenderAttempt,
  ): Promise<PosterRenderSummary>;
  /** Stops the loops and waits for in-flight work. Does not close the database. */
  stop(options?: { timeoutMs?: number; close?: boolean }): Promise<void>;
}

/**
 * Wires the outbox into pg-boss:
 *
 * - a poll loop writes the push rows of updates posted with `notify` (`fanOutPendingUpdatePushes`,
 *   one update per pass, migration 0011), then claims due rows (`queued` -> `sending`) and puts
 *   one job per row on `outbox-send-push` (push) or `outbox-send` (WhatsApp, SMS). It claims no
 *   more than each lane's in-flight limit (`maxInFlight`), so a burst waits as `queued` rows rather
 *   than as claims whose leases run out on the queue; while a lane is full it looks again every
 *   `busyIntervalMs`. Between passes a one-statement wake probe (`findPendingWork`, every
 *   `wakeIntervalMs`) starts the next pass as soon as there is work, so a posted update's pushes
 *   are written and sent within about a second without a full pass every second when idle;
 * - exactly-once sending does not rest on the queue: the claim is a compare-and-set, and senders
 *   take a batch's rows in one compare-and-set on the attempt and the claim's lease
 *   (`takeForSending`), renewing the lease. A duplicate or stale job is dropped there and costs no
 *   send slot; a row being sent is never reclaimed;
 * - `outbox-send-push` workers send pushes in parallel (`pushParallel` per batch, `pushConcurrency`
 *   batches); `outbox-send` workers send WhatsApp and SMS one at a time per batch, with the SEC-02
 *   cap and budget checked per message. pg-boss retries a job only when the database itself
 *   failed, since provider failures are recorded on the row with their own backoff (and a
 *   provider's retry-after is honoured);
 * - jobs that run out of retries land in `outbox-send-dead`, where they are logged; the row's lease
 *   then expires and the dispatcher recovers it;
 * - a cron job reconciles reminder rows every minute;
 * - a cron job tops up recurring sessions' occurrences once a day (00:30 Pakistan time). A missed
 *   run (the worker was down) is made up once on start; the job is idempotent, so a duplicate run
 *   adds nothing;
 * - a cron job queues the morning ayah push once a day (06:30 Pakistan time). A missed run is made
 *   up once on start, but only before noon Pakistan time; rows are idempotent per person and date;
 * - a cron job purges spent sign-in codes and expired or revoked sessions once a day (03:00 Pakistan
 *   time), and redacts any finished outbox payload still holding personal fields (SEC-06). A missed
 *   run is made up once on start; a second run deletes nothing more;
 * - `poster-render` workers render the posters the API queued (`renderPosters`): retry 3 with
 *   backoff for retryable renderer failures and for database or storage errors, expire after 120 s,
 *   then `poster-render-dead`, which fails the rows still queued so a person can regenerate.
 */
export async function startRuntime(options: RuntimeOptions): Promise<Runtime> {
  const { boss, logger } = options;
  const pollingIntervalSeconds = Math.max(0.5, options.workPollingSeconds ?? 2);

  // The dead-letter queue has to exist before a queue can point at it.
  await boss.createQueue(SEND_DEAD_QUEUE, { retentionSeconds: 30 * 24 * 3600 });
  const sendQueue = {
    deadLetter: SEND_DEAD_QUEUE,
    retryLimit: 3,
    retryDelay: 15,
    retryBackoff: true,
    retryDelayMax: 600,
    expireInSeconds: 120,
    retentionSeconds: 24 * 3600,
    deleteAfterSeconds: 24 * 3600,
  };
  await boss.createQueue(SEND_QUEUE, sendQueue);
  await boss.createQueue(PUSH_SEND_QUEUE, sendQueue);
  await boss.createQueue(RECONCILE_QUEUE, {
    retryLimit: 1,
    expireInSeconds: 120,
    retentionSeconds: 600,
    deleteAfterSeconds: 3600,
  });

  await boss.createQueue(TOP_UP_QUEUE, {
    policy: 'singleton',
    retryLimit: 3,
    retryDelay: 300,
    retryBackoff: true,
    expireInSeconds: 900,
    retentionSeconds: 2 * 24 * 3600,
    deleteAfterSeconds: 7 * 24 * 3600,
  });

  await boss.createQueue(AYAH_QUEUE, {
    policy: 'singleton',
    retryLimit: 3,
    retryDelay: 120,
    retryBackoff: true,
    expireInSeconds: 900,
    retentionSeconds: 2 * 24 * 3600,
    deleteAfterSeconds: 7 * 24 * 3600,
  });

  await boss.createQueue(AUTH_PURGE_QUEUE, {
    policy: 'singleton',
    retryLimit: 3,
    retryDelay: 300,
    retryBackoff: true,
    expireInSeconds: 900,
    retentionSeconds: 2 * 24 * 3600,
    deleteAfterSeconds: 7 * 24 * 3600,
  });

  // The worker owns the poster queue's settings. `updateQueue` applies them even when the API
  // created the queue first, so both sides can create it without disagreeing.
  await boss.createQueue(POSTER_DEAD_QUEUE, { retentionSeconds: 30 * 24 * 3600 });
  const posterQueue = {
    retryLimit: POSTER_RETRY_LIMIT,
    retryDelay: Math.max(1, options.posterRetryDelaySeconds ?? 15),
    retryBackoff: true,
    retryDelayMax: 600,
    expireInSeconds: POSTER_EXPIRE_SECONDS,
    retentionSeconds: 24 * 3600,
    deleteAfterSeconds: 7 * 24 * 3600,
  };
  await boss.createQueue(POSTER_QUEUE, { ...posterQueue, deadLetter: POSTER_DEAD_QUEUE });
  await boss.updateQueue(POSTER_QUEUE, { ...posterQueue, deadLetter: POSTER_DEAD_QUEUE });

  const stats: RuntimeStats = {
    claimed: 0,
    workerLost: 0,
    workerLostDead: 0,
    staleJobs: 0,
    sent: 0,
    requeued: 0,
    failed: 0,
    dead: 0,
    updatePushes: 0,
    updatePushRows: 0,
    passes: 0,
    wakeups: 0,
  };
  const count = (result: BatchResult): void => {
    stats.staleJobs += result.skipped;
    stats.sent += result.outcomes.sent;
    stats.requeued += result.outcomes.requeued;
    stats.failed += result.outcomes.failed;
    stats.dead += result.outcomes.dead;
  };

  const leaseMs = options.leaseMs ?? DEFAULT_LEASE_MS;
  const processor: ProcessorDeps = { leaseMs, ...options.processor };
  const queue: SendQueue = {
    async enqueue(jobs: readonly SendJob[], lane: SendLane) {
      if (jobs.length === 0) return;
      await boss.insert(
        lane === 'push' ? PUSH_SEND_QUEUE : SEND_QUEUE,
        jobs.map((data) => ({ data })),
      );
    },
  };
  const dispatcher = createDispatcher({
    db: options.db,
    queue,
    logger,
    now: options.now,
    leaseMs,
    ...(options.claimBatchSize ? { batchSize: options.claimBatchSize } : {}),
    ...(options.maxInFlight ? { maxInFlight: options.maxInFlight } : {}),
    ...(options.retry ? { retry: options.retry } : {}),
  });

  /** A batch handler: one take for the batch, then the sends; a database failure fails the batch. */
  const sendBatch =
    (parallel: number) =>
    async (jobs: Array<{ data: SendJob }>): Promise<void> => {
      const result = await processJobs(
        processor,
        jobs.map((job) => job.data),
        { parallel },
      );
      count(result);
      // A database failure. The rest of the batch was still handled; failing it makes pg-boss
      // retry, and rows already finished or taken are skipped on the retry.
      if (result.failure) throw result.failure;
    };
  await boss.work<SendJob>(
    SEND_QUEUE,
    {
      batchSize: 10,
      localConcurrency: options.sendConcurrency ?? 4,
      pollingIntervalSeconds,
      // While batches come back full, fetch the next at once instead of waiting for the poll.
      burstWhenBatchFull: true,
    },
    sendBatch(1),
  );
  await boss.work<SendJob>(
    PUSH_SEND_QUEUE,
    {
      batchSize: Math.max(1, options.pushBatchSize ?? 50),
      localConcurrency: Math.max(1, options.pushConcurrency ?? 4),
      pollingIntervalSeconds: Math.max(0.5, options.pushPollingSeconds ?? 0.5),
      burstWhenBatchFull: true,
    },
    sendBatch(Math.max(1, options.pushParallel ?? 10)),
  );
  await boss.work<SendJob>(
    SEND_DEAD_QUEUE,
    { batchSize: 10, pollingIntervalSeconds: Math.max(pollingIntervalSeconds, 5) },
    async (jobs) => {
      for (const job of jobs) {
        logger.error('outbox.job_dead', { outboxId: job.data.outboxId, attempt: job.data.attempt });
      }
    },
  );

  const reconcile = (): Promise<ReconcileSummary> =>
    reconcileReminders({
      db: options.db,
      logger,
      now: options.now,
      ...(options.webBase ? { webBase: options.webBase } : {}),
    });
  await boss.work(
    RECONCILE_QUEUE,
    { pollingIntervalSeconds: Math.max(pollingIntervalSeconds, 5) },
    async () => {
      // `reconcileReminders` logs `reminders.reconciled` itself when a run changed something;
      // logging here too printed every run twice (F-03).
      await reconcile();
    },
  );
  if (options.scheduleReminders ?? true) {
    await boss.schedule(RECONCILE_QUEUE, '* * * * *', {}, { key: 'every-minute' });
  }

  const topUp = (): Promise<TopUpSummary> =>
    runOccurrenceTopUp({
      db: options.db,
      logger,
      now: options.now,
      horizonDays: options.occurrenceHorizonDays ?? DEFAULT_OCCURRENCE_HORIZON_DAYS,
    });
  await boss.work(
    TOP_UP_QUEUE,
    { pollingIntervalSeconds: Math.max(pollingIntervalSeconds, 5) },
    async () => {
      await topUp();
    },
  );
  if (options.scheduleTopUp ?? true) {
    await boss.schedule(
      TOP_UP_QUEUE,
      TOP_UP_CRON,
      {},
      { key: 'daily', tz: TOP_UP_TIMEZONE, missed: 'once' },
    );
  }

  const ayah = (): Promise<AyahJobSummary> =>
    runMorningAyah({
      db: options.db,
      logger,
      now: options.now,
      ...(options.webBase ? { webBase: options.webBase } : {}),
    });
  await boss.work(
    AYAH_QUEUE,
    { pollingIntervalSeconds: Math.max(pollingIntervalSeconds, 5) },
    async () => {
      // `runMorningAyah` logs its one line per run.
      await ayah();
    },
  );
  if (options.scheduleAyah ?? true) {
    await boss.schedule(
      AYAH_QUEUE,
      AYAH_CRON,
      {},
      { key: 'daily', tz: AYAH_TIMEZONE, missed: 'once' },
    );
  }

  const authPurge = (): Promise<PurgeResult> =>
    runAuthPurge({ db: options.db, logger, now: options.now });
  await boss.work(
    AUTH_PURGE_QUEUE,
    { pollingIntervalSeconds: Math.max(pollingIntervalSeconds, 5) },
    async () => {
      // `runAuthPurge` logs its one counts-only line per run.
      await authPurge();
      // The same daily slot catches outbox payloads that finished without being redacted (rows
      // finished before SEC-06, or by another path): counts only.
      const redacted = await redactFinishedPayloads(options.db);
      logger.info('outbox.payloads_redacted', { rows: redacted });
    },
  );
  if (options.scheduleAuthPurge ?? true) {
    await boss.schedule(
      AUTH_PURGE_QUEUE,
      AUTH_PURGE_CRON,
      {},
      { key: 'daily', tz: AUTH_PURGE_TIMEZONE, missed: 'once' },
    );
  }

  const posterDeps: PosterRenderDeps = {
    db: options.db,
    logger,
    renderer: options.posters?.renderer ?? null,
    storage: options.posters?.storage ?? null,
    missing: options.posters?.missing ?? POSTER_ENV_NAMES,
  };
  const renderPostersNow = (
    job: PosterRenderJob,
    attempt: PosterRenderAttempt = { finalAttempt: true },
  ): Promise<PosterRenderSummary> => renderPosters(posterDeps, job, attempt);
  await boss.work(
    POSTER_QUEUE,
    {
      batchSize: 1,
      includeMetadata: true,
      localConcurrency: options.posterConcurrency ?? 2,
      pollingIntervalSeconds,
    },
    async (jobs: JobWithMetadata<unknown>[]) => {
      for (const job of jobs) {
        const parsed = PosterRenderJob.safeParse(job.data);
        if (!parsed.success) {
          // Retrying a malformed payload cannot help.
          logger.error('posters.job_invalid', { jobId: job.id });
          continue;
        }
        const summary = await renderPosters(posterDeps, parsed.data, {
          finalAttempt: job.retryCount >= job.retryLimit,
          signal: job.signal,
          attempt: job.retryCount,
        });
        if (summary.notConfigured) {
          throw new PosterRenderNotConfiguredError('poster renderer or storage not configured');
        }
        if (summary.retry) throw new PosterRenderRetryError(summary.failure ?? 'render_failed');
      }
    },
  );
  await boss.work<unknown>(
    POSTER_DEAD_QUEUE,
    { batchSize: 10, pollingIntervalSeconds: Math.max(pollingIntervalSeconds, 5) },
    async (jobs) => {
      for (const job of jobs) {
        const parsed = PosterRenderJob.safeParse(job.data);
        const failed = parsed.success
          ? await failQueuedPosters(options.db, parsed.data.posterIds)
          : 0;
        logger.error('posters.job_dead', {
          posters: parsed.success ? parsed.data.posterIds.length : 0,
          failed,
        });
      }
    },
  );

  const fanOut = async (limit = 1): Promise<UpdatePushSummary> => {
    const summary = await fanOutPendingUpdatePushes(options.db, {
      limit,
      ...(options.webBase ? { webBase: options.webBase } : {}),
    });
    if (summary.updates > 0) {
      stats.updatePushes += summary.updates;
      stats.updatePushRows += summary.rows;
      logger.info('updates.pushes_written', { updates: summary.updates, rows: summary.rows });
    }
    return summary;
  };
  const dispatch = async (): Promise<TickResult> => {
    const result = await dispatcher.tick();
    stats.claimed += result.claimed;
    stats.workerLost += result.reclaimed + result.dead;
    stats.workerLostDead += result.dead;
    return result;
  };

  // The poll loop. One pass at a time; a slow pass delays the next instead of overlapping it.
  // A pass first writes the pushes of at most one posted update, then claims what is due.
  //
  // Between passes the loop does not run the full pass (a dozen statements, two transactions) on
  // a fixed timer. Every `wakeIntervalMs` it runs one read-only probe (`findPendingWork`) and
  // starts a pass at once when an update's pushes are pending, a row is due or a lease ran out.
  // So a burst is picked up within about a second while an idle worker costs one cheap statement a
  // second. `dispatchIntervalMs` is the longest the loop goes without a full pass whatever the
  // probe says (a safety net), and the interval itself when the probe is off (`wakeIntervalMs` 0).
  const intervalMs = options.dispatchIntervalMs ?? DEFAULT_DISPATCH_INTERVAL_MS;
  const wakeMs =
    (options.wakeIntervalMs ?? DEFAULT_WAKE_INTERVAL_MS) > 0
      ? Math.min(intervalMs, Math.max(100, options.wakeIntervalMs ?? DEFAULT_WAKE_INTERVAL_MS))
      : 0;
  const busyMs = Math.min(intervalMs, Math.max(100, options.busyIntervalMs ?? 1_000));
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;
  let inFlight: Promise<unknown> = Promise.resolve();
  let lastPassAt = Date.now();
  const pass = async (): Promise<boolean> => {
    lastPassAt = Date.now();
    stats.passes++;
    let busy = false;
    try {
      busy = (await fanOut()).updates > 0;
    } catch (error) {
      logger.error('updates.push_fanout_failed', {
        error: error instanceof Error ? error.name : 'unknown',
      });
    }
    try {
      busy = (await dispatch()).saturated || busy;
    } catch (error) {
      logger.error('outbox.dispatch_failed', {
        error: error instanceof Error ? error.name : 'unknown',
      });
    }
    return busy;
  };
  /** True when a full pass should run now: the probe found work, or the safety net is due. */
  const wanted = async (): Promise<boolean> => {
    if (Date.now() - lastPassAt >= intervalMs) return true;
    try {
      const found = await findPendingWork(options.db, options.now());
      if (found.fanOut || found.due || found.stale) {
        stats.wakeups++;
        return true;
      }
      return false;
    } catch (error) {
      // The pass logs its own failures; a failed probe falls back to the pass rather than waiting.
      logger.error('outbox.wake_probe_failed', {
        error: error instanceof Error ? error.name : 'unknown',
      });
      return true;
    }
  };
  /** One turn of the loop; resolves with the delay before the next. */
  const turn = async (afterBusy: boolean): Promise<{ busy: boolean }> => {
    if (wakeMs === 0 || afterBusy || (await wanted())) return { busy: await pass() };
    return { busy: false };
  };
  const loop = (delayMs: number, afterBusy: boolean): void => {
    if (stopped || intervalMs <= 0) return;
    timer = setTimeout(() => {
      const run = turn(afterBusy);
      inFlight = run;
      void run.then(({ busy }) => {
        // After a pass with more to do, look again soon (and pass without probing); otherwise
        // probe every `wakeMs`, or pass every `intervalMs` when the probe is off.
        if (busy) loop(busyMs, true);
        else loop(wakeMs > 0 ? wakeMs : intervalMs, false);
      });
    }, delayMs);
    timer.unref();
  };
  // The first pass on start, after one wake interval (or the interval when the probe is off).
  lastPassAt = Date.now() - intervalMs;
  loop(wakeMs > 0 ? wakeMs : intervalMs, false);

  return {
    dispatchNow: dispatch,
    fanOutNow: fanOut,
    stats: () => ({ ...stats }),
    reconcileNow: reconcile,
    topUpNow: topUp,
    ayahNow: ayah,
    authPurgeNow: authPurge,
    renderPostersNow,
    async stop(stopOptions = {}) {
      stopped = true;
      if (timer) clearTimeout(timer);
      await inFlight;
      await boss.stop({
        graceful: true,
        timeout: stopOptions.timeoutMs ?? 20_000,
        close: stopOptions.close ?? false,
      });
    },
  };
}
