import { ApiError, type Tokens } from '@qc/contracts';

export interface TokenSource {
  current(): Tokens | null;
  /** Called with new tokens after a refresh. */
  update(tokens: Tokens): Promise<void> | void;
  /** Exchanges the refresh token. Throws when it is no longer valid. */
  refresh(refreshToken: string): Promise<Tokens>;
  /** Called when the sign-in cannot be recovered: the person must sign in again. */
  lost(): void;
}

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

async function errorCodeOf(response: Response): Promise<string | null> {
  const body = (await response
    .clone()
    .json()
    .catch(() => null)) as unknown;
  const parsed = ApiError.safeParse(body);
  return parsed.success ? parsed.data.error.code : null;
}

/**
 * Wraps `fetch` so a stale access token is refreshed once, in one place, and the call that
 * failed is repeated with the new token. Several calls that fail together share one refresh.
 * If the refresh token is no longer valid, or the server does not know the person, the
 * sign-in is reported lost and the original response is returned.
 */
export function createAuthedFetch(base: FetchLike, source: TokenSource): FetchLike {
  let inFlight: Promise<Tokens | null> | null = null;

  const refreshOnce = (): Promise<Tokens | null> => {
    inFlight ??= (async () => {
      const tokens = source.current();
      if (!tokens) return null;
      try {
        const next = await source.refresh(tokens.refreshToken);
        await source.update(next);
        return next;
      } catch {
        source.lost();
        return null;
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  };

  return async (input, init) => {
    const response = await base(input, init);
    if (response.status !== 401) return response;
    const code = await errorCodeOf(response);
    if (code === 'unauthenticated') {
      source.lost();
      return response;
    }
    if (code !== 'token_expired') return response;
    const next = await refreshOnce();
    if (!next) return response;
    const headers = new Headers(init?.headers);
    headers.set('authorization', `Bearer ${next.accessToken}`);
    return base(input, { ...init, headers });
  };
}
