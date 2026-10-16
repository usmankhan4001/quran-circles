import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../modules/shared/context';
import type { Logger } from './logger';

/**
 * One structured line per request: method, route pattern, status, duration, request id and the
 * pseudonymous user id. Never the URL (it can hold search text), headers, query or body.
 */
export const requestLog =
  (logger: Logger): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    const started = Date.now();
    await next();
    const status = c.res.status;
    const fields = {
      requestId: c.get('requestId'),
      method: c.req.method,
      route: c.req.routePath === '/*' ? 'unmatched' : c.req.routePath,
      status,
      durationMs: Date.now() - started,
      userId: c.get('principal')?.userId ?? null,
    };
    if (status >= 500) logger.error('request', fields);
    else logger.info('request', fields);
  };
