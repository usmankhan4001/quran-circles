import { describe, expect, it } from 'vitest';
import { ApiClientError, createApiClient } from './client';
import { fixtureId, importExamples } from './fixtures';
import { createMockHandler } from './mock';

const mock = createMockHandler();
const calls: { url: string; method: string; auth: string | null; lang: string | null }[] = [];

const make = (token: string | null = 'mock-user', validateResponses = true) =>
  createApiClient({
    baseUrl: 'http://mock.test/',
    getAccessToken: () => token,
    getLocale: () => 'ur',
    validateResponses,
    fetch: (async (url: string | URL | Request, init?: RequestInit) => {
      const req = new Request(url as string, init);
      calls.push({
        url: req.url,
        method: req.method,
        auth: req.headers.get('authorization'),
        lang: req.headers.get('accept-language'),
      });
      return mock(req);
    }) as typeof fetch,
  });

describe('typed API client', () => {
  it('calls a public endpoint with query parameters and parses the result', async () => {
    const api = make(null);
    const page = await api.sessions.list({
      query: { section: 'women', dayOfWeek: [1, 2], limit: 5 },
    });
    expect(page.items.length).toBeGreaterThan(0);
    const last = calls.at(-1)!;
    expect(last.url).toContain('section=women');
    expect(last.url).toContain('dayOfWeek=1&dayOfWeek=2');
    expect(last.auth).toBeNull();
    expect(last.lang).toBe('ur');
  });

  it('fills path parameters and sends the token on signed-in endpoints', async () => {
    const api = make('mock-user');
    const session = await api.sessions.get({ params: { sessionId: fixtureId('session', 1) } });
    expect(session.id).toBe(fixtureId('session', 1));
    const me = await api.me.get();
    expect(me.id).toBeTruthy();
    expect(calls.at(-1)!.auth).toBe('Bearer mock-user');
  });

  it('sends JSON bodies and returns a typed response', async () => {
    const api = make();
    const reg = await api.registrations.create({
      body: {
        sessionId: fixtureId('session', 2),
        areaId: fixtureId('area', 1),
        section: 'women',
        partySize: 2,
        allowWhatsapp: true,
      },
    });
    expect(reg.status).toBe('waitlisted');
    expect(reg.waitlistPosition).toBe(3);
  });

  it('returns nothing for 204 and text for CSV', async () => {
    const api = make('mock-staff');
    await expect(
      api.follows.delete({ params: { followId: fixtureId('user', 3) } }),
    ).resolves.toBeUndefined();
    const csv = await api.registrations.export({ params: { sessionId: fixtureId('session', 1) } });
    expect(csv.startsWith('name,phone')).toBe(true);
  });

  it('throws a typed error with the contract code', async () => {
    const api = make(null);
    await expect(api.me.get()).rejects.toMatchObject({
      name: 'ApiClientError',
      status: 401,
      code: 'unauthenticated',
    });
    const err = await make('mock-user')
      .sessions.get({ params: { sessionId: fixtureId('session', 999) } })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiClientError);
    expect((err as ApiClientError).code).toBe('not_found');
    expect((err as ApiClientError).requestId).toMatch(/^mock-/);
  });

  it('refuses a bad request before it leaves the device', async () => {
    const before = calls.length;
    const api = make();
    await expect(
      api.registrations.create({
        body: {
          sessionId: fixtureId('session', 1),
          areaId: fixtureId('area', 1),
          section: 'women',
          partySize: 'many' as unknown as number,
          allowWhatsapp: true,
        },
      }),
    ).rejects.toThrow();
    expect(calls.length).toBe(before);
  });

  it('turns a network failure into network_error', async () => {
    const api = createApiClient({
      baseUrl: 'http://x.test',
      fetch: (async () => {
        throw new TypeError('offline');
      }) as typeof fetch,
    });
    await expect(api.config.get()).rejects.toMatchObject({ code: 'network_error' });
  });

  it('flags a response that breaks the contract', async () => {
    const api = createApiClient({
      baseUrl: 'http://x.test',
      fetch: (async () =>
        new Response(JSON.stringify({ nope: true }), { status: 200 })) as typeof fetch,
    });
    await expect(api.config.get()).rejects.toMatchObject({ code: 'invalid_response' });
  });

  it('carries retry hints on rate limits', async () => {
    const api = createApiClient({
      baseUrl: 'http://mock.test',
      fetch: (async (url: string | URL | Request, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        headers.set('x-mock-error', 'rate_limited');
        return mock(new Request(url as string, { ...init, headers }));
      }) as typeof fetch,
    });
    await expect(api.auth.requestCode({ body: { phone: '+923000000099' } })).rejects.toMatchObject({
      code: 'rate_limited',
      retryAfterSeconds: 30,
    });
  });
});

describe('typed API client, endpoints added in 1.0.0-rc.2', () => {
  it('keeps the issues of a validation_failed response on the error', async () => {
    const forced = createApiClient({
      baseUrl: 'http://mock.test',
      fetch: (async (url: string | URL | Request, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        headers.set('x-mock-error', 'not-a-code');
        return mock(new Request(url as string, { ...init, headers }));
      }) as typeof fetch,
    });
    const rejected = (await forced.config.get().catch((e: unknown) => e)) as ApiClientError;
    expect(rejected.code).toBe('validation_failed');
    expect(rejected.issues).toEqual([{ path: 'x-mock-error', code: 'invalid_value' }]);
    expect(rejected.requestId).toMatch(/^mock-/);
  });

  it('leaves issues empty for other errors', async () => {
    const err = (await make(null)
      .me.get()
      .catch((e: unknown) => e)) as ApiClientError;
    expect(err.code).toBe('unauthenticated');
    expect(err.issues).toBeUndefined();
  });

  it('shows which field a bulk import row failed on, from the typed result', async () => {
    const api = make('mock-staff');
    const result = await api.adminImport.venues({
      body: { dryRun: true, rows: [{ ...importExamples.venues[0]!, lat: 500 }] },
    });
    expect(result.applied).toBe(false);
    expect(result.rows[0]).toEqual({
      index: 0,
      status: 'invalid',
      issues: [{ path: 'lat', code: 'too_big' }],
    });
    const clean = await api.adminImport.sessions({
      body: { dryRun: true, rows: importExamples.sessions },
    });
    expect(clean.counts.created).toBe(1);
    const invites = await api.adminImport.coordinators({
      body: { dryRun: false, rows: importExamples.coordinators },
    });
    expect(invites.applied).toBe(true);
  });

  it('exports with filters and reads single records through the typed client', async () => {
    const api = make('mock-staff');
    const csv = await api.adminRegistrations.export({
      query: { venueId: fixtureId('venue', 1), from: '2027-02-01', to: '2027-02-28' },
    });
    expect(csv.startsWith('session_id,venue_id,city_id,name,phone')).toBe(true);
    expect(calls.at(-1)!.url).toContain('venueId=');
    expect(calls.at(-1)!.url).toContain('from=2027-02-01');
    const session = await api.adminSessions.get({ params: { sessionId: fixtureId('session', 1) } });
    expect(session.id).toBe(fixtureId('session', 1));
    const circle = await api.adminCircles.get({ params: { circleId: fixtureId('circle', 1) } });
    expect(circle.status).toBe('published');
    const preview = await api.adminUpdates.preview({
      body: { scope: { type: 'national' }, title: { en: 'Hi' }, body: { en: 'There' } },
    });
    expect(preview.recipients).toBeGreaterThan(0);
  });

  it('sends a handover invite and archives a circle', async () => {
    const api = make('mock-staff');
    const invite = await api.adminRoles.invite({
      body: {
        role: 'venue_coordinator',
        venueId: fixtureId('venue', 1),
        phone: '+923000000101',
        replacesAssignmentId: fixtureId('user', 5),
      },
    });
    expect(invite.status).toBeTruthy();
    const circle = await api.adminCircles.update({
      params: { circleId: fixtureId('circle', 1) },
      body: { status: 'archived' },
    });
    expect(circle.id).toBeTruthy();
  });

  it('reads settings with reminder lead times and updates just one program', async () => {
    const api = make('mock-staff');
    const settings = await api.adminSettings.get();
    expect(settings.reminderLeadMinutes.dora).toBeGreaterThanOrEqual(5);
    await api.adminSettings.update({ body: { reminderLeadMinutes: { circles: 30 } } });
    const sent = calls.at(-1)!;
    expect(sent.method).toBe('PATCH');
  });
});
