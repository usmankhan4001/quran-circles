import type { Context } from 'hono';
import { getConnInfo } from '@hono/node-server/conninfo';
import type { AuthConfig } from './config';
import type { CodeSender } from './code-sender';
import { deriveKeys, type AuthKeys } from './crypto';
import { InMemoryRateLimiter, type RateLimiter } from './rate-limiter';
import { silentLogger, type AuthDb, type AuthDeps, type AuthLogger } from './types';

/** The dependencies with defaults filled in and keys derived. Built once per `AuthDeps`. */
export interface AuthContext {
  db: AuthDb;
  config: AuthConfig;
  keys: AuthKeys;
  codeSender: CodeSender;
  rateLimiter: RateLimiter;
  logger: AuthLogger;
  now: () => Date;
  clientIp: (c: Context) => string | null;
}

/**
 * The caller's address. Behind our reverse proxy (`trustProxy`) it is the last `X-Forwarded-For`
 * entry, which the proxy appended; earlier entries can be forged by the caller. Otherwise it is
 * the socket address. Used only for rate limits, and only as a hash.
 */
export const defaultClientIp =
  (trustProxy: boolean) =>
  (c: Context): string | null => {
    if (trustProxy) {
      const forwarded = c.req.header('x-forwarded-for');
      if (forwarded) {
        const last = forwarded
          .split(',')
          .map((part) => part.trim())
          .filter(Boolean)
          .pop();
        if (last) return last;
      }
    }
    try {
      return getConnInfo(c).remote.address ?? null;
    } catch {
      return null;
    }
  };

const cache = new WeakMap<AuthDeps, AuthContext>();

export function getAuthContext(deps: AuthDeps): AuthContext {
  const existing = cache.get(deps);
  if (existing) return existing;
  const context: AuthContext = {
    db: deps.db,
    config: deps.config,
    keys: deriveKeys(deps.config.secret),
    codeSender: deps.codeSender,
    rateLimiter: deps.rateLimiter ?? new InMemoryRateLimiter(),
    logger: deps.logger ?? silentLogger,
    now: deps.now ?? (() => new Date()),
    clientIp: deps.clientIp ?? defaultClientIp(deps.config.trustProxy),
  };
  cache.set(deps, context);
  return context;
}
