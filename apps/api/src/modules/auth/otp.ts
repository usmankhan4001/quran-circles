import { randomUUID } from 'node:crypto';
import { and, count, desc, eq, gt, isNull, lt, min, sql, type SQL } from 'drizzle-orm';
import { PAKISTAN_MOBILE_PATTERN, PHONE_NOT_PAKISTAN_MOBILE, type PhoneE164 } from '@qc/contracts';
import { schema } from '@qc/db';
import type { RateRule } from '../../auth/config';
import type { AuthContext } from '../../auth/context';
import { hashCode, hashIdentifier, safeEqualHex, generateCode } from '../../auth/crypto';
import { AuthHttpError, rateLimited } from '../../auth/errors';
import { describeError, type AuthDb } from '../../auth/types';
import type { RequestCodeInput, RequestCodeResult, VerifyCodeInput } from './types';

const { otpChallenges } = schema;

export type OtpChallengeRow = typeof otpChallenges.$inferSelect;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** How long to wait after the `count`th code in the last hour: 60 s, 120 s, 240 s, ... capped. */
export function cooldownSeconds(ctx: AuthContext, count: number): number {
  const { cooldownBaseSeconds, cooldownMaxSeconds } = ctx.config.otp;
  return Math.min(cooldownBaseSeconds * 2 ** Math.max(0, count - 1), cooldownMaxSeconds);
}

/** Codes made for this number in the last hour, newest first. */
async function recentChallenges(ctx: AuthContext, phone: string, now: Date) {
  return ctx.db
    .select({ createdAt: otpChallenges.createdAt })
    .from(otpChallenges)
    .where(
      and(
        eq(otpChallenges.phoneE164, phone),
        gt(otpChallenges.createdAt, new Date(now.getTime() - HOUR_MS)),
      ),
    )
    .orderBy(desc(otpChallenges.createdAt))
    .limit(50);
}

/** Seconds until another code may be asked for, or 0. Kept in the database, so it survives restarts. */
async function cooldownRemaining(ctx: AuthContext, phone: string, now: Date): Promise<number> {
  const recent = await recentChallenges(ctx, phone, now);
  const newest = recent[0];
  if (!newest) return 0;
  const elapsed = (now.getTime() - newest.createdAt.getTime()) / 1000;
  return Math.max(0, cooldownSeconds(ctx, recent.length) - elapsed);
}

async function enforce(
  ctx: AuthContext,
  key: string,
  rule: RateRule,
  now: Date,
  onDeny: (retryAfterSeconds: number) => AuthHttpError = rateLimited,
): Promise<void> {
  const result = await ctx.rateLimiter.hit(key, rule, now);
  if (!result.allowed) throw onDeny(result.retryAfterSeconds);
}

/** What the resend wait and the ceilings need to know, from one pass over the last day's codes. */
interface IssueCounts {
  /** This number's codes in the last hour, and the newest of them: the resend wait. */
  mineHour: number;
  mineNewest: Date | null;
  /** This number's codes in the last 24 hours, and the oldest of them. */
  mineDay: number;
  mineOldest: Date | null;
  /** Everyone's codes in the last hour and the last 24 hours, and the oldest of each. */
  hour: number;
  hourOldest: Date | null;
  day: number;
  dayOldest: Date | null;
}

/**
 * Counts in one query what the resend wait and the three ceilings need. One statement, not four,
 * because `requestCode` runs it while it holds the issue lock, and every other code request waits
 * for that lock.
 */
async function issueCounts(db: AuthDb, phone: string, now: Date): Promise<IssueCounts> {
  const createdAt = otpChallenges.createdAt;
  const mine = eq(otpChallenges.phoneE164, phone);
  const inHour = gt(createdAt, new Date(now.getTime() - HOUR_MS));
  const mineInHour = sql`${mine} and ${inHour}`;
  const n = (where: SQL) => sql<number>`count(*) filter (where ${where})`.mapWith(Number);
  const oldest = (where: SQL) =>
    sql<Date | null>`min(${createdAt}) filter (where ${where})`.mapWith(createdAt);
  const [row] = await db
    .select({
      mineHour: n(mineInHour),
      mineNewest: sql<Date | null>`max(${createdAt}) filter (where ${mineInHour})`.mapWith(
        createdAt,
      ),
      mineDay: n(mine),
      mineOldest: oldest(mine),
      hour: n(inHour),
      hourOldest: oldest(inHour),
      day: count(),
      dayOldest: min(createdAt),
    })
    .from(otpChallenges)
    .where(gt(createdAt, new Date(now.getTime() - DAY_MS)));
  return {
    mineHour: row?.mineHour ?? 0,
    mineNewest: row?.mineNewest ?? null,
    mineDay: row?.mineDay ?? 0,
    mineOldest: row?.mineOldest ?? null,
    hour: row?.hour ?? 0,
    hourOldest: row?.hourOldest ?? null,
    day: row?.day ?? 0,
    dayOldest: row?.dayOldest ?? null,
  };
}

/** Seconds until the oldest counted code leaves its window and one slot frees up. */
const secondsUntilFree = (oldest: Date | null, windowMs: number, now: Date): number =>
  oldest ? Math.max(1, Math.ceil((oldest.getTime() + windowMs - now.getTime()) / 1000)) : 60;

/**
 * Refuses a new code while the number must still wait (the resend wait, kept in the database so it
 * survives restarts) or a ceiling is reached (SEC-04, SEC-07): codes per number in any 24 hours,
 * and codes for everyone together per hour and per 24 hours, a cost backstop against SMS pumping.
 * They count `otp_challenges` rows, which the purge keeps for a day past their expiry, so they
 * hold across restarts and processes. A delivery that failed deletes its row and is not counted.
 */
function assertMayIssue(ctx: AuthContext, counts: IssueCounts, now: Date): void {
  if (counts.mineNewest) {
    const elapsed = (now.getTime() - counts.mineNewest.getTime()) / 1000;
    const wait = cooldownSeconds(ctx, counts.mineHour) - elapsed;
    if (wait > 0) throw rateLimited(wait);
  }
  const caps = ctx.config.codeCaps;
  if (counts.mineDay >= caps.perPhonePerDay) {
    throw rateLimited(secondsUntilFree(counts.mineOldest, DAY_MS, now));
  }
  if (counts.hour >= caps.globalPerHour) {
    ctx.logger.warn('auth.code_global_cap_reached', { window: 'hour', limit: caps.globalPerHour });
    throw rateLimited(secondsUntilFree(counts.hourOldest, HOUR_MS, now));
  }
  if (counts.day >= caps.globalPerDay) {
    ctx.logger.warn('auth.code_global_cap_reached', { window: 'day', limit: caps.globalPerDay });
    throw rateLimited(secondsUntilFree(counts.dayOldest, DAY_MS, now));
  }
}

/**
 * Codes are issued one at a time across every API process: the resend wait and the ceilings are
 * counted, and the new code stored, under this lock, so requests in flight together cannot all
 * pass a ceiling that has one slot left. Transaction-scoped: released at commit or rollback, so
 * never leaked. It is the only advisory lock the sign-in lane takes, it is taken before any row
 * lock, and nothing that holds a row lock waits for it (verify, refresh and the purge never take
 * it), so it cannot close a deadlock. The two-key form keeps it apart from the single-key advisory
 * locks other modules take.
 */
const ISSUE_LOCK = sql`select pg_advisory_xact_lock(hashtext('qc.auth'), hashtext('otp_issue'))`;

/**
 * One issuing transaction at a time in this process, ahead of the database lock. Without it, a
 * burst of code requests would each take a pooled connection and wait on the lock while holding
 * it, and the rest of the API in this process would queue for connections behind them. With it,
 * each process has at most one connection waiting on the lock. Keyed by the database handle,
 * which is one per process (and one per test harness).
 */
const issueQueues = new WeakMap<AuthDb, Promise<unknown>>();

function oneAtATime<T>(db: AuthDb, work: () => Promise<T>): Promise<T> {
  const turn = (issueQueues.get(db) ?? Promise.resolve()).then(work);
  issueQueues.set(
    db,
    turn.catch(() => undefined),
  );
  return turn;
}

/**
 * Sign-in codes go to Pakistani mobile numbers only (SEC-04, owner decision). The contract schema
 * (`PakistaniMobilePhone`) refuses other numbers first; this is the second guard in the service,
 * before anything is counted or sent, with the contract's same issue code. It names the field,
 * never the value.
 */
export function assertSignInCountry(phone: string): void {
  if (!PAKISTAN_MOBILE_PATTERN.test(phone)) {
    throw new AuthHttpError('validation_failed', undefined, [
      { path: 'phone', code: PHONE_NOT_PAKISTAN_MOBILE },
    ]);
  }
}

/** The rate-limit key for wrong-code attempts against one number. */
export const verifyPhoneKey = (ctx: AuthContext, phone: string): string =>
  `otp-verify:phone:${hashIdentifier(ctx.keys, 'phone', phone)}`;

const ipKeyOf = (ctx: AuthContext, ip: string | null): string =>
  hashIdentifier(ctx.keys, 'ip', ip ?? 'unknown');

/**
 * Starts a sign-in: makes a code, stores its hash and hands the code to the sender. The same rule
 * holds for everyone, staff included: WhatsApp first (the contract's default channel), and the
 * sender falls back to SMS and reports it, so the response says where the code went.
 */
export async function requestCode(
  ctx: AuthContext,
  body: RequestCodeInput,
  ip: string | null,
): Promise<RequestCodeResult> {
  const now = ctx.now();
  const { rateLimits, otp } = ctx.config;
  const phone: PhoneE164 = body.phone;
  assertSignInCountry(phone);
  const ipHash = ipKeyOf(ctx, ip);
  const phoneHash = hashIdentifier(ctx.keys, 'phone', phone);

  await enforce(ctx, `otp-request:ip:${ipHash}`, rateLimits.requestPerIp, now);
  await enforce(ctx, `otp-request:phone:${phoneHash}`, rateLimits.requestPerPhone, now);

  // A first look without the lock. Once a ceiling is reached, which is when a flood arrives, the
  // request is refused here, in parallel with the others, without waiting for the lock or holding
  // a pooled connection while it waits. Whatever passes is counted again under the lock below.
  assertMayIssue(ctx, await issueCounts(ctx.db, phone, now), now);

  const challengeId = randomUUID();
  const code = otp.fixedCode ?? generateCode();
  const expiresAt = new Date(now.getTime() + otp.ttlSeconds * 1000);

  const issuedThisHour = await oneAtATime(ctx.db, () =>
    ctx.db.transaction(async (tx) => {
      await tx.execute(ISSUE_LOCK);
      const counts = await issueCounts(tx, phone, now);
      assertMayIssue(ctx, counts, now);
      // Only the newest code for a number works: retire the others, then add this one.
      await tx
        .update(otpChallenges)
        .set({ consumedAt: now })
        .where(and(eq(otpChallenges.phoneE164, phone), isNull(otpChallenges.consumedAt)));
      await tx.insert(otpChallenges).values({
        id: challengeId,
        phoneE164: phone,
        channel: body.channel,
        // Copied to the account if this sign-in creates one, so it starts in this language.
        locale: body.locale,
        codeHash: hashCode(ctx.keys, challengeId, code),
        expiresAt,
        createdAt: now,
        ipHash,
      });
      return counts.mineHour + 1;
    }),
  );

  // The lock is released at commit, before the slow part: handing the code to the provider. The
  // row is already counted, so a parallel request cannot take its slot while this one sends.
  let channel = body.channel;
  try {
    const sent = await ctx.codeSender.send({ phone, code, locale: body.locale, channel });
    if (sent?.channel) channel = sent.channel;
  } catch (error) {
    ctx.logger.error('auth.code_send_failed', { challengeId, ...describeError(error) });
    await ctx.db.delete(otpChallenges).where(eq(otpChallenges.id, challengeId));
    throw new AuthHttpError('service_unavailable');
  }

  ctx.logger.info('auth.code_requested', { challengeId, channel });
  return {
    challengeId,
    channel,
    expiresAt: expiresAt.toISOString(),
    resendAfterSeconds: cooldownSeconds(ctx, issuedThisHour),
  };
}

/**
 * Checks a code against its challenge. Throws the contract error when it is wrong, expired, used
 * or locked. On success the challenge is still unused: the caller consumes it in the same
 * transaction that creates the session, so a failure part-way leaves the code usable.
 */
export async function checkCode(
  ctx: AuthContext,
  body: VerifyCodeInput,
  ip: string | null,
): Promise<OtpChallengeRow> {
  const now = ctx.now();
  const { rateLimits, otp } = ctx.config;

  await enforce(ctx, `otp-verify:ip:${ipKeyOf(ctx, ip)}`, rateLimits.verifyPerIp, now);

  const [challenge] = await ctx.db
    .select()
    .from(otpChallenges)
    .where(eq(otpChallenges.id, body.challengeId))
    .limit(1);
  // Unknown, used and retired codes all answer the same way.
  if (!challenge || challenge.consumedAt) throw new AuthHttpError('otp_invalid');
  if (challenge.expiresAt.getTime() <= now.getTime()) throw new AuthHttpError('otp_expired');

  const lockedFor = async () =>
    new AuthHttpError(
      'otp_too_many_attempts',
      Math.max(
        1,
        Math.ceil(await cooldownRemaining(ctx, challenge.phoneE164, now)) ||
          otp.cooldownBaseSeconds,
      ),
    );

  await enforce(
    ctx,
    verifyPhoneKey(ctx, challenge.phoneE164),
    rateLimits.verifyPerPhone,
    now,
    (retryAfter) => new AuthHttpError('otp_too_many_attempts', Math.max(1, Math.ceil(retryAfter))),
  );

  // Count the attempt before comparing, in one atomic step, so parallel guesses cannot all slip in.
  const [counted] = await ctx.db
    .update(otpChallenges)
    .set({ attempts: sql`${otpChallenges.attempts} + 1` })
    .where(
      and(
        eq(otpChallenges.id, challenge.id),
        isNull(otpChallenges.consumedAt),
        gt(otpChallenges.expiresAt, now),
        lt(otpChallenges.attempts, otp.maxAttempts),
      ),
    )
    .returning({ attempts: otpChallenges.attempts });
  if (!counted) {
    const [fresh] = await ctx.db
      .select({ attempts: otpChallenges.attempts, consumedAt: otpChallenges.consumedAt })
      .from(otpChallenges)
      .where(eq(otpChallenges.id, challenge.id))
      .limit(1);
    if (fresh && !fresh.consumedAt && fresh.attempts >= otp.maxAttempts) throw await lockedFor();
    throw new AuthHttpError('otp_invalid');
  }

  if (!safeEqualHex(hashCode(ctx.keys, challenge.id, body.code), challenge.codeHash)) {
    ctx.logger.warn('auth.code_rejected', {
      challengeId: challenge.id,
      attempts: counted.attempts,
    });
    if (counted.attempts >= otp.maxAttempts) throw await lockedFor();
    throw new AuthHttpError('otp_invalid');
  }
  return challenge;
}
