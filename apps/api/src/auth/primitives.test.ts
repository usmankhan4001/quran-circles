import { describe, expect, it } from 'vitest';
import { AuthConfigError, createAuthConfig, loadAuthConfigFromEnv } from './config';
import {
  deriveKeys,
  generateCode,
  hashCode,
  hashIdentifier,
  hashRefreshToken,
  newRefreshToken,
  parseRefreshToken,
  safeEqualHex,
} from './crypto';
import { InMemoryRateLimiter } from './rate-limiter';
import { signAccessToken, verifyAccessToken } from './tokens';
import { describeError } from './types';
import { TEST_SECRET } from './testing/harness';

const USER = '11111111-1111-4111-8111-111111111111';
const SESSION = '22222222-2222-4222-8222-222222222222';
const LETTERS = 'abcdef12-aaaa-4bbb-8ccc-abcdefabcdef';
const NOW = new Date('2026-10-16T09:00:00Z');

describe('config', () => {
  it('fills in safe defaults and treats an unset environment as production', () => {
    const config = createAuthConfig({ secret: TEST_SECRET });
    expect(config.appEnv).toBe('production');
    expect(config.accessTokenTtlSeconds).toBe(900);
    expect(config.otp).toMatchObject({ ttlSeconds: 300, maxAttempts: 5, fixedCode: null });
    expect(config.trustProxy).toBe(false);
  });

  it('refuses a short or missing secret without repeating it', () => {
    expect(() => createAuthConfig({ secret: 'short-secret' })).toThrow(AuthConfigError);
    try {
      createAuthConfig({ secret: 'short-secret' });
    } catch (error) {
      expect(String(error)).not.toContain('short-secret');
    }
    expect(() => loadAuthConfigFromEnv({})).toThrow(/AUTH_SECRET/);
  });

  it('never allows a fixed code in production, which is also what an unset environment means', () => {
    expect(() => createAuthConfig({ secret: TEST_SECRET, appEnv: 'production', otp: { fixedCode: '123456' } })).toThrow(
      /production/,
    );
    expect(() => createAuthConfig({ secret: TEST_SECRET, otp: { fixedCode: '123456' } })).toThrow(/production/);
    expect(() => loadAuthConfigFromEnv({ AUTH_SECRET: TEST_SECRET, AUTH_FIXED_CODE: '123456' })).toThrow(
      /production/,
    );
    expect(() =>
      loadAuthConfigFromEnv({ AUTH_SECRET: TEST_SECRET, APP_ENV: 'production', AUTH_FIXED_CODE: '123456' }),
    ).toThrow(/production/);
  });

  it('allows a fixed code on staging, development and test only through configuration', () => {
    for (const appEnv of ['staging', 'development', 'test']) {
      const config = loadAuthConfigFromEnv({ AUTH_SECRET: TEST_SECRET, APP_ENV: appEnv, AUTH_FIXED_CODE: '123456' });
      expect(config.otp.fixedCode).toBe('123456');
    }
    expect(loadAuthConfigFromEnv({ AUTH_SECRET: TEST_SECRET, APP_ENV: 'staging' }).otp.fixedCode).toBeNull();
  });

  it('rejects a fixed code that is not six digits, and nonsense numbers', () => {
    expect(() => createAuthConfig({ secret: TEST_SECRET, appEnv: 'test', otp: { fixedCode: '12345' } })).toThrow();
    expect(() => createAuthConfig({ secret: TEST_SECRET, accessTokenTtlSeconds: 0 })).toThrow();
    expect(() => createAuthConfig({ secret: TEST_SECRET, otp: { maxAttempts: 1.5 } })).toThrow();
    expect(() => createAuthConfig({ secret: TEST_SECRET, appEnv: 'prod' as never })).toThrow();
  });

  it('reads the proxy setting from the environment', () => {
    expect(loadAuthConfigFromEnv({ AUTH_SECRET: TEST_SECRET, AUTH_TRUST_PROXY: 'true' }).trustProxy).toBe(true);
    expect(loadAuthConfigFromEnv({ AUTH_SECRET: TEST_SECRET, AUTH_TRUST_PROXY: 'yes' }).trustProxy).toBe(false);
  });
});

describe('codes and hashes', () => {
  it('makes six digit codes, with leading zeros, that vary', () => {
    const codes = Array.from({ length: 300 }, generateCode);
    expect(codes.every((c) => /^[0-9]{6}$/.test(c))).toBe(true);
    expect(new Set(codes).size).toBeGreaterThan(250);
  });

  it('hashes a code against its challenge and its own key', () => {
    const keys = deriveKeys(TEST_SECRET);
    const hash = hashCode(keys, SESSION, '123456');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain('123456');
    expect(hashCode(keys, SESSION, '123456')).toBe(hash);
    expect(hashCode(keys, USER, '123456')).not.toBe(hash);
    expect(hashCode(keys, SESSION, '123457')).not.toBe(hash);
    expect(hashCode(deriveKeys(`${TEST_SECRET}x`), SESSION, '123456')).not.toBe(hash);
  });

  it('uses a different key for each purpose', () => {
    const keys = deriveKeys(TEST_SECRET);
    expect(Buffer.from(keys.token).equals(keys.otp)).toBe(false);
    expect(keys.otp.equals(keys.id)).toBe(false);
    expect(hashIdentifier(keys, 'phone', 'x')).not.toBe(hashIdentifier(keys, 'ip', 'x'));
  });

  it('compares hashes safely', () => {
    expect(safeEqualHex('abcd', 'abcd')).toBe(true);
    expect(safeEqualHex('abcd', 'abce')).toBe(false);
    expect(safeEqualHex('abcd', 'abcde')).toBe(false);
  });

  it('builds and parses refresh tokens, and hashes the whole token', () => {
    const token = newRefreshToken(SESSION);
    expect(token.startsWith(`${SESSION}.`)).toBe(true);
    expect(token).not.toBe(newRefreshToken(SESSION));
    expect(parseRefreshToken(token)).toEqual({ sessionId: SESSION, secret: token.slice(37) });
    expect(hashRefreshToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(parseRefreshToken(`${LETTERS}.${'a'.repeat(43)}`)).not.toBeNull();
    for (const bad of ['', 'abc', `${SESSION}.short`, `${SESSION}-${'a'.repeat(43)}`, `${LETTERS.toUpperCase()}.${'a'.repeat(43)}`]) {
      expect(parseRefreshToken(bad)).toBeNull();
    }
  });
});

describe('access tokens', () => {
  const keys = deriveKeys(TEST_SECRET);
  const config = createAuthConfig({ secret: TEST_SECRET, appEnv: 'test' });

  it('round-trips the user and session ids', async () => {
    const { token, expiresAt } = await signAccessToken(keys, config, { userId: USER, sessionId: SESSION }, NOW);
    expect(expiresAt.getTime()).toBe(NOW.getTime() + 900_000);
    expect(await verifyAccessToken(keys, config, token, NOW)).toEqual({ ok: true, userId: USER, sessionId: SESSION });
  });

  it('expires exactly at the stated time', async () => {
    const { token } = await signAccessToken(keys, config, { userId: USER, sessionId: SESSION }, NOW);
    const before = new Date(NOW.getTime() + 899_000);
    const at = new Date(NOW.getTime() + 900_000);
    expect((await verifyAccessToken(keys, config, token, before)).ok).toBe(true);
    expect(await verifyAccessToken(keys, config, token, at)).toEqual({ ok: false, reason: 'expired' });
  });

  it('refuses tampering, a different secret and a different issuer', async () => {
    const { token } = await signAccessToken(keys, config, { userId: USER, sessionId: SESSION }, NOW);
    const [head, payload, signature] = token.split('.');
    const forged = Buffer.from(
      JSON.stringify({ ...JSON.parse(Buffer.from(payload ?? '', 'base64url').toString()), sub: SESSION }),
    ).toString('base64url');
    for (const bad of [`${head}.${forged}.${signature}`, `${head}.${payload}.`, 'a.b.c', '', token + 'x']) {
      expect(await verifyAccessToken(keys, config, bad, NOW)).toEqual({ ok: false, reason: 'invalid' });
    }
    const other = createAuthConfig({ secret: `${TEST_SECRET}x`, appEnv: 'test' });
    expect((await verifyAccessToken(deriveKeys(other.secret), other, token, NOW)).ok).toBe(false);
    const otherIssuer = createAuthConfig({ secret: TEST_SECRET, appEnv: 'test', issuer: 'someone' });
    expect((await verifyAccessToken(keys, otherIssuer, token, NOW)).ok).toBe(false);
  });
});

describe('rate limiter', () => {
  const rule = { limit: 3, windowSeconds: 60 };

  it('allows the limit, then says how long to wait', async () => {
    const limiter = new InMemoryRateLimiter();
    for (let n = 0; n < 3; n++) expect(await limiter.hit('k', rule, new Date(NOW.getTime() + n * 10_000))).toEqual({ allowed: true });
    const denied = await limiter.hit('k', rule, new Date(NOW.getTime() + 30_000));
    expect(denied).toEqual({ allowed: false, retryAfterSeconds: 30 });
  });

  it('frees a slot as the oldest hit leaves the window', async () => {
    const limiter = new InMemoryRateLimiter();
    for (let n = 0; n < 3; n++) await limiter.hit('k', rule, new Date(NOW.getTime() + n * 10_000));
    expect((await limiter.hit('k', rule, new Date(NOW.getTime() + 59_000))).allowed).toBe(false);
    expect((await limiter.hit('k', rule, new Date(NOW.getTime() + 60_001))).allowed).toBe(true);
  });

  it('does not extend the lock when a locked key is hammered', async () => {
    const limiter = new InMemoryRateLimiter();
    for (let n = 0; n < 3; n++) await limiter.hit('k', rule, NOW);
    for (let n = 1; n <= 50; n++) await limiter.hit('k', rule, new Date(NOW.getTime() + n * 1000));
    expect((await limiter.hit('k', rule, new Date(NOW.getTime() + 61_000))).allowed).toBe(true);
  });

  it('keeps keys apart and can forget one', async () => {
    const limiter = new InMemoryRateLimiter();
    for (let n = 0; n < 3; n++) await limiter.hit('a', rule, NOW);
    expect((await limiter.hit('a', rule, NOW)).allowed).toBe(false);
    expect((await limiter.hit('b', rule, NOW)).allowed).toBe(true);
    await limiter.reset('a');
    expect((await limiter.hit('a', rule, NOW)).allowed).toBe(true);
  });
});

describe('describeError', () => {
  it('reports the type and database code, never the message', () => {
    const cause = Object.assign(new Error('duplicate key value (+923000000001)'), { code: '23505' });
    const wrapped = new Error('Failed query for +923000000001', { cause });
    const described = describeError(wrapped);
    expect(described).toEqual({ errorName: 'Error', errorCode: '23505' });
    expect(JSON.stringify(described)).not.toContain('923000000001');
  });
});
