import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { errorStatus, makeApiError, type ErrorCode } from '@qc/contracts';

/** Thrown inside the auth lane; turned into a contract error body at the edge. */
export class AuthHttpError extends Error {
  override name = 'AuthHttpError';
  constructor(
    readonly code: ErrorCode,
    readonly retryAfterSeconds?: number,
    readonly issues?: { path: string; code: string }[],
  ) {
    super(code);
  }
}

export const rateLimited = (retryAfterSeconds: number) =>
  new AuthHttpError('rate_limited', Math.max(1, Math.ceil(retryAfterSeconds)));

export function requestIdOf(c: Context): string {
  const value = (c as Context<{ Variables: { requestId?: string } }>).get('requestId');
  return typeof value === 'string' && value !== '' ? value : 'unknown';
}

/** A contract error response: `{ error: { code, messageKey, requestId, ... } }`. */
export function errorResponse(
  c: Context,
  code: ErrorCode,
  extra: { retryAfterSeconds?: number; issues?: { path: string; code: string }[] } = {},
): Response {
  const body = makeApiError(code, requestIdOf(c), {
    ...(extra.retryAfterSeconds === undefined
      ? {}
      : { retryAfterSeconds: Math.max(1, Math.ceil(extra.retryAfterSeconds)) }),
    ...(extra.issues === undefined ? {} : { issues: extra.issues }),
  });
  if (extra.retryAfterSeconds !== undefined) {
    c.header('Retry-After', String(body.error.retryAfterSeconds));
  }
  return c.json(body, errorStatus(code) as ContentfulStatusCode);
}
