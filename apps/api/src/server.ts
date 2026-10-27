import { serve } from '@hono/node-server';
import { createMessaging } from '@qc/messaging';
import { PgBoss } from 'pg-boss';
import { createApp } from './app';
import {
  authRoutes,
  consoleLogger,
  ensureFirstAdmin,
  loadAuthConfigFromEnv,
  redirectingCodeSender,
  type AuthDeps,
} from './auth';
import { createPgDb } from './db';
import { authLane } from './middleware/auth-lane';
import type { Logger } from './middleware/logger';
import type { RateLimiter } from './middleware/rate-limit';
import { posterSenderOptions, startPosterSender } from './modules/posters/sender';
import { posterStorageFromEnv } from './modules/posters/storage';

export interface ServerLimits {
  /** The contract buckets and per-staff allowances. Unset: in memory in this process. */
  rateLimiter?: RateLimiter;
  /** The sign-in limits per number, per address and for refresh. Unset: in memory here. */
  signInRateLimiter?: AuthDeps['rateLimiter'];
}

export interface RunningServer {
  /** Stops taking connections, lets requests finish, then closes messaging, pg-boss and the pool. */
  stop(): Promise<void>;
}

const list = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v !== '');

/**
 * One API server process: the database pool, the sign-in lane, the poster sender and the HTTP
 * listener. `index.ts` runs it directly (`API_PROCESSES` 1) or in each cluster worker, which passes
 * the limiters kept by the primary.
 */
export async function startServer(
  env: Record<string, string | undefined>,
  databaseUrl: string,
  logger: Logger,
  limits: ServerLimits = {},
): Promise<RunningServer> {
  const { db, close } = createPgDb(databaseUrl);
  const messaging = createMessaging(env, { logger });
  const authConfig = loadAuthConfigFromEnv(env);
  const authDeps: AuthDeps = {
    db,
    config: authConfig,
    // The first admin's codes may go to another mailbox (BOOTSTRAP_ADMIN_CODE_TO).
    codeSender: redirectingCodeSender(messaging.codeSender, authConfig.firstAdmin),
    logger: consoleLogger,
    ...(limits.signInRateLimiter ? { rateLimiter: limits.signInRateLimiter } : {}),
  };
  // A fresh database has no staff: invite the configured first admin, once.
  const firstAdmin = await ensureFirstAdmin(db, authConfig.firstAdmin, consoleLogger);
  if (firstAdmin !== 'not_configured') logger.info('first admin', { state: firstAdmin });
  const { principalMiddleware, authFailure } = authLane(authDeps);
  const posterSender = await startPosterSender(
    new PgBoss(posterSenderOptions(databaseUrl)),
    logger,
  );

  const app = createApp({
    db,
    logger,
    principalMiddleware,
    authFailure,
    ...(limits.rateLimiter ? { rateLimiter: limits.rateLimiter } : {}),
    config: {
      corsOrigins: list(env.CORS_ORIGINS),
      trustProxy: env.TRUST_PROXY === 'true',
      ...(env.PUBLIC_WEB_BASE ? { webBase: env.PUBLIC_WEB_BASE } : {}),
    },
    mount: [authRoutes(authDeps)],
    posters: { storage: posterStorageFromEnv(), queue: posterSender.queue },
  });

  const port = Number(env.PORT ?? 3000);
  const server = serve({ fetch: app.fetch, port }, (info) => {
    logger.info('api listening', { port: info.port });
  });

  let stopping: Promise<void> | null = null;
  return {
    stop: () => {
      stopping ??= new Promise<void>((resolve) => {
        server.close(() => {
          messaging.close();
          void posterSender
            .stop()
            .then(() => close())
            .catch(() => undefined)
            .finally(resolve);
        });
      });
      return stopping;
    },
  };
}
