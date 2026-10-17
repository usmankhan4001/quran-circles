import { and, isNotNull, lt, or } from 'drizzle-orm';
import * as schema from '../schema/index';
import type { JobDb } from './occurrences';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Sign-in codes are kept this many days past their expiry. */
export const DEFAULT_CHALLENGE_RETENTION_DAYS = 1;
/** Expired or revoked sessions are kept this many days. */
export const DEFAULT_SESSION_RETENTION_DAYS = 30;

export interface PurgeResult {
  challenges: number;
  sessions: number;
}

export interface PurgeOptions {
  challengeRetentionDays?: number;
  sessionRetentionDays?: number;
}

/**
 * Removes sign-in rows nobody needs any more; the worker runs it daily. Codes (used or not) are
 * kept a day past their expiry (the resend wait looks at the last hour), and finished sessions
 * (expired or revoked) for 30 days so a replayed refresh token is still recognised as reuse for a
 * while. Live sessions are never touched. Safe to run at any time and as often as wanted. Returns
 * counts only; no row contents.
 */
export async function purgeStaleAuthRows(
  db: JobDb,
  now: Date,
  options: PurgeOptions = {},
): Promise<PurgeResult> {
  const { otpChallenges, authSessions } = schema;
  const challengeDays = options.challengeRetentionDays ?? DEFAULT_CHALLENGE_RETENTION_DAYS;
  const sessionDays = options.sessionRetentionDays ?? DEFAULT_SESSION_RETENTION_DAYS;
  const challengeCutoff = new Date(now.getTime() - challengeDays * DAY_MS);
  const sessionCutoff = new Date(now.getTime() - sessionDays * DAY_MS);

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
