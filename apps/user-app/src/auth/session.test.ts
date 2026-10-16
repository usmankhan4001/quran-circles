import { describe, expect, it, vi } from 'vitest';
import { ApiClientError, type Tokens } from '@qc/contracts';
import { fixtures } from '@qc/contracts/fixtures';
import { MemoryStore } from '../core/storage';
import { AuthSession, TOKENS_KEY } from './session';

const NOW = Date.parse('2027-02-15T08:00:00Z');

function tokens(change: Partial<Tokens> = {}): Tokens {
  return {
    accessToken: 'access-1',
    accessTokenExpiresAt: '2027-02-15T09:00:00Z',
    refreshToken: 'refresh-1',
    refreshTokenExpiresAt: '2027-03-15T08:00:00Z',
    ...change,
  };
}

function setup(refresh?: (token: string) => Promise<Tokens>) {
  const storage = new MemoryStore();
  const refreshTokens = vi.fn(
    refresh ?? (async () => tokens({ accessToken: 'access-2', refreshToken: 'refresh-2' })),
  );
  const session = new AuthSession({ storage, refreshTokens, now: () => NOW });
  return { storage, refreshTokens, session };
}

describe('AuthSession.restore', () => {
  it('starts signed out when nothing is saved', async () => {
    const { session } = setup();
    expect(session.getState().status).toBe('restoring');
    expect((await session.restore()).status).toBe('signedOut');
  });

  it('signs in again from saved tokens', async () => {
    const { session, storage } = setup();
    await storage.set(TOKENS_KEY, JSON.stringify(tokens()));
    expect((await session.restore()).status).toBe('signedIn');
    expect(await session.getAccessToken()).toBe('access-1');
  });

  it('forgets tokens whose refresh token has run out', async () => {
    const { session, storage } = setup();
    await storage.set(
      TOKENS_KEY,
      JSON.stringify(tokens({ refreshTokenExpiresAt: '2027-02-01T00:00:00Z' })),
    );
    expect((await session.restore()).status).toBe('signedOut');
    expect(await storage.get(TOKENS_KEY)).toBeNull();
  });

  it('ignores a damaged file', async () => {
    const { session, storage } = setup();
    await storage.set(TOKENS_KEY, '{"accessToken": 5}');
    expect((await session.restore()).status).toBe('signedOut');
  });
});

describe('AuthSession tokens', () => {
  it('saves tokens on sign-in and removes them on clear', async () => {
    const { session, storage } = setup();
    await session.signIn(tokens(), fixtures.me);
    expect(session.getState()).toEqual({ status: 'signedIn', me: fixtures.me });
    expect(JSON.parse((await storage.get(TOKENS_KEY))!)).toEqual(tokens());
    await session.clear();
    expect(session.getState()).toEqual({ status: 'signedOut', me: null });
    expect(await storage.get(TOKENS_KEY)).toBeNull();
    expect(await session.getAccessToken()).toBeNull();
  });

  it('keeps the person but not the old name when told of a new profile', async () => {
    const { session } = setup();
    await session.signIn(tokens(), fixtures.me);
    session.setMe({ ...fixtures.me, displayName: 'New Name' });
    expect(session.getState().me?.displayName).toBe('New Name');
  });

  it('does not sign anyone in by setting the profile while signed out', async () => {
    const { session } = setup();
    await session.restore();
    session.setMe(fixtures.me);
    expect(session.getState().status).toBe('signedOut');
  });

  it('refreshes an access token that is about to run out, before it is used', async () => {
    const { session, refreshTokens, storage } = setup();
    await session.signIn(tokens({ accessTokenExpiresAt: '2027-02-15T08:00:10Z' }), fixtures.me);
    expect(await session.getAccessToken()).toBe('access-2');
    expect(refreshTokens).toHaveBeenCalledWith('refresh-1');
    // The new tokens are saved before they are used, because refresh tokens rotate.
    expect(JSON.parse((await storage.get(TOKENS_KEY))!).refreshToken).toBe('refresh-2');
  });

  it('does not refresh a token with time left', async () => {
    const { session, refreshTokens } = setup();
    await session.signIn(tokens(), fixtures.me);
    await session.getAccessToken();
    expect(refreshTokens).not.toHaveBeenCalled();
  });

  it('runs one refresh however many calls ask at once', async () => {
    let release!: (value: Tokens) => void;
    const { session, refreshTokens } = setup(
      () => new Promise<Tokens>((resolve) => (release = resolve)),
    );
    await session.signIn(tokens(), fixtures.me);
    const results = [session.refresh(), session.refresh(), session.refresh()];
    release(tokens({ accessToken: 'access-2', refreshToken: 'refresh-2' }));
    expect(await Promise.all(results)).toEqual([true, true, true]);
    expect(refreshTokens).toHaveBeenCalledTimes(1);
  });

  it('signs the device out when the refresh token is refused', async () => {
    const { session, storage } = setup(async () => {
      throw new ApiClientError(401, 'refresh_token_invalid', 'r');
    });
    await session.signIn(tokens(), fixtures.me);
    expect(await session.refresh()).toBe(false);
    expect(session.getState().status).toBe('signedOut');
    expect(await storage.get(TOKENS_KEY)).toBeNull();
  });

  it('keeps the person signed in when the refresh fails only because the phone is offline', async () => {
    const { session, storage } = setup(async () => {
      throw new ApiClientError(0, 'network_error', null);
    });
    await session.signIn(tokens(), fixtures.me);
    await expect(session.refresh()).rejects.toMatchObject({ code: 'network_error' });
    expect(session.getState().status).toBe('signedIn');
    expect(await storage.get(TOKENS_KEY)).not.toBeNull();
  });

  it('sends the old token when it cannot refresh offline, and lets the server decide', async () => {
    const { session } = setup(async () => {
      throw new ApiClientError(0, 'network_error', null);
    });
    await session.signIn(tokens({ accessTokenExpiresAt: '2027-02-15T08:00:05Z' }), fixtures.me);
    expect(await session.getAccessToken()).toBe('access-1');
  });

  it('can refresh again after one refresh has finished', async () => {
    const { session, refreshTokens } = setup();
    await session.signIn(tokens(), fixtures.me);
    await session.refresh();
    await session.refresh();
    expect(refreshTokens).toHaveBeenCalledTimes(2);
  });

  it('has nothing to refresh when signed out', async () => {
    const { session, refreshTokens } = setup();
    await session.restore();
    expect(await session.refresh()).toBe(false);
    expect(refreshTokens).not.toHaveBeenCalled();
  });
});
