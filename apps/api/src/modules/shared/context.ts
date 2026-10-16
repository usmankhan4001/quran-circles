import type { Db } from '../../db';
import type { Logger } from '../../middleware/logger';
import type { RateLimiter, RateLimitRule } from '../../middleware/rate-limit';
import type { AuthVariables, PrincipalMiddleware } from '../../middleware/auth-adapter';
import type { RateLimitBucket } from '@qc/contracts';

export interface AppEnv {
  Variables: AuthVariables & { requestId: string };
}

export interface ApiConfig {
  /** Origins the browser apps and the console are served from. */
  corsOrigins: readonly string[];
  /** Public https origin for links in messages, once the domain is chosen. */
  webBase?: string;
  /** Trust `x-forwarded-for` for the caller address (true behind the reverse proxy). */
  trustProxy: boolean;
  rateLimits: Record<RateLimitBucket, RateLimitRule>;
  /** Days a coordinator invite stays valid. */
  inviteTtlDays: number;
  /** Days a "circle near me" request stays active. */
  circleRequestTtlDays: number;
  /** How far ahead occurrences of a recurring session are created. */
  occurrenceHorizonDays: number;
}

export interface AppDeps {
  db: Db;
  now: () => Date;
  config: ApiConfig;
  logger: Logger;
  rateLimiter: RateLimiter;
  /** Sets the principal from the bearer token. Supplied by the auth lane (tests use a stand-in). */
  principalMiddleware: PrincipalMiddleware;
}

/** What the modules that post updates and queue messages need from the request. */
export const messagingDepsOf = (deps: AppDeps, now: Date) => ({
  now,
  webBase: deps.config.webBase,
  horizonDays: deps.config.occurrenceHorizonDays,
});
