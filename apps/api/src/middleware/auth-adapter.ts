import type { Context, MiddlewareHandler } from 'hono';
import {
  can,
  scopeFilter,
  type ErrorCode,
  type Principal,
  type ResourceScope,
  type ScopeAction,
  type ScopeFilter,
} from '@qc/contracts';
import { fail } from '../modules/shared/errors';

/**
 * The thin seam between the API modules and sign-in. The auth-scopes lane owns token handling
 * (`apps/api/src/auth`) and supplies a middleware that sets `principal` on the context. Everything
 * here is the decision side, and it always goes through the contract's `can` and `scopeFilter`.
 * A handler never looks at a role.
 */

export interface AuthVariables {
  principal: Principal | null;
}

/** Sets `c.var.principal` from the bearer token (the auth lane's `authMiddleware(deps)`). */
export type PrincipalMiddleware = MiddlewareHandler<{ Variables: AuthVariables }>;

/**
 * Throws `unauthenticated` for no principal and `forbidden` when the matrix says no.
 * `resource` carries the city and venue of what is being acted on.
 */
export function authorize(
  principal: Principal | null,
  action: ScopeAction,
  resource: ResourceScope = {},
): void {
  if (!principal?.userId) fail('unauthenticated');
  if (!can(principal, action, resource)) fail('forbidden');
}

/**
 * For list endpoints: what the person may see for an `any` action. Throws `forbidden` when they
 * hold none of the qualifying roles.
 */
export function authorizedScope(principal: Principal | null, action: ScopeAction): ScopeFilter {
  if (!principal?.userId) fail('unauthenticated');
  if (!can(principal, action)) fail('forbidden');
  return scopeFilter(principal, action);
}

/**
 * The resource a staff action targets was not found. Someone with no qualifying role gets
 * `forbidden`, so the answer never tells an outsider whether an id exists.
 */
export function resourceMissing(principal: Principal | null, action: ScopeAction): never {
  if (!principal?.userId) fail('unauthenticated');
  const f = scopeFilter(principal, action);
  if (!f.national && f.cityIds.length === 0 && f.venueIds.length === 0) fail('forbidden');
  return fail('not_found');
}

/** The reasons a request can be refused before any rule runs. */
export type AuthFailureCode = Extract<
  ErrorCode,
  'unauthenticated' | 'token_expired' | 'account_suspended'
>;

/** Reports why the request has no principal. Only called when there is none. */
export type AuthFailureReader = (c: Context) => Promise<AuthFailureCode> | AuthFailureCode;
