import { describe, expect, it } from 'vitest';
import type { EndpointDef } from './define';
import { errorsFor } from './define';
import { ENDPOINT_IDS, endpoints } from './endpoints';
import { ApiError, ERROR_CODES } from './errors';
import { fakeFromSchema, seeded } from './fake';
import { createMockHandler } from './mock';
import * as fx from './fixtures';
import { fixtureId, importExamples } from './fixtures';
import { SignInResponse } from './schemas/auth';
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

describe('mock server, staff sign-in and roles', () => {
  const lahore = fx.cities.find((c) => c.slug === 'lahore')!;
  const rawalpindi = fx.cities.find((c) => c.slug === 'rawalpindi')!;
  const alNoor = fx.venues[0]!;
  /** Taraweeh with Dora at Al-Noor (Rawalpindi). */
  const sessionAlNoor = fixtureId('session', 1);
  /** Women Dora at Markaz Iqra: Rawalpindi, another venue, full. */
  const sessionIqra = fixtureId('session', 2);
  /** Johar Town Dora, in Lahore. */
  const sessionLahore = fixtureId('session', 5);
  const occurrenceOf = (sessionId: string) =>
    fx.occurrences.find((o) => o.sessionId === sessionId)!;
  const TOKENS = { venue: 'mock-venue', city: 'mock-city', national: 'mock-staff' } as const;

  /** Calls the mock and, on success, checks the body against the endpoint's schema. */
  const call = async (
    id: keyof typeof endpoints,
    token: string,
    path: string,
    init: { method?: string; body?: unknown } = {},
  ) => {
    const d = endpoints[id] as EndpointDef;
    const response = await mock(
      new Request(`${BASE}${path}`, {
        method: init.method ?? d.method,
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      }),
    );
    const text = await response.text();
    const data =
      text && d.success.contentType !== 'text/csv' ? (JSON.parse(text) as unknown) : text;
    if (response.status === d.success.status && d.success.schema && typeof data !== 'string') {
      const parsed = d.success.schema.safeParse(data);
      expect(parsed.success, `${id}: ${JSON.stringify(parsed.error?.issues.slice(0, 3))}`).toBe(
        true,
      );
    }
    return { status: response.status, data };
  };
  const codeOf = (data: unknown) => ApiError.parse(data).error.code;
  const ids = (data: unknown) => (data as { items: { id: string }[] }).items.map((x) => x.id);

  const signIn = async (phone: string, code = '123456') => {
    const requested = await mock(
      new Request(`${BASE}/v1/auth/code`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone }),
      }),
    );
    expect(requested.status).toBe(202);
    const challenge = (await requested.json()) as { challengeId: string };
    const verified = await mock(
      new Request(`${BASE}/v1/auth/verify`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ challengeId: challenge.challengeId, code }),
      }),
    );
    return { status: verified.status, data: (await verified.json()) as unknown };
  };

  for (const kind of ['venue', 'city', 'national'] as const) {
    const account = fx.staffAccounts[kind];

    it(`${kind}: signs in from its test number and reads its roles back`, async () => {
      const { status, data } = await signIn(account.phone);
      expect(status).toBe(200);
      const signedIn = SignInResponse.parse(data);
      expect(signedIn.accessToken).toBe(TOKENS[kind]);
      expect(signedIn.me).toEqual(account.me);
      expect(signedIn.me.roles).toHaveLength(1);
      const me = await call('me.get', signedIn.accessToken, '/v1/me');
      expect(me.status).toBe(200);
      expect(me.data).toEqual(account.me);
    });

    it(`${kind}: refreshes into the same staff token`, async () => {
      const { status, data } = await call('auth.refresh', 'unused', '/v1/auth/refresh', {
        body: { refreshToken: account.refreshToken },
      });
      expect(status).toBe(200);
      expect((data as { accessToken: string }).accessToken).toBe(account.token);
    });

    it(`${kind}: a wrong code is still otp_invalid`, async () => {
      const { status, data } = await signIn(account.phone, '000000');
      expect(status).toBe(400);
      expect(codeOf(data)).toBe('otp_invalid');
    });
  }

  it('signs any other number in as the attendee, as before', async () => {
    const { data } = await signIn('+923000000099');
    const signedIn = SignInResponse.parse(data);
    expect(signedIn.accessToken).toBe('mock-user');
    expect(signedIn.me).toEqual(fx.fixtureMe);
    expect((await call('me.get', 'mock-user', '/v1/me')).data).toEqual(fx.fixtureMe);
  });

  it('serves fixture venues by role, with the city filter', async () => {
    const venuesFor = async (token: string, q = '') =>
      ids((await call('adminVenues.list', token, `/v1/admin/venues?limit=100${q}`)).data);
    expect(await venuesFor(TOKENS.national)).toEqual(fx.venues.map((v) => v.id));
    expect(await venuesFor(TOKENS.city)).toEqual(
      fx.venues.filter((v) => v.cityId === rawalpindi.id).map((v) => v.id),
    );
    expect(await venuesFor(TOKENS.venue)).toEqual([alNoor.id]);
    expect(await venuesFor(TOKENS.national, `&cityId=${lahore.id}&includeArchived=true`)).toEqual(
      fx.venues.filter((v) => v.cityId === lahore.id).map((v) => v.id),
    );
    expect(await venuesFor(TOKENS.city, `&cityId=${lahore.id}`)).toEqual([]);
  });

  it('serves fixture sessions by role, with city and venue filters', async () => {
    const sessionsFor = async (token: string, q = '') =>
      ids((await call('adminSessions.list', token, `/v1/admin/sessions?limit=100${q}`)).data);
    expect(await sessionsFor(TOKENS.national)).toEqual(fx.adminSessions.map((s) => s.id));
    expect(await sessionsFor(TOKENS.city)).toEqual(
      fx.sessions.filter((s) => s.cityId === rawalpindi.id).map((s) => s.id),
    );
    expect(await sessionsFor(TOKENS.venue)).toEqual(
      fx.sessions.filter((s) => s.venueId === alNoor.id).map((s) => s.id),
    );
    expect(await sessionsFor(TOKENS.national, `&cityId=${lahore.id}`)).toEqual([sessionLahore]);
    expect(await sessionsFor(TOKENS.city, `&venueId=${fx.venues[1]!.id}`)).toEqual([sessionIqra]);
    const first = (await call('adminSessions.list', TOKENS.national, '/v1/admin/sessions?limit=2'))
      .data as { nextCursor: string | null };
    expect(first.nextCursor).toBe('2');
  });

  it('serves fixture circles by role, with city and venue filters', async () => {
    const circlesFor = async (token: string, q = '') =>
      ids((await call('adminCircles.list', token, `/v1/admin/circles?limit=100${q}`)).data);
    expect(await circlesFor(TOKENS.national)).toEqual(fx.circles.map((c) => c.id));
    expect(await circlesFor(TOKENS.national, `&cityId=${lahore.id}`)).toEqual([
      fixtureId('circle', 2),
    ]);
    expect(await circlesFor(TOKENS.national, `&venueId=${alNoor.id}`)).toEqual([
      fixtureId('circle', 1),
    ]);
    expect(await circlesFor(TOKENS.city)).toEqual([fixtureId('circle', 1)]);
    expect(await circlesFor(TOKENS.venue)).toEqual([fixtureId('circle', 1)]);
  });

  it('serves fixture occurrences for a session, with from, to and limit', async () => {
    const path = `/v1/admin/sessions/${sessionAlNoor}/occurrences`;
    const all = (await call('adminSessions.occurrences', TOKENS.venue, path)).data as {
      items: { id: string; startsAt: string; headcount: number | null }[];
    };
    const expected = fx.occurrences.filter((o) => o.sessionId === sessionAlNoor);
    expect(all.items.map((o) => o.id)).toEqual(expected.map((o) => o.id));
    expect(all.items[0]).toHaveProperty('headcount');
    const from = expected[2]!.startsAt;
    const to = expected[4]!.startsAt;
    const window = (
      await call('adminSessions.occurrences', TOKENS.venue, `${path}?from=${from}&to=${to}`)
    ).data as { items: { id: string }[] };
    expect(window.items.map((o) => o.id)).toEqual(expected.slice(2, 5).map((o) => o.id));
    const limited = (await call('adminSessions.occurrences', TOKENS.venue, `${path}?limit=2`))
      .data as { items: unknown[] };
    expect(limited.items).toHaveLength(2);
  });

  it('builds attendance from the fixture occurrence: headcount, no entries, not marked', async () => {
    const o = occurrenceOf(sessionAlNoor);
    const { status, data } = await call(
      'adminAttendance.get',
      TOKENS.venue,
      `/v1/admin/occurrences/${o.id}/attendance`,
    );
    expect(status).toBe(200);
    expect(data).toEqual({
      occurrenceId: o.id,
      headcount: o.headcount,
      entries: [],
      markedAt: null,
    });
  });

  it('lists synthetic registrants for a session, with totals and filters', async () => {
    const path = `/v1/admin/sessions/${sessionAlNoor}/registrations`;
    const { status, data } = await call('registrations.forSession', TOKENS.venue, path);
    expect(status).toBe(200);
    const body = data as {
      items: { id: string; name: string | null; phone: string | null; status: string }[];
      totals: { registrations: number; people: number; waitlisted: number };
    };
    expect(body.items.length).toBeGreaterThan(2);
    expect(body.totals.registrations).toBe(body.items.length);
    expect(body.totals.waitlisted).toBe(0);
    for (const r of body.items) if (r.phone) expect(r.phone.startsWith('+92300000')).toBe(true);
    expect(body.items.some((r) => r.name === null)).toBe(true);
    expect(body.items.some((r) => r.phone === null)).toBe(true);
    const full = (
      await call(
        'registrations.forSession',
        TOKENS.city,
        `/v1/admin/sessions/${sessionIqra}/registrations?status=waitlisted`,
      )
    ).data as typeof body;
    expect(full.items.length).toBeGreaterThan(0);
    expect(full.items.every((r) => r.status === 'waitlisted')).toBe(true);
    expect(full.totals.waitlisted).toBe(full.items.length);
    const occurrence = occurrenceOf(sessionAlNoor).id;
    const forOne = (
      await call(
        'registrations.forSession',
        TOKENS.venue,
        `${path}?occurrenceId=${occurrence}&limit=2`,
      )
    ).data as typeof body & { nextCursor: string | null };
    expect(forOne.items).toHaveLength(2);
    expect(forOne.nextCursor).toBe('2');
  });

  it('answers not_found for unknown sessions and occurrences on the new handlers', async () => {
    const missingSession = fixtureId('session', 99);
    const missingOccurrence = fixtureId('occurrence', 9999);
    for (const kind of ['venue', 'city', 'national'] as const) {
      const token = TOKENS[kind];
      for (const [id, path] of [
        ['adminSessions.occurrences', `/v1/admin/sessions/${missingSession}/occurrences`],
        ['registrations.forSession', `/v1/admin/sessions/${missingSession}/registrations`],
        ['adminAttendance.get', `/v1/admin/occurrences/${missingOccurrence}/attendance`],
        ['adminSessions.get', `/v1/admin/sessions/${missingSession}`],
      ] as const) {
        const { status, data } = await call(id, token, path);
        expect(status, `${kind} ${id}`).toBe(404);
        expect(codeOf(data)).toBe('not_found');
      }
    }
  });

  it('refuses a venue coordinator on another venue, and a city coordinator on another city', async () => {
    const lahoreOccurrence = occurrenceOf(sessionLahore).id;
    const iqraOccurrence = occurrenceOf(sessionIqra).id;
    const cases = [
      ['mock-venue', 'registrations.forSession', `/v1/admin/sessions/${sessionIqra}/registrations`],
      ['mock-venue', 'adminSessions.occurrences', `/v1/admin/sessions/${sessionIqra}/occurrences`],
      ['mock-venue', 'adminAttendance.get', `/v1/admin/occurrences/${iqraOccurrence}/attendance`],
      [
        'mock-city',
        'registrations.forSession',
        `/v1/admin/sessions/${sessionLahore}/registrations`,
      ],
      ['mock-city', 'adminSessions.occurrences', `/v1/admin/sessions/${sessionLahore}/occurrences`],
      ['mock-city', 'adminAttendance.get', `/v1/admin/occurrences/${lahoreOccurrence}/attendance`],
    ] as const;
    for (const [token, id, path] of cases) {
      const { status, data } = await call(id, token, path);
      expect(status, `${token} ${id}`).toBe(403);
      expect(codeOf(data)).toBe('forbidden');
    }
    // The city coordinator reaches every venue in the city; the national admin reaches all.
    expect(
      (
        await call(
          'adminAttendance.get',
          'mock-city',
          `/v1/admin/occurrences/${iqraOccurrence}/attendance`,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await call(
          'registrations.forSession',
          'mock-staff',
          `/v1/admin/sessions/${sessionLahore}/registrations`,
        )
      ).status,
    ).toBe(200);
  });

  it('answers not_found for a session or circle outside scope on the scoped reads', async () => {
    const venueOwn = await call(
      'adminSessions.get',
      'mock-venue',
      `/v1/admin/sessions/${sessionAlNoor}`,
    );
    expect(venueOwn.status).toBe(200);
    for (const [token, id, path] of [
      ['mock-venue', 'adminSessions.get', `/v1/admin/sessions/${sessionIqra}`],
      ['mock-city', 'adminSessions.get', `/v1/admin/sessions/${sessionLahore}`],
      ['mock-city', 'adminCircles.get', `/v1/admin/circles/${fixtureId('circle', 2)}`],
    ] as const) {
      const { status, data } = await call(id, token, path);
      expect(status, `${token} ${path}`).toBe(404);
      expect(codeOf(data)).toBe('not_found');
    }
    expect(
      (await call('adminCircles.get', 'mock-staff', `/v1/admin/circles/${fixtureId('circle', 2)}`))
        .status,
    ).toBe(200);
  });

  it('refuses each role the endpoints the scope matrix does not give it', async () => {
    const status = async (token: string, id: keyof typeof endpoints, path: string) =>
      (await call(id, token, path)).status;
    expect(await status('mock-venue', 'adminRoles.list', '/v1/admin/role-assignments')).toBe(403);
    expect(await status('mock-venue', 'adminAudit.list', '/v1/admin/audit')).toBe(403);
    expect(await status('mock-venue', 'adminSettings.get', '/v1/admin/settings')).toBe(403);
    expect(await status('mock-city', 'adminSettings.get', '/v1/admin/settings')).toBe(403);
    expect(await status('mock-city', 'adminRoles.list', '/v1/admin/role-assignments')).toBe(200);
    expect(await status('mock-city', 'adminAudit.list', '/v1/admin/audit')).toBe(200);
    expect(await status('mock-staff', 'adminSettings.get', '/v1/admin/settings')).toBe(200);
    expect(await status('mock-venue', 'adminTemplates.list', '/v1/admin/message-templates')).toBe(
      200,
    );
  });

  it('checks writes against the place in the body or path', async () => {
    const lahoreArea = fx.areas.find((a) => a.cityId === lahore.id)!;
    const venueInLahore = {
      ...fx.importExamples.venues[0]!,
      cityId: lahore.id,
      areaId: lahoreArea.id,
    };
    expect(
      (await call('adminVenues.create', 'mock-city', '/v1/admin/venues', { body: venueInLahore }))
        .status,
    ).toBe(403);
    const venueInRawalpindi = {
      ...venueInLahore,
      cityId: rawalpindi.id,
      areaId: fx.areas.find((a) => a.cityId === rawalpindi.id)!.id,
    };
    expect(
      (
        await call('adminVenues.create', 'mock-city', '/v1/admin/venues', {
          body: venueInRawalpindi,
        })
      ).status,
    ).toBe(201);
    const preview = (token: string, scope: unknown) =>
      call('adminUpdates.preview', token, '/v1/admin/updates/preview', {
        body: { scope, title: { en: 'Hello' }, body: { en: 'World' } },
      });
    expect((await preview('mock-venue', { type: 'national' })).status).toBe(403);
    expect((await preview('mock-venue', { type: 'venue', venueId: fx.venues[1]!.id })).status).toBe(
      403,
    );
    expect((await preview('mock-venue', { type: 'venue', venueId: alNoor.id })).status).toBe(200);
    expect((await preview('mock-city', { type: 'city', cityId: rawalpindi.id })).status).toBe(200);
    expect((await preview('mock-city', { type: 'city', cityId: lahore.id })).status).toBe(403);
    const decide = (token: string) =>
      call('adminCircles.decide', token, `/v1/admin/circles/${fixtureId('circle', 2)}/decision`, {
        body: { decision: 'approve' },
      });
    expect((await decide('mock-city')).status).toBe(403);
    expect((await decide('mock-venue')).status).toBe(403);
    expect((await decide('mock-staff')).status).toBe(200);
    const invite = (token: string, venueId: string) =>
      call('adminRoles.invite', token, '/v1/admin/invites', {
        body: { role: 'venue_coordinator', venueId, phone: '+923000000301' },
      });
    expect((await invite('mock-city', fx.venues[1]!.id)).status).toBe(201);
    expect((await invite('mock-city', fx.venues[4]!.id)).status).toBe(403);
    expect((await invite('mock-venue', alNoor.id)).status).toBe(403);
  });

  it('answers the export by the rule for unknown ids: not_found for staff, forbidden out of scope (rc.3)', async () => {
    const unknown = '00000000-0000-4000-8000-00000000abcd';
    const status = async (token: string, query: string) =>
      (await call('adminRegistrations.export', token, `/v1/admin/registrations/export?${query}`))
        .status;
    for (const token of ['mock-staff', 'mock-city', 'mock-venue']) {
      expect(await status(token, `venueId=${unknown}`), token).toBe(404);
      expect(await status(token, `cityId=${unknown}`), token).toBe(404);
    }
    const lahoreVenue = fx.venues.find((v) => v.cityId !== rawalpindi.id)!;
    expect(await status('mock-city', `venueId=${lahoreVenue.id}`)).toBe(403);
    expect(await status('mock-venue', `venueId=${lahoreVenue.id}`)).toBe(403);
    expect(await status('mock-venue', `cityId=${rawalpindi.id}`)).toBe(403);
    expect(await status('mock-city', `cityId=${rawalpindi.id}`)).toBe(200);
    expect(await status('mock-venue', `venueId=${alNoor.id}`)).toBe(200);
    expect(await status('mock-staff', `venueId=${lahoreVenue.id}`)).toBe(200);
    // Someone with no staff role is refused before any lookup.
    expect(await status('mock-user', `venueId=${unknown}`)).toBe(403);
  });

  it('echoes the handover on the invite it creates, and null without one (rc.3)', async () => {
    const assignment = '00000000-0000-4000-8000-00000000beef';
    const sent = await call('adminRoles.invite', 'mock-city', '/v1/admin/invites', {
      body: {
        role: 'venue_coordinator',
        venueId: alNoor.id,
        phone: '+923000000302',
        replacesAssignmentId: assignment,
      },
    });
    expect(sent.status).toBe(201);
    expect(sent.data).toMatchObject({
      phone: '+923000000302',
      role: 'venue_coordinator',
      scopeType: 'venue',
      venueId: alNoor.id,
      cityId: null,
      status: 'pending',
      replacesAssignmentId: assignment,
    });
    const plain = await call('adminRoles.invite', 'mock-staff', '/v1/admin/invites', {
      body: { role: 'city_coordinator', cityId: rawalpindi.id, phone: '+923000000303' },
    });
    expect(plain.data).toMatchObject({
      scopeType: 'city',
      cityId: rawalpindi.id,
      venueId: null,
      replacesAssignmentId: null,
    });
  });

  it('exports only the registrations in the caller scope', async () => {
    const rows = async (token: string) =>
      (
        (await call('adminRegistrations.export', token, '/v1/admin/registrations/export'))
          .data as string
      )
        .trimEnd()
        .split('\r\n')
        .slice(1);
    expect(await rows('mock-staff')).toHaveLength(fx.sessions.length);
    const venueRows = await rows('mock-venue');
    expect(venueRows.length).toBe(fx.sessions.filter((s) => s.venueId === alNoor.id).length);
    expect(venueRows.every((l) => l.includes(alNoor.id))).toBe(true);
    const cityRows = await rows('mock-city');
    expect(cityRows.length).toBe(fx.sessions.filter((s) => s.cityId === rawalpindi.id).length);
  });
});
