import { serve } from '@hono/node-server';
import { createMessaging } from '@qc/messaging';
import { createApp } from './app';
import { authRoutes, consoleLogger, loadAuthConfigFromEnv } from './auth';
import { createPgDb } from './db';
import { authLane } from './middleware/auth-lane';
import { createLogger } from './middleware/logger';

/**
 * The server. Everything it needs comes from the environment; nothing is read from code:
 *
 * - `DATABASE_URL`: the Postgres connection string (required).
 * - `PORT`: defaults to 3000.
 * - `CORS_ORIGINS`: comma-separated origins of the apps and the console.
 * - `PUBLIC_WEB_BASE`: public https origin for links in messages, once the domain is chosen.
 * - `TRUST_PROXY=true`: behind the reverse proxy, take the caller address from `x-forwarded-for`.
 * - `APP_ENV`, `AUTH_SECRET`, `AUTH_FIXED_CODE`, `AUTH_TRUST_PROXY`: the auth lane's settings.
 * - `MESSAGING_MODE` and the provider variables: read by `@qc/messaging` (sign-in code delivery).
 */
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const list = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v !== '');

const logger = createLogger();
const { db, close } = createPgDb(databaseUrl);
const messaging = createMessaging(process.env);
const authDeps = {
  db,
  config: loadAuthConfigFromEnv(),
  codeSender: messaging.codeSender,
  logger: consoleLogger,
};
const { principalMiddleware, authFailure } = authLane(authDeps);

const app = createApp({
  db,
  logger,
  principalMiddleware,
  authFailure,
  config: {
    corsOrigins: list(process.env.CORS_ORIGINS),
    trustProxy: process.env.TRUST_PROXY === 'true',
    ...(process.env.PUBLIC_WEB_BASE ? { webBase: process.env.PUBLIC_WEB_BASE } : {}),
  },
  mount: [authRoutes(authDeps)],
});

const port = Number(process.env.PORT ?? 3000);
const server = serve({ fetch: app.fetch, port }, (info) => {
  logger.info('api listening', { port: info.port });
});

const shutdown = (): void => {
  server.close(() => {
    messaging.close();
    void close().finally(() => process.exit(0));
  });
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
