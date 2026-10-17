import { describe, expect, it } from 'vitest';
import type { EndpointDef } from './define';
import { errorsFor } from './define';
import { ENDPOINT_IDS, endpoints } from './endpoints';
import { ApiError, ERROR_CODES } from './errors';
import { fakeFromSchema, seeded } from './fake';
import { createMockHandler } from './mock';
import { fixtureId, importExamples } from './fixtures';
import { REGISTRATION_EXPORT_COLUMNS, type ImportResult } from './schemas/admin';

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
    if (k === 'circleId') params[k] = fixtureId('circle', 1);
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

describe('mock server, endpoints added in 1.0.0-rc.2', () => {
  const staff = (path: string, init: { method?: string; body?: unknown } = {}) =>
    mock(
      new Request(`${BASE}${path}`, {
        method: init.method ?? 'GET',
        headers: { authorization: 'Bearer mock-staff', 'content-type': 'application/json' },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      }),
    );
  const importRows = async (kind: string, dryRun: boolean, rows: unknown[]) => {
    const response = await staff(`/v1/admin/import/${kind}`, {
      method: 'POST',
      body: { dryRun, rows },
    });
    expect(response.status).toBe(200);
    return (await response.json()) as ImportResult;
  };

  it('dry-runs a clean venue file: created, nothing applied', async () => {
    const result = await importRows('venues', true, importExamples.venues);
    expect(result).toEqual({
      dryRun: true,
      applied: false,
      counts: { created: 1, duplicate: 0, invalid: 0 },
      rows: [{ index: 0, status: 'created', issues: [] }],
    });
  });

  it('applies a clean file only when it is not a dry run', async () => {
    const result = await importRows('venues', false, importExamples.venues);
    expect(result.applied).toBe(true);
    expect(result.counts).toEqual({ created: 1, duplicate: 0, invalid: 0 });
  });

  it('reports a repeated row and an existing venue as duplicate, not as an error', async () => {
    const existing = {
      ...importExamples.venues[0]!,
      cityId: fixtureId('city', 1),
      areaId: fixtureId('area', 1),
      name: { en: 'sample masjid al-noor', ur: null },
    };
    const result = await importRows('venues', false, [
      importExamples.venues[0],
      importExamples.venues[0],
      existing,
    ]);
    expect(result.rows.map((r) => r.status)).toEqual(['created', 'duplicate', 'duplicate']);
    expect(result.applied).toBe(true);
  });

  it('applies nothing when any row is invalid, and says where, by row index', async () => {
    const result = await importRows('venues', false, [
      importExamples.venues[0],
      { ...importExamples.venues[0]!, lat: 500 },
      { ...importExamples.venues[0]!, cityId: fixtureId('city', 99), name: { en: 'Other' } },
      { ...importExamples.venues[0]!, areaId: fixtureId('area', 1), name: { en: 'Elsewhere' } },
      { nonsense: true },
    ]);
    expect(result.applied).toBe(false);
    expect(result.counts).toEqual({ created: 1, duplicate: 0, invalid: 4 });
    expect(result.rows.map((r) => `${r.index}:${r.status}`)).toEqual([
      '0:created',
      '1:invalid',
      '2:invalid',
      '3:invalid',
      '4:invalid',
    ]);
    expect(result.rows[1]!.issues.map((i) => i.path)).toEqual(['lat']);
    expect(result.rows[2]!.issues).toContainEqual({ path: 'cityId', code: 'invalid_reference' });
    expect(result.rows[3]!.issues).toContainEqual({ path: 'areaId', code: 'area_not_in_city' });
    expect(JSON.stringify(result)).not.toContain('Elsewhere');
  });

  it('checks coordinators and sessions against fixture ids', async () => {
    const coordinators = await importRows('coordinators', true, [
      importExamples.coordinators[0],
      importExamples.coordinators[0],
      { ...importExamples.coordinators[0]!, venueId: fixtureId('venue', 99) },
    ]);
    expect(coordinators.rows.map((r) => r.status)).toEqual(['created', 'duplicate', 'invalid']);
    const sessions = await importRows('sessions', true, [
      importExamples.sessions[0],
      { ...importExamples.sessions[0]!, venueId: fixtureId('venue', 99) },
      { ...importExamples.sessions[0]!, circleId: fixtureId('circle', 99) },
    ]);
    expect(sessions.rows.map((r) => r.status)).toEqual(['created', 'invalid', 'invalid']);
    expect(sessions.rows[1]!.issues).toEqual([{ path: 'venueId', code: 'invalid_reference' }]);
    expect(sessions.rows[2]!.issues).toEqual([{ path: 'circleId', code: 'invalid_reference' }]);
  });

  it('refuses more than 2000 rows and an empty file as validation_failed', async () => {
    for (const rows of [[], Array.from({ length: 2001 }, () => ({}))]) {
      const response = await staff('/v1/admin/import/venues', {
        method: 'POST',
        body: { dryRun: true, rows },
      });
      expect(response.status).toBe(400);
      expect(((await response.json()) as ApiError).error.code).toBe('validation_failed');
    }
  });

  it('exports registrations as CSV with the fixed header, filtered by venue, city and date', async () => {
    const all = await (await staff('/v1/admin/registrations/export')).text();
    const [header, ...lines] = all.trimEnd().split('\r\n');
    expect(header).toBe(REGISTRATION_EXPORT_COLUMNS.join(','));
    expect(lines.length).toBeGreaterThan(2);
    const venue = fixtureId('venue', 1);
    const one = (await (await staff(`/v1/admin/registrations/export?venueId=${venue}`)).text())
      .trimEnd()
      .split('\r\n');
    expect(one.length).toBeGreaterThan(1);
    expect(one.slice(1).every((l) => l.includes(venue))).toBe(true);
    const none = await (
      await staff(`/v1/admin/registrations/export?from=2027-03-01&to=2027-03-31`)
    ).text();
    expect(none).toBe(`${REGISTRATION_EXPORT_COLUMNS.join(',')}\r\n`);
    const inRange = await (
      await staff(`/v1/admin/registrations/export?from=2027-02-14&to=2027-02-14`)
    ).text();
    expect(inRange.trimEnd().split('\r\n').length).toBe(lines.length + 1);
  });

  it('refuses a backwards date range with an issue on from', async () => {
    const response = await staff('/v1/admin/registrations/export?from=2027-03-01&to=2027-02-01');
    expect(response.status).toBe(400);
    expect(((await response.json()) as ApiError).error.issues).toEqual([
      { path: 'from', code: 'invalid_range' },
    ]);
  });

  it('reads one session and one circle, and says not_found for unknown ids', async () => {
    const session = await staff(`/v1/admin/sessions/${fixtureId('session', 4)}`);
    expect(session.status).toBe(200);
    expect(await session.json()).toMatchObject({
      id: fixtureId('session', 4),
      circleStatus: 'published',
    });
    const circle = await staff(`/v1/admin/circles/${fixtureId('circle', 2)}`);
    expect(((await circle.json()) as { status: string }).status).toBe('pending_approval');
    for (const path of [
      `/v1/admin/sessions/${fixtureId('session', 99)}`,
      `/v1/admin/circles/${fixtureId('circle', 99)}`,
    ]) {
      const missing = await staff(path);
      expect(missing.status).toBe(404);
      expect(((await missing.json()) as ApiError).error.code).toBe('not_found');
    }
  });

  it('counts the people an update would reach, by scope', async () => {
    const preview = async (scope: unknown) =>
      (await (
        await staff('/v1/admin/updates/preview', {
          method: 'POST',
          body: { scope, title: { en: 'Hello' }, body: { en: 'World' } },
        })
      ).json()) as { recipients: number };
    const national = await preview({ type: 'national' });
    const city = await preview({ type: 'city', cityId: fixtureId('city', 1) });
    const venue = await preview({ type: 'venue', venueId: fixtureId('venue', 1) });
    expect(national.recipients).toBeGreaterThan(city.recipients);
    expect(city.recipients).toBeGreaterThan(venue.recipients);
  });

  it('keeps every new endpoint behind a staff token', async () => {
    const attendee = (path: string, method = 'GET', body?: unknown) =>
      mock(
        new Request(`${BASE}${path}`, {
          method,
          headers: { authorization: 'Bearer mock-user', 'content-type': 'application/json' },
          body: body === undefined ? undefined : JSON.stringify(body),
        }),
      );
    expect((await attendee('/v1/admin/registrations/export')).status).toBe(403);
    expect(
      (await attendee('/v1/admin/import/venues', 'POST', { dryRun: true, rows: [{}] })).status,
    ).toBe(403);
  });
});
