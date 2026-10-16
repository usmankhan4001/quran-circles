import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { ApiError, RequestCodeResponse, SignInResponse } from '@qc/contracts';
import { schema } from '@qc/db';
import { PHONE_A, PHONE_B, TEST_IP, createHarness, type Harness } from '../../auth/testing/harness';

vi.setConfig({ testTimeout: 30_000, hookTimeout: 60_000 });

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
}, 60_000);
afterAll(async () => {
  await h.close();
});
beforeEach(async () => {
  await h.reset();
});

const challengeRows = () => h.db.select().from(schema.otpChallenges);

async function errorOf(response: Response) {
  const body = ApiError.parse(await response.json());
  return { status: response.status, ...body.error };
}

async function startCode(phone = PHONE_A, ip?: string) {
  const response = await h.requestCode(phone, ip ? { ip } : {});
  expect(response.status).toBe(202);
  const body = RequestCodeResponse.parse(await response.json());
  const code = h.sender.last?.code ?? '';
  return { ...body, code };
}

const verify = (
  challengeId: string,
  code: string,
  extra: Record<string, unknown> = {},
  ip?: string,
) => h.post('/v1/auth/verify', { challengeId, code, ...extra }, ip ? { ip } : {});

describe('auth.requestCode', () => {
  it('sends a six digit code and answers with the contract shape', async () => {
    const response = await h.requestCode(PHONE_A);
    expect(response.status).toBe(202);
    const body = RequestCodeResponse.parse(await response.json());
    expect(body.channel).toBe('whatsapp');
    expect(body.resendAfterSeconds).toBe(60);
    expect(new Date(body.expiresAt).getTime()).toBe(h.clock.now().getTime() + 300_000);

    expect(h.sender.sent).toHaveLength(1);
    expect(h.sender.last).toMatchObject({ phone: PHONE_A, locale: 'ur', channel: 'whatsapp' });
    expect(h.sender.last?.code).toMatch(/^[0-9]{6}$/);
  });

  it('passes the chosen language and channel to the sender', async () => {
    const response = await h.post('/v1/auth/code', {
      phone: PHONE_A,
      locale: 'en',
      channel: 'sms',
    });
    expect(response.status).toBe(202);
    expect(h.sender.last).toMatchObject({ locale: 'en', channel: 'sms' });
    expect(RequestCodeResponse.parse(await response.json()).channel).toBe('sms');
  });

  it('reports the channel the sender really used after a fallback', async () => {
    h.sender.reportChannel = 'sms';
    const response = await h.requestCode(PHONE_A);
    expect(RequestCodeResponse.parse(await response.json()).channel).toBe('sms');
  });

  it('stores only a hash of the code, bound to its challenge', async () => {
    const { challengeId, code } = await startCode();
    const [row] = await challengeRows();
    expect(row?.id).toBe(challengeId);
    expect(row?.codeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(row)).not.toContain(code);
    expect(row?.attempts).toBe(0);
    expect(row?.consumedAt).toBeNull();
    // The address is stored as a hash for rate limits, never as given.
    expect(row?.ipHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(row)).not.toContain(TEST_IP);
  });

  it('answers the same way for a number with an account and one without', async () => {
    await h.createUser({ phoneE164: PHONE_A });
    const known = await h.requestCode(PHONE_A);
    const unknown = await h.requestCode(PHONE_B);
    expect(known.status).toBe(unknown.status);
    const a = (await known.json()) as Record<string, unknown>;
    const b = (await unknown.json()) as Record<string, unknown>;
    expect(Object.keys(a).sort()).toEqual(Object.keys(b).sort());
    expect(a.resendAfterSeconds).toBe(b.resendAfterSeconds);
  });

  it('refuses a malformed number, naming the field and not the value', async () => {
    const response = await h.post('/v1/auth/code', { phone: '0300 1234567' });
    const error = await errorOf(response);
    expect(error.status).toBe(400);
    expect(error.code).toBe('validation_failed');
    expect(error.issues?.map((i) => i.path)).toContain('phone');
    expect(JSON.stringify(error)).not.toContain('1234567');
    expect(h.sender.sent).toHaveLength(0);
  });

  it('refuses a body that is not JSON, not an object, or too large', async () => {
    for (const raw of ['not json', '"text"', '[]', `{"phone":"${'1'.repeat(5000)}"}`]) {
      const response = await h.post('/v1/auth/code', null, { raw });
      expect((await errorOf(response)).code).toBe('validation_failed');
    }
    expect(h.sender.sent).toHaveLength(0);
  });

  it('retires the earlier code when a new one is asked for', async () => {
    const first = await startCode();
    h.clock.advance(61);
    const second = await startCode();
    const old = await verify(first.challengeId, first.code);
    expect((await errorOf(old)).code).toBe('otp_invalid');
    const fresh = await verify(second.challengeId, second.code);
    expect(fresh.status).toBe(200);
  });

  it('makes the caller wait between codes, longer each time', async () => {
    await startCode();
    const early = await errorOf(await h.requestCode(PHONE_A));
    expect(early).toMatchObject({ status: 429, code: 'rate_limited' });
    expect(early.retryAfterSeconds).toBe(60);

    h.clock.advance(60);
    const second = RequestCodeResponse.parse(await (await h.requestCode(PHONE_A)).json());
    expect(second.resendAfterSeconds).toBe(120);
    h.clock.advance(119);
    expect((await errorOf(await h.requestCode(PHONE_A))).retryAfterSeconds).toBe(1);
    h.clock.advance(1);
    const third = RequestCodeResponse.parse(await (await h.requestCode(PHONE_A)).json());
    expect(third.resendAfterSeconds).toBe(240);
  });

  it('sends the Retry-After header with a rate limit', async () => {
    await startCode();
    const response = await h.requestCode(PHONE_A);
    expect(response.headers.get('retry-after')).toBe('60');
  });

  it('keeps the wait after a restart, because it lives in the database', async () => {
    await startCode();
    h.limiter.clear(); // what a restart does to the in-memory limiter
    const response = await h.requestCode(PHONE_A);
    expect((await errorOf(response)).code).toBe('rate_limited');
  });

  it('allows five codes an hour for one number, then locks it', async () => {
    for (const wait of [0, 60, 120, 240, 480]) {
      h.clock.advance(wait);
      await startCode();
    }
    h.clock.advance(900);
    const blocked = await errorOf(await h.requestCode(PHONE_A));
    expect(blocked.code).toBe('rate_limited');
    expect(blocked.retryAfterSeconds).toBeGreaterThan(900);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(3600);
    // Once the oldest code leaves the hour, one more is allowed.
    h.clock.advance(blocked.retryAfterSeconds ?? 0);
    expect((await h.requestCode(PHONE_A)).status).toBe(202);
  });

  it('limits codes per address across different numbers', async () => {
    const tight = await createHarness({
      config: { rateLimits: { requestPerIp: { limit: 3, windowSeconds: 3600 } } },
    });
    try {
      for (let n = 0; n < 3; n++) {
        expect((await tight.requestCode(`+92300000010${n}`, { ip: '198.51.100.1' })).status).toBe(
          202,
        );
      }
      const blocked = await errorOf(
        await tight.requestCode('+923000000109', { ip: '198.51.100.1' }),
      );
      expect(blocked.code).toBe('rate_limited');
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
      // Another address is not affected.
      expect((await tight.requestCode('+923000000109', { ip: '198.51.100.2' })).status).toBe(202);
    } finally {
      await tight.close();
    }
  });

  it('fails with service_unavailable when the code cannot be delivered, and keeps nothing', async () => {
    h.sender.failWith = new Error('provider down');
    const error = await errorOf(await h.requestCode(PHONE_A));
    expect(error).toMatchObject({ status: 503, code: 'service_unavailable' });
    expect(await challengeRows()).toHaveLength(0);
    // The failed attempt does not lock the person out of trying again.
    h.sender.failWith = null;
    expect((await h.requestCode(PHONE_A)).status).toBe(202);
  });

  it('uses the fixed code in test mode, and only then', async () => {
    const fixed = await createHarness({ config: { otp: { fixedCode: '123456' } } });
    try {
      await fixed.requestCode(PHONE_A);
      expect(fixed.sender.last?.code).toBe('123456');
    } finally {
      await fixed.close();
    }
    await startCode(PHONE_B);
    expect(h.sender.last?.code).not.toBeUndefined();
  });
});

describe('auth.verifyCode', () => {
  it('signs a new person in, creating the account', async () => {
    const { challengeId, code } = await startCode();
    const response = await verify(challengeId, code, { deviceLabel: 'Android phone' });
    expect(response.status).toBe(200);
    const body = SignInResponse.parse(await response.json());
    expect(body.isNewAccount).toBe(true);
    expect(body.me.phone).toBe(PHONE_A);
    expect(body.me.displayName).toBeNull();
    expect(body.me.roles).toEqual([]);
    expect(body.me.locale).toBe('ur');
    expect(new Date(body.accessTokenExpiresAt).getTime()).toBe(
      h.clock.now().getTime() + 15 * 60_000,
    );
    expect(new Date(body.refreshTokenExpiresAt).getTime()).toBe(
      h.clock.now().getTime() + 30 * 24 * 3600_000,
    );

    const users = await h.db.select().from(schema.users);
    expect(users).toHaveLength(1);
    expect(users[0]?.phoneE164).toBe(PHONE_A);
    expect(users[0]?.phoneVerifiedAt.getTime()).toBe(h.clock.now().getTime());
    const [session] = await h.db.select().from(schema.authSessions);
    expect(session?.deviceLabel).toBe('Android phone');
    expect(session?.userId).toBe(body.me.id);
  });

  it('marks the code used', async () => {
    const { challengeId, code } = await startCode();
    await verify(challengeId, code);
    const [row] = await challengeRows();
    expect(row?.consumedAt).not.toBeNull();
    const again = await errorOf(await verify(challengeId, code));
    expect(again).toMatchObject({ status: 400, code: 'otp_invalid' });
  });

  it('signs the same person in again to the same account', async () => {
    const first = await h.signIn(PHONE_A);
    h.clock.advance(120);
    const second = await h.signIn(PHONE_A);
    expect(first.body.isNewAccount).toBe(true);
    expect(second.body.isNewAccount).toBe(false);
    expect(second.body.me.id).toBe(first.body.me.id);
    expect(await h.db.select().from(schema.users)).toHaveLength(1);
    expect(await h.db.select().from(schema.authSessions)).toHaveLength(2);
  });

  it('rejects a wrong code and counts the attempt', async () => {
    const { challengeId, code } = await startCode();
    const wrong = code === '000000' ? '000001' : '000000';
    const error = await errorOf(await verify(challengeId, wrong));
    expect(error).toMatchObject({ status: 400, code: 'otp_invalid' });
    const [row] = await challengeRows();
    expect(row?.attempts).toBe(1);
    expect(row?.consumedAt).toBeNull();
    // The right code still works afterwards.
    expect((await verify(challengeId, code)).status).toBe(200);
  });

  it('locks the code after five wrong tries, even for the right code', async () => {
    const { challengeId, code } = await startCode();
    const wrong = code === '000000' ? '000001' : '000000';
    const outcomes: string[] = [];
    for (let n = 0; n < 5; n++)
      outcomes.push((await errorOf(await verify(challengeId, wrong))).code);
    expect(outcomes).toEqual([
      'otp_invalid',
      'otp_invalid',
      'otp_invalid',
      'otp_invalid',
      'otp_too_many_attempts',
    ]);

    const locked = await errorOf(await verify(challengeId, code));
    expect(locked).toMatchObject({ status: 429, code: 'otp_too_many_attempts' });
    expect(locked.retryAfterSeconds).toBeGreaterThan(0);
    expect(await h.db.select().from(schema.users)).toHaveLength(0);
    const [row] = await challengeRows();
    expect(row?.attempts).toBe(5);
  });

  it('cannot be beaten by guessing in parallel', async () => {
    const { challengeId, code } = await startCode();
    const wrong = code === '000000' ? '000001' : '000000';
    const responses = await Promise.all(
      Array.from({ length: 12 }, () => verify(challengeId, wrong)),
    );
    expect(responses.every((r) => r.status !== 200)).toBe(true);
    const [row] = await challengeRows();
    expect(row?.attempts).toBe(5);
  });

  it('lets only one of several parallel verifications of the right code through', async () => {
    const { challengeId, code } = await startCode();
    const responses = await Promise.all(Array.from({ length: 4 }, () => verify(challengeId, code)));
    const statuses = responses.map((r) => r.status).sort();
    expect(statuses.filter((s) => s === 200)).toHaveLength(1);
    expect(await h.db.select().from(schema.authSessions)).toHaveLength(1);
    expect(await h.db.select().from(schema.users)).toHaveLength(1);
  });

  it('reports an expired code', async () => {
    const { challengeId, code } = await startCode();
    h.clock.advance(301);
    const error = await errorOf(await verify(challengeId, code));
    expect(error).toMatchObject({ status: 410, code: 'otp_expired' });
    expect(await h.db.select().from(schema.users)).toHaveLength(0);
  });

  it('accepts a code in its last second', async () => {
    const { challengeId, code } = await startCode();
    h.clock.advance(299);
    expect((await verify(challengeId, code)).status).toBe(200);
  });

  it('answers an unknown challenge like a wrong code', async () => {
    const error = await errorOf(await verify('00000000-0000-4000-8000-000000000001', '123456'));
    expect(error).toMatchObject({ status: 400, code: 'otp_invalid' });
  });

  it('rejects a bad code shape or challenge id before touching the database', async () => {
    const { challengeId } = await startCode();
    for (const body of [
      { challengeId, code: '12345' },
      { challengeId, code: '12345a' },
      { challengeId, code: 123456 },
      { challengeId: 'nope', code: '123456' },
      { code: '123456' },
      { challengeId, code: '123456', deviceLabel: 'x'.repeat(61) },
    ]) {
      const error = await errorOf(await h.post('/v1/auth/verify', body));
      expect(error.code).toBe('validation_failed');
    }
    const [row] = await challengeRows();
    expect(row?.attempts).toBe(0);
  });

  it('does not accept a code made for another challenge', async () => {
    const first = await startCode(PHONE_A);
    h.clock.advance(1);
    const second = await startCode(PHONE_B);
    const swapped = await errorOf(await verify(first.challengeId, second.code));
    expect(swapped.code).toBe('otp_invalid');
  });

  it('limits attempts per address', async () => {
    const tight = await createHarness({
      config: { rateLimits: { verifyPerIp: { limit: 3, windowSeconds: 600 } } },
    });
    try {
      const outcomes: number[] = [];
      for (let n = 0; n < 4; n++) {
        const response = await tight.post(
          '/v1/auth/verify',
          { challengeId: '00000000-0000-4000-8000-000000000001', code: '123456' },
          { ip: '198.51.100.9' },
        );
        outcomes.push(response.status);
      }
      expect(outcomes).toEqual([400, 400, 400, 429]);
    } finally {
      await tight.close();
    }
  });

  it('limits attempts per number across codes', async () => {
    const tight = await createHarness({
      config: { rateLimits: { verifyPerPhone: { limit: 2, windowSeconds: 900 } } },
    });
    try {
      const asked = await tight.requestCode(PHONE_A);
      const { challengeId } = (await asked.json()) as { challengeId: string };
      const code = tight.sender.last?.code ?? '';
      const wrong = code === '000000' ? '000001' : '000000';
      await tight.post('/v1/auth/verify', { challengeId, code: wrong });
      await tight.post('/v1/auth/verify', { challengeId, code: wrong });
      const third = await tight.post('/v1/auth/verify', { challengeId, code });
      const error = await errorOf(third);
      expect(error).toMatchObject({ status: 429, code: 'otp_too_many_attempts' });
      expect(error.retryAfterSeconds).toBeGreaterThan(0);
    } finally {
      await tight.close();
    }
  });

  it('refuses a suspended account after the code is right', async () => {
    const user = await h.createUser({ phoneE164: PHONE_A, status: 'suspended' });
    // Asking for a code looks the same as for anyone else.
    const { challengeId, code } = await startCode(PHONE_A);
    const error = await errorOf(await verify(challengeId, code));
    expect(error).toMatchObject({ status: 403, code: 'account_suspended' });
    expect(await h.db.select().from(schema.authSessions)).toHaveLength(0);
    const [row] = await h.db.select().from(schema.users).where(eq(schema.users.id, user.id));
    expect(row?.status).toBe('suspended');
  });

  it('keeps a named account name and updates when the number was verified', async () => {
    const user = await h.createUser({ phoneE164: PHONE_A, displayName: 'Amina Khan' });
    h.clock.advance(3600);
    const signedIn = await h.signIn(PHONE_A);
    expect(signedIn.body.me.displayName).toBe('Amina Khan');
    const [row] = await h.db.select().from(schema.users).where(eq(schema.users.id, user.id));
    expect(row?.phoneVerifiedAt.getTime()).toBe(h.clock.now().getTime());
    expect(row?.lastSeenAt?.getTime()).toBe(h.clock.now().getTime());
  });

  it('answers a failure after the code with internal_error and leaves everything as it was', async () => {
    const { challengeId, code } = await startCode();
    await h.pg.exec(`
      CREATE FUNCTION fail_session() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'boom'; END; $$ LANGUAGE plpgsql;
      CREATE TRIGGER fail_session BEFORE INSERT ON auth_sessions FOR EACH ROW EXECUTE FUNCTION fail_session();
    `);
    try {
      const error = await errorOf(await verify(challengeId, code));
      expect(error).toMatchObject({ status: 500, code: 'internal_error' });
    } finally {
      await h.pg.exec('DROP TRIGGER fail_session ON auth_sessions; DROP FUNCTION fail_session();');
    }
    // Nothing half-done: no account, and the code can still be used.
    expect(await h.db.select().from(schema.users)).toHaveLength(0);
    const [row] = await challengeRows();
    expect(row?.consumedAt).toBeNull();
    expect((await verify(challengeId, code)).status).toBe(200);
  });
});
