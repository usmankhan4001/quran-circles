import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { ApiError } from '@qc/contracts';
import { schema } from '@qc/db';
import { authMiddleware, requireAction } from './middleware';
import { PHONE_A, PHONE_B, TEST_SECRET, createHarness, type Harness } from './testing/harness';
import type { AuthVariables } from './types';

vi.setConfig({ testTimeout: 30_000, hookTimeout: 60_000 });

let h: Harness;
beforeAll(async () => {
  h = await createHarness({
    extend: (app) => {
      app.get('/test/principal', requireAction('me.read'), (c) => c.json(c.get('principal')));
      app.put(
        '/test/venues/:venueId/:cityId',
        requireAction('venue.update', (c) => ({
          venueId: c.req.param('venueId'),
          cityId: c.req.param('cityId'),
        })),
        (c) => c.json({ ok: true }),
      );
      app.post(
        '/test/cities/:cityId/venues',
        requireAction('venue.create', (c) => ({ cityId: c.req.param('cityId') })),
        (c) => c.json({ ok: true }),
      );
      app.get('/test/audit', requireAction('audit.read'), (c) => c.json({ ok: true }));
      app.get('/test/request-id', (c) => c.json({ requestId: c.get('requestId') }));
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

/** An account that signs in and holds the given role, returning the access token. */
async function staffToken(
  phone: string,
  role: 'national_admin' | 'city_coordinator' | 'venue_coordinator',
  target: { cityId?: string; venueId?: string } = {},
) {
  const user = await h.createUser({ phoneE164: phone });
  const assignment = await h.grantRole(user.id, role, target);
  h.clock.advance(61);
  const { body } = await h.signIn(phone);
  return { token: body.accessToken, userId: user.id, assignment };
}

const updateVenue = (token: string, venueId: string, cityId: string) =>
  h.app.request(`/test/venues/${venueId}/${cityId}`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${token}` },
  });

describe('principal loading', () => {
  it('sets no principal without a token, and the guarded route answers unauthenticated', async () => {
    const response = await h.get('/test/principal');
    expect(await errorOf(response)).toMatchObject({
      status: 401,
      code: 'unauthenticated',
      messageKey: 'errors.unauthenticated',
      requestId: 'test-request-id',
    });
  });

  it('loads the live assignments of the signed-in person', async () => {
    const user = await h.createUser({ phoneE164: PHONE_A });
    await h.grantRole(user.id, 'venue_coordinator', { venueId: h.world.venueA1 });
    const revoked = await h.grantRole(user.id, 'city_coordinator', { cityId: h.world.cityA.id });
    await h.db
      .update(schema.roleAssignments)
      .set({ revokedAt: h.clock.now() })
      .where(eq(schema.roleAssignments.id, revoked.id));
    h.clock.advance(61);
    const { body } = await h.signIn(PHONE_A);
    const response = await h.get('/test/principal', { token: body.accessToken });
    const principal = (await response.json()) as { userId: string; assignments: { role: string }[] };
    expect(principal.userId).toBe(user.id);
    expect(principal.assignments).toEqual([
      { role: 'venue_coordinator', cityId: null, venueId: h.world.venueA1 },
    ]);
  });

  it('asks for sign-in on a malformed Authorization header', async () => {
    for (const header of ['Basic abc', 'Bearer', 'Bearer a b', 'token abc', 'Bearer ' + 'x'.repeat(10) + '!!']) {
      const response = await h.app.request('/test/principal', { headers: { authorization: header } });
      expect((await errorOf(response)).code).toBe('unauthenticated');
    }
  });

  it('rejects tokens signed with another key, with no signature, or for another audience', async () => {
    const { SignJWT } = await import('jose');
    const user = await h.createUser({ phoneE164: PHONE_A });
    const claims = (audience: string) => ({
      sid: '00000000-0000-4000-8000-000000000001',
      sub: user.id,
      iss: 'qc-api',
      aud: audience,
      iat: Math.floor(h.clock.now().getTime() / 1000),
      exp: Math.floor(h.clock.now().getTime() / 1000) + 3600,
    });
    const signed = (key: Uint8Array, audience = 'qc-app') =>
      new SignJWT(claims(audience)).setProtectedHeader({ alg: 'HS256' }).sign(key);
    const unsigned = () => {
      const part = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
      return `${part({ alg: 'none', typ: 'JWT' })}.${part(claims('qc-app'))}.`;
    };
    const tokens = [
      await signed(new Uint8Array(32).fill(7)),
      unsigned(),
      // The configured secret itself is not the signing key: keys are derived from it.
      await signed(new TextEncoder().encode(TEST_SECRET)),
      await signed(new Uint8Array(32).fill(7), 'someone-else'),
    ];
    for (const token of tokens) {
      expect((await errorOf(await h.get('/test/principal', { token }))).code).toBe('unauthenticated');
    }
  });

  it('refuses a token whose session no longer exists', async () => {
    const { body } = await h.signIn(PHONE_A);
    await h.db.delete(schema.authSessions);
    expect((await errorOf(await h.get('/test/principal', { token: body.accessToken }))).code).toBe(
      'unauthenticated',
    );
  });

  it('refuses a token whose session has run out, before the token itself expires', async () => {
    const short = await createHarness({ config: { refreshTokenTtlSeconds: 300 } });
    try {
      const { body } = await short.signIn(PHONE_A);
      short.clock.advance(301);
      const response = await short.app.request('/v1/auth/sign-out', {
        method: 'POST',
        headers: { authorization: `Bearer ${body.accessToken}` },
      });
      expect(response.status).toBe(401);
    } finally {
      await short.close();
    }
  });

  it('refuses a suspended account at once, with account_suspended', async () => {
    const { body } = await h.signIn(PHONE_A);
    expect((await h.get('/test/principal', { token: body.accessToken })).status).toBe(200);
    await h.db
      .update(schema.users)
      .set({ status: 'suspended' })
      .where(eq(schema.users.id, body.me.id));
    expect(await errorOf(await h.get('/test/principal', { token: body.accessToken }))).toMatchObject({
      status: 403,
      code: 'account_suspended',
    });
  });

  it('fails closed when the database cannot be read', async () => {
    const { body } = await h.signIn(PHONE_A);
    const broken = new Hono<{ Variables: AuthVariables }>();
    let reached = false;
    const failingDb = new Proxy(h.db, {
      get(target, prop, receiver) {
        if (prop === 'select') {
          return () => {
            throw new Error(`connection lost for ${PHONE_A}`);
          };
        }
        return Reflect.get(target, prop, receiver) as unknown;
      },
    });
    broken.use('*', authMiddleware({ ...h.deps, db: failingDb }));
    broken.get('/x', (c) => {
      reached = true;
      return c.json({ principal: c.get('principal') });
    });
    const response = await broken.request('/x', { headers: { authorization: `Bearer ${body.accessToken}` } });
    expect(response.status).toBe(500);
    expect(ApiError.parse(await response.json()).error.code).toBe('internal_error');
    expect(reached).toBe(false);
    expect(h.logger.text()).not.toContain(PHONE_A);
  });

  it('fills in a request id when the app has none, and is safe to run twice', async () => {
    const bare = new Hono<{ Variables: AuthVariables }>();
    bare.use('*', authMiddleware(h.deps));
    bare.use('*', authMiddleware(h.deps));
    bare.get('/id', (c) => c.json({ requestId: c.get('requestId') }));
    const body = (await (await bare.request('/id')).json()) as { requestId: string };
    expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('role changes take effect at once', () => {
  it('a revoked assignment stops working on the very next request, with the same token', async () => {
    const coordinator = await staffToken(PHONE_A, 'venue_coordinator', { venueId: h.world.venueA1 });
    expect((await updateVenue(coordinator.token, h.world.venueA1, h.world.cityA.id)).status).toBe(200);

    await h.db
      .update(schema.roleAssignments)
      .set({ revokedAt: h.clock.now() })
      .where(eq(schema.roleAssignments.id, coordinator.assignment.id));

    const after = await updateVenue(coordinator.token, h.world.venueA1, h.world.cityA.id);
    expect(await errorOf(after)).toMatchObject({ status: 403, code: 'forbidden' });
  });

  it('handover: the old coordinator loses the venue and the new one gains it, no re-login', async () => {
    const before = await staffToken(PHONE_A, 'venue_coordinator', { venueId: h.world.venueA1 });
    const successor = await h.createUser({ phoneE164: PHONE_B });
    h.clock.advance(61);
    const successorSignIn = await h.signIn(PHONE_B);
    const token = successorSignIn.body.accessToken;
    expect((await updateVenue(token, h.world.venueA1, h.world.cityA.id)).status).toBe(403);

    await h.db.transaction(async (tx) => {
      await tx
        .update(schema.roleAssignments)
        .set({ revokedAt: h.clock.now() })
        .where(eq(schema.roleAssignments.id, before.assignment.id));
      await tx.insert(schema.roleAssignments).values({
        userId: successor.id,
        role: 'venue_coordinator',
        scopeType: 'venue',
        venueId: h.world.venueA1,
      });
    });

    expect((await updateVenue(before.token, h.world.venueA1, h.world.cityA.id)).status).toBe(403);
    expect((await updateVenue(token, h.world.venueA1, h.world.cityA.id)).status).toBe(200);
  });

  it('a role granted after sign-in counts on the next request', async () => {
    const { body } = await h.signIn(PHONE_A);
    expect((await updateVenue(body.accessToken, h.world.venueA1, h.world.cityA.id)).status).toBe(403);
    await h.grantRole(body.me.id, 'venue_coordinator', { venueId: h.world.venueA1 });
    expect((await updateVenue(body.accessToken, h.world.venueA1, h.world.cityA.id)).status).toBe(200);
  });

  it('a city coordinator reaches venues in their city and nowhere else', async () => {
    const { token } = await staffToken(PHONE_A, 'city_coordinator', { cityId: h.world.cityA.id });
    expect((await updateVenue(token, h.world.venueA1, h.world.cityA.id)).status).toBe(200);
    expect((await updateVenue(token, h.world.venueA2, h.world.cityA.id)).status).toBe(200);
    expect((await updateVenue(token, h.world.venueB1, h.world.cityB.id)).status).toBe(403);
  });

  it('a venue coordinator cannot reach a sibling venue or a city action', async () => {
    const { token } = await staffToken(PHONE_A, 'venue_coordinator', { venueId: h.world.venueA1 });
    expect((await updateVenue(token, h.world.venueA2, h.world.cityA.id)).status).toBe(403);
    const create = await h.app.request(`/test/cities/${h.world.cityA.id}/venues`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    });
    expect((await errorOf(create)).code).toBe('forbidden');
  });

  it('a national admin reaches everything', async () => {
    const { token } = await staffToken(PHONE_A, 'national_admin');
    expect((await updateVenue(token, h.world.venueB1, h.world.cityB.id)).status).toBe(200);
    const audit = await h.get('/test/audit', { token });
    expect(audit.status).toBe(200);
  });

  it('an ordinary signed-in person gets forbidden, not unauthenticated', async () => {
    const { body } = await h.signIn(PHONE_A);
    const audit = await h.get('/test/audit', { token: body.accessToken });
    expect(await errorOf(audit)).toMatchObject({ status: 403, code: 'forbidden', messageKey: 'errors.forbidden' });
  });
});
