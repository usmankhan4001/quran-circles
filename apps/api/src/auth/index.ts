/**
 * The auth lane's public surface. The api-core lane codes against exactly these five:
 *
 * - `authMiddleware(deps)`: sets `c.var.principal` from the bearer token.
 * - `authFailureReason(c)`: why the request has no principal (`unauthenticated`,
 *   `token_expired` or `account_suspended`).
 * - `requireAction(action, resolveResource?)`: guards a route with a scope-matrix action.
 * - `authRoutes(deps)`: the four sign-in endpoints, at their contract paths.
 * - `AuthVariables`: the Hono variables (`principal`, `requestId`).
 *
 * The rest is what start-up code needs to build `deps`.
 */
export { authFailureReason, authMiddleware, requireAction } from './middleware';
export type { AuthFailure } from './middleware';
export { authRoutes } from '../modules/auth/routes';
export type { AuthVariables, AuthDeps, AuthLogger, AuthDb } from './types';
export { consoleLogger, silentLogger } from './types';
export { createAuthConfig, loadAuthConfigFromEnv, AuthConfigError } from './config';
export type { AuthConfig, AppEnv } from './config';
export { DiscardCodeSender, FakeCodeSender } from './code-sender';
export type { CodeSender, CodeMessage } from './code-sender';
export { InMemoryRateLimiter } from './rate-limiter';
export type { RateLimiter, RateLimitResult } from './rate-limiter';
export { loadMe } from '../modules/auth/me';
export { purgeStaleAuthRows } from '../modules/auth/cleanup';
export type { PurgeResult } from '../modules/auth/cleanup';
