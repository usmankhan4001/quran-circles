import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { listFilterOf, pickWorkingScope, workingScopesOf } from '../../scope/principal';
import { WORKING_SCOPE_KEY } from '../../scope/WorkingScopeProvider';
import { createMemoryStore } from '../../storage/storage';
import { createBackend, FIXTURE_NOW, ids, meFor, type Backend } from '../../test/backend';
import { BASE_URL, renderScreen, settled, tokens } from '../../test/render';
import type { EarlyMeAnswer } from '../../auth/earlyMe';
import { EARLY_TODAY_MAX_AGE_MS, startEarlyToday, takeEarlyToday, TODAY_LIMIT } from './earlyToday';
import { TodayScreen } from './TodayScreen';

const NOW = FIXTURE_NOW.getTime();
/** Someone else (synthetic id). */
const OTHER_PERSON = '00000000-0000-4000-8000-00000000f00d';

/** An early `me` answer as `peekEarlyMe` gives it. */
const answer = (body: unknown, accessToken = tokens.accessToken): EarlyMeAnswer => ({
  accessToken,
  body: Promise.resolve(body),
});

/** Lets the answer's promise chain run (the body, `Me` check and the request). */
const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

function start(backend: Backend, body: unknown = backend.me, savedScopeId: string | null = null) {
  startEarlyToday({
    baseUrl: BASE_URL,
    me: answer(body),
    savedScopeId,
    locale: 'en',
    fetch: backend.fetch,
    now: () => NOW,
  });
}

afterEach(() => {
  takeEarlyToday('clear', {}); // never leave an answer for the next test
});

describe('startEarlyToday', () => {
  it.each(['venue', 'city', 'admin', 'multi'] as const)(
    'asks for the %s working scope exactly as Today will, with the early token',
    async (kind) => {
      const backend = createBackend({ me: meFor(kind) });
      start(backend);
      await flush();
      const calls = backend.callsTo('adminSessions.list');
      expect(calls).toHaveLength(1);
      const filter = listFilterOf(pickWorkingScope(workingScopesOf(backend.me)));
      expect(calls[0]!.query).toEqual(
        Object.fromEntries(
          Object.entries({ ...filter, limit: TODAY_LIMIT }).map(([k, v]) => [k, String(v)]),
        ),
      );
      const early = takeEarlyToday(backend.me.id, filter, NOW);
      expect(early).not.toBeNull();
      const sessions = await early!;
      expect(sessions.length).toBeGreaterThan(0);
    },
  );

  it('follows the saved working scope when it is still held', async () => {
    const me = meFor('multi');
    const backend = createBackend({ me });
    const second = me.roles[1]!;
    start(backend, me, second.id);
    await flush();
    expect(backend.callsTo('adminSessions.list')[0]!.query.venueId).toBe(second.venueId);
    expect(takeEarlyToday(me.id, { venueId: me.roles[0]!.venueId! }, NOW)).toBeNull();
  });

  it('asks nothing without an early answer', async () => {
    const backend = createBackend();
    startEarlyToday({ baseUrl: BASE_URL, me: null, savedScopeId: null, locale: 'en' });
    await flush();
    expect(backend.calls).toHaveLength(0);
    expect(takeEarlyToday(backend.me.id, {}, NOW)).toBeNull();
  });

  it('asks nothing when the early me failed (no body)', async () => {
    const backend = createBackend();
    start(backend, null);
    await flush();
    expect(backend.calls).toHaveLength(0);
  });

  it('asks nothing when me does not check out against the contract', async () => {
    const backend = createBackend();
    start(backend, { ...backend.me, roles: 'everything' });
    await flush();
    start(backend, { id: 'not-a-uuid' });
    await flush();
    expect(backend.calls).toHaveLength(0);
  });

  it('asks nothing for someone with no staff role', async () => {
    const backend = createBackend({ me: { ...meFor('city'), roles: [] } });
    start(backend);
    await flush();
    expect(backend.calls).toHaveLength(0);
  });
});

describe('takeEarlyToday', () => {
  it('hands the answer over once', async () => {
    const backend = createBackend({ me: meFor('city') });
    start(backend);
    await flush();
    const filter = { cityId: ids.cityRawalpindi };
    expect(takeEarlyToday(backend.me.id, filter, NOW)).not.toBeNull();
    expect(takeEarlyToday(backend.me.id, filter, NOW)).toBeNull();
  });

  it('drops the answer for another person, another scope or when it is too old', async () => {
    const backend = createBackend({ me: meFor('city') });
    const filter = { cityId: ids.cityRawalpindi };
    start(backend);
    await flush();
    expect(takeEarlyToday(OTHER_PERSON, filter, NOW)).toBeNull();
    expect(takeEarlyToday(backend.me.id, filter, NOW)).toBeNull(); // dropped by the mismatch

    start(backend);
    await flush();
    expect(takeEarlyToday(backend.me.id, { venueId: ids.venueAlNoor }, NOW)).toBeNull();

    start(backend);
    await flush();
    expect(takeEarlyToday(backend.me.id, {}, NOW)).toBeNull();

    start(backend);
    await flush();
    expect(takeEarlyToday(backend.me.id, filter, NOW + EARLY_TODAY_MAX_AGE_MS + 1)).toBeNull();
  });
});

describe('TodayScreen with an early answer', () => {
  it('shows the early sessions without asking again', async () => {
    const backend = createBackend({ me: meFor('venue') });
    start(backend);
    await flush();
    expect(backend.callsTo('adminSessions.list')).toHaveLength(1);
    renderScreen(<TodayScreen now={FIXTURE_NOW} />, { backend });
    await settled('today-data');
    expect(screen.queryByTestId(`session-${ids.sessionDora}`)).toBeTruthy();
    expect(screen.queryByTestId(`session-${ids.sessionLahore}`)).toBeNull();
    expect(backend.callsTo('adminSessions.list')).toHaveLength(1);
  });

  it('asks again when the saved scope changed the filter', async () => {
    const me = meFor('multi');
    const backend = createBackend({ me });
    start(backend, me, null); // early: the first venue
    await flush();
    const prefs = createMemoryStore({ [WORKING_SCOPE_KEY]: me.roles[1]!.id });
    renderScreen(<TodayScreen now={FIXTURE_NOW} />, { backend, prefs });
    await settled('today-data');
    const calls = backend.callsTo('adminSessions.list');
    expect(calls).toHaveLength(2);
    expect(calls[1]!.query.venueId).toBe(me.roles[1]!.venueId);
    expect(screen.queryByTestId(`session-${ids.sessionLahore}`)).toBeTruthy();
    expect(screen.queryByTestId(`session-${ids.sessionDora}`)).toBeNull();
  });

  it('asks again when the early request failed', async () => {
    const backend = createBackend({ me: meFor('city') });
    backend.failWith('adminSessions.list', 'service_unavailable', { times: 1 });
    start(backend);
    await flush();
    renderScreen(<TodayScreen now={FIXTURE_NOW} />, { backend });
    await settled('today-data');
    expect(backend.callsTo('adminSessions.list')).toHaveLength(2);
    expect(screen.queryByTestId(`session-${ids.sessionDora}`)).toBeTruthy();
  });
});
