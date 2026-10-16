/**
 * The smallest HTTP surface the real providers need. Global `fetch` satisfies it through
 * `defaultFetch`; tests pass a scripted fake, so no test ever touches the network.
 */
export interface HttpResponseLike {
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}

export interface HttpRequestInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string | Uint8Array;
  signal?: AbortSignal;
}

export type FetchLike = (url: string, init?: HttpRequestInit) => Promise<HttpResponseLike>;

/** Global fetch, typed to the structural surface above. */
export const defaultFetch: FetchLike = (url, init) => globalThis.fetch(url, init as RequestInit);

export const DEFAULT_HTTP_TIMEOUT_MS = 10_000;

export class HttpTimeoutError extends Error {
  override name = 'HttpTimeoutError';
}

/**
 * Calls `fetch` with a timeout. A network failure or a timeout throws; providers turn the throw
 * into a transient failure with a fixed code, so no error text (which may echo a URL) is logged.
 */
export async function fetchWithTimeout(
  fetchImpl: FetchLike,
  url: string,
  init: HttpRequestInit,
  timeoutMs: number = DEFAULT_HTTP_TIMEOUT_MS,
): Promise<HttpResponseLike> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) throw new HttpTimeoutError('request timed out');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/** Parses a JSON response body, returning `undefined` when it is empty or not JSON. */
export async function readJson(response: HttpResponseLike): Promise<unknown> {
  const text = await response.text();
  if (text.trim() === '') return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/** Seconds (or an HTTP date) from a Retry-After header, as milliseconds. */
export function parseRetryAfter(value: string | null, now: Date = new Date()): number | undefined {
  if (value === null) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000);
  const date = Date.parse(value);
  if (Number.isFinite(date)) return Math.max(0, date - now.getTime());
  return undefined;
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
