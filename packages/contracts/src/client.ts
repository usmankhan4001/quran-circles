import type { z } from 'zod';
import { ApiError, type ErrorCode, type ValidationIssue } from './errors';
import { endpoints, type Endpoints } from './endpoints';
import type { EndpointDef } from './define';

type Group<K extends string> = K extends `${infer G}.${string}` ? G : never;
type Op<K extends string, G extends string> = K extends `${G}.${infer O}` ? O : never;

type Part<K extends string, S extends z.ZodType> =
  Record<never, never> extends z.input<S> ? { [P in K]?: z.input<S> } : { [P in K]: z.input<S> };

type Req<E> = (E extends { params: infer S extends z.ZodType } ? Part<'params', S> : unknown) &
  (E extends { query: infer S extends z.ZodType } ? Part<'query', S> : unknown) &
  (E extends { body: infer S extends z.ZodType } ? Part<'body', S> : unknown);

type OptionalIfEmpty<R> = Record<never, never> extends R ? [req?: R] : [req: R];

type Res<E> = E extends { success: { schema: infer S extends z.ZodType } } ? z.output<S> : void;

type Call<E> = (...args: OptionalIfEmpty<Req<E>>) => Promise<Res<E>>;

export type ApiClient = {
  [G in Group<keyof Endpoints & string>]: {
    [O in Op<keyof Endpoints & string, G>]: Call<Endpoints[`${G}.${O}` & keyof Endpoints]>;
  };
};

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode | 'network_error' | 'invalid_response',
    readonly requestId: string | null,
    readonly retryAfterSeconds?: number,
    /**
     * For validation_failed: where the server rejected the input, as `{ path, code }`. Path is
     * dotted (`name.en`, `rows.3.cityId`). Never contains the input itself.
     */
    readonly issues?: readonly ValidationIssue[],
  ) {
    super(`${code} (${status})`);
    this.name = 'ApiClientError';
  }
}

export interface ClientOptions {
  baseUrl: string;
  fetch?: typeof fetch;
  /** Called per request, so a refreshed token is picked up. */
  getAccessToken?: () => string | null | Promise<string | null>;
  /** Sent as Accept-Language so error messages and content follow the person's language. */
  getLocale?: () => 'en' | 'ur';
  /** Check responses against the contract. On by default; turn off only for performance. */
  validateResponses?: boolean;
}

const fillPath = (path: string, params: Record<string, unknown> | undefined): string =>
  path.replace(/\{(\w+)\}/g, (_m, name: string) => encodeURIComponent(String(params?.[name])));

const queryString = (query: Record<string, unknown> | undefined): string => {
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

/**
 * A typed client generated from the endpoint registry: `api.sessions.list({ query: { cityId } })`.
 * Apps use this and never hand-write fetch calls.
 */
export function createApiClient(options: ClientOptions): ApiClient {
  const doFetch = options.fetch ?? fetch;
  const validate = options.validateResponses ?? true;
  const root: Record<string, Record<string, unknown>> = {};

  for (const def of Object.values(endpoints) as EndpointDef[]) {
    const [group, op] = def.id.split('.') as [string, string];
    (root[group] ??= {})[op] = async (
      req: { params?: object; query?: object; body?: unknown } = {},
    ) => {
      const parsed = {
        params: def.params ? def.params.parse(req.params) : undefined,
        query: def.query ? def.query.parse(req.query ?? {}) : undefined,
        body: def.body ? def.body.parse(req.body) : undefined,
      };
      const headers: Record<string, string> = {
        accept: def.success.contentType ?? 'application/json',
      };
      if (def.body) headers['content-type'] = 'application/json';
      const token = def.auth === 'public' ? null : await options.getAccessToken?.();
      if (token) headers.authorization = `Bearer ${token}`;
      const locale = options.getLocale?.();
      if (locale) headers['accept-language'] = locale;

      const url = `${options.baseUrl.replace(/\/+$/, '')}${fillPath(def.path, parsed.params as Record<string, unknown>)}${queryString(parsed.query as Record<string, unknown>)}`;
      let response: Response;
      try {
        response = await doFetch(url, {
          method: def.method,
          headers,
          body: def.body ? JSON.stringify(parsed.body) : undefined,
        });
      } catch {
        throw new ApiClientError(0, 'network_error', null);
      }

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as unknown;
        const err = ApiError.safeParse(body);
        if (!err.success) throw new ApiClientError(response.status, 'invalid_response', null);
        throw new ApiClientError(
          response.status,
          err.data.error.code,
          err.data.error.requestId,
          err.data.error.retryAfterSeconds,
          err.data.error.issues,
        );
      }
      if (def.success.status === 204) return undefined;
      if (def.success.contentType === 'text/csv') return response.text();
      const data = (await response.json()) as unknown;
      if (!validate || !def.success.schema) return data;
      const checked = def.success.schema.safeParse(data);
      if (!checked.success) throw new ApiClientError(response.status, 'invalid_response', null);
      return checked.data;
    };
  }
  return root as unknown as ApiClient;
}
