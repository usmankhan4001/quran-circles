import type { Context, ErrorHandler, NotFoundHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';
import { ERROR_CODES, makeApiError, type ErrorCode } from '@qc/contracts';
import { ApiException } from '../modules/shared/errors';
import type { AppEnv } from '../modules/shared/context';
import type { Logger } from './logger';

const requestIdOf = (c: Context<AppEnv>): string => c.get('requestId') ?? 'unknown';

export function errorResponse(
  c: Context<AppEnv>,
  code: ErrorCode,
  extra: Parameters<typeof makeApiError>[2] = {},
): Response {
  const headers: Record<string, string> = {};
  if (extra.retryAfterSeconds) headers['retry-after'] = String(extra.retryAfterSeconds);
  return c.json(makeApiError(code, requestIdOf(c), extra), ERROR_CODES[code], headers);
}

/** Only the kind of database error is logged. Its message can hold the values that clashed. */
function safeErrorFields(error: unknown): Record<string, unknown> {
  const e = error as { name?: string; code?: unknown; constraint?: unknown; cause?: unknown };
  const cause = e.cause as { code?: unknown; constraint?: unknown } | undefined;
  return {
    errorName: e.name ?? 'Error',
    errorCode: typeof e.code === 'string' ? e.code : (cause?.code as string | undefined),
    constraint:
      typeof e.constraint === 'string' ? e.constraint : (cause?.constraint as string | undefined),
  };
}

export const apiErrorHandler =
  (logger: Logger): ErrorHandler<AppEnv> =>
  (error, c) => {
    if (error instanceof ApiException) return errorResponse(c, error.code, error.extra);
    if (error instanceof ZodError) {
      return errorResponse(c, 'validation_failed', {
        issues: error.issues.slice(0, 20).map((i) => ({ path: i.path.join('.'), code: i.code })),
      });
    }
    if (error instanceof HTTPException) {
      if (error.status === 413) {
        return errorResponse(c, 'validation_failed', {
          issues: [{ path: '', code: 'too_large' }],
        });
      }
      if (error.status === 400) {
        return errorResponse(c, 'validation_failed', {
          issues: [{ path: '', code: 'invalid_request' }],
        });
      }
      if (error.status === 401) return errorResponse(c, 'unauthenticated');
      if (error.status === 403) return errorResponse(c, 'forbidden');
      if (error.status === 404) return errorResponse(c, 'not_found');
    }
    logger.error('unhandled error', { requestId: requestIdOf(c), ...safeErrorFields(error) });
    return errorResponse(c, 'internal_error');
  };

export const apiNotFound: NotFoundHandler<AppEnv> = (c) => errorResponse(c, 'not_found');
