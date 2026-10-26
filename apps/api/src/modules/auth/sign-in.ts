import { and, eq, isNull } from 'drizzle-orm';
import { schema } from '@qc/db';
import type { AuthContext } from '../../auth/context';
import { AuthHttpError } from '../../auth/errors';
import { acceptInvites, expireLapsedInvites, type InviteIdentity } from './invites';
import { loadMe } from './me';
import { challengeTarget, checkCode, verifyTargetKey } from './otp';
import { createSession, issueTokens } from './sessions';
import type { SignInResult, VerifyCodeInput } from './types';

const { users, otpChallenges } = schema;

/** What accounts made before migration 0008 hold instead of NULL. Read as no name. */
const LEGACY_PLACEHOLDER = '-';

/**
 * Finishes a sign-in once the code is right: finds or creates the account (the verified email, or number with WhatsApp sign-in, is
 * the account), accepts invites into roles, and starts a session. One transaction.
 */
export async function verifyCode(
  ctx: AuthContext,
  body: VerifyCodeInput,
  ip: string | null,
): Promise<SignInResult> {
  const challenge = await checkCode(ctx, body, ip);
  const now = ctx.now();
  const target = challengeTarget(challenge);
  const byEmail = target.kind === 'email';
  const claimedPhone = challenge.claimedPhoneE164;
  const sameAccount = byEmail ? eq(users.email, target.value) : eq(users.phoneE164, target.value);

  const [known] = await ctx.db
    .select({
      status: users.status,
      phoneE164: users.phoneE164,
      phoneVerifiedAt: users.phoneVerifiedAt,
    })
    .from(users)
    .where(sameAccount)
    .limit(1);
  if (known && known.status !== 'active') throw new AuthHttpError('account_suspended');

  // The code is right, so the person has proved the address (or number) is theirs. A first sign-in
  // by email also needs the WhatsApp number given with the code request. The code stays usable
  // after either refusal below: the person fixes it and asks again, or signs up properly.
  if (byEmail && !known) {
    if (!claimedPhone) {
      throw new AuthHttpError('validation_failed', undefined, [
        { path: 'phone', code: 'phone_required' },
      ]);
    }
    const [taken] = await ctx.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.phoneE164, claimedPhone))
      .limit(1);
    if (taken) {
      throw new AuthHttpError('validation_failed', undefined, [
        { path: 'phone', code: 'phone_in_use' },
      ]);
    }
  }

  // Invitations are matched by what was proved: this address, and a number only when a code has
  // verified it. A number typed in at sign-up never accepts an invitation.
  const who: InviteIdentity = byEmail
    ? { email: target.value, phone: known?.phoneVerifiedAt ? known.phoneE164 : null }
    : { phone: target.value };
  const invites = await expireLapsedInvites(ctx, who, now);
  if (invites.expired > 0 && invites.livePending === 0) throw new AuthHttpError('invite_expired');

  const result = await ctx.db.transaction(async (tx) => {
    const [consumed] = await tx
      .update(otpChallenges)
      .set({ consumedAt: now })
      .where(and(eq(otpChallenges.id, challenge.id), isNull(otpChallenges.consumedAt)))
      .returning({ id: otpChallenges.id });
    // Two sign-ins racing on one code: only the first to get here wins.
    if (!consumed) throw new AuthHttpError('otp_invalid');

    type Row = {
      id: string;
      displayName: string | null;
      status: 'active' | 'suspended';
      phoneE164: string;
      phoneVerifiedAt: Date | null;
    };
    const columns = {
      id: users.id,
      displayName: users.displayName,
      status: users.status,
      phoneE164: users.phoneE164,
      phoneVerifiedAt: users.phoneVerifiedAt,
    };
    let user: Row | undefined;
    let isNewAccount = false;
    [user] = await tx.select(columns).from(users).where(sameAccount).limit(1);
    if (!user) {
      // A new account needs its number: the claimed one for email, the verified one otherwise.
      const newPhone = byEmail ? claimedPhone : target.value;
      if (!newPhone) throw new AuthHttpError('validation_failed');
      [user] = await tx
        .insert(users)
        .values({
          ...(byEmail
            ? {
                email: target.value,
                emailVerifiedAt: now,
                // The WhatsApp number as typed: kept for reminders and contact, not verified.
                phoneE164: newPhone,
                phoneVerifiedAt: null,
              }
            : { phoneE164: newPhone, phoneVerifiedAt: now }),
          // No name until registration asks for it; the language is the one used to sign in.
          displayName: null,
          locale: challenge.locale,
          createdAt: now,
        })
        .onConflictDoNothing()
        .returning(columns);
      isNewAccount = user !== undefined;
      if (!user) {
        // Another sign-in for this address created the account a moment ago.
        [user] = await tx.select(columns).from(users).where(sameAccount).limit(1);
      }
      if (!user && byEmail) {
        // The number was taken in the meantime.
        throw new AuthHttpError('validation_failed', undefined, [
          { path: 'phone', code: 'phone_in_use' },
        ]);
      }
    }
    if (!user) throw new Error('account could not be created');
    if (user.status !== 'active') throw new AuthHttpError('account_suspended');

    const accepted = await acceptInvites(tx, {
      userId: user.id,
      who: byEmail
        ? { email: target.value, phone: user.phoneVerifiedAt ? user.phoneE164 : null }
        : { phone: target.value },
      now,
    });
    const nameFromInvite =
      user.displayName === null || user.displayName === LEGACY_PLACEHOLDER
        ? accepted.displayName
        : null;
    await tx
      .update(users)
      .set({
        ...(byEmail ? { emailVerifiedAt: now } : { phoneVerifiedAt: now }),
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
  await ctx.rateLimiter.reset(verifyTargetKey(ctx, target));
  ctx.logger.info('auth.signed_in', {
    userId: result.userId,
    sessionId: result.session.sessionId,
    isNewAccount: result.isNewAccount,
    invitesAccepted: result.accepted,
    channel: challenge.channel,
  });
  return { ...tokens, me, isNewAccount: result.isNewAccount };
}
