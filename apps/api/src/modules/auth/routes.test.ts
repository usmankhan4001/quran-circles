import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { ApiError, endpoints } from '@qc/contracts';
import { authMiddleware, authRoutes, requireAction, type AuthVariables } from '../../auth';
import { PHONE_A, createHarness, type Harness } from '../../auth/testing/harness';

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

describe('authRoutes mounted on its own', () => {
  it('serves the contract paths and nothing else', async () => {
    const app = new Hono().route('/', authRoutes(h.deps));
    for (const id of [
      'auth.requestCode',
      'auth.verifyCode',
      'auth.refresh',
      'auth.signOut',
    ] as const) {
      const { method, path } = endpoints[id];
      expect(method).toBe('POST');
      const response = await app.request(path, { method, body: '{}' });
      // Reached the handler: a validation or sign-in error, not a missing route.
      expect(response.status, path).not.toBe(404);
    }
    expect((await app.request('/v1/auth/code', { method: 'GET' })).status).toBe(404);
    expect((await app.request('/v1/auth/other', { method: 'POST', body: '{}' })).status).toBe(404);
  });

  it('signs out without any middleware from the host app, and invents a request id', async () => {
    const app = new Hono().route('/', authRoutes(h.deps));
    const { body } = await h.signIn(PHONE_A);
    const noToken = await app.request('/v1/auth/sign-out', { method: 'POST' });
    expect(noToken.status).toBe(401);
    const error = ApiError.parse(await noToken.json()).error;
    expect(error.requestId).toMatch(/^[0-9a-f-]{36}$/);

    const out = await app.request('/v1/auth/sign-out', {
      method: 'POST',
      headers: { authorization: `Bearer ${body.accessToken}` },
    });
    expect(out.status).toBe(204);
  });

  it('turns an unexpected failure into internal_error without details', async () => {
    const app = new Hono().route('/', authRoutes(h.deps));
    await h.pg.exec(`
      CREATE FUNCTION fail_challenge() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'secret detail'; END; $$ LANGUAGE plpgsql;
      CREATE TRIGGER fail_challenge BEFORE INSERT ON otp_challenges FOR EACH ROW EXECUTE FUNCTION fail_challenge();
    `);
    try {
      const response = await app.request('/v1/auth/code', {
        method: 'POST',
        body: JSON.stringify({ phone: PHONE_A }),
      });
      expect(response.status).toBe(500);
      const text = await response.text();
      expect(ApiError.parse(JSON.parse(text)).error.code).toBe('internal_error');
      expect(text).not.toContain('secret detail');
      expect(text).not.toContain(PHONE_A);
    } finally {
      await h.pg.exec(
        'DROP TRIGGER fail_challenge ON otp_challenges; DROP FUNCTION fail_challenge();',
      );
    }
    expect(h.sender.sent).toHaveLength(0);
  });
});

describe('the interface the api-core lane codes against', () => {
  it('fits an app that has more variables than ours', async () => {
    type Env = { Variables: AuthVariables & { extra: string } };
    const app = new Hono<Env>();
    app.use('*', async (c, next) => {
      c.set('requestId', 'r-1');
      c.set('extra', 'x');
      await next();
    });
    app.use('*', authMiddleware(h.deps));
    app.get('/me', requireAction('me.read'), (c) => c.json({ user: c.get('principal')?.userId }));
    app.put(
      '/venues/:id',
      requireAction('venue.update', (c) => ({
        venueId: c.req.param('id'),
        cityId: h.world.cityA.id,
      })),
      (c) => c.json({ ok: true, extra: c.get('extra') }),
    );
    app.route('/', authRoutes(h.deps));

    const { body } = await h.signIn(PHONE_A);
    const me = await app.request('/me', {
      headers: { authorization: `Bearer ${body.accessToken}` },
    });
    expect(await me.json()).toEqual({ user: body.me.id });
    const venue = await app.request(`/venues/${h.world.venueA1}`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${body.accessToken}` },
    });
    expect(venue.status).toBe(403);
  });
});
