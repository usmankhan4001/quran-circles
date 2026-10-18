import cluster from 'node:cluster';
import { apiProcessesFromEnv, superviseWorkers } from './cluster';
import { createLogger } from './middleware/logger';
import {
  SharedLimitClient,
  SharedLimitStore,
  processChannel,
  sharedBucketLimiter,
  sharedSignInLimiter,
} from './middleware/shared-limits';
import type { ServerLimits } from './server';

/**
 * The server. Everything it needs comes from the environment; nothing is read from code:
 *
 * - `DATABASE_URL`: the Postgres connection string (required).
 * - `PORT`: defaults to 3000.
 * - `API_PROCESSES`: server processes in this container, 1 to 8 (default 1). Above 1 this process
 *   becomes a `node:cluster` primary that runs that many servers on the same port, keeps their
 *   shared rate limits and restarts one that dies (`cluster.ts`). Each server has its own database
 *   pool of 10 connections and its own pg-boss sender.
 * - `CORS_ORIGINS`: comma-separated origins of the apps and the console.
 * - `PUBLIC_WEB_BASE`: public https origin for links in messages, once the domain is chosen.
 * - `TRUST_PROXY=true`: behind the reverse proxy, take the caller address from `x-forwarded-for`.
 * - `APP_ENV`, `AUTH_SECRET`, `AUTH_FIXED_CODE`, `AUTH_TRUST_PROXY`: the auth lane's settings.
 * - `MESSAGING_MODE` and the provider variables: read by `@qc/messaging` (sign-in code delivery).
 * - `POSTER_STORAGE_DIR`: the folder the worker writes poster files to (the shared volume, mounted
 *   read-only here). Unset, a folder under the OS temp dir (local development only).
 *
 * Poster renders go to the worker through pg-boss on the same database (`poster-render`). The API
 * only sends: it runs no workers or schedules and never creates or changes a queue. If pg-boss does
 * not start, the API still serves and new posters come back `failed` / `render_failed`.
 */
const logger = createLogger();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

let processes: number;
try {
  processes = apiProcessesFromEnv(process.env);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'API_PROCESSES is not valid');
  process.exit(1);
}

/** One server in this process, stopped by SIGTERM or SIGINT (and by losing the primary). */
async function serveHere(url: string, limits: ServerLimits): Promise<void> {
  // Loaded here, not at the top: the cluster primary serves nothing and need not load the app.
  const { startServer } = await import('./server');
  const server = await startServer(process.env, url, logger, limits);
  const stop = (): void => {
    void server.stop().finally(() => process.exit(0));
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
  // A cluster worker whose primary is gone has no shared limits left: stop rather than serve.
  if (cluster.isWorker) process.on('disconnect', stop);
}

if (processes === 1) {
  await serveHere(databaseUrl, {});
} else if (cluster.isPrimary) {
  const store = new SharedLimitStore();
  const supervisor = superviseWorkers({
    cluster,
    processes,
    logger,
    onMessage: (worker, message) => {
      void store.handle(message).then((reply) => {
        if (reply && worker.isConnected()) worker.send(reply, undefined, () => undefined);
      });
    },
    exit: (code) => process.exit(code),
  });
  logger.info('api primary started', { processes });
  process.on('SIGTERM', () => supervisor.shutdown('SIGTERM'));
  process.on('SIGINT', () => supervisor.shutdown('SIGINT'));
} else {
  const client = new SharedLimitClient(processChannel());
  await serveHere(databaseUrl, {
    rateLimiter: sharedBucketLimiter(client),
    signInRateLimiter: sharedSignInLimiter(client),
  });
}
