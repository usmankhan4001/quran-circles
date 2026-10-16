import type { Context } from 'hono';
import { authMiddleware, requireAction, type AuthDeps } from '../auth';
import type { AuthFailureCode, AuthFailureReader, PrincipalMiddleware } from './auth-adapter';

const FAILURES: readonly AuthFailureCode[] = [
  'unauthenticated',
  'token_expired',
  'account_suspended',
];

/**
 * Connects the auth lane to the API: the middleware that sets the principal, and a reader for why a
 * request has none. The auth lane records that reason per request (an expired token must read as
 * `token_expired` so the app refreshes instead of signing out); its public surface exposes it only
 * through `requireAction`, so the reader asks the guard and reads the code off its refusal.
 * See change request 2026-10-16-auth-failure-reason.
 */
export function authLane(deps: AuthDeps): {
  principalMiddleware: PrincipalMiddleware;
  authFailure: AuthFailureReader;
} {
  const guard = requireAction('me.read');
  return {
    principalMiddleware: authMiddleware(deps) as unknown as PrincipalMiddleware,
    async authFailure(c: Context): Promise<AuthFailureCode> {
      const refusal = await guard(c as Parameters<typeof guard>[0], async () => {});
      if (!(refusal instanceof Response)) return 'unauthenticated';
      try {
        const body = (await refusal.clone().json()) as { error?: { code?: string } };
        const code = FAILURES.find((f) => f === body.error?.code);
        return code ?? 'unauthenticated';
      } catch {
        return 'unauthenticated';
      }
    },
  };
}
