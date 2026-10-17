import { drizzle } from 'drizzle-orm/node-postgres';
import { PgBoss } from 'pg-boss';
import pg from 'pg';
import { schema } from '@qc/db';
import { createConsoleLogger, createMessaging } from '@qc/messaging';
import { parseWorkerEnv } from './config';
import { startRuntime } from './runtime';
import { applyWhatsAppEvents } from './whatsapp/apply';
import { createWebhookHandler, createWebhookServer } from './whatsapp/handler';
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
    },
    logger,
    now: () => new Date(),
    dispatchIntervalMs: config.WORKER_POLL_MS,
    sendConcurrency: config.WORKER_SEND_CONCURRENCY,
    occurrenceHorizonDays: config.OCCURRENCE_HORIZON_DAYS,
    ...(config.PUBLIC_WEB_BASE ? { webBase: config.PUBLIC_WEB_BASE } : {}),
  });

  const handler = createWebhookHandler({
    appSecret: messaging.webhook.appSecret,
    verifyToken: messaging.webhook.verifyToken,
    logger,
    onEvents: (events) => applyWhatsAppEvents({ db, logger }, events),
    health: async () => ({ ok: true, details: await countByStatus(db) }),
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
