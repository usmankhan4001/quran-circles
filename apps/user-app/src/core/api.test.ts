import { describe, expect, it, vi } from 'vitest';
import { ApiClientError, type Tokens } from '@qc/contracts';
import { fixtures } from '@qc/contracts/fixtures';
import { AuthSession } from '../auth/session';
import { createMockFetch, BASE_URL } from '../test/harness';
import { createAppApi } from './api';
import { Connectivity } from './connectivity';
import { MemoryStore } from './storage';

function freshTokens(change: Partial<Tokens> = {}): Tokens {
  return {
    accessToken: 'mock-user',
    accessTokenExpiresAt: '2099-01-01T00:00:00Z',
    refreshToken: 'refresh-2',
    refreshTokenExpiresAt: '2099-02-01T00:00:00Z',
    ...change,
  };
}

async function setup(initial: Partial<Tokens>, refresh?: () => Promise<Tokens>) {
  const http = createMockFetch();
  const connectivity = new Connectivity();
  const refreshTokens = vi.fn(refresh ?? (async () => freshTokens()));
  const session = new AuthSession({ storage: new MemoryStore(), refreshTokens });
  await session.signIn(freshTokens(initial), fixtures.me);
  const api = createAppApi(
    { baseUrl: BASE_URL, fetch: http.fetch, getLocale: () => 'en' },
    session,
    connectivity,
  );
  return { http, api, session, connectivity, refreshTokens };
}

describe('the app API client', () => {
  it('sends the bearer token and the language the person chose', async () => {
    const { api, http } = await setup({});
    await api.me.get();
    const call = http.callsTo('GET /v1/me')[0]!;
    expect(call.headers.get('authorization')).toBe('Bearer mock-user');
    expect(call.headers.get('accept-language')).toBe('en');
  });

  it('refreshes once on token_expired and repeats the call with the new token', async () => {
    const { api, http, refreshTokens } = await setup({ accessToken: 'mock-expired' });
    const me = await api.me.get();
    expect(me.id).toBe(fixtures.me.id);
    expect(refreshTokens).toHaveBeenCalledTimes(1);
    expect(refreshTokens).toHaveBeenCalledWith('refresh-2');
    const tokensSent = http.callsTo('GET /v1/me').map((c) => c.headers.get('authorization'));
    expect(tokensSent).toEqual(['Bearer mock-expired', 'Bearer mock-user']);
  });

  it('shares one refresh between calls that expire together', async () => {
    const { api, refreshTokens } = await setup({ accessToken: 'mock-expired' });
    const results = await Promise.all([api.me.get(), api.consents.list(), api.follows.list()]);
    expect(results).toHaveLength(3);
    expect(refreshTokens).toHaveBeenCalledTimes(1);
  });

  it('gives up after one retry instead of looping', async () => {
    const { api, http } = await setup({ accessToken: 'mock-expired' }, async () =>
      freshTokens({ accessToken: 'mock-expired' }),
    );
    await api.me.get().then(
      () => {
        throw new Error('should have failed');
      },
      (error: unknown) => expect(error).toMatchObject({ code: 'token_expired' }),
    );
    // The first call, then one retry: no more.
    expect(http.callsTo('GET /v1/me')).toHaveLength(2);
  });

  it('signs the device out and reports the expiry when the refresh token is refused', async () => {
    const { api, session } = await setup({ accessToken: 'mock-expired' }, async () => {
      throw new ApiClientError(401, 'refresh_token_invalid', 'r');
    });
    await expect(api.me.get()).rejects.toMatchObject({ code: 'token_expired' });
    expect(session.getState().status).toBe('signedOut');
  });

  it('does not sign anyone out when the refresh fails because the phone is offline', async () => {
    const { api, session, connectivity } = await setup(
      { accessToken: 'mock-expired' },
      async () => {
        throw new ApiClientError(0, 'network_error', null);
      },
    );
    await expect(api.me.get()).rejects.toMatchObject({ code: 'network_error' });
    expect(session.getState().status).toBe('signedIn');
    expect(connectivity.isOffline()).toBe(true);
  });

  it('reports a dropped connection and clears it again after a good answer', async () => {
    const { api, http, connectivity } = await setup({});
    http.setOffline(true);
    await expect(api.me.get()).rejects.toMatchObject({ code: 'network_error' });
    expect(connectivity.isOffline()).toBe(true);
    http.setOffline(false);
    await api.me.get();
    expect(connectivity.isOffline()).toBe(false);
  });

  it('counts an error answer from the server as being online', async () => {
    const { api, http, connectivity } = await setup({});
    connectivity.markOffline();
    http.failNext('GET /v1/me', 'internal_error');
    await expect(api.me.get()).rejects.toMatchObject({ code: 'internal_error' });
    expect(connectivity.isOffline()).toBe(false);
  });
});
