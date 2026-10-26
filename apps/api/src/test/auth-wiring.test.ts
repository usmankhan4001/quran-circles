import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  ApiClientError,
  PakistaniMobilePhone,
  RequestCodeBody,
  createApiClient,
  type ApiClient,
} from '@qc/contracts';
import { z } from 'zod';
import { schema } from '@qc/db';
import { createApp } from '../app';
import { FakeCodeSender, authRoutes, createAuthConfig, silentLogger } from '../auth';
import { authLane } from '../middleware/auth-lane';
import { silentLogger as quietLogger } from '../middleware/logger';
import { MemoryRateLimiter } from '../middleware/rate-limit';
import { ApiException } from '../modules/shared/errors';
import { parseWith } from '../modules/shared/route';
import { createHarness, type Harness } from './harness';

/**
 * The real sign-in lane wired into the real API, the way `index.ts` does it: sign in with a code,
 * call endpoints with the token, and see the refusals the apps rely on (expired token, suspended
 * account, signed out). The other test files use a stand-in for who is calling.
 */
let h: Harness;
let sender: FakeCodeSender;
let api: ApiClient;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  h = await createHarness();
});
afterAll(() => h.close());
beforeEach(async () => {
  await h.reset();
  // Most of these tests are about the lane's wiring, not the channel: they use the number-based
  // sign-in, which stays supported when switched on. The email tests below turn it off, as in
  // production.
  buildApp({ fixedCode: '123456', phoneSignIn: true });
});

function buildApp(otp: { fixedCode: string; phoneSignIn: boolean }) {
  sender = new FakeCodeSender();
  const authDeps = {
    db: h.db,
    config: createAuthConfig({
      secret: 'test-secret-test-secret-test-secret-0000',
      appEnv: 'test',
      otp,
    }),
    codeSender: sender,
    logger: silentLogger,
    now: h.clock.now,
  };
  const { principalMiddleware, authFailure } = authLane(authDeps);
  app = createApp({
    db: h.db,
    now: h.clock.now,
    logger: quietLogger,
    rateLimiter: new MemoryRateLimiter(),
    principalMiddleware,
    authFailure,
    mount: [authRoutes(authDeps)],
  });
  api = createApiClient({
    baseUrl: 'http://api.test',
    fetch: async (input, init) => {
      const url = new URL(
        typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
      );
      return app.request(`${url.pathname}${url.search}`, init);
    },
  });
}

const PHONE = '+923000000001';

async function signIn(phone = PHONE) {
  const challenge = await api.auth.requestCode({
    body: { phone, locale: 'en', channel: 'whatsapp' },
  });
  return api.auth.verifyCode({ body: { challengeId: challenge.challengeId, code: '123456' } });
}

const authed = (token: string): ApiClient =>
  createApiClient({
    baseUrl: 'http://api.test',
    getAccessToken: () => token,
    fetch: async (input, init) => {
      const url = new URL(
        typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
      );
      return app.request(`${url.pathname}${url.search}`, init);
    },
  });

const failure = async (promise: Promise<unknown>): Promise<ApiClientError> => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiClientError) return error;
    throw error;
  }
  throw new Error('the call did not fail');
};

describe('signing in and using the API', () => {
  it('mounts the sign-in routes of the auth lane beside the API, with the shared request id', async () => {
    const res = await app.request('/v1/auth/code', {
      method: 'POST',
      body: '{}',
      headers: { 'content-type': 'application/json' },
    });
    expect(res.status).toBe(400);
    expect(res.headers.get('x-request-id')).toBeTruthy();
  });

  it('signs a new person in and lets them read their own profile', async () => {
    const session = await signIn();
    expect(session.isNewAccount).toBe(true);
    const me = await authed(session.accessToken).me.get();
    expect(me).toMatchObject({ id: session.me.id, phone: PHONE, roles: [] });
    // The sign-in lane stores a placeholder name; the API reports no name.
    expect(me.displayName).toBeNull();
  });

  it('gives a new account the name the registration form asks for, once', async () => {
    const session = await signIn();
    const person = authed(session.accessToken);
    await person.me.update({ body: { displayName: 'Sana Test' } });
    expect((await person.me.get()).displayName).toBe('Sana Test');
  });

  it('answers token_expired when the access token has aged out, so the app refreshes', async () => {
    const session = await signIn();
    h.clock.advanceMinutes(16);
    const error = await failure(authed(session.accessToken).me.get());
    expect(error).toMatchObject({ status: 401, code: 'token_expired' });
    const refreshed = await api.auth.refresh({ body: { refreshToken: session.refreshToken } });
    expect((await authed(refreshed.accessToken).me.get()).id).toBe(session.me.id);
  });

  it('answers unauthenticated for a missing or forged token, but public endpoints still work', async () => {
    const forged = await failure(authed('not-a-token').me.get());
    expect(forged).toMatchObject({ status: 401, code: 'unauthenticated' });
    expect((await authed('not-a-token').places.provinces()).items).toHaveLength(1);
  });

  it('answers account_suspended for a suspended account', async () => {
    const session = await signIn();
    await h.db
      .update(schema.users)
      .set({ status: 'suspended' })
      .where(eq(schema.users.id, session.me.id));
    const error = await failure(authed(session.accessToken).me.get());
    expect(error).toMatchObject({ status: 403, code: 'account_suspended' });
  });

  it('stops the token at once after signing out', async () => {
    const session = await signIn();
    const person = authed(session.accessToken);
    expect((await person.me.get()).id).toBe(session.me.id);
    await person.auth.signOut();
    const error = await failure(person.me.get());
    expect(error.status).toBe(401);
  });

  it('takes roles from the database on every request, so a new role works at once and a revoked one stops', async () => {
    const admin = await h.nationalAdmin();
    const adminSession = await signIn(admin.phone);
    const adminApi = authed(adminSession.accessToken);
    const newcomer = await signIn();
    const newcomerApi = authed(newcomer.accessToken);

    expect((await failure(newcomerApi.adminSettings.get())).status).toBe(403);
    const assignment = await adminApi.adminRoles.assign({
      body: { role: 'national_admin', userId: newcomer.me.id },
    });
    expect((await newcomerApi.adminSettings.get()).seasonMode).toBe('circles');
    await adminApi.adminRoles.revoke({ params: { assignmentId: assignment.id } });
    expect((await failure(newcomerApi.adminSettings.get())).status).toBe(403);
  });

  it('turns an invite into a role at sign-in, and the new coordinator can act only in scope', async () => {
    const admin = await h.nationalAdmin();
    const adminApi = authed((await signIn(admin.phone)).accessToken);
    await adminApi.adminRoles.invite({
      body: { role: 'venue_coordinator', venueId: h.world.venueA1, phone: PHONE },
    });
    const coordinator = authed((await signIn(PHONE)).accessToken);
    const me = await coordinator.me.get();
    expect(me.roles.map((r) => [r.role, r.venueId])).toEqual([
      ['venue_coordinator', h.world.venueA1],
    ]);
    const refused = await failure(
      coordinator.adminVenues.update({
        params: { venueId: h.world.venueB1 },
        body: { name: { en: 'Not allowed' } },
      }),
    );
    expect(refused.code).toBe('forbidden');
    const allowed = await coordinator.adminVenues.update({
      params: { venueId: h.world.venueA1 },
      body: { name: { en: 'Renamed by coordinator' } },
    });
    expect(allowed.name.en).toBe('Renamed by coordinator');
  });
});

describe('contract issue codes (SEC-04)', () => {
  it('answers a non-Pakistani-mobile number with phone_not_pakistan_mobile through the real server, sending nothing', async () => {
    for (const phone of ['+447700900123', '+924235761234']) {
      const res = await app.request('/v1/auth/code', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as {
        error: { code: string; issues: { path: string; code: string }[] };
      };
      expect(body.error.code).toBe('validation_failed');
      expect(body.error.issues).toEqual([{ path: 'phone', code: 'phone_not_pakistan_mobile' }]);
    }
    expect(sender.sent).toHaveLength(0);
  });

  it('reports refinement codes from the contract in the shared route binder too, never `custom`', async () => {
    let thrown: unknown;
    try {
      parseWith(z.object({ phone: PakistaniMobilePhone }), { phone: '+447700900123' });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(ApiException);
    expect((thrown as ApiException).extra.issues).toEqual([
      { path: 'phone', code: 'phone_not_pakistan_mobile' },
    ]);
    // Zod's own codes are unchanged.
    expect(() => parseWith(RequestCodeBody, { email: 12 })).toThrow(ApiException);
  });
});

describe('signing in by email, as in production (WhatsApp sign-in off)', () => {
  const EMAIL = 'reader@example.org';

  beforeEach(() => buildApp({ fixedCode: '123456', phoneSignIn: false }));

  it('signs a new person in with an email code and the WhatsApp number given with it', async () => {
    const challenge = await api.auth.requestCode({
      body: { email: EMAIL, phone: PHONE, locale: 'en' },
    });
    expect(challenge.channel).toBe('email');
    expect(sender.last).toMatchObject({ email: EMAIL, channel: 'email', code: '123456' });
    expect(sender.last?.phone).toBeUndefined();
    const session = await api.auth.verifyCode({
      body: { challengeId: challenge.challengeId, code: '123456' },
    });
    expect(session.isNewAccount).toBe(true);
    const me = await authed(session.accessToken).me.get();
    expect(me).toMatchObject({ email: EMAIL, phone: PHONE, roles: [] });
  });

  it('refuses a phone-only request while WhatsApp sign-in is off, sending nothing', async () => {
    const res = await app.request('/v1/auth/code', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone: PHONE }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { issues: { path: string; code: string }[] } };
    expect(body.error.issues).toEqual([{ path: 'email', code: 'email_required' }]);
    expect(sender.sent).toHaveLength(0);
  });

  it('turns an invite that names the email into a role at sign-in', async () => {
    const admin = await h.nationalAdmin();
    await h.db
      .update(schema.users)
      .set({ email: 'admin@example.org', emailVerifiedAt: h.clock.now() })
      .where(eq(schema.users.id, admin.userId));
    const adminSignIn = await api.auth.requestCode({ body: { email: 'admin@example.org' } });
    const adminSession = await api.auth.verifyCode({
      body: { challengeId: adminSignIn.challengeId, code: '123456' },
    });
    await authed(adminSession.accessToken).adminRoles.invite({
      body: {
        role: 'venue_coordinator',
        venueId: h.world.venueA1,
        phone: PHONE,
        email: EMAIL,
      },
    });
    const challenge = await api.auth.requestCode({
      body: { email: EMAIL, phone: '+923000000077', locale: 'en' },
    });
    const session = await api.auth.verifyCode({
      body: { challengeId: challenge.challengeId, code: '123456' },
    });
    const me = await authed(session.accessToken).me.get();
    expect(me.roles.map((r) => [r.role, r.venueId])).toEqual([
      ['venue_coordinator', h.world.venueA1],
    ]);
  });
});
