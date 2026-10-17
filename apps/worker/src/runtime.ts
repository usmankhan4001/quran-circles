import type { JobWithMetadata, PgBoss } from 'pg-boss';
import { POSTER_RENDER_QUEUE, PosterRenderJob } from '@qc/contracts';
import { DEFAULT_OCCURRENCE_HORIZON_DAYS, type PurgeResult, type TopUpSummary } from '@qc/db';
import type { Logger, RetryPolicy } from '@qc/messaging';
import { POSTER_ENV_NAMES } from './config';
import type { Clock, Db } from './db';
import { createDispatcher, type SendJob, type SendQueue } from './outbox/dispatcher';
import { processJob, type ProcessorDeps } from './outbox/processor';
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

export const SEND_QUEUE = 'outbox-send';
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
  /** How often to look for due outbox rows. Default 5 seconds. 0 turns the loop off (tests drive it). */
  dispatchIntervalMs?: number;
  /** How often idle queue workers poll, in seconds (pg-boss minimum 0.5). Default 2. */
  workPollingSeconds?: number;
  /** Send jobs handled at once on this node. Default 4. */
  sendConcurrency?: number;
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

export interface Runtime {
  /** One dispatcher pass now. */
  dispatchNow(): Promise<{ claimed: number; reclaimed: number; dead: number }>;
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
 * - a poll loop claims due rows (`queued` -> `sending`) and puts one `outbox-send` job on the queue
 *   per row. Exactly-once sending does not rest on the queue: the claim is a compare-and-set and
 *   `processJob` ignores a job whose attempt no longer matches the row, so a duplicate job is a no-op;
 * - `outbox-send` workers send; pg-boss retries a job only when the database itself failed, since
 *   provider failures are recorded on the row with their own backoff;
 * - jobs that run out of retries land in `outbox-send-dead`, where they are logged; the row's lease
 *   then expires and the dispatcher recovers it;
 * - a cron job reconciles reminder rows every minute;
 * - a cron job tops up recurring sessions' occurrences once a day (00:30 Pakistan time). A missed
 *   run (the worker was down) is made up once on start; the job is idempotent, so a duplicate run
 *   adds nothing;
 * - a cron job queues the morning ayah push once a day (06:30 Pakistan time). A missed run is made
 *   up once on start, but only before noon Pakistan time; rows are idempotent per person and date;
 * - a cron job purges spent sign-in codes and expired or revoked sessions once a day (03:00 Pakistan
 *   time). A missed run is made up once on start; a second run deletes nothing more;
 * - `poster-render` workers render the posters the API queued (`renderPosters`): retry 3 with
 *   backoff for retryable renderer failures and for database or storage errors, expire after 120 s,
 *   then `poster-render-dead`, which fails the rows still queued so a person can regenerate.
 */
export async function startRuntime(options: RuntimeOptions): Promise<Runtime> {
  const { boss, logger } = options;
  const pollingIntervalSeconds = Math.max(0.5, options.workPollingSeconds ?? 2);

  // The dead-letter queue has to exist before a queue can point at it.
  await boss.createQueue(SEND_DEAD_QUEUE, { retentionSeconds: 30 * 24 * 3600 });
  await boss.createQueue(SEND_QUEUE, {
    deadLetter: SEND_DEAD_QUEUE,
    retryLimit: 3,
    retryDelay: 15,
    retryBackoff: true,
    retryDelayMax: 600,
    expireInSeconds: 120,
    retentionSeconds: 24 * 3600,
    deleteAfterSeconds: 24 * 3600,
  });
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

  const queue: SendQueue = {
    async enqueue(job: SendJob) {
      await boss.send(SEND_QUEUE, job);
    },
  };
  const dispatcher = createDispatcher({
    db: options.db,
    queue,
    logger,
    now: options.now,
    ...(options.retry ? { retry: options.retry } : {}),
  });

  await boss.work<SendJob>(
    SEND_QUEUE,
    { batchSize: 10, localConcurrency: options.sendConcurrency ?? 4, pollingIntervalSeconds },
    async (jobs) => {
      let failure: unknown;
      for (const job of jobs) {
        try {
          await processJob(options.processor, job.data);
        } catch (error) {
          // A database failure. Keep going with the rest, then fail the batch so pg-boss retries it;
          // finished rows are skipped on the retry because their status has moved on.
          failure ??= error;
          logger.error('outbox.job_failed', {
            error: error instanceof Error ? error.name : 'unknown',
          });
        }
      }
      if (failure) throw failure;
    },
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

  // The poll loop. One pass at a time; a slow pass delays the next instead of overlapping it.
  const intervalMs = options.dispatchIntervalMs ?? 5_000;
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;
  let inFlight: Promise<unknown> = Promise.resolve();
  const loop = (): void => {
    if (stopped || intervalMs <= 0) return;
    timer = setTimeout(() => {
      inFlight = dispatcher
        .tick()
        .catch((error: unknown) => {
          logger.error('outbox.dispatch_failed', {
            error: error instanceof Error ? error.name : 'unknown',
          });
        })
        .finally(loop);
    }, intervalMs);
    timer.unref();
  };
  loop();

  return {
    dispatchNow: () => dispatcher.tick(),
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
