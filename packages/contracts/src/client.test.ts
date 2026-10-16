import { describe, expect, it } from 'vitest';
import { ApiClientError, createApiClient } from './client';
import { fixtureId } from './fixtures';
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
