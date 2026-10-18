import { performance } from 'node:perf_hooks';
import { endpoints, type EndpointDef, type EndpointId } from '@qc/contracts';

/**
 * A raw HTTP call to one contract endpoint, built from the `@qc/contracts` registry (method and
 * path). Unlike the typed client it never throws on a status: the scope runner and the load runner
 * both need the status itself. Nothing here logs a request or response body.
 */
export interface CallInput {
  params?: Record<string, string | number | undefined>;
  query?: Record<string, unknown>;
  body?: unknown;
  token?: string | null;
  /** Plays the reverse proxy's X-Forwarded-For, so each synthetic person has their own address. */
  ip?: string;
}

export interface CallResult {
  status: number;
  /** Wall-clock milliseconds from sending to the last byte of the body. */
  ms: number;
  /** Parsed JSON, or null for an empty or non-JSON body. */
  body: unknown;
  /** Set when the request never got an HTTP answer (connection refused, reset, timeout). */
  networkError?: string;
}

export interface CallOptions {
  /** How many times to wait out a 429 (Retry-After) and send again. 0 by default. */
  retry429?: number;
  timeoutMs?: number;
  /** Test seam. */
  fetch?: typeof fetch;
}

export const fillPath = (path: string, params: Record<string, unknown> | undefined): string =>
  path.replace(/\{(\w+)\}/g, (_m, name: string) => {
    const value = params?.[name];
    if (value === undefined || value === null) throw new Error(`missing path parameter ${name}`);
    return encodeURIComponent(String(value));
  });

export const queryString = (query: Record<string, unknown> | undefined): string => {
  if (!query) return '';
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) for (const item of v) sp.append(k, String(item));
    else sp.append(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
};

export const endpointDef = (id: EndpointId): EndpointDef => endpoints[id] as unknown as EndpointDef;

export function buildUrl(baseUrl: string, id: EndpointId, input: CallInput = {}): string {
  const def = endpointDef(id);
  return `${baseUrl.replace(/\/+$/, '')}${fillPath(def.path, input.params)}${queryString(input.query)}`;
}

const sleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));

function retryAfterSeconds(res: Response, body: unknown): number {
  const header = Number(res.headers.get('retry-after'));
  if (Number.isFinite(header) && header > 0) return header;
  if (typeof body === 'object' && body !== null && 'error' in body) {
    const err = (body as { error: { retryAfterSeconds?: unknown } }).error;
    if (typeof err.retryAfterSeconds === 'number') return err.retryAfterSeconds;
  }
  return 5;
}

export async function call(
  baseUrl: string,
  id: EndpointId,
  input: CallInput = {},
  options: CallOptions = {},
): Promise<CallResult> {
  const def = endpointDef(id);
  const url = buildUrl(baseUrl, id, input);
  const headers: Record<string, string> = {
    accept: def.success.contentType ?? 'application/json',
    'accept-language': 'en',
  };
  if (input.body !== undefined) headers['content-type'] = 'application/json';
  if (input.token) headers.authorization = `Bearer ${input.token}`;
  if (input.ip) headers['x-forwarded-for'] = input.ip;
  const doFetch = options.fetch ?? fetch;
  let attempts = options.retry429 ?? 0;
  for (;;) {
    const started = performance.now();
    let res: Response;
    try {
      res = await doFetch(url, {
        method: def.method,
        headers,
        body: input.body !== undefined ? JSON.stringify(input.body) : undefined,
        signal: AbortSignal.timeout(options.timeoutMs ?? 30_000),
      });
    } catch (error) {
      return {
        status: 0,
        ms: performance.now() - started,
        body: null,
        networkError: error instanceof Error ? error.name : 'unknown',
      };
    }
    let body: unknown = null;
    try {
      const text = await res.text();
      if (text && (res.headers.get('content-type') ?? '').includes('json')) {
        body = JSON.parse(text) as unknown;
      }
    } catch {
      body = null;
    }
    const ms = performance.now() - started;
    if (res.status === 429 && attempts > 0) {
      attempts -= 1;
      await sleep(Math.min(retryAfterSeconds(res, body), 120) * 1000 + 100);
      continue;
    }
    return { status: res.status, ms, body };
  }
}

/** The error code of a contract error body, if any. */
export function errorCode(body: unknown): string | null {
  if (typeof body !== 'object' || body === null || !('error' in body)) return null;
  const err = (body as { error: unknown }).error;
  if (typeof err !== 'object' || err === null || !('code' in err)) return null;
  const code = (err as { code: unknown }).code;
  return typeof code === 'string' ? code : null;
}

/** Throws unless the call succeeded; for setup steps, where a failure means the run cannot go on. */
export function expectOk<T>(res: CallResult, what: string): T {
  if (res.status >= 200 && res.status < 300) return res.body as T;
  throw new Error(
    `${what} failed: HTTP ${res.status}${res.networkError ? ` (${res.networkError})` : ''} ${errorCode(res.body) ?? ''}`.trim(),
  );
}
