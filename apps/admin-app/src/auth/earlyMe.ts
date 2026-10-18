import type { Locale, Me } from '@qc/contracts';

/**
 * `me.get` in the contract (`endpoints['me.get'].path`; earlyMe.test.ts checks they agree).
 * This module asks it with a plain `fetch` so that it can run before the contract's client
 * and its schemas have loaded; `takeEarlyMe` checks the answer against the `Me` schema.
 */
export const ME_PATH = '/v1/me';

interface Early {
  accessToken: string;
  response: Promise<Response | null>;
  /** The answer's JSON, read once and shared (`peekEarlyMe` and `takeEarlyMe`). */
  body?: Promise<unknown>;
}

/** The answer's JSON, or null when the request failed, was refused or was not JSON. */
function bodyOf(pending: Early): Promise<unknown> {
  pending.body ??= pending.response
    .then((response) => (response?.ok ? (response.json() as Promise<unknown>) : null))
    .catch(() => null);
  return pending.body;
}

let early: Early | null = null;

export interface EarlyMeOptions {
  baseUrl: string;
  /** The saved sign-in, as stored (`TOKENS_KEY`), read at once. */
  savedTokens: string | null;
  locale: Locale;
  fetch?: typeof fetch;
  now?: () => number;
}

/** Just enough of the saved tokens to ask; `AuthProvider` checks them fully with `Tokens`. */
function accessTokenOf(raw: string | null, now: number): string | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as { accessToken?: unknown; accessTokenExpiresAt?: unknown };
    const { accessToken, accessTokenExpiresAt } = value ?? {};
    if (typeof accessToken !== 'string' || typeof accessTokenExpiresAt !== 'string') return null;
    // A minute's margin: a token about to run out gets the normal path, which can refresh it.
    const left = Date.parse(accessTokenExpiresAt) - now;
    return Number.isFinite(left) && left >= 60_000 ? accessToken : null;
  } catch {
    return null;
  }
}

/**
 * Asks who is signed in with the saved access token while the page's scripts are still being
 * run, instead of after the app has mounted: one round trip less before the first screen on a
 * slow connection. `AuthProvider` takes the answer with `takeEarlyMe`.
 *
 * It only reads: a token that has run out or is about to is left alone, and nothing is ever
 * refreshed, written or forgotten here. Any failure, a 401 included, is an empty answer, and
 * `AuthProvider` then asks again itself, refreshing or signing out as it always does.
 */
export function startEarlyMe(options: EarlyMeOptions): void {
  early = null;
  const accessToken = accessTokenOf(options.savedTokens, (options.now ?? Date.now)());
  if (!accessToken) return;
  const doFetch = options.fetch ?? ((input, init) => globalThis.fetch(input, init));
  let response: Promise<Response | null>;
  try {
    response = doFetch(`${options.baseUrl.replace(/\/+$/, '')}${ME_PATH}`, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${accessToken}`,
        'accept-language': options.locale,
      },
    }).catch(() => null);
  } catch {
    return;
  }
  early = { accessToken, response };
}

/**
 * The early answer for this access token, once, checked with `parse` (the `Me` schema). Null
 * when none was started, it failed or did not check out, or it was asked with other tokens.
 */
export async function takeEarlyMe(
  accessToken: string,
  parse: (data: unknown) => Me | null,
): Promise<Me | null> {
  const pending = early;
  early = null;
  if (!pending || pending.accessToken !== accessToken) return null;
  const body = await bodyOf(pending);
  if (body === null) return null;
  try {
    return parse(body);
  } catch {
    return null;
  }
}

/** The early answer, unchecked, without taking it. */
export interface EarlyMeAnswer {
  /** The access token it was asked with. */
  accessToken: string;
  /** Its JSON, or null when it failed or was refused. Not yet checked against `Me`. */
  body: Promise<unknown>;
}

/**
 * Lets the first screen start its own request off the early answer (`startEarlyToday`) while it
 * stays available to `takeEarlyMe`. Null when none was started or it was already taken.
 */
export function peekEarlyMe(): EarlyMeAnswer | null {
  if (!early) return null;
  return { accessToken: early.accessToken, body: bodyOf(early) };
}
