import { drizzle } from 'drizzle-orm/node-postgres';
import { PgBoss } from 'pg-boss';
import pg from 'pg';
import { countPendingUpdatePushes, schema } from '@qc/db';
import { createConsoleLogger, createMessaging } from '@qc/messaging';
import { missingPosterEnv, parseWorkerEnv } from './config';
import { LocalDiskPosterStorage } from './posters/storage';
import { startRuntime } from './runtime';
import { applyWhatsAppEvents } from './whatsapp/apply';
import { createWebhookHandler, createWebhookServer } from './whatsapp/handler';
import { createWhatsAppLimits } from './outbox/limits';
import { countByStatus } from './outbox/repo';

/**
 * The worker process: sends the outbox through pg-boss, keeps reminders in step with the schedule,
 * tops up session occurrences daily, queues the morning ayah, purges spent sign-in codes and dead
 * sessions daily, and serves the WhatsApp webhook and `/healthz`.
 */
export async function main(env: Record<string, string | undefined> = process.env): Promise<void> {
  const logger = createConsoleLogger();
  const config = parseWorkerEnv(env);

  // Refuses to start with fake providers or test-mode codes when APP_ENV=production.
  const messaging = createMessaging(env, { logger });
  logger.info('worker.starting', { mode: messaging.mode });

  const pool = new pg.Pool({ connectionString: config.DATABASE_URL, max: 10 });
  pool.on('error', (error) => logger.error('worker.pool_error', { error: error.name }));
  const db = drizzle(pool, { schema });
  const boss = new PgBoss({ connectionString: config.DATABASE_URL, max: 5 });
  boss.on('error', (error) => logger.error('worker.boss_error', { error: error.name }));
  await boss.start();

  // Posters are optional: without the renderer or storage the worker runs and poster jobs fail
  // with a log line naming the missing variables.
  const missingPoster = missingPosterEnv(config);
  if (missingPoster.length > 0) {
    logger.warn('posters.not_configured', { missing: missingPoster.join(',') });
  }
  const posters = {
    renderer:
      config.RENDERER_URL && config.RENDERER_TOKEN
        ? {
            url: config.RENDERER_URL,
            token: config.RENDERER_TOKEN,
            timeoutMs: config.RENDERER_TIMEOUT_MS,
          }
        : null,
    storage: config.POSTER_STORAGE_DIR
      ? new LocalDiskPosterStorage(config.POSTER_STORAGE_DIR)
      : null,
    missing: missingPoster,
  };

  // SEC-02: the per-person daily cap and the city budgets, read per message from the settings
  // table with the environment's values as defaults (`./outbox/limits` lists them).
  const whatsappLimits = createWhatsAppLimits(
    { db, logger, now: () => new Date() },
    {
      dailyCap: config.WHATSAPP_DAILY_CAP,
      cityMonthlyBudget: config.WHATSAPP_CITY_MONTHLY_BUDGET,
      budgetAlertPercent: config.WHATSAPP_BUDGET_ALERT_PERCENT,
    },
  );

  const runtime = await startRuntime({
    db,
    boss,
    processor: {
      db,
      push: messaging.push,
      whatsapp: messaging.whatsapp,
      sms: messaging.sms,
      logger,
      now: () => new Date(),
      limits: whatsappLimits.limits,
      afterSend: whatsappLimits.afterSend,
    },
    logger,
    now: () => new Date(),
    dispatchIntervalMs: config.WORKER_POLL_MS,
    sendConcurrency: config.WORKER_SEND_CONCURRENCY,
    pushConcurrency: config.WORKER_PUSH_CONCURRENCY,
    pushBatchSize: config.WORKER_PUSH_BATCH_SIZE,
    pushParallel: config.WORKER_PUSH_PARALLEL,
    pushPollingSeconds: config.WORKER_PUSH_POLL_MS / 1000,
    maxInFlight: {
      push: config.WORKER_PUSH_MAX_IN_FLIGHT,
      message: config.WORKER_MESSAGE_MAX_IN_FLIGHT,
    },
    leaseMs: config.WORKER_LEASE_MS,
    busyIntervalMs: config.WORKER_BUSY_POLL_MS,
    occurrenceHorizonDays: config.OCCURRENCE_HORIZON_DAYS,
    posters,
    posterConcurrency: config.WORKER_POSTER_CONCURRENCY,
    ...(config.PUBLIC_WEB_BASE ? { webBase: config.PUBLIC_WEB_BASE } : {}),
  });

  const handler = createWebhookHandler({
    appSecret: messaging.webhook.appSecret,
    verifyToken: messaging.webhook.verifyToken,
    logger,
    onEvents: (events) => applyWhatsAppEvents({ db, logger }, events),
    // `details` stays the outbox counts by status (the load test reads it); `metrics` holds the
    // counters since start, `workerLost` above 0 meaning leases ran out (see `outbox.worker_lost`).
    health: async () => ({
      ok: true,
      details: await countByStatus(db),
      metrics: { ...runtime.stats(), updatePushesPending: await countPendingUpdatePushes(db) },
    }),
  });
  const server = createWebhookServer(handler, logger);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.WORKER_HTTP_PORT, resolve);
  });
  logger.info('worker.ready', { port: config.WORKER_HTTP_PORT });

  let stopping = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (stopping) return;
    stopping = true;
    logger.info('worker.stopping', { signal });
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await runtime.stop({ timeoutMs: 20_000, close: true });
    messaging.close();
    await pool.end();
    logger.info('worker.stopped');
  };
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.once(signal, () => {
      shutdown(signal).then(
        () => process.exit(0),
        (error: unknown) => {
          logger.error('worker.shutdown_failed', {
            error: error instanceof Error ? error.name : 'unknown',
          });
          process.exit(1);
        },
      );
    });
  }
}

main().catch((error: unknown) => {
  // The message names variables, never values.
  console.error(
    error instanceof Error ? `${error.name}: ${error.message}` : 'worker failed to start',
  );
  process.exit(1);
});
