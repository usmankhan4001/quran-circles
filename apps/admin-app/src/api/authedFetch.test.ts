import type { Tokens } from '@qc/contracts';
import { describe, expect, it, vi } from 'vitest';
import { createAuthedFetch, type TokenSource } from './authedFetch';

const tokens = (n: number): Tokens => ({
  accessToken: `access-${n}`,
  accessTokenExpiresAt: '2027-02-15T09:00:00Z',
  refreshToken: `refresh-${n}`,
  refreshTokenExpiresAt: '2027-03-15T08:00:00Z',
});

const failure = (status: number, code: string) =>
  new Response(
    JSON.stringify({ error: { code, messageKey: `errors.${code}`, requestId: 'req-1' } }),
    {
      status,
      headers: { 'content-type': 'application/json' },
    },
  );
const ok = () =>
  new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });

function setup(base: (input: string | URL | Request, init?: RequestInit) => Promise<Response>) {
  let current: Tokens | null = tokens(1);
  const source: TokenSource = {
    current: () => current,
    update: vi.fn((next: Tokens) => {
      current = next;
    }),
    refresh: vi.fn(async () => tokens(2)),
    lost: vi.fn(),
  };
  return { source, fetch: createAuthedFetch(base, source) };
}

describe('createAuthedFetch', () => {
  it('passes a good response straight through', async () => {
    const base = vi.fn(async () => ok());
    const { fetch, source } = setup(base);
    expect((await fetch('http://x.test/a')).status).toBe(200);
    expect(source.refresh).not.toHaveBeenCalled();
  });

  it('refreshes once on an expired token and repeats the call with the new one', async () => {
    const seen: (string | null)[] = [];
    const base = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const auth = new Headers(init?.headers).get('authorization');
      seen.push(auth);
      return auth === 'Bearer access-2' ? ok() : failure(401, 'token_expired');
    });
    const { fetch, source } = setup(base);
    const response = await fetch('http://x.test/a', {
      headers: { authorization: 'Bearer access-1' },
    });
    expect(response.status).toBe(200);
    expect(seen).toEqual(['Bearer access-1', 'Bearer access-2']);
    expect(source.refresh).toHaveBeenCalledWith('refresh-1');
    expect(source.update).toHaveBeenCalledWith(tokens(2));
    expect(source.lost).not.toHaveBeenCalled();
  });

  it('shares one refresh between calls that fail together', async () => {
    const base = vi.fn(async (_input: string | URL | Request, init?: RequestInit) =>
      new Headers(init?.headers).get('authorization') === 'Bearer access-2'
        ? ok()
        : failure(401, 'token_expired'),
    );
    const { fetch, source } = setup(base);
    const calls = await Promise.all(
      ['a', 'b', 'c'].map((p) =>
        fetch(`http://x.test/${p}`, { headers: { authorization: 'Bearer access-1' } }),
      ),
    );
    expect(calls.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(source.refresh).toHaveBeenCalledTimes(1);
  });

  it('reports the sign-in lost when the refresh token is refused, and returns the original answer', async () => {
    const base = vi.fn(async () => failure(401, 'token_expired'));
    const { fetch, source } = setup(base);
    (source.refresh as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('refused'));
    const response = await fetch('http://x.test/a');
    expect(response.status).toBe(401);
    expect(source.lost).toHaveBeenCalledTimes(1);
  });

  it('reports the sign-in lost when the server does not know the person', async () => {
    const base = vi.fn(async () => failure(401, 'unauthenticated'));
    const { fetch, source } = setup(base);
    expect((await fetch('http://x.test/a')).status).toBe(401);
    expect(source.lost).toHaveBeenCalledTimes(1);
    expect(source.refresh).not.toHaveBeenCalled();
  });

  it('leaves other failures alone', async () => {
    const base = vi.fn(async () => failure(403, 'forbidden'));
    const { fetch, source } = setup(base);
    expect((await fetch('http://x.test/a')).status).toBe(403);
    expect(source.refresh).not.toHaveBeenCalled();
    expect(source.lost).not.toHaveBeenCalled();
  });
});
