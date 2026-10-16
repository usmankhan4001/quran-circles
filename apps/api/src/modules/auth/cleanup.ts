import { and, isNotNull, lt, or } from 'drizzle-orm';
import { schema } from '@qc/db';
import type { AuthDb } from '../../auth/types';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface PurgeResult {
  challenges: number;
  sessions: number;
}

/**
 * Removes sign-in rows nobody needs any more, for the worker to run daily. Codes are kept a day
 * past their expiry (the resend wait looks at the last hour), and finished sessions for 30 days so
 * a replayed refresh token is still recognised as reuse for a while. Counts only; no row contents.
 */
export async function purgeStaleAuthRows(
  db: AuthDb,
  now: Date,
  options: { challengeRetentionDays?: number; sessionRetentionDays?: number } = {},
): Promise<PurgeResult> {
  const { otpChallenges, authSessions } = schema;
  const challengeCutoff = new Date(now.getTime() - (options.challengeRetentionDays ?? 1) * DAY_MS);
  const sessionCutoff = new Date(now.getTime() - (options.sessionRetentionDays ?? 30) * DAY_MS);

  const challenges = await db
    .delete(otpChallenges)
    .where(lt(otpChallenges.expiresAt, challengeCutoff))
    .returning({ id: otpChallenges.id });
  const sessions = await db
    .delete(authSessions)
    .where(
      or(
        lt(authSessions.expiresAt, sessionCutoff),
        and(isNotNull(authSessions.revokedAt), lt(authSessions.revokedAt, sessionCutoff)),
      ),
    )
    .returning({ id: authSessions.id });
  return { challenges: challenges.length, sessions: sessions.length };
}
