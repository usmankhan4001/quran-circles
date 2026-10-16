import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { ApiError, Tokens } from '@qc/contracts';
import { schema } from '@qc/db';
import { requireAction } from '../../auth/middleware';
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

  it('treats a used refresh token as theft and ends the whole session', async () => {
    const first = await signedIn();
    const second = Tokens.parse(await (await refresh(first.refreshToken)).json());

    const replay = await errorOf(await refresh(first.refreshToken));
    expect(replay).toMatchObject({ status: 401, code: 'refresh_token_invalid' });

    // Both the thief's and the owner's tokens stop working.
    expect((await errorOf(await refresh(second.refreshToken))).code).toBe('refresh_token_invalid');
    expect((await errorOf(await whoAmI(second.accessToken))).code).toBe('unauthenticated');
    const [session] = await sessions();
    expect(session?.revokedAt).not.toBeNull();
    expect(h.logger.entries.some((e) => e.event === 'auth.refresh_reuse_detected')).toBe(true);
  });

  it('leaves the person other sign-ins alone when one session is revoked', async () => {
    const phone = await signedIn(PHONE_A);
    h.clock.advance(120);
    const tablet = await signedIn(PHONE_A);
    await refresh(phone.refreshToken);
    await refresh(phone.refreshToken); // reuse: phone session revoked
    expect((await refresh(tablet.refreshToken)).status).toBe(200);
  });

  it('lets only one of two parallel refreshes win', async () => {
    const first = await signedIn();
    const [a, b] = await Promise.all([refresh(first.refreshToken), refresh(first.refreshToken)]);
    expect([a.status, b.status].sort()).toEqual([200, 401]);
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
