import { and, eq, isNull } from 'drizzle-orm';
import { schema } from '@qc/db';
import type { AuthContext } from '../../auth/context';
import { AuthHttpError } from '../../auth/errors';
import { acceptInvites, expireLapsedInvites } from './invites';
import { UNNAMED_DISPLAY_NAME, loadMe } from './me';
import { checkCode, verifyPhoneKey } from './otp';
import { createSession, issueTokens } from './sessions';
import type { SignInResult, VerifyCodeInput } from './types';

const { users, otpChallenges } = schema;

/**
 * Finishes a sign-in once the code is right: finds or creates the account (the verified number is
 * the account), accepts invites into roles, and starts a session. One transaction.
 */
export async function verifyCode(
  ctx: AuthContext,
  body: VerifyCodeInput,
  ip: string | null,
): Promise<SignInResult> {
  const challenge = await checkCode(ctx, body, ip);
  const now = ctx.now();
  const phone = challenge.phoneE164;

  const [known] = await ctx.db
    .select({ status: users.status })
    .from(users)
    .where(eq(users.phoneE164, phone))
    .limit(1);
  if (known && known.status !== 'active') throw new AuthHttpError('account_suspended');

  // The code is right, so the person has proved the number is theirs. Tell them if the invitation
  // they came for has lapsed. The code stays usable: signing in again works, without a role.
  const invites = await expireLapsedInvites(ctx, phone, now);
  if (invites.expired > 0 && invites.livePending === 0) throw new AuthHttpError('invite_expired');

  const result = await ctx.db.transaction(async (tx) => {
    const [consumed] = await tx
      .update(otpChallenges)
      .set({ consumedAt: now })
      .where(and(eq(otpChallenges.id, challenge.id), isNull(otpChallenges.consumedAt)))
      .returning({ id: otpChallenges.id });
    // Two sign-ins racing on one code: only the first to get here wins.
    if (!consumed) throw new AuthHttpError('otp_invalid');

    let user: { id: string; displayName: string; status: 'active' | 'suspended' } | undefined;
    let isNewAccount = false;
    [user] = await tx
      .select({ id: users.id, displayName: users.displayName, status: users.status })
      .from(users)
      .where(eq(users.phoneE164, phone))
      .limit(1);
    if (!user) {
      [user] = await tx
        .insert(users)
        .values({
          phoneE164: phone,
          phoneVerifiedAt: now,
          displayName: UNNAMED_DISPLAY_NAME,
          createdAt: now,
        })
        .onConflictDoNothing()
        .returning({ id: users.id, displayName: users.displayName, status: users.status });
      isNewAccount = user !== undefined;
      if (!user) {
        // Another sign-in for this number created the account a moment ago.
        [user] = await tx
          .select({ id: users.id, displayName: users.displayName, status: users.status })
          .from(users)
          .where(eq(users.phoneE164, phone))
          .limit(1);
      }
    }
    if (!user) throw new Error('account could not be created');
    if (user.status !== 'active') throw new AuthHttpError('account_suspended');

    const accepted = await acceptInvites(tx, { userId: user.id, phone, now });
    const nameFromInvite = user.displayName === UNNAMED_DISPLAY_NAME ? accepted.displayName : null;
    await tx
      .update(users)
      .set({
        phoneVerifiedAt: now,
        lastSeenAt: now,
        ...(nameFromInvite ? { displayName: nameFromInvite } : {}),
      })
      .where(eq(users.id, user.id));

    const session = await createSession(ctx, tx, {
      userId: user.id,
      deviceLabel: body.deviceLabel,
      now,
    });
    return { userId: user.id, isNewAccount, session, accepted: accepted.accepted };
  });

  const tokens = await issueTokens(ctx, result.session, result.userId, now);
  const me = await loadMe(ctx.db, result.userId);
  if (!me) throw new Error('signed-in user not found');
  await ctx.rateLimiter.reset(verifyPhoneKey(ctx, phone));
  ctx.logger.info('auth.signed_in', {
    userId: result.userId,
    sessionId: result.session.sessionId,
    isNewAccount: result.isNewAccount,
    invitesAccepted: result.accepted,
  });
  return { ...tokens, me, isNewAccount: result.isNewAccount };
}
