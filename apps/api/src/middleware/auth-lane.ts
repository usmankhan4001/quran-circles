import type { Context } from 'hono';
import { authFailureReason, authMiddleware, type AuthDeps } from '../auth';
import type { AuthFailureCode, AuthFailureReader, PrincipalMiddleware } from './auth-adapter';

/**
 * Connects the auth lane to the API: the middleware that sets the principal, and the reader for
 * why a request has none (an expired token must read as `token_expired` so the app refreshes
 * instead of signing out). Both come from the auth lane's public surface.
 */
export function authLane(deps: AuthDeps): {
  principalMiddleware: PrincipalMiddleware;
  authFailure: AuthFailureReader;
} {
  return {
    principalMiddleware: authMiddleware(deps) as unknown as PrincipalMiddleware,
    authFailure: (c: Context): AuthFailureCode => authFailureReason(c),
  };
}
