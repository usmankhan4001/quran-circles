import type { Context } from 'hono';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type { Principal } from '@qc/contracts';
import type { schema } from '@qc/db';
import type { AuthConfig } from './config';
import type { CodeSender } from './code-sender';
import type { RateLimiter } from './rate-limiter';

/** Hono variables the auth lane sets. The api-core lane adds `requestId` before this runs. */
export type AuthVariables = { principal: Principal | null; requestId: string };

/** Any Drizzle Postgres database over the shared schema: node-postgres in production, PGlite in tests. */
export type AuthDb = PgDatabase<PgQueryResultHKT, typeof schema>;

export type LogFields = Record<string, string | number | boolean | null | undefined>;

/**
 * Structured logging for the auth lane. Callers pass ids, counts and codes only. Phone numbers,
 * sign-in codes, tokens and names are never passed, and raw error messages are never logged
 * (database errors can quote the values that failed).
 */
export interface AuthLogger {
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  error(event: string, fields?: LogFields): void;
}

export const silentLogger: AuthLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
};

/** One JSON line per event on stdout. */
export const consoleLogger: AuthLogger = {
  info: (event, fields) => console.log(JSON.stringify({ level: 'info', event, ...fields })),
  warn: (event, fields) => console.warn(JSON.stringify({ level: 'warn', event, ...fields })),
  error: (event, fields) => console.error(JSON.stringify({ level: 'error', event, ...fields })),
};

/** What the lane needs from the rest of the API. Built once at start-up. */
export interface AuthDeps {
  db: AuthDb;
  config: AuthConfig;
  /** Delivers sign-in codes. The messaging lane supplies the real one. */
  codeSender: CodeSender;
  /** Defaults to an in-memory limiter. */
  rateLimiter?: RateLimiter;
  logger?: AuthLogger;
  /** Defaults to the system clock. Tests pass a fake. */
  now?: () => Date;
  /** The caller's network address, for rate limits. Defaults to `defaultClientIp(config.trustProxy)`. */
  clientIp?: (c: Context) => string | null;
}

/** Safe description of an unexpected error: its type and database code, never its message. */
export function describeError(error: unknown): LogFields {
  const out: LogFields = { errorName: error instanceof Error ? error.name : typeof error };
  let current: unknown = error;
  for (let depth = 0; depth < 4 && typeof current === 'object' && current !== null; depth++) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === 'string' && /^[0-9A-Za-z_]{1,12}$/.test(code)) {
      out.errorCode = code;
      break;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return out;
}
