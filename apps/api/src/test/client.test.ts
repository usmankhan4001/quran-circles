import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ApiClientError, createApiClient, type ApiClient } from '@qc/contracts';
import { TEST_PRINCIPAL_HEADER } from '../middleware/test-auth';
import { createHarness, type Actor, type Harness } from './harness';

/**
 * The typed client apps use, pointed at the real API in memory. It checks every response against
 * the contract schema, so a drifting handler fails here the way it would fail an app.
 */
let h: Harness;
let admin: Actor;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(() => h.close());
beforeEach(async () => {
  await h.reset();
  admin = await h.nationalAdmin();
});

/** The token is the principal as JSON; the stand-in sign-in reads it from a header. */
function clientFor(actor: Actor | null): ApiClient {
  return createApiClient({
    baseUrl: 'http://api.test',
    getAccessToken: () => (actor ? JSON.stringify(actor.principal) : null),
    fetch: async (input, init) => {
      const url = new URL(
        typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
      );
      const headers = new Headers(init?.headers);
      const bearer = headers.get('authorization');
      if (bearer?.startsWith('Bearer ')) headers.set(TEST_PRINCIPAL_HEADER, bearer.slice(7));
      headers.delete('authorization');
      return h.app.request(`${url.pathname}${url.search}`, { ...init, headers });
    },
  });
}

const failure = async (promise: Promise<unknown>): Promise<ApiClientError> => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiClientError) return error;
    throw error;
  }
  throw new Error('the call did not fail');
};

describe('the typed client against the real API', () => {
  it('reads public data without signing in', async () => {
    const api = clientFor(null);
    const provinces = await api.places.provinces();
    expect(provinces.items.map((p) => p.id)).toContain(h.world.provinceId);
    const cities = await api.places.cities({ query: { provinceId: h.world.provinceId } });
    expect(cities.items.length).toBe(2);
    const health = await api.system.health();
    expect(health).toMatchObject({ ok: true, service: 'api' });
  });

  it('runs a coordinator flow from creating a session to the public seeing it', async () => {
    const staff = clientFor(admin);
    const session = await staff.adminSessions.create({
      body: {
        kind: 'recurring',
        venueId: h.world.venueA1,
        program: 'circles',
        title: { en: 'Client circle' },
        section: 'family',
        language: 'en',
        localStartTime: '18:00',
        durationMinutes: 60,
        daysOfWeek: [5],
        startsOn: '2026-10-16',
      },
    });
    const visitor = clientFor(null);
    const listed = await visitor.sessions.list({ query: {} });
    expect(listed.items.map((s) => s.id)).toEqual([session.id]);
    const occurrences = await visitor.sessions.occurrences({
      params: { sessionId: session.id },
      query: {},
    });
    expect(occurrences.items.length).toBeGreaterThan(0);
  });

  it('runs a participant flow: register, see it, cancel, read the feed', async () => {
    const staff = clientFor(admin);
    const session = await staff.adminSessions.create({
      body: {
        kind: 'recurring',
        venueId: h.world.venueA1,
        program: 'circles',
        title: { en: 'Flow circle' },
        section: 'family',
        language: 'en',
        localStartTime: '18:00',
        durationMinutes: 60,
        daysOfWeek: [5],
        startsOn: '2026-10-16',
      },
    });
    const person = await h.person();
    const api = clientFor(person);
    const registration = await api.registrations.create({
      body: {
        sessionId: session.id,
        areaId: h.world.cityA.areaId,
        section: 'family',
        partySize: 2,
        allowWhatsapp: false,
      },
    });
    expect(registration.status).toBe('confirmed');
    const mine = await api.registrations.listMine({ query: {} });
    expect(mine.items.map((r) => r.id)).toEqual([registration.id]);

    await staff.adminUpdates.post({
      body: {
        scope: { type: 'venue', venueId: h.world.venueA1 },
        title: { en: 'Hello' },
        body: { en: 'Welcome' },
      },
    });
    const feed = await api.updates.feed({ query: {} });
    expect(feed.items).toHaveLength(1);
    expect(feed.unreadCount).toBe(1);
    expect((await api.updates.markRead({ body: { all: true } })).unreadCount).toBe(0);

    const cancelled = await api.registrations.cancel({
      params: { registrationId: registration.id },
    });
    expect(cancelled.status).toBe('cancelled');
    const me = await api.me.get();
    expect(me.id).toBe(person.userId);
    await api.me.delete({ body: { confirm: true } });
  });

  it('turns an error body into an ApiClientError with the contract code and the request id', async () => {
    const stranger = clientFor(await h.person());
    const forbidden = await failure(stranger.adminSettings.get());
    expect(forbidden).toMatchObject({ status: 403, code: 'forbidden' });
    expect(forbidden.requestId).toMatch(/^[0-9a-f-]{36}$/);

    const signedOut = await failure(clientFor(null).me.get());
    expect(signedOut).toMatchObject({ status: 401, code: 'unauthenticated' });

    const missing = await failure(
      clientFor(admin).adminSessions.occurrences({
        params: { sessionId: '00000000-0000-4000-8000-000000000000' },
        query: {},
      }),
    );
    expect(missing).toMatchObject({ status: 404, code: 'not_found' });
  });

  it('shows the retry delay when a caller is rate limited', async () => {
    const limited = createApiClient({
      baseUrl: 'http://api.test',
      fetch: async (input, init) => {
        const url = new URL(
          typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
        );
        return h.app.request(`${url.pathname}${url.search}`, init);
      },
    });
    let error: ApiClientError | null = null;
    for (let i = 0; i < 400 && !error; i++) {
      try {
        await limited.places.provinces();
      } catch (caught) {
        if (caught instanceof ApiClientError) error = caught;
        else throw caught;
      }
    }
    expect(error).toMatchObject({ status: 429, code: 'rate_limited' });
    expect(error?.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('downloads the registrations export as text', async () => {
    const staff = clientFor(admin);
    const session = await staff.adminSessions.create({
      body: {
        kind: 'one_off',
        venueId: h.world.venueA1,
        program: 'dora',
        title: { en: 'Export check' },
        section: 'family',
        language: 'en',
        localStartTime: '20:00',
        durationMinutes: 60,
        date: '2026-10-20',
      },
    });
    const csv = await staff.registrations.export({ params: { sessionId: session.id } });
    expect(csv.replace('﻿', '').split('\r\n')[0]).toBe(
      'name,phone,section,party_size,status,whatsapp,registered_at',
    );
  });
});
