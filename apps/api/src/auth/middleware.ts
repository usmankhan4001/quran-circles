import { randomUUID } from 'node:crypto';
import type { Context, MiddlewareHandler } from 'hono';
import { and, eq, isNull } from 'drizzle-orm';
import {
  can,
  type ErrorCode,
  type Principal,
  type ResourceScope,
  type ScopeAction,
} from '@qc/contracts';
import { schema } from '@qc/db';
import { getAuthContext, type AuthContext } from './context';
import { errorResponse, requestIdOf } from './errors';
import { verifyAccessToken } from './tokens';
import { describeError, type AuthDeps, type AuthVariables } from './types';

type AuthEnv = { Variables: AuthVariables };

/** Why a request has no principal. `null` means no credentials were sent. */
export type AuthFailure = Extract<
  ErrorCode,
  'unauthenticated' | 'token_expired' | 'account_suspended'
>;

interface RequestAuth {
  principal: Principal | null;
  sessionId: string | null;
  failure: AuthFailure | null;
}

/**
 * Per-request outcome of `authMiddleware`. Kept off `AuthVariables` (which is the interface the
 * other lanes code against) and keyed by the Hono context.
 */
const requestAuth = new WeakMap<object, RequestAuth>();

/**
 * Why this request has no signed-in person, as `authMiddleware` worked it out: `token_expired`
 * (refresh and retry), `account_suspended` (show the suspended screen) or `unauthenticated` (sign
 * in; also when no token was sent at all, or the middleware has not run on this request).
 */
export const authFailureReason = (c: Context): AuthFailure =>
  requestAuth.get(c)?.failure ?? 'unauthenticated';

/** The session behind this request's access token, for sign-out. Null when not signed in. */
export const sessionIdOf = (c: Context): string | null => requestAuth.get(c)?.sessionId ?? null;

const BEARER = /^Bearer\s+([A-Za-z0-9._~+/-]+=*)$/i;

async function resolve(ctx: AuthContext, header: string | undefined): Promise<RequestAuth> {
  const anonymous: RequestAuth = { principal: null, sessionId: null, failure: null };
  if (header === undefined || header.trim() === '') return anonymous;
  const match = BEARER.exec(header.trim());
  if (!match?.[1]) return { ...anonymous, failure: 'unauthenticated' };

  const now = ctx.now();
  const verified = await verifyAccessToken(ctx.keys, ctx.config, match[1], now);
  if (!verified.ok) {
    return {
      ...anonymous,
      failure: verified.reason === 'expired' ? 'token_expired' : 'unauthenticated',
    };
  }

  const { authSessions, users, roleAssignments } = schema;
  const [row] = await ctx.db
    .select({
      sessionUserId: authSessions.userId,
      revokedAt: authSessions.revokedAt,
      expiresAt: authSessions.expiresAt,
      status: users.status,
    })
    .from(authSessions)
    .innerJoin(users, eq(users.id, authSessions.userId))
    .where(eq(authSessions.id, verified.sessionId))
    .limit(1);
  if (
    !row ||
    row.sessionUserId !== verified.userId ||
    row.revokedAt !== null ||
    row.expiresAt.getTime() <= now.getTime()
  ) {
    return { ...anonymous, failure: 'unauthenticated' };
  }
  if (row.status !== 'active') return { ...anonymous, failure: 'account_suspended' };

  // Read fresh on every request: a revoked assignment stops counting on the next call.
  const assignments = await ctx.db
    .select({
      role: roleAssignments.role,
      cityId: roleAssignments.cityId,
      venueId: roleAssignments.venueId,
    })
    .from(roleAssignments)
    .where(and(eq(roleAssignments.userId, verified.userId), isNull(roleAssignments.revokedAt)));

  return {
    principal: { userId: verified.userId, assignments },
    sessionId: verified.sessionId,
    failure: null,
  };
}

/**
 * Reads the bearer token and sets `c.var.principal` (null when there is no valid token). It never
 * rejects on its own, so public endpoints keep working with a stale token; `requireAction` decides.
 * Safe to run more than once on a request.
 */
export function authMiddleware(deps: AuthDeps): MiddlewareHandler<AuthEnv> {
  const ctx = getAuthContext(deps);
  return async (c, next) => {
    if (!(c.get('requestId') as string | undefined)) c.set('requestId', randomUUID());
    let state = requestAuth.get(c);
    if (!state) {
      try {
        state = await resolve(ctx, c.req.header('authorization'));
      } catch (error) {
        // Fail closed: never carry on as signed in when the check could not be made.
        ctx.logger.error('auth.principal_load_failed', describeError(error));
        return errorResponse(c, 'internal_error');
      }
      requestAuth.set(c, state);
    }
    c.set('principal', state.principal);
    await next();
  };
}

/**
 * Guards a route with an action from the scope matrix. Handlers never check roles by hand.
 * `resolveResource` says what is being acted on (its city, venue or owner); leave it out for
 * actions that are not tied to one resource.
 *
 * No principal: 401 `unauthenticated` (or `token_expired` / `account_suspended` when that is why).
 * A principal who may not: 403 `forbidden`.
 */
export function requireAction(
  action: ScopeAction,
  resolveResource?: (c: Context<AuthEnv>) => ResourceScope | Promise<ResourceScope>,
): MiddlewareHandler<AuthEnv> {
  return async (c, next) => {
    const principal = c.get('principal') ?? null;
    const resource = resolveResource ? await resolveResource(c) : {};
    if (can(principal, action, resource)) {
      await next();
      return;
    }
    if (principal === null) return errorResponse(c, authFailureReason(c));
    return errorResponse(c, 'forbidden');
  };
}

export { requestIdOf };
