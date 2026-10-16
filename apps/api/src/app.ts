import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { DEFAULT_RATE_LIMITS, MemoryRateLimiter } from './middleware/rate-limit';
import { corsMiddleware } from './middleware/cors';
import { apiErrorHandler, apiNotFound, errorResponse } from './middleware/error-handler';
import { createLogger } from './middleware/logger';
import { requestId } from './middleware/request-id';
import { requestLog } from './middleware/request-log';
import { allHandlers } from './modules';
import { healthHandlers } from './modules/system/routes';
import type { ApiConfig, AppDeps, AppEnv } from './modules/shared/context';
import { registerHandlers } from './modules/shared/route';

export const defaultConfig: ApiConfig = {
  corsOrigins: [],
  trustProxy: false,
  rateLimits: DEFAULT_RATE_LIMITS,
  inviteTtlDays: 7,
  circleRequestTtlDays: 90,
  occurrenceHorizonDays: 90,
};

/** What a caller must supply. Everything else has a default. */
export type AppOptions = Pick<AppDeps, 'db' | 'principalMiddleware'> &
  Partial<Omit<AppDeps, 'db' | 'principalMiddleware' | 'config'>> & {
    config?: Partial<ApiConfig>;
  };

const maxBodyBytes = 1024 * 1024;

function baseApp(deps: Pick<AppDeps, 'logger'>): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  app.use('*', requestId());
  app.use('*', requestLog(deps.logger));
  app.onError(apiErrorHandler(deps.logger));
  app.notFound(apiNotFound);
  return app;
}

/**
 * The real API: every endpoint of the contract registry except the sign-in group, which the
 * auth-scopes lane mounts with `authRoutes(deps)` (see `index.ts`).
 */
export function createApp(options: AppOptions): Hono<AppEnv> {
  const deps: AppDeps = {
    db: options.db,
    principalMiddleware: options.principalMiddleware,
    now: options.now ?? (() => new Date()),
    logger: options.logger ?? createLogger(),
    rateLimiter: options.rateLimiter ?? new MemoryRateLimiter(),
    config: { ...defaultConfig, ...options.config },
  };
  const app = baseApp(deps);
  app.use('*', corsMiddleware(deps.config.corsOrigins));
  app.use(
    '*',
    bodyLimit({
      maxSize: maxBodyBytes,
      onError: (c) => errorResponse(c, 'validation_failed', { issues: [{ path: '', code: 'too_large' }] }),
    }),
  );
  app.use('*', deps.principalMiddleware);
  registerHandlers(app, deps, allHandlers());
  return app;
}

/**
 * A liveness-only instance: `/health` and nothing else. It needs no database, so the health test
 * and uptime probes can use it. The real server is `createApp`.
 */
export const app = (() => {
  const health = baseApp({ logger: createLogger(() => {}, 'error') });
  registerHandlers(
    health,
    {
      db: undefined as never,
      now: () => new Date(),
      logger: createLogger(() => {}, 'error'),
      rateLimiter: new MemoryRateLimiter(),
      config: defaultConfig,
      principalMiddleware: async (_c, next) => {
        await next();
      },
    },
    healthHandlers(),
  );
  return health;
})();
