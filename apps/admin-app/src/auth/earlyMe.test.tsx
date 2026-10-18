import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Text } from 'react-native';
import { Me, endpoints } from '@qc/contracts';
import { createMemoryStore } from '../storage/storage';
import { FIXTURE_NOW, createBackend, meFor, type Backend } from '../test/backend';
import { BASE_URL, tokens } from '../test/render';
import { AuthProvider, TOKENS_KEY, useAuth } from './AuthProvider';
import { ME_PATH, peekEarlyMe, startEarlyMe, takeEarlyMe } from './earlyMe';

const NOW = () => FIXTURE_NOW.getTime();
const parseMe = (data: unknown) => {
  const checked = Me.safeParse(data);
  return checked.success ? checked.data : null;
};
const asStored = (value: unknown = tokens) =>
  typeof value === 'string' ? value : JSON.stringify(value);

function start(backend: Backend, savedTokens: string | null = asStored()) {
  startEarlyMe({ baseUrl: BASE_URL, savedTokens, locale: 'ur', fetch: backend.fetch, now: NOW });
}

function Who() {
  const { status, me } = useAuth();
  return <Text testID="who">{`${status}:${me?.id ?? 'none'}`}</Text>;
}

function mountAuth(backend: Backend) {
  const tokenStore = createMemoryStore({ [TOKENS_KEY]: asStored() });
  render(
    <AuthProvider baseUrl={BASE_URL} tokenStore={tokenStore} fetch={backend.fetch}>
      <Who />
    </AuthProvider>,
  );
  return tokenStore;
}

describe('startEarlyMe and takeEarlyMe', () => {
  afterEach(async () => {
    await takeEarlyMe('clear', parseMe); // never leave an answer for the next test
  });

  it('asks the contract path for me at once, with the saved token and the page language', () => {
    expect(ME_PATH).toBe(endpoints['me.get'].path);
    const asked: { url: string; headers: Headers }[] = [];
    startEarlyMe({
      baseUrl: `${BASE_URL}/`,
      savedTokens: asStored(),
      locale: 'ur',
      now: NOW,
      fetch: (input, init) => {
        asked.push({ url: String(input), headers: new Headers(init?.headers) });
        return new Promise<Response>(() => undefined);
      },
    });
    // Synchronously: the request leaves while the rest of the scripts are still running.
    expect(asked).toHaveLength(1);
    expect(asked[0]!.url).toBe(`${BASE_URL}/v1/me`);
    expect(asked[0]!.headers.get('authorization')).toBe(`Bearer ${tokens.accessToken}`);
    expect(asked[0]!.headers.get('accept-language')).toBe('ur');
  });

  it('gives the checked answer once, for the same token only', async () => {
    const backend = createBackend({ me: meFor('city') });
    start(backend);
    expect(await takeEarlyMe(tokens.accessToken, parseMe)).toEqual(backend.me);
    expect(await takeEarlyMe(tokens.accessToken, parseMe)).toBeNull();
    expect(backend.callsTo('me.get')).toHaveLength(1);

    start(backend);
    expect(await takeEarlyMe('another-token', parseMe)).toBeNull();
  });

  it('asks nothing when no sign-in, a damaged one or a token about to run out is saved', async () => {
    const backend = createBackend({ me: meFor('city') });
    const soon = new Date(NOW() + 30_000).toISOString();
    for (const saved of [
      null,
      '{',
      'null',
      asStored({ accessToken: 'x' }),
      asStored({ ...tokens, accessTokenExpiresAt: 'not a date' }),
      asStored({ ...tokens, accessTokenExpiresAt: soon }),
    ]) {
      start(backend, saved);
      expect(await takeEarlyMe(tokens.accessToken, parseMe)).toBeNull();
    }
    expect(backend.calls).toHaveLength(0);
  });

  it('is empty when nothing was started', async () => {
    expect(await takeEarlyMe(tokens.accessToken, parseMe)).toBeNull();
  });

  it('is empty when the server refuses, the connection is down or the answer does not check', async () => {
    const refused = createBackend({ me: meFor('city') });
    refused.failWith('me.get', 'token_expired');
    start(refused);
    expect(await takeEarlyMe(tokens.accessToken, parseMe)).toBeNull();
    expect(refused.callsTo('auth.refresh')).toHaveLength(0);

    const offline = createBackend({ me: meFor('city') });
    offline.setOffline(true);
    start(offline);
    expect(await takeEarlyMe(tokens.accessToken, parseMe)).toBeNull();

    const odd = createBackend({ me: meFor('city') });
    start(odd);
    expect(await takeEarlyMe(tokens.accessToken, () => null)).toBeNull();
  });

  it('never throws, even when fetch itself throws', async () => {
    expect(() =>
      startEarlyMe({
        baseUrl: BASE_URL,
        savedTokens: asStored(),
        locale: 'en',
        now: NOW,
        fetch: () => {
          throw new Error('no fetch here');
        },
      }),
    ).not.toThrow();
    expect(await takeEarlyMe(tokens.accessToken, parseMe)).toBeNull();
  });
});

describe('peekEarlyMe', () => {
  afterEach(async () => {
    await takeEarlyMe('clear', parseMe);
  });

  it('shows the unchecked answer without taking it, and the body is read once', async () => {
    const backend = createBackend({ me: meFor('city') });
    start(backend);
    const peeked = peekEarlyMe();
    expect(peeked?.accessToken).toBe(tokens.accessToken);
    expect(await peeked!.body).toEqual(JSON.parse(JSON.stringify(backend.me)));
    expect(peekEarlyMe()?.body).toBe(peeked!.body);
    expect(await takeEarlyMe(tokens.accessToken, parseMe)).toEqual(backend.me);
    expect(peekEarlyMe()).toBeNull();
    expect(backend.callsTo('me.get')).toHaveLength(1);
  });

  it('gives a null body when the early answer was refused', async () => {
    const backend = createBackend();
    backend.failWith('me.get', 'unauthenticated');
    start(backend);
    expect(await peekEarlyMe()!.body).toBeNull();
    expect(await takeEarlyMe(tokens.accessToken, parseMe)).toBeNull();
  });

  it('is null when nothing was started', () => {
    expect(peekEarlyMe()).toBeNull();
  });
});

describe('AuthProvider with an early answer', () => {
  it('signs in from the early answer without asking again', async () => {
    const backend = createBackend({ me: meFor('venue') });
    start(backend);
    mountAuth(backend);
    expect(await screen.findByText(`signedIn:${backend.me.id}`)).toBeTruthy();
    expect(backend.callsTo('me.get')).toHaveLength(1);
  });

  it('asks again itself, refreshing as usual, when the early answer was refused', async () => {
    const backend = createBackend({ me: meFor('venue') });
    backend.failWith('me.get', 'token_expired', { times: 2 });
    start(backend);
    mountAuth(backend);
    expect(await screen.findByText(`signedIn:${backend.me.id}`)).toBeTruthy();
    expect(backend.callsTo('auth.refresh')).toHaveLength(1);
  });

  it('signs out and forgets the tokens as usual when the server no longer knows the sign-in', async () => {
    const backend = createBackend({ me: meFor('venue') });
    backend.failWith('me.get', 'unauthenticated', { times: 2 });
    start(backend);
    const tokenStore = mountAuth(backend);
    expect(await screen.findByText('signedOut:none')).toBeTruthy();
    expect(await tokenStore.get(TOKENS_KEY)).toBeNull();
  });
});
