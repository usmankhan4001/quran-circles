import { Hono, type Context } from 'hono';
import type { z } from 'zod';
import {
  RefreshBody,
  RequestCodeBody,
  RequestCodeResponse,
  SignInResponse,
  Tokens,
  VerifyCodeBody,
  endpoints,
  issuesFromZod,
} from '@qc/contracts';
import { getAuthContext, type AuthContext } from '../../auth/context';
import { hashIdentifier } from '../../auth/crypto';
import { AuthHttpError, errorResponse, rateLimited } from '../../auth/errors';
import { authMiddleware, requireAction, sessionIdOf } from '../../auth/middleware';
import { describeError, type AuthDeps, type AuthVariables } from '../../auth/types';
import { randomUUID } from 'node:crypto';
import { verifyCode } from './sign-in';
import { requestCode } from './otp';
import { refreshTokens, signOut } from './sessions';

/** Sign-in bodies are a few hundred bytes; refuse anything much larger before parsing it. */
const MAX_BODY_BYTES = 4096;

type AuthEnv = { Variables: AuthVariables };

/** Reads and validates a JSON body with a contract schema. Error bodies name fields, never values. */
async function readBody<S extends z.ZodType>(c: Context<AuthEnv>, schema: S): Promise<z.output<S>> {
  let raw: unknown;
  try {
    const text = await c.req.text();
    if (text.length > MAX_BODY_BYTES) throw new AuthHttpError('validation_failed');
    raw = JSON.parse(text);
  } catch (error) {
    if (error instanceof AuthHttpError) throw error;
    throw new AuthHttpError('validation_failed');
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    // The contract's own issue codes, for example `phone_not_pakistan_mobile` (SEC-04).
    throw new AuthHttpError('validation_failed', undefined, issuesFromZod(parsed.error));
  }
  return parsed.data;
}

/** Checks the response against the contract before it leaves, so a drifting shape fails loudly. */
const checked = <S extends z.ZodType>(schema: S, value: unknown): z.output<S> =>
  schema.parse(value);

function toErrorResponse(ctx: AuthContext, c: Context, error: unknown): Response {
  if (error instanceof AuthHttpError) {
    return errorResponse(c, error.code, {
      ...(error.retryAfterSeconds === undefined
        ? {}
        : { retryAfterSeconds: error.retryAfterSeconds }),
      ...(error.issues === undefined ? {} : { issues: error.issues }),
    });
  }
  ctx.logger.error('auth.unexpected_error', describeError(error));
  return errorResponse(c, 'internal_error');
}

/**
 * The four sign-in endpoints, served at the contract's own paths (`/v1/auth/code`, `/v1/auth/verify`,
 * `/v1/auth/refresh`, `/v1/auth/sign-out`). Mount it at the root: `app.route('/', authRoutes(deps))`.
 */
export function authRoutes(deps: AuthDeps): Hono<AuthEnv> {
  const ctx = getAuthContext(deps);
  const app = new Hono<AuthEnv>();

  app.use('*', async (c, next) => {
    if (!(c.get('requestId') as string | undefined)) c.set('requestId', randomUUID());
    await next();
  });
  app.onError((error, c) => toErrorResponse(ctx, c, error));

  app.post(endpoints['auth.requestCode'].path, async (c) => {
    const body = await readBody(c, RequestCodeBody);
    const result = await requestCode(ctx, body, ctx.clientIp(c));
    return c.json(
      checked(RequestCodeResponse, result),
      endpoints['auth.requestCode'].success.status,
    );
  });

  app.post(endpoints['auth.verifyCode'].path, async (c) => {
    const body = await readBody(c, VerifyCodeBody);
    const result = await verifyCode(ctx, body, ctx.clientIp(c));
    return c.json(checked(SignInResponse, result), endpoints['auth.verifyCode'].success.status);
  });

  app.post(endpoints['auth.refresh'].path, async (c) => {
    // SEC-07: each refresh costs a database read, so it is throttled per address before parsing.
    const ipHash = hashIdentifier(ctx.keys, 'ip', ctx.clientIp(c) ?? 'unknown');
    const limit = await ctx.rateLimiter.hit(
      `refresh:ip:${ipHash}`,
      ctx.config.rateLimits.refreshPerIp,
      ctx.now(),
    );
    if (!limit.allowed) throw rateLimited(limit.retryAfterSeconds);
    const body = await readBody(c, RefreshBody);
    const result = await refreshTokens(ctx, body);
    return c.json(checked(Tokens, result), endpoints['auth.refresh'].success.status);
  });

  app.post(
    endpoints['auth.signOut'].path,
    authMiddleware(deps),
    requireAction('auth.sign_out'),
    async (c) => {
      const principal = c.get('principal');
      const sessionId = sessionIdOf(c);
      if (!principal?.userId || !sessionId) throw new AuthHttpError('unauthenticated');
      await signOut(ctx, sessionId, principal.userId);
      return c.body(null, endpoints['auth.signOut'].success.status);
    },
  );

  return app;
}
