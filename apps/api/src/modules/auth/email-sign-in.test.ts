import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { ApiError, RequestCodeResponse } from '@qc/contracts';
import { schema } from '@qc/db';
import { PHONE_A, PHONE_B, createHarness, type Harness } from '../../auth/testing/harness';

vi.setConfig({ testTimeout: 30_000, hookTimeout: 60_000 });

const EMAIL = 'reader@example.org';
const OTHER_EMAIL = 'other@example.org';
// A WhatsApp number from another country: the number is contact data, not a sign-in.
const ABROAD = '+447700900123';

let h: Harness;
beforeAll(async () => {
  // As in production: only the email sign-in is on.
  h = await createHarness({ config: { otp: { phoneSignIn: false } } });
}, 60_000);
afterAll(async () => {
  await h.close();
});
beforeEach(async () => {
  await h.reset();
});

async function errorOf(response: Response) {
  const body = ApiError.parse(await response.json());
  return { status: response.status, ...body.error };
}

async function startCode(email: string, phone?: string, ip?: string) {
  const response = await h.requestEmailCode(email, {
    ...(phone ? { phone } : {}),
    ...(ip ? { ip } : {}),
  });
  expect(response.status).toBe(202);
  const body = RequestCodeResponse.parse(await response.json());
  return { ...body, code: h.sender.last?.code ?? '' };
}

const verify = (challengeId: string, code: string, ip?: string) =>
  h.post('/v1/auth/verify', { challengeId, code }, ip ? { ip } : {});

describe('email codes: requesting', () => {
  it('sends the code to the address, on the email channel, and never to a phone', async () => {
    const asked = await startCode(EMAIL, PHONE_A);
    expect(asked.channel).toBe('email');
    expect(asked.resendAfterSeconds).toBe(60);
    expect(h.sender.sent).toHaveLength(1);
    expect(h.sender.last).toMatchObject({ email: EMAIL, channel: 'email', locale: 'ur' });
    expect(h.sender.last?.phone).toBeUndefined();
    expect(h.sender.last?.code).toMatch(/^[0-9]{6}$/);
    const [row] = await h.db.select().from(schema.otpChallenges);
    expect(row).toMatchObject({ email: EMAIL, phoneE164: null, claimedPhoneE164: PHONE_A });
    expect(row?.codeHash).not.toContain(asked.code);
  });

  it('treats the address case-insensitively and trims it', async () => {
    await startCode('  Reader@Example.ORG ');
    expect(h.sender.last?.email).toBe(EMAIL);
    const again = await h.requestEmailCode(EMAIL);
    // The same mailbox: the resend wait applies.
    expect(again.status).toBe(429);
  });

  it('keeps the resend wait and the daily ceiling per address', async () => {
    await startCode(EMAIL);
    const early = await errorOf(await h.requestEmailCode(EMAIL));
    expect(early).toMatchObject({ status: 429, code: 'rate_limited' });
    expect(early.retryAfterSeconds).toBeGreaterThan(0);
    // Another address is not held up by it.
    await startCode(OTHER_EMAIL);
    h.clock.advance(61);
    await startCode(EMAIL);
    const rows = await h.db
      .select()
      .from(schema.otpChallenges)
      .where(eq(schema.otpChallenges.email, EMAIL));
    // Only the newest code for an address works.
    expect(rows.filter((r) => r.consumedAt === null)).toHaveLength(1);
  });

  it('counts address and number separately: a number request does not slow an email one', async () => {
    const capped = await createHarness({
      config: { otp: { phoneSignIn: true }, codeCaps: { perPhonePerDay: 1 } },
    });
    try {
      await capped.requestEmailCode(EMAIL);
      expect((await capped.requestCode(PHONE_A)).status).toBe(202);
      capped.clock.advance(3600);
      expect((await capped.requestEmailCode(EMAIL)).status).toBe(429);
      expect((await capped.requestEmailCode(OTHER_EMAIL)).status).toBe(202);
    } finally {
      await capped.close();
    }
  });

  it('refuses a request with neither an email nor (while it is off) a number sign-in, sending nothing', async () => {
    const res = await h.post('/v1/auth/code', { phone: PHONE_A });
    const err = await errorOf(res);
    expect(err.code).toBe('validation_failed');
    expect(err.issues).toEqual([{ path: 'email', code: 'email_required' }]);
    expect((await h.post('/v1/auth/code', {})).status).toBe(400);
    expect(h.sender.sent).toHaveLength(0);
    expect(await h.db.select().from(schema.otpChallenges)).toHaveLength(0);
  });

  it('refuses a malformed address and a phone channel for an email', async () => {
    for (const email of ['nobody', 'a@b', '']) {
      expect((await h.post('/v1/auth/code', { email })).status, email).toBe(400);
    }
    const wrongChannel = await h.post('/v1/auth/code', { email: EMAIL, channel: 'whatsapp' });
    expect(wrongChannel.status).toBe(400);
    const badPhone = await h.post('/v1/auth/code', { email: EMAIL, phone: '0300 1234567' });
    expect(badPhone.status).toBe(400);
    expect(h.sender.sent).toHaveLength(0);
  });

  it('answers service_unavailable and frees the slot when the email cannot be sent', async () => {
    h.sender.failWith = new Error('resend down');
    expect(await errorOf(await h.requestEmailCode(EMAIL))).toMatchObject({
      status: 503,
      code: 'service_unavailable',
    });
    expect(await h.db.select().from(schema.otpChallenges)).toHaveLength(0);
    h.sender.failWith = null;
    expect((await h.requestEmailCode(EMAIL)).status).toBe(202);
    expect(JSON.stringify(h.logger.entries)).not.toContain(EMAIL);
  });

  it('never writes the address or the code to the log', async () => {
    const { code } = await startCode(EMAIL, PHONE_A);
    const log = JSON.stringify(h.logger.entries);
    expect(log).not.toContain(EMAIL);
    expect(log).not.toContain(code);
    expect(log).not.toContain(PHONE_A);
  });
});

describe('email codes: signing in', () => {
  it('makes an account with the verified email and the WhatsApp number typed at sign-up', async () => {
    const { challengeId, code } = await startCode(EMAIL, ABROAD);
    const res = await verify(challengeId, code);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      isNewAccount: boolean;
      me: { email: string; phone: string; roles: unknown[] };
    };
    expect(body.isNewAccount).toBe(true);
    expect(body.me).toMatchObject({ email: EMAIL, phone: ABROAD, roles: [] });
    const [user] = await h.db.select().from(schema.users);
    expect(user).toMatchObject({ email: EMAIL, phoneE164: ABROAD, phoneVerifiedAt: null });
    expect(user?.emailVerifiedAt?.getTime()).toBe(h.clock.now().getTime());
    expect(user?.displayName).toBeNull();
  });

  it('signs a returning person in with the email alone, and keeps their number', async () => {
    const first = await h.signInByEmail(EMAIL, { phone: PHONE_A });
    expect(first.body.isNewAccount).toBe(true);
    h.clock.advance(3600);
    const again = await h.signInByEmail(EMAIL);
    expect(again.status).toBe(200);
    expect(again.body.isNewAccount).toBe(false);
    expect(again.body.me.id).toBe(first.body.me.id);
    expect(again.body.me.phone).toBe(PHONE_A);
    // A different number typed later does not rewrite the account.
    h.clock.advance(3600);
    const third = await h.signInByEmail(EMAIL, { phone: PHONE_B });
    expect(third.body.me.phone).toBe(PHONE_A);
    expect(await h.db.select().from(schema.users)).toHaveLength(1);
  });

  it('asks for the WhatsApp number when a new account has none, and keeps the code usable', async () => {
    const asked = await startCode(EMAIL);
    const missing = await errorOf(await verify(asked.challengeId, asked.code));
    expect(missing.code).toBe('validation_failed');
    expect(missing.issues).toEqual([{ path: 'phone', code: 'phone_required' }]);
    expect(await h.db.select().from(schema.users)).toHaveLength(0);
    // The code was not used up, and the attempt was counted.
    const [row] = await h.db.select().from(schema.otpChallenges);
    expect(row?.consumedAt).toBeNull();
    // Signing up again with a number works.
    h.clock.advance(61);
    const signedUp = await h.signInByEmail(EMAIL, { phone: PHONE_A });
    expect(signedUp.status).toBe(200);
    expect(signedUp.body.isNewAccount).toBe(true);
  });

  it('does not take a number that another account holds, and creates nothing', async () => {
    const owner = await h.createUser({ phoneE164: PHONE_A });
    const asked = await startCode(EMAIL, PHONE_A);
    const refused = await errorOf(await verify(asked.challengeId, asked.code));
    expect(refused.code).toBe('validation_failed');
    expect(refused.issues).toEqual([{ path: 'phone', code: 'phone_in_use' }]);
    const users = await h.db.select().from(schema.users);
    expect(users.map((u) => u.id)).toEqual([owner.id]);
    // It does not link the email to that account either.
    expect(users[0]?.email).toBeNull();
  });

  it('refuses a suspended account', async () => {
    const first = await h.signInByEmail(EMAIL, { phone: PHONE_A });
    await h.db
      .update(schema.users)
      .set({ status: 'suspended' })
      .where(eq(schema.users.id, first.body.me.id));
    h.clock.advance(3600);
    const asked = await startCode(EMAIL);
    const refused = await errorOf(await verify(asked.challengeId, asked.code));
    expect(refused).toMatchObject({ status: 403, code: 'account_suspended' });
  });

  it('answers a wrong code, counts attempts per address and locks after five', async () => {
    const asked = await startCode(EMAIL, PHONE_A);
    const wrong = asked.code === '000000' ? '111111' : '000000';
    for (let n = 1; n <= 4; n++) {
      expect((await errorOf(await verify(asked.challengeId, wrong))).code).toBe('otp_invalid');
    }
    expect((await errorOf(await verify(asked.challengeId, wrong))).code).toBe(
      'otp_too_many_attempts',
    );
    expect((await errorOf(await verify(asked.challengeId, asked.code))).code).toBe(
      'otp_too_many_attempts',
    );
  });

  it('refuses a code twice, and an expired one', async () => {
    const asked = await startCode(EMAIL, PHONE_A);
    expect((await verify(asked.challengeId, asked.code)).status).toBe(200);
    expect((await errorOf(await verify(asked.challengeId, asked.code))).code).toBe('otp_invalid');
    h.clock.advance(3600);
    const late = await startCode(OTHER_EMAIL, PHONE_B);
    h.clock.advance(301);
    expect((await errorOf(await verify(late.challengeId, late.code))).code).toBe('otp_expired');
  });
});

describe('email codes: invitations', () => {
  const invite = async (values: Partial<typeof schema.coordinatorInvites.$inferInsert>) => {
    await h.db.insert(schema.coordinatorInvites).values({
      phoneE164: PHONE_A,
      role: 'venue_coordinator',
      scopeType: 'venue',
      venueId: h.world.venueA1,
      status: 'pending',
      createdAt: h.clock.now(),
      expiresAt: new Date(h.clock.now().getTime() + 7 * 86_400_000),
      ...values,
    });
  };

  it('accepts an invitation that names the verified email', async () => {
    await invite({ email: EMAIL, phoneE164: PHONE_B });
    const session = await h.signInByEmail(EMAIL, { phone: PHONE_A });
    expect(session.body.me.roles.map((r) => r.role)).toEqual(['venue_coordinator']);
    const [row] = await h.db.select().from(schema.coordinatorInvites);
    expect(row?.status).toBe('accepted');
  });

  it('does not give a role to someone who only typed the invited number', async () => {
    await invite({ email: null, phoneE164: PHONE_A });
    const session = await h.signInByEmail(EMAIL, { phone: PHONE_A });
    expect(session.status).toBe(200);
    expect(session.body.me.roles).toEqual([]);
    const [row] = await h.db.select().from(schema.coordinatorInvites);
    expect(row?.status).toBe('pending');
  });

  it('does not accept an invitation for another address', async () => {
    await invite({ email: OTHER_EMAIL, phoneE164: PHONE_B });
    const session = await h.signInByEmail(EMAIL, { phone: PHONE_A });
    expect(session.body.me.roles).toEqual([]);
  });

  it('accepts a number-only invitation once the number is verified by a code', async () => {
    // An older account whose number was proved; it now signs in by email.
    const user = await h.createUser({
      phoneE164: PHONE_A,
      email: EMAIL,
      emailVerifiedAt: h.clock.now(),
    });
    await invite({ email: null, phoneE164: PHONE_A });
    const session = await h.signInByEmail(EMAIL);
    expect(session.body.me.id).toBe(user.id);
    expect(session.body.me.roles.map((r) => r.role)).toEqual(['venue_coordinator']);
  });

  it('tells the person when the invitation for their address has lapsed', async () => {
    await invite({
      email: EMAIL,
      phoneE164: PHONE_B,
      expiresAt: new Date(h.clock.now().getTime() - 1000),
    });
    const asked = await startCode(EMAIL, PHONE_A);
    const lapsed = await errorOf(await verify(asked.challengeId, asked.code));
    expect(lapsed.code).toBe('invite_expired');
  });
});

describe('number sign-in stays off', () => {
  it('does not let a number-only body start a sign-in', async () => {
    expect((await h.requestCode(PHONE_A)).status).toBe(400);
    expect(await h.db.select().from(schema.otpChallenges)).toHaveLength(0);
  });
});

describe('older accounts', () => {
  it('lets a number-verified account that has no email keep signing in by number when it is on', async () => {
    const withNumber = await createHarness({ config: { otp: { phoneSignIn: true } } });
    try {
      const user = await withNumber.createUser({ phoneE164: PHONE_A });
      const session = await withNumber.signIn(PHONE_A);
      expect(session.status).toBe(200);
      expect(session.body.me.id).toBe(user.id);
      expect(session.body.me.email).toBeNull();
    } finally {
      await withNumber.close();
    }
  });
});
