import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { isNull } from 'drizzle-orm';
import { schema } from '@qc/db';
import { requireAction } from '../../auth/middleware';
import {
  PHONE_A,
  PHONE_B,
  TEST_SECRET,
  createHarness,
  type Harness,
} from '../../auth/testing/harness';

vi.setConfig({ testTimeout: 30_000, hookTimeout: 60_000 });

let h: Harness;
beforeAll(async () => {
  h = await createHarness({
    extend: (app) => {
      app.get('/test/me', requireAction('me.read'), (c) => c.json({ ok: true }));
    },
  });
}, 60_000);
afterAll(async () => {
  await h.close();
});
beforeEach(async () => {
  await h.reset();
});

const REAL_LOOKING_IP = '198.51.100.77';

/** Runs the whole range of sign-in outcomes and returns every response body and every log line. */
async function exerciseEverything() {
  const bodies: string[] = [];
  const keep = async (response: Response) => {
    bodies.push(await response.clone().text());
    return response;
  };

  // An invited coordinator with a name.
  await h.db.insert(schema.coordinatorInvites).values({
    phoneE164: PHONE_A,
    displayName: 'Bilal Ahmed',
    role: 'venue_coordinator',
    scopeType: 'venue',
    venueId: h.world.venueA1,
    createdAt: h.clock.now(),
    expiresAt: new Date(h.clock.now().getTime() + 86400_000),
  });

  // Wrong codes, then the right one.
  const asked = await keep(await h.requestCode(PHONE_A, { ip: REAL_LOOKING_IP }));
  const { challengeId } = (await asked.json()) as { challengeId: string };
  const code = h.sender.last?.code ?? '';
  const wrong = code === '000000' ? '000001' : '000000';
  await keep(
    await h.post('/v1/auth/verify', { challengeId, code: wrong }, { ip: REAL_LOOKING_IP }),
  );
  const verified = await keep(
    await h.post(
      '/v1/auth/verify',
      { challengeId, code, deviceLabel: 'Bilal personal phone' },
      { ip: REAL_LOOKING_IP },
    ),
  );
  const tokens = (await verified.json()) as { accessToken: string; refreshToken: string };

  // Rate limit, bad input, expired code, no token, refresh, reuse, sign out.
  await keep(await h.requestCode(PHONE_A, { ip: REAL_LOOKING_IP }));
  await keep(await h.post('/v1/auth/code', { phone: '03001234567' }));
  await keep(await h.post('/v1/auth/verify', { challengeId, code }, { ip: REAL_LOOKING_IP }));
  await keep(await h.get('/test/me'));
  h.clock.advance(61);
  await keep(await h.requestCode(PHONE_A, { ip: REAL_LOOKING_IP }));
  const staleCode = h.sender.last?.code ?? '';
  h.clock.advance(400);
  const [staleChallenge] = await h.db
    .select()
    .from(schema.otpChallenges)
    .where(isNull(schema.otpChallenges.consumedAt));
  expect(staleChallenge).toBeDefined();
  await keep(await h.post('/v1/auth/verify', { challengeId: staleChallenge?.id, code: staleCode }));
  const refreshed = await keep(
    await h.post('/v1/auth/refresh', { refreshToken: tokens.refreshToken }),
  );
  const next = (await refreshed.json()) as { accessToken: string; refreshToken: string };
  await keep(await h.post('/v1/auth/sign-out', undefined, { token: next.accessToken }));

  // A second sign-in whose refresh token is then replayed.
  h.clock.advance(1000);
  const second = await h.signIn(PHONE_A, { ip: REAL_LOOKING_IP });
  await keep(await h.post('/v1/auth/refresh', { refreshToken: second.body.refreshToken }));
  await keep(await h.post('/v1/auth/refresh', { refreshToken: second.body.refreshToken }));

  // A delivery failure and a database failure.
  h.clock.advance(4000);
  h.sender.failWith = new Error(`provider rejected ${PHONE_B}`);
  await keep(await h.requestCode(PHONE_B));
  h.sender.failWith = null;
  const failing = await keep(await h.requestCode(PHONE_B));
  const secondChallenge = ((await failing.json()) as { challengeId: string }).challengeId;
  const secondCode = h.sender.last?.code ?? '';
  await h.pg.exec(`
    CREATE FUNCTION fail_session() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'boom for %', NEW.user_id; END; $$ LANGUAGE plpgsql;
    CREATE TRIGGER fail_session BEFORE INSERT ON auth_sessions FOR EACH ROW EXECUTE FUNCTION fail_session();
  `);
  try {
    await keep(await h.post('/v1/auth/verify', { challengeId: secondChallenge, code: secondCode }));
  } finally {
    await h.pg.exec('DROP TRIGGER fail_session ON auth_sessions; DROP FUNCTION fail_session();');
  }

  return {
    bodies,
    tokens: [
      tokens.accessToken,
      tokens.refreshToken,
      next.accessToken,
      next.refreshToken,
      second.body.accessToken,
      second.body.refreshToken,
    ],
  };
}

describe('personal data stays out of logs and error bodies', () => {
  it('never logs phone numbers, codes, tokens, names, device labels or addresses', async () => {
    const { tokens } = await exerciseEverything();
    const logs = h.logger.text();

    // The flow really logged things, so the checks below are not vacuous.
    const events = new Set(h.logger.entries.map((e) => e.event));
    for (const event of [
      'auth.code_requested',
      'auth.code_rejected',
      'auth.signed_in',
      'auth.refresh_reuse_detected',
      'auth.signed_out',
      'auth.code_send_failed',
      'auth.unexpected_error',
    ]) {
      expect(events, event).toContain(event);
    }

    const secrets = [
      PHONE_A,
      PHONE_A.slice(1),
      `0${PHONE_A.slice(3)}`,
      PHONE_B,
      PHONE_B.slice(1),
      ...h.sender.sent.map((m) => m.code),
      ...tokens,
      ...tokens.map((t) => t.split('.')[1] ?? ''),
      'Bilal',
      'Bilal personal phone',
      REAL_LOOKING_IP,
      '203.0.113.7',
      TEST_SECRET,
      'boom for',
      'provider rejected',
    ];
    for (const secret of secrets) {
      expect(secret.length).toBeGreaterThan(3);
      expect(logs, `logs contain ${secret.slice(0, 6)}...`).not.toContain(secret);
    }
  });

  it('never puts the phone number, a code or a token in an error body', async () => {
    const { bodies, tokens } = await exerciseEverything();
    const errors = bodies.filter((b) => b.includes('"error"'));
    expect(errors.length).toBeGreaterThan(5);
    for (const body of errors) {
      for (const secret of [
        PHONE_A,
        PHONE_A.slice(1),
        PHONE_B,
        '03001234567',
        ...tokens,
        ...h.sender.sent.map((m) => m.code),
      ]) {
        expect(body).not.toContain(secret);
      }
      const parsed = JSON.parse(body) as { error: Record<string, unknown> };
      expect(
        Object.keys(parsed.error)
          .sort()
          .every((k) =>
            ['code', 'messageKey', 'requestId', 'issues', 'retryAfterSeconds'].includes(k),
          ),
      ).toBe(true);
    }
  });

  it('stores no raw address and no plain code or token anywhere in the database', async () => {
    const { tokens } = await exerciseEverything();
    const dump = JSON.stringify([
      await h.db.select().from(schema.otpChallenges),
      await h.db.select().from(schema.authSessions),
      await h.db.select().from(schema.auditLog),
    ]);
    for (const secret of [
      REAL_LOOKING_IP,
      '203.0.113.7',
      ...tokens,
      ...h.sender.sent.map((m) => m.code),
    ]) {
      expect(dump).not.toContain(secret);
    }
    // Audit rows hold ids and roles, not numbers or names.
    const audit = JSON.stringify(await h.db.select().from(schema.auditLog));
    expect(audit).not.toContain(PHONE_A);
    expect(audit).not.toContain('Bilal');
  });
});
