import { randomUUID } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import type { Tokens } from '@qc/contracts';
import { schema } from '@qc/db';
import type { AuthContext } from '../../auth/context';
import {
  hashRefreshToken,
  newRefreshToken,
  parseRefreshToken,
  safeEqualHex,
} from '../../auth/crypto';
import { AuthHttpError } from '../../auth/errors';
import { signAccessToken } from '../../auth/tokens';
import type { AuthDb } from '../../auth/types';
import type { RefreshInput } from './types';

const { authSessions, users } = schema;

/** A transaction or the database: anything that can run the queries below. */
type Executor = Pick<AuthDb, 'insert' | 'update' | 'select'>;

const addSeconds = (date: Date, seconds: number) => new Date(date.getTime() + seconds * 1000);

/** When a session's refresh token runs out if used at `now`: sliding, but never past the cap. */
const refreshExpiry = (ctx: AuthContext, createdAt: Date, now: Date): Date => {
  const sliding = addSeconds(now, ctx.config.refreshTokenTtlSeconds);
  const cap = addSeconds(createdAt, ctx.config.sessionMaxAgeSeconds);
  return sliding.getTime() < cap.getTime() ? sliding : cap;
};

const tokensFor = async (
  ctx: AuthContext,
  claims: { userId: string; sessionId: string },
  refreshToken: string,
  refreshExpiresAt: Date,
  now: Date,
): Promise<Tokens> => {
  const access = await signAccessToken(ctx.keys, ctx.config, claims, now);
  return {
    accessToken: access.token,
    accessTokenExpiresAt: access.expiresAt.toISOString(),
    refreshToken,
    refreshTokenExpiresAt: refreshExpiresAt.toISOString(),
  };
};

/** A new sign-in. Runs inside the caller's transaction; the access token is signed afterwards. */
export async function createSession(
  ctx: AuthContext,
  tx: Executor,
  input: { userId: string; deviceLabel: string | undefined; now: Date },
): Promise<{ sessionId: string; refreshToken: string; refreshExpiresAt: Date }> {
  const sessionId = randomUUID();
  const refreshToken = newRefreshToken(sessionId);
  const refreshExpiresAt = refreshExpiry(ctx, input.now, input.now);
  await tx.insert(authSessions).values({
    id: sessionId,
    userId: input.userId,
    refreshTokenHash: hashRefreshToken(refreshToken),
    deviceLabel: input.deviceLabel?.trim() || null,
    createdAt: input.now,
    expiresAt: refreshExpiresAt,
    lastUsedAt: input.now,
  });
  return { sessionId, refreshToken, refreshExpiresAt };
}

export const issueTokens = (
  ctx: AuthContext,
  session: { sessionId: string; refreshToken: string; refreshExpiresAt: Date },
  userId: string,
  now: Date,
): Promise<Tokens> =>
  tokensFor(
    ctx,
    { userId, sessionId: session.sessionId },
    session.refreshToken,
    session.refreshExpiresAt,
    now,
  );

async function revokeSession(ctx: AuthContext, sessionId: string, now: Date): Promise<void> {
  await ctx.db
    .update(authSessions)
    .set({ revokedAt: now })
    .where(and(eq(authSessions.id, sessionId), isNull(authSessions.revokedAt)));
}

/**
 * Swaps a refresh token for a new pair. The refresh token changes every time. A token that names a
 * live session but no longer matches it has been used before, so someone holds a stale copy: the
 * whole session is revoked and the person signs in again.
 */
export async function refreshTokens(ctx: AuthContext, body: RefreshInput): Promise<Tokens> {
  const now = ctx.now();
  const invalid = () => new AuthHttpError('refresh_token_invalid');
  const parsed = parseRefreshToken(body.refreshToken);
  if (!parsed) throw invalid();

  const [row] = await ctx.db
    .select({
      id: authSessions.id,
      userId: authSessions.userId,
      hash: authSessions.refreshTokenHash,
      createdAt: authSessions.createdAt,
      expiresAt: authSessions.expiresAt,
      revokedAt: authSessions.revokedAt,
      status: users.status,
    })
    .from(authSessions)
    .innerJoin(users, eq(users.id, authSessions.userId))
    .where(eq(authSessions.id, parsed.sessionId))
    .limit(1);
  if (!row || row.revokedAt !== null || row.expiresAt.getTime() <= now.getTime()) throw invalid();

  const presentedHash = hashRefreshToken(body.refreshToken);
  if (!safeEqualHex(presentedHash, row.hash)) return reuseDetected(ctx, row.id, row.userId, now);
  if (row.status !== 'active') throw new AuthHttpError('account_suspended');

  const refreshToken = newRefreshToken(row.id);
  const refreshExpiresAt = refreshExpiry(ctx, row.createdAt, now);
  // Compare-and-swap: only one of two parallel refreshes with the same token can win.
  const [rotated] = await ctx.db
    .update(authSessions)
    .set({
      refreshTokenHash: hashRefreshToken(refreshToken),
      expiresAt: refreshExpiresAt,
      lastUsedAt: now,
    })
    .where(
      and(
        eq(authSessions.id, row.id),
        eq(authSessions.refreshTokenHash, row.hash),
        isNull(authSessions.revokedAt),
        gt(authSessions.expiresAt, now),
      ),
    )
    .returning({ id: authSessions.id });
  if (!rotated) return reuseDetected(ctx, row.id, row.userId, now);

  return tokensFor(
    ctx,
    { userId: row.userId, sessionId: row.id },
    refreshToken,
    refreshExpiresAt,
    now,
  );
}

async function reuseDetected(
  ctx: AuthContext,
  sessionId: string,
  userId: string,
  now: Date,
): Promise<never> {
  await revokeSession(ctx, sessionId, now);
  ctx.logger.warn('auth.refresh_reuse_detected', { sessionId, userId });
  throw new AuthHttpError('refresh_token_invalid');
}

/** Ends one sign-in. The access token stops working at once because every request checks the session. */
export async function signOut(ctx: AuthContext, sessionId: string, userId: string): Promise<void> {
  const now = ctx.now();
  await ctx.db
    .update(authSessions)
    .set({ revokedAt: now })
    .where(
      and(
        eq(authSessions.id, sessionId),
        eq(authSessions.userId, userId),
        isNull(authSessions.revokedAt),
      ),
    );
  ctx.logger.info('auth.signed_out', { sessionId, userId });
}
