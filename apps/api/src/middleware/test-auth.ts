import type { Principal } from '@qc/contracts';
import type { PrincipalMiddleware } from './auth-adapter';

/**
 * TEST ONLY. Reads the principal from the `x-test-principal` header (JSON) so API tests do not
 * depend on the sign-in lane. It refuses to run unless NODE_ENV is `test`, so it cannot be wired
 * into a real server by mistake.
 */
export const TEST_PRINCIPAL_HEADER = 'x-test-principal';

export function testPrincipalMiddleware(): PrincipalMiddleware {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('testPrincipalMiddleware is only available when NODE_ENV=test');
  }
  return async (c, next) => {
    const raw = c.req.header(TEST_PRINCIPAL_HEADER);
    let principal: Principal | null = null;
    if (raw) {
      try {
        principal = JSON.parse(raw) as Principal;
      } catch {
        principal = null;
      }
    }
    c.set('principal', principal);
    await next();
  };
}
