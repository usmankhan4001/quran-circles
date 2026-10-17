import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { ApiError, Tokens } from '@qc/contracts';
import { schema } from '@qc/db';
import { authFailureReason, requireAction } from '../../auth';
import { hashRefreshToken } from '../../auth/crypto';
import {
  PHONE_A,
  PHONE_B,
  createHarness,
  type Harness,
  type SignedIn,
} from '../../auth/testing/harness';

vi.setConfig({ testTimeout: 30_000, hookTimeout: 60_000 });

let h: Harness;
beforeAll(async () => {
  h = await createHarness({
    extend: (app) => {
      app.get('/test/me', requireAction('me.read'), (c) =>
        c.json({ ok: true, principal: c.get('principal') }),
      );
      app.get('/test/public', requireAction('config.read'), (c) => c.json({ ok: true }));
      app.get('/test/reason', (c) => c.json({ reason: authFailureReason(c) }));
    },
  });
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

const refresh = (refreshToken: string) => h.post('/v1/auth/refresh', { refreshToken });
const whoAmI = (token: string) => h.get('/test/me', { token });
const sessions = () => h.db.select().from(schema.authSessions);

async function signedIn(phone = PHONE_A): Promise<SignedIn['body']> {
  const result = await h.signIn(phone);
  expect(result.status).toBe(200);
  return result.body;
}

describe('auth.refresh', () => {
  it('hands out a new token pair and retires the old refresh token', async () => {
    const first = await signedIn();
    h.clock.advance(600);
    const response = await refresh(first.refreshToken);
    expect(response.status).toBe(200);
    const next = Tokens.parse(await response.json());
    expect(next.refreshToken).not.toBe(first.refreshToken);
    expect(next.accessToken).not.toBe(first.accessToken);
    expect(new Date(next.accessTokenExpiresAt).getTime()).toBe(h.clock.now().getTime() + 900_000);

    expect((await whoAmI(next.accessToken)).status).toBe(200);
    expect(await sessions()).toHaveLength(1);
  });

  it('keeps only a hash of the refresh token', async () => {
    const result = await signedIn();
    const [session] = await sessions();
    expect(session?.refreshTokenHash).toBe(hashRefreshToken(result.refreshToken));
    expect(session?.refreshTokenHash).not.toContain(result.refreshToken);
    const dump = JSON.stringify(await sessions());
    expect(dump).not.toContain(result.refreshToken);
    expect(dump).not.toContain(result.refreshToken.split('.')[1] ?? 'x');
  });

  it('answers a retry of the old token within ten seconds with the very same pair', async () => {
    const first = await signedIn();
    h.clock.advance(600);
    const second = Tokens.parse(await (await refresh(first.refreshToken)).json());
    h.clock.advance(9);
    const retry = await refresh(first.refreshToken);
    expect(retry.status).toBe(200);
    expect(Tokens.parse(await retry.json())).toEqual(second);
    expect((await whoAmI(second.accessToken)).status).toBe(200);
    const [session] = await sessions();
    expect(session?.revokedAt).toBeNull();
    expect(session?.refreshTokenHash).toBe(hashRefreshToken(second.refreshToken));
    expect(session?.previousRefreshTokenHash).toBe(hashRefreshToken(first.refreshToken));
    // Only hashes are stored, never a token.
    const dump = JSON.stringify(await sessions());
    expect(dump).not.toContain(second.refreshToken);
    expect(dump).not.toContain(first.refreshToken);
    // The new token still rotates normally afterwards.
    expect((await refresh(second.refreshToken)).status).toBe(200);
  });

  it('treats the old token after ten seconds as theft and ends the whole session', async () => {
    const first = await signedIn();
    const second = Tokens.parse(await (await refresh(first.refreshToken)).json());
    h.clock.advance(11);

    const replay = await errorOf(await refresh(first.refreshToken));
    expect(replay).toMatchObject({ status: 401, code: 'refresh_token_invalid' });

    // Both the thief's and the owner's tokens stop working.
    expect((await errorOf(await refresh(second.refreshToken))).code).toBe('refresh_token_invalid');
    expect((await errorOf(await whoAmI(second.accessToken))).code).toBe('unauthenticated');
    const [session] = await sessions();
    expect(session?.revokedAt).not.toBeNull();
    expect(h.logger.entries.some((e) => e.event === 'auth.refresh_reuse_detected')).toBe(true);
  });

  it('refuses a token that matches neither the current nor the previous one, and revokes nothing', async () => {
    const t0 = await signedIn();
    const t1 = Tokens.parse(await (await refresh(t0.refreshToken)).json());
    const t2 = Tokens.parse(await (await refresh(t1.refreshToken)).json());
    // t0 is two rotations old: neither current (t2) nor previous (t1).
    expect((await errorOf(await refresh(t0.refreshToken))).code).toBe('refresh_token_invalid');
    const [session] = await sessions();
    expect(session?.revokedAt).toBeNull();
    expect((await refresh(t2.refreshToken)).status).toBe(200);
  });

  it('leaves the person other sign-ins alone when one session is revoked', async () => {
    const phone = await signedIn(PHONE_A);
    h.clock.advance(120);
    const tablet = await signedIn(PHONE_A);
    await refresh(phone.refreshToken);
    h.clock.advance(11);
    await refresh(phone.refreshToken); // reuse: phone session revoked
    expect((await refresh(tablet.refreshToken)).status).toBe(200);
  });

  it('gives two parallel refreshes of one token the same new pair', async () => {
    const first = await signedIn();
    const [a, b] = await Promise.all([refresh(first.refreshToken), refresh(first.refreshToken)]);
    expect([a.status, b.status]).toEqual([200, 200]);
    const [pairA, pairB] = [Tokens.parse(await a.json()), Tokens.parse(await b.json())];
    expect(pairA).toEqual(pairB);
    const [session] = await sessions();
    expect(session?.revokedAt).toBeNull();
    expect(session?.refreshTokenHash).toBe(hashRefreshToken(pairA.refreshToken));
    expect(session?.previousRefreshTokenHash).toBe(hashRefreshToken(first.refreshToken));
    expect((await whoAmI(pairA.accessToken)).status).toBe(200);
  });

  it('keeps two tabs sharing one sign-in working while they refresh moments apart', async () => {
    const shared = await signedIn();
    // Tab A refreshes; tab B, which read the same stored token, follows a few seconds later.
    h.clock.advance(900);
    const tabA = Tokens.parse(await (await refresh(shared.refreshToken)).json());
    h.clock.advance(3);
    const tabB = Tokens.parse(await (await refresh(shared.refreshToken)).json());
    expect(tabB).toEqual(tabA);

    // Next round: tab B goes first this time, tab A follows within the window.
    h.clock.advance(900);
    const roundTwoB = Tokens.parse(await (await refresh(tabB.refreshToken)).json());
    h.clock.advance(5);
    const roundTwoA = Tokens.parse(await (await refresh(tabA.refreshToken)).json());
    expect(roundTwoA).toEqual(roundTwoB);
    expect((await whoAmI(roundTwoA.accessToken)).status).toBe(200);
    expect((await sessions())[0]?.revokedAt).toBeNull();

    // A tab that wakes up much later with the stale token is treated as reuse.
    h.clock.advance(60);
    expect((await refresh(tabA.refreshToken)).status).toBe(401);
    expect((await sessions())[0]?.revokedAt).not.toBeNull();
  });

  it('does not hand a retry to a suspended account', async () => {
    const first = await signedIn();
    await refresh(first.refreshToken);
    await h.db
      .update(schema.users)
      .set({ status: 'suspended' })
      .where(eq(schema.users.id, first.me.id));
    expect((await errorOf(await refresh(first.refreshToken))).code).toBe('account_suspended');
  });

  it('refuses an expired refresh token', async () => {
    const first = await signedIn();
    h.clock.advance(30 * 24 * 3600 + 1);
    expect((await errorOf(await refresh(first.refreshToken))).code).toBe('refresh_token_invalid');
  });

  it('slides the expiry on use, up to the absolute limit', async () => {
    const capped = await createHarness({
      config: { refreshTokenTtlSeconds: 30 * 86400, sessionMaxAgeSeconds: 45 * 86400 },
    });
    try {
      const start = capped.clock.now().getTime();
      const first = await capped.signIn(PHONE_A);
      capped.clock.advance(20 * 86400);
      const response = await capped.post('/v1/auth/refresh', {
        refreshToken: first.body.refreshToken,
      });
      const next = Tokens.parse(await response.json());
      // 20 + 30 days would be 50; the cap is 45 days from the first sign-in.
      expect(new Date(next.refreshTokenExpiresAt).getTime()).toBe(start + 45 * 86400_000);

      capped.clock.advance(24 * 86400 + 1); // day 44 + a second
      const late = await capped.post('/v1/auth/refresh', { refreshToken: next.refreshToken });
      expect(late.status).toBe(200);
      const last = Tokens.parse(await late.json());
      capped.clock.advance(2 * 86400);
      const over = await capped.post('/v1/auth/refresh', { refreshToken: last.refreshToken });
      expect(over.status).toBe(401);
    } finally {
      await capped.close();
    }
  });

  it('refuses tokens that are not ours', async () => {
    const real = await signedIn();
    const sessionId = real.refreshToken.split('.')[0] ?? '';
    for (const token of [
      'x'.repeat(40),
      `${sessionId}.${'A'.repeat(43)}`.replace(sessionId, '00000000-0000-4000-8000-000000000009'),
      real.accessToken,
      `${sessionId}.`,
      '..........',
      real.refreshToken.toUpperCase(),
    ]) {
      expect((await errorOf(await refresh(token))).code).toBe('refresh_token_invalid');
    }
    // None of those touched the real session.
    expect((await refresh(real.refreshToken)).status).toBe(200);
  });

  it('rejects a body without a usable refresh token', async () => {
    expect((await errorOf(await h.post('/v1/auth/refresh', {}))).code).toBe('validation_failed');
    expect((await errorOf(await h.post('/v1/auth/refresh', { refreshToken: 'short' }))).code).toBe(
      'validation_failed',
    );
  });

  it('refuses a suspended account', async () => {
    const result = await signedIn();
    await h.db
      .update(schema.users)
      .set({ status: 'suspended' })
      .where(eq(schema.users.id, result.me.id));
    expect(await errorOf(await refresh(result.refreshToken))).toMatchObject({
      status: 403,
      code: 'account_suspended',
    });
  });

  it('refuses a signed-out session', async () => {
    const result = await signedIn();
    await h.post('/v1/auth/sign-out', undefined, { token: result.accessToken });
    expect((await errorOf(await refresh(result.refreshToken))).code).toBe('refresh_token_invalid');
  });
});

describe('access tokens', () => {
  it('stop working after fifteen minutes, with token_expired', async () => {
    const result = await signedIn();
    h.clock.advance(899);
    expect((await whoAmI(result.accessToken)).status).toBe(200);
    h.clock.advance(2);
    expect(await errorOf(await whoAmI(result.accessToken))).toMatchObject({
      status: 401,
      code: 'token_expired',
    });
    const renewed = Tokens.parse(await (await refresh(result.refreshToken)).json());
    expect((await whoAmI(renewed.accessToken)).status).toBe(200);
  });

  it('carry no phone number, name or role', async () => {
    const user = await h.createUser({ phoneE164: PHONE_B, displayName: 'Amina Khan' });
    await h.grantRole(user.id, 'city_coordinator', { cityId: h.world.cityA.id });
    const result = await signedIn(PHONE_B);
    const [header, payload] = result.accessToken.split('.');
    const decoded = JSON.parse(Buffer.from(payload ?? '', 'base64url').toString('utf8')) as Record<
      string,
      unknown
    >;
    expect(Object.keys(decoded).sort()).toEqual(['aud', 'exp', 'iat', 'iss', 'sid', 'sub']);
    const everything = `${Buffer.from(header ?? '', 'base64url').toString()}${JSON.stringify(decoded)}`;
    expect(everything).not.toContain(PHONE_B);
    expect(everything).not.toContain(PHONE_B.slice(1));
    expect(everything).not.toContain('Amina');
    expect(everything).not.toContain('coordinator');
    expect(decoded.sub).toBe(user.id);
  });

  it('work for a public action even when stale or garbage', async () => {
    const result = await signedIn();
    h.clock.advance(3600);
    expect((await h.get('/test/public', { token: result.accessToken })).status).toBe(200);
    expect((await h.get('/test/public', { token: 'garbage' })).status).toBe(200);
    expect((await h.get('/test/public')).status).toBe(200);
  });
});

describe('authFailureReason', () => {
  const reason = async (token?: string) =>
    ((await (await h.get('/test/reason', token ? { token } : {})).json()) as { reason: string })
      .reason;

  it('tells an expired token apart from a missing, forged or revoked one', async () => {
    const result = await signedIn();
    expect(await reason()).toBe('unauthenticated');
    expect(await reason('not-a-token')).toBe('unauthenticated');
    h.clock.advance(15 * 60 + 1);
    expect(await reason(result.accessToken)).toBe('token_expired');
  });

  it('reads account_suspended for a suspended account', async () => {
    const result = await signedIn();
    await h.db
      .update(schema.users)
      .set({ status: 'suspended' })
      .where(eq(schema.users.id, result.me.id));
    expect(await reason(result.accessToken)).toBe('account_suspended');
  });
});

describe('auth.signOut', () => {
  it('ends this sign-in at once, access token included', async () => {
    const result = await signedIn();
    expect((await whoAmI(result.accessToken)).status).toBe(200);
    const response = await h.post('/v1/auth/sign-out', undefined, { token: result.accessToken });
    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');

    expect((await errorOf(await whoAmI(result.accessToken))).code).toBe('unauthenticated');
    const [session] = await sessions();
    expect(session?.revokedAt?.getTime()).toBe(h.clock.now().getTime());
  });

  it('ends only that sign-in, not the person other devices', async () => {
    const phone = await signedIn(PHONE_A);
    h.clock.advance(120);
    const tablet = await signedIn(PHONE_A);
    await h.post('/v1/auth/sign-out', undefined, { token: phone.accessToken });
    expect((await whoAmI(tablet.accessToken)).status).toBe(200);
    expect((await refresh(tablet.refreshToken)).status).toBe(200);
  });

  it('needs a valid access token', async () => {
    const result = await signedIn();
    expect((await errorOf(await h.post('/v1/auth/sign-out', undefined))).code).toBe(
      'unauthenticated',
    );
    expect(
      (await errorOf(await h.post('/v1/auth/sign-out', undefined, { token: 'garbage' }))).code,
    ).toBe('unauthenticated');
    h.clock.advance(1000);
    expect(
      await errorOf(await h.post('/v1/auth/sign-out', undefined, { token: result.accessToken })),
    ).toMatchObject({ status: 401, code: 'token_expired' });
    const [session] = await sessions();
    expect(session?.revokedAt).toBeNull();
  });

  it('can be repeated without harm', async () => {
    const result = await signedIn();
    expect(
      (await h.post('/v1/auth/sign-out', undefined, { token: result.accessToken })).status,
    ).toBe(204);
    expect(
      (await errorOf(await h.post('/v1/auth/sign-out', undefined, { token: result.accessToken })))
        .code,
    ).toBe('unauthenticated');
  });
});
