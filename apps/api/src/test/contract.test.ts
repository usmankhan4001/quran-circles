import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ApiError,
  ENDPOINT_IDS,
  ERROR_CODES,
  endpoints,
  errorsFor,
  type EndpointDef,
  type EndpointId,
} from '@qc/contracts';
import { toHonoPath } from '../modules/shared/route';
import { createHarness, type Harness } from './harness';

const NIL = '00000000-0000-4000-8000-000000000000';

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(() => h.close());
beforeEach(() => h.reset());

const served = ENDPOINT_IDS.filter((id) => !id.startsWith('auth.'));
const def = (id: EndpointId) => endpoints[id] as unknown as EndpointDef;

/** Placeholders for every `{name}` in a path. */
const nilParams = (id: EndpointId): Record<string, string> =>
  Object.fromEntries([...def(id).path.matchAll(/\{(\w+)\}/g)].map((m) => [m[1] as string, NIL]));

describe('routes', () => {
  it('serves every endpoint of the registry except the sign-in group, at its exact method and path', () => {
    const mounted = new Set(
      h.app.routes
        .filter((r) => r.method !== 'ALL' && !r.path.includes('*'))
        .map((r) => `${r.method} ${r.path}`),
    );
    const expected = new Set(served.map((id) => `${def(id).method} ${toHonoPath(def(id).path)}`));
    expect([...mounted].sort()).toEqual([...expected].sort());
    expect(served).toHaveLength(ENDPOINT_IDS.length - 4);
  });

  it('leaves the four sign-in endpoints to the auth lane', () => {
    const authIds = ENDPOINT_IDS.filter((id) => id.startsWith('auth.'));
    expect(authIds).toEqual([
      'auth.requestCode',
      'auth.verifyCode',
      'auth.refresh',
      'auth.signOut',
    ]);
    for (const id of authIds) {
      const mounted = h.app.routes.some(
        (r) => r.method === def(id).method && r.path === toHonoPath(def(id).path),
      );
      expect(mounted).toBe(false);
    }
  });

  it('answers an unknown path with the contract not_found error', async () => {
    const res = await h.get('/v1/does-not-exist');
    expect(res.status).toBe(404);
    expect(ApiError.parse(res.json()).error.code).toBe('not_found');
  });

  it('does not answer a known path with the wrong method', async () => {
    const res = await h.call('DELETE', '/v1/places/cities');
    expect(res.status).toBe(404);
  });
});

describe('request id', () => {
  it('sets x-request-id on every response, success or error', async () => {
    const ok = await h.get('/health');
    const err = await h.get('/v1/does-not-exist');
    const denied = await h.api('me.get');
    for (const res of [ok, err, denied]) {
      expect(res.headers.get('x-request-id')).toMatch(/^[A-Za-z0-9._-]{8,64}$/);
    }
    expect(ok.headers.get('x-request-id')).not.toBe(err.headers.get('x-request-id'));
  });

  it('keeps a safe id sent by the caller and puts it in the error body', async () => {
    const res = await h.get('/v1/does-not-exist', {
      headers: { 'x-request-id': 'trace-abc-12345' },
    });
    expect(res.headers.get('x-request-id')).toBe('trace-abc-12345');
    expect(ApiError.parse(res.json()).error.requestId).toBe('trace-abc-12345');
  });

  it('replaces an unsafe id instead of echoing it', async () => {
    const res = await h.get('/health', {
      headers: { 'x-request-id': 'bad id with spaces <script>' },
    });
    expect(res.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('errors', () => {
  it('has a handler for every non-public endpoint that refuses a caller with no principal', async () => {
    for (const id of served) {
      if (def(id).auth === 'public') continue;
      const res = await h.api(id, { params: nilParams(id) });
      expect(res.status, id).toBe(401);
      expect(res.json<ApiError>().error.code, id).toBe('unauthenticated');
    }
  });

  it('answers a malformed body, query or id with validation_failed that names fields, not values', async () => {
    const admin = await h.nationalAdmin();
    for (const id of served) {
      const d = def(id);
      const params = nilParams(id);
      const call = { as: admin, params };
      let res;
      if (d.body) {
        res = await h.api(id, { ...call, body: 'secret-looking-value-not-an-object' });
      } else if (d.params) {
        const bad = Object.fromEntries(Object.keys(params).map((k) => [k, '!!']));
        // A free-text parameter such as a page slug has no malformed value.
        if (d.params.safeParse(bad).success) continue;
        res = await h.api(id, { ...call, params: bad });
      } else if (d.query && 'limit' in ((d.query as unknown as { shape: object }).shape ?? {})) {
        res = await h.api(id, { ...call, query: { limit: 0 } });
      } else continue;
      expect(res.status, id).toBe(400);
      const body = res.json<ApiError>();
      expect(body.error.code, id).toBe('validation_failed');
      expect(res.text, id).not.toContain('secret-looking-value');
      for (const issue of body.error.issues ?? []) {
        expect(Object.keys(issue).sort(), id).toEqual(['code', 'path']);
      }
    }
  });

  it('rejects a body that is not JSON', async () => {
    const person = await h.person();
    const res = await h.call('PATCH', '/v1/me', { as: person, raw: '{not json' });
    expect(res.status).toBe(400);
    const error = ApiError.parse(res.json()).error;
    expect(error.code).toBe('validation_failed');
    expect(error.issues).toEqual([{ path: '', code: 'invalid_json' }]);
  });

  it('rejects an oversized body before parsing it', async () => {
    const person = await h.person();
    const res = await h.call('PATCH', '/v1/me', {
      as: person,
      raw: JSON.stringify({ x: 'a'.repeat(1_100_000) }),
    });
    expect(res.status).toBe(400);
    expect(ApiError.parse(res.json()).error.issues).toEqual([{ path: '', code: 'too_large' }]);
  });

  it('only ever uses codes from the contract, with the contract status', async () => {
    const res = await h.api('me.get');
    const error = ApiError.parse(res.json()).error;
    expect(Object.keys(ERROR_CODES)).toContain(error.code);
    expect(res.status).toBe(ERROR_CODES[error.code]);
    expect(error.messageKey).toBe(`errors.${error.code}`);
  });

  it('lists forbidden, not_found and validation_failed for the endpoints that can return them', () => {
    // Guards the harness check itself: errorsFor is what every h.api call is held to.
    expect(errorsFor(def('adminSettings.update'))).toContain('forbidden');
    expect(errorsFor(def('venues.get'))).toContain('not_found');
  });
});

describe('caching', () => {
  it('marks signed-in responses private and uncacheable', async () => {
    const person = await h.person();
    const res = await h.api('me.get', { as: person });
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });
});

describe('cors', () => {
  it('answers a preflight only for configured origins', async () => {
    const allowed = await createHarness({ config: { corsOrigins: ['https://app.example.org'] } });
    try {
      const ok = await allowed.call('OPTIONS', '/v1/me', {
        headers: { origin: 'https://app.example.org', 'access-control-request-method': 'PATCH' },
      });
      expect(ok.headers.get('access-control-allow-origin')).toBe('https://app.example.org');
      const other = await allowed.call('OPTIONS', '/v1/me', {
        headers: { origin: 'https://evil.example.com', 'access-control-request-method': 'PATCH' },
      });
      expect(other.headers.get('access-control-allow-origin')).toBeNull();
    } finally {
      await allowed.close();
    }
  });

  it('allows no origin when none is configured', async () => {
    const res = await h.get('/health', { headers: { origin: 'https://app.example.org' } });
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('rate limits', () => {
  it('limits each endpoint by its rateLimit bucket and tells the caller when to retry', async () => {
    const limited = await createHarness({
      config: {
        rateLimits: {
          default: { limit: 1000, windowSeconds: 60 },
          auth_code: { limit: 5, windowSeconds: 60 },
          registration: { limit: 2, windowSeconds: 60 },
          messaging: { limit: 2, windowSeconds: 60 },
        },
      },
    });
    try {
      const admin = await limited.nationalAdmin();
      const post = () =>
        limited.api('adminUpdates.post', {
          as: admin,
          body: {
            scope: { type: 'national' },
            title: { en: 'Hello' },
            body: { en: 'World' },
            notify: false,
          },
        });
      expect((await post()).status).toBe(201);
      expect((await post()).status).toBe(201);
      const third = await post();
      expect(third.status).toBe(429);
      const error = ApiError.parse(third.json()).error;
      expect(error.code).toBe('rate_limited');
      expect(error.retryAfterSeconds).toBeGreaterThan(0);
      expect(third.headers.get('retry-after')).toBe(String(error.retryAfterSeconds));
      // Another bucket and another person are not affected.
      expect((await limited.api('adminUpdates.list', { as: admin })).status).toBe(200);
      const other = await limited.nationalAdmin();
      expect(
        (
          await limited.api('adminUpdates.post', {
            as: other,
            body: {
              scope: { type: 'national' },
              title: { en: 'Hi' },
              body: { en: 'There' },
              notify: false,
            },
          })
        ).status,
      ).toBe(201);
      // The window passing frees the caller.
      limited.clock.advanceMinutes(2);
      expect((await post()).status).toBe(201);
    } finally {
      await limited.close();
    }
  });

  it('limits callers with no account by address', async () => {
    const limited = await createHarness({
      config: {
        rateLimits: {
          default: { limit: 2, windowSeconds: 60 },
          auth_code: { limit: 5, windowSeconds: 60 },
          registration: { limit: 20, windowSeconds: 60 },
          messaging: { limit: 30, windowSeconds: 60 },
        },
      },
    });
    try {
      expect((await limited.get('/v1/places/provinces')).status).toBe(200);
      expect((await limited.get('/v1/places/provinces')).status).toBe(200);
      expect((await limited.get('/v1/places/provinces')).status).toBe(429);
    } finally {
      await limited.close();
    }
  });
});
