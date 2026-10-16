import { describe, expect, it } from 'vitest';
import type { EndpointDef } from './define';
import { errorsFor } from './define';
import { ENDPOINT_IDS, endpoints } from './endpoints';
import { ApiError, ERROR_CODES } from './errors';
import { fakeFromSchema, seeded } from './fake';
import { createMockHandler } from './mock';
import { fixtureId } from './fixtures';

const mock = createMockHandler();
const BASE = 'http://mock.test';

const tokenFor = (d: EndpointDef): string | undefined =>
  d.auth === 'public' ? undefined : d.auth === 'staff' ? 'mock-staff' : 'mock-user';

/** Builds a request the contract says is valid, from the endpoint's own schemas. */
function validRequest(d: EndpointDef, extra: Record<string, string> = {}): Request {
  const rng = seeded(`req:${d.id}`);
  const params = d.params ? (fakeFromSchema(d.params, rng, 'input') as Record<string, string>) : {};
  // Use ids that exist in the fixtures so lookups succeed.
  for (const k of Object.keys(params)) {
    if (k === 'sessionId') params[k] = fixtureId('session', 1);
    if (k === 'venueId') params[k] = fixtureId('venue', 1);
    if (k === 'occurrenceId') params[k] = fixtureId('occurrence', 101);
    if (k === 'slug') params[k] = 'about';
  }
  const path = d.path.replace(/\{(\w+)\}/g, (_m, n: string) => params[n]!);
  const url = new URL(`${BASE}${path}`);
  if (d.query) {
    const required = Object.entries(d.query.shape).filter(
      ([, s]) => !(s as { isOptional: () => boolean }).isOptional(),
    );
    const sample = fakeFromSchema(d.query, rng, 'input') as Record<string, unknown>;
    for (const [k] of required) url.searchParams.set(k, String(sample[k]));
  }
  const headers: Record<string, string> = { ...extra };
  const token = tokenFor(d);
  if (token) headers.authorization = `Bearer ${token}`;
  let body: string | undefined;
  if (d.body) {
    headers['content-type'] = 'application/json';
    const sample = fakeFromSchema(d.body, rng, 'input') as Record<string, unknown>;
    if ('sessionId' in sample) sample.sessionId = fixtureId('session', 1);
    body = JSON.stringify(sample);
  }
  return new Request(url, { method: d.method, headers, body });
}

describe('mock server, every endpoint', () => {
  for (const id of ENDPOINT_IDS) {
    const d = endpoints[id] as EndpointDef;

    it(`${id}: valid request gets the contract's success response`, async () => {
      const response = await mock(validRequest(d));
      expect(response.status, `${d.method} ${d.path}`).toBe(d.success.status);
      if (d.success.status === 204) return;
      if (d.success.contentType === 'text/csv') {
        expect(response.headers.get('content-type')).toContain('text/csv');
        expect(typeof (await response.text())).toBe('string');
        return;
      }
      const data = (await response.json()) as unknown;
      const parsed = d.success.schema!.safeParse(data);
      expect(parsed.success, JSON.stringify(parsed.error?.issues.slice(0, 3))).toBe(true);
    });

    for (const code of errorsFor(d)) {
      it(`${id}: can fail with ${code}`, async () => {
        const response = await mock(validRequest(d, { 'x-mock-error': code }));
        expect(response.status).toBe(ERROR_CODES[code]);
        const body = ApiError.parse(await response.json());
        expect(body.error.code).toBe(code);
        expect(body.error.messageKey).toBe(`errors.${code}`);
      });
    }

    if (d.auth !== 'public') {
      it(`${id}: needs a token`, async () => {
        const req = validRequest(d);
        const headers = new Headers(req.headers);
        headers.delete('authorization');
        const response = await mock(
          new Request(req.url, {
            method: req.method,
            headers,
            body: d.body ? await req.text() : undefined,
          }),
        );
        expect(response.status).toBe(401);
        expect(ApiError.parse(await response.json()).error.code).toBe('unauthenticated');
      });
    }

    if (d.auth === 'staff') {
      it(`${id}: refuses a plain attendee`, async () => {
        const req = validRequest(d);
        const headers = new Headers(req.headers);
        headers.set('authorization', 'Bearer mock-user');
        const response = await mock(
          new Request(req.url, {
            method: req.method,
            headers,
            body: d.body ? await req.text() : undefined,
          }),
        );
        expect(response.status).toBe(403);
      });
    }

    if (d.body) {
      it(`${id}: rejects an invalid body with validation_failed`, async () => {
        const req = validRequest(d);
        const response = await mock(
          new Request(req.url, {
            method: req.method,
            headers: req.headers,
            body: JSON.stringify('definitely not valid'),
          }),
        );
        expect(response.status).toBe(400);
        const body = ApiError.parse(await response.json());
        expect(body.error.code).toBe('validation_failed');
        // Issues name where the input was wrong, never the input.
        expect(JSON.stringify(body)).not.toContain('definitely');
      });
    }
  }
});

describe('mock server, behaviour with realistic data', () => {
  const get = (path: string, token?: string) =>
    mock(
      new Request(`${BASE}${path}`, { headers: token ? { authorization: `Bearer ${token}` } : {} }),
    );

  it('lists the nine V1 cities', async () => {
    const body = (await (await get('/v1/places/cities')).json()) as { items: { slug: string }[] };
    expect(body.items.map((c) => c.slug)).toEqual(
      expect.arrayContaining([
        'rawalpindi',
        'islamabad',
        'multan',
        'faisalabad',
        'wah-cantt',
        'murree',
        'kot-addu',
        'abbottabad',
        'lahore',
      ]),
    );
  });

  it('filters sessions by section, language and day and pages them', async () => {
    const women = (await (await get('/v1/sessions?section=women')).json()) as {
      items: { section: string }[];
    };
    expect(women.items.length).toBeGreaterThan(0);
    expect(women.items.every((s) => s.section === 'women')).toBe(true);
    const english = (await (await get('/v1/sessions?language=en')).json()) as {
      items: { language: string }[];
    };
    expect(english.items.every((s) => s.language === 'en')).toBe(true);
    const tuesday = (await (
      await get('/v1/sessions?dayOfWeek=2&kind=recurring&program=circles')
    ).json()) as {
      items: { daysOfWeek: number[] }[];
    };
    expect(tuesday.items.length).toBe(1);
    const first = (await (await get('/v1/sessions?limit=2')).json()) as {
      items: unknown[];
      nextCursor: string | null;
    };
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).toBe('2');
    const second = (await (await get('/v1/sessions?limit=2&cursor=2')).json()) as {
      items: { id: string }[];
    };
    expect(second.items.length).toBeGreaterThan(0);
  });

  it('returns not_found for an unknown session and an unknown route', async () => {
    const r = await get(`/v1/sessions/${fixtureId('session', 999)}`);
    expect(r.status).toBe(404);
    expect(((await r.json()) as ApiError).error.code).toBe('not_found');
    expect((await get('/v1/nope')).status).toBe(404);
  });

  it('rejects a bad query with validation_failed', async () => {
    const r = await get('/v1/sessions?limit=1000&section=nobody');
    expect(r.status).toBe(400);
    const body = (await r.json()) as ApiError;
    expect(body.error.issues?.map((i) => i.path).sort()).toEqual(['limit', 'section']);
  });

  it('signs in with 123456 and refuses other codes', async () => {
    const post = (code: string) =>
      mock(
        new Request(`${BASE}/v1/auth/verify`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ challengeId: fixtureId('user', 7), code }),
        }),
      );
    const ok = await post('123456');
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as { accessToken: string }).accessToken).toBe('mock-user');
    const bad = await post('000000');
    expect(bad.status).toBe(400);
    expect(((await bad.json()) as ApiError).error.code).toBe('otp_invalid');
  });

  it('puts a registration on the waitlist when the session is full', async () => {
    const register = (n: number) =>
      mock(
        new Request(`${BASE}/v1/registrations`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: 'Bearer mock-user' },
          body: JSON.stringify({
            sessionId: fixtureId('session', n),
            areaId: fixtureId('area', 1),
            section: 'women',
            partySize: 2,
            allowWhatsapp: true,
          }),
        }),
      );
    expect(((await (await register(1)).json()) as { status: string }).status).toBe('confirmed');
    expect(((await (await register(2)).json()) as { status: string }).status).toBe('waitlisted');
  });

  it('expired and suspended tokens get their own codes', async () => {
    expect(((await (await get('/v1/me', 'mock-expired')).json()) as ApiError).error.code).toBe(
      'token_expired',
    );
    expect(((await (await get('/v1/me', 'mock-suspended')).json()) as ApiError).error.code).toBe(
      'account_suspended',
    );
  });
});
