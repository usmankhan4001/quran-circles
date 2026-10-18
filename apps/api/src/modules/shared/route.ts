import type { Context, Hono } from 'hono';
import type { z } from 'zod';
import {
  endpoints,
  type EndpointDef,
  type EndpointId,
  type Endpoints,
  type Principal,
  type ResourceScope,
  type ScopeAction,
  type ScopeFilter,
  can,
  issuesFromZod,
} from '@qc/contracts';
import {
  authorize,
  authorizedScope,
  hasQualifyingRole,
  resourceMissing,
} from '../../middleware/auth-adapter';
import { clientAddress } from '../../auth/client-address';
import { errorResponse } from '../../middleware/error-handler';
import type { AppDeps, AppEnv } from './context';
import type { Db } from '../../db';
import { ApiException, fail } from './errors';

/**
 * Binds a handler to an endpoint of the contract registry. The method, path, input schemas, status
 * and output schema all come from `endpoints`, so the API cannot drift from the contract:
 * - the request is validated (params, query, body) before the handler runs;
 * - the handler's result is parsed with the endpoint's response schema before it is sent;
 * - signed-in endpoints reject callers with no principal, and staff endpoints fail closed: a
 *   handler that never made an authorisation decision gets `internal_error`, not data.
 */

type Out<S> = S extends z.ZodType ? z.output<S> : undefined;

type ParamsOf<K extends EndpointId> = Endpoints[K] extends { params: infer S } ? Out<S> : undefined;
type QueryOf<K extends EndpointId> = Endpoints[K] extends { query: infer S } ? Out<S> : undefined;
type BodyOf<K extends EndpointId> = Endpoints[K] extends { body: infer S } ? Out<S> : undefined;

/**
 * What a handler returns: the response body before the schema parse, a string for CSV, the bytes
 * (`Uint8Array`) for a file, or nothing.
 */
export type ResultOf<K extends EndpointId> = Endpoints[K]['success'] extends { status: 204 }
  ? void
  : Endpoints[K]['success'] extends { schema: infer S extends z.ZodType }
    ? z.input<S>
    : never;

export interface HandlerCtx<K extends EndpointId> {
  params: ParamsOf<K>;
  query: QueryOf<K>;
  body: BodyOf<K>;
  deps: AppDeps;
  db: Db;
  /** The request time. Tests control it. */
  now: Date;
  principal: Principal | null;
  requestId: string;
  /** The signed-in person's id. Throws `unauthenticated` on a public call without one. */
  uid(): string;
  /** Decide a staff or self action on a resource. Throws `forbidden` or `unauthenticated`. */
  authorize(action: ScopeAction, resource?: ResourceScope): void;
  /** The rows a person may see for an `any` action. Throws `forbidden` with no qualifying role. */
  scope(action: ScopeAction): ScopeFilter;
  /** The target was not found: `forbidden` for outsiders, `not_found` for people in scope. */
  missing(action: ScopeAction): never;
  /**
   * A body or query field points at nothing (an unknown city, venue, session...). Outsiders get
   * `forbidden`, so an id's existence is never revealed to them; anyone holding a role that
   * qualifies for the action gets `not_found`. The contract lists `not_found` on every endpoint
   * that uses this.
   */
  unknownRef(action: ScopeAction): never;
  /**
   * For requests decided item by item (bulk import): refuses with `forbidden` a caller who holds
   * no role that qualifies for any of these actions anywhere. Each item must then be decided with
   * `allowed`.
   */
  qualify(...actions: ScopeAction[]): void;
  /** Whether the person may do an action on a resource, without failing. For branching on rank. */
  allowed(action: ScopeAction, resource?: ResourceScope): boolean;
  header(name: string, value: string): void;
}

export type Handler<K extends EndpointId> = (ctx: HandlerCtx<K>) => Promise<ResultOf<K>>;
export type Handlers = { [K in EndpointId]?: Handler<K> };

/** The four sign-in endpoints belong to the auth-scopes lane. */
export const isAuthEndpoint = (id: string): boolean => id.startsWith('auth.');

export const toHonoPath = (path: string): string => path.replace(/\{(\w+)\}/g, ':$1');

const arrayKeyCache = new WeakMap<object, Set<string>>();

/** Query strings are flat; a key is an array when the schema says so. */
function arrayKeys(def: EndpointDef): Set<string> {
  if (!def.query) return new Set();
  const cached = arrayKeyCache.get(def.query);
  if (cached) return cached;
  const shape = (def.query as z.ZodObject).shape as Record<string, z.ZodType>;
  const keys = new Set<string>();
  for (const [key, schema] of Object.entries(shape)) {
    let s: z.ZodType | undefined = schema;
    // Unwrap optional/default/nullable wrappers to reach the array.
    for (let i = 0; i < 4 && s; i++) {
      const inner: { type?: string; innerType?: z.ZodType } | undefined = (
        s as unknown as { def?: { type?: string; innerType?: z.ZodType } }
      ).def;
      if (inner?.type === 'array') {
        keys.add(key);
        break;
      }
      s = inner?.innerType;
    }
  }
  arrayKeyCache.set(def.query, keys);
  return keys;
}

function queryObject(def: EndpointDef, url: URL): Record<string, unknown> {
  const arrays = arrayKeys(def);
  const out: Record<string, unknown> = {};
  for (const key of new Set(url.searchParams.keys())) {
    const all = url.searchParams.getAll(key);
    out[key] = arrays.has(key) ? all : all[0];
  }
  return out;
}

/** Validates input with a contract schema, or fails `validation_failed`. Exported for tests. */
export function parseWith(schema: z.ZodType, input: unknown): unknown {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  // The contract's own issue codes (for example `phone_not_pakistan_mobile`), not Zod's `custom`.
  return fail('validation_failed', { issues: issuesFromZod(result.error) });
}

/** The caller's address for the rate-limit key: the API's one rule, shared with sign-in (SEC-20). */
function callerAddress(c: Context<AppEnv>, deps: AppDeps): string {
  return clientAddress(c, deps.config.trustProxy) ?? 'unknown';
}

async function enforceRateLimit(c: Context<AppEnv>, deps: AppDeps, def: EndpointDef) {
  const rule = deps.config.rateLimits[def.rateLimit];
  const who = c.get('principal')?.userId ?? `ip:${callerAddress(c, deps)}`;
  const result = await deps.rateLimiter.consume(
    `${def.rateLimit}:${who}`,
    rule,
    deps.now().getTime(),
  );
  if (!result.allowed) fail('rate_limited', { retryAfterSeconds: result.retryAfterSeconds });
}

function register<K extends EndpointId>(
  app: Hono<AppEnv>,
  deps: AppDeps,
  id: K,
  handler: Handler<K>,
): void {
  const def = endpoints[id] as unknown as EndpointDef;
  app.on(def.method, toHonoPath(def.path), async (c) => {
    await enforceRateLimit(c, deps, def);

    const principal = c.get('principal') ?? null;
    if (def.auth !== 'public' && !principal?.userId) {
      fail(deps.authFailure ? await deps.authFailure(c) : 'unauthenticated');
    }

    const params = def.params ? parseWith(def.params, c.req.param()) : undefined;
    const query = def.query
      ? parseWith(def.query, queryObject(def, new URL(c.req.url)))
      : undefined;
    let body: unknown;
    if (def.body) {
      let raw: unknown;
      try {
        raw = await c.req.json();
      } catch {
        return fail('validation_failed', { issues: [{ path: '', code: 'invalid_json' }] });
      }
      body = parseWith(def.body, raw);
    }

    // Public endpoints and self endpoints are decided here; staff endpoints must decide in the handler.
    let decided = def.auth !== 'staff';
    if (def.auth === 'user') {
      const ownerUserId = principal?.userId;
      if (!def.actions.some((a) => can(principal, a, { ownerUserId }))) fail('forbidden');
    }

    const extraHeaders: Record<string, string> = {};
    const ctx: HandlerCtx<K> = {
      params: params as ParamsOf<K>,
      query: query as QueryOf<K>,
      body: body as BodyOf<K>,
      deps,
      db: deps.db,
      now: deps.now(),
      principal,
      requestId: c.get('requestId'),
      uid() {
        if (!principal?.userId) return fail('unauthenticated');
        return principal.userId;
      },
      authorize(action, resource) {
        authorize(principal, action, resource);
        decided = true;
      },
      scope(action) {
        const filter = authorizedScope(principal, action);
        decided = true;
        return filter;
      },
      missing(action) {
        decided = true;
        return resourceMissing(principal, action);
      },
      unknownRef(action) {
        decided = true;
        return resourceMissing(principal, action);
      },
      qualify(...actions) {
        if (!principal?.userId) fail('unauthenticated');
        if (!actions.some((a) => hasQualifyingRole(principal, a))) fail('forbidden');
        decided = true;
      },
      allowed(action, resource) {
        return can(principal, action, resource);
      },
      header(name, value) {
        extraHeaders[name] = value;
      },
    };

    const result = await handler(ctx);
    if (!decided) {
      deps.logger.error('staff handler made no authorisation decision', { endpoint: id });
      return fail('internal_error');
    }

    if (def.auth !== 'public') c.header('cache-control', 'private, no-store');
    for (const [name, value] of Object.entries(extraHeaders)) c.header(name, value);

    const status = def.success.status;
    if (status === 204) return c.body(null, 204);
    if (!def.success.schema) return fail('internal_error');
    const parsed = def.success.schema.safeParse(result);
    if (!parsed.success) {
      deps.logger.error('response does not match the contract', {
        endpoint: id,
        paths: parsed.error.issues.slice(0, 10).map((i) => i.path.join('.')),
      });
      return fail('internal_error');
    }
    if (def.success.contentType === 'text/csv') {
      c.header('content-type', 'text/csv; charset=utf-8');
      return c.body(parsed.data as string, status);
    }
    if (def.success.contentType === 'application/octet-stream') {
      // A file: the bytes as they are. The handler sets the real type (`image/png`,
      // `application/pdf`) and the file name; without one it goes out as plain bytes.
      const data: unknown = parsed.data;
      if (!(data instanceof Uint8Array)) return fail('internal_error');
      const bytes: Uint8Array<ArrayBuffer> =
        data.buffer instanceof ArrayBuffer
          ? (data as Uint8Array<ArrayBuffer>)
          : new Uint8Array(data);
      if (!extraHeaders['content-type']) c.header('content-type', 'application/octet-stream');
      c.header('x-content-type-options', 'nosniff');
      return c.body(bytes, status);
    }
    return c.json(parsed.data, status);
  });
}

/** Registers every handler under its endpoint's method and path. */
export function registerHandlers(app: Hono<AppEnv>, deps: AppDeps, ...sets: Handlers[]): void {
  const seen = new Set<string>();
  for (const set of sets) {
    for (const [id, handler] of Object.entries(set) as [EndpointId, Handler<EndpointId>][]) {
      if (seen.has(id)) throw new Error(`Endpoint ${id} is registered twice`);
      if (isAuthEndpoint(id)) throw new Error(`Endpoint ${id} belongs to the auth lane`);
      seen.add(id);
      register(app, deps, id, handler);
    }
  }
}

export { ApiException, errorResponse };
