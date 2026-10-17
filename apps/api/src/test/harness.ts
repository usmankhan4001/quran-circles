import { PGlite } from '@electric-sql/pglite';
import { guardTransactions } from '@qc/db/testing';
import { drizzle } from 'drizzle-orm/pglite';
import { vi } from 'vitest';
import type { Hono } from 'hono';
import { migrateUp, pgliteExecutor, schema } from '@qc/db';
import {
  ApiError,
  endpoints,
  errorsFor,
  type EndpointDef,
  type EndpointId,
  type Principal,
  type ScopedRole,
} from '@qc/contracts';
import { createApp } from '../app';
import type { Db } from '../db';
import { createLogger } from '../middleware/logger';
import { MemoryRateLimiter } from '../middleware/rate-limit';
import { TEST_PRINCIPAL_HEADER, testPrincipalMiddleware } from '../middleware/test-auth';
import type { ApiConfig, AppEnv } from '../modules/shared/context';

/**
 * A real Postgres (PGlite) with the real migrations, and the real API on top of it. The only
 * stand-in is who is calling: `x-test-principal` carries the principal, which is allowed only
 * when NODE_ENV is `test`. The clock is injected, so tests control time.
 */

export const START = new Date('2026-10-16T05:00:00.000Z');

export class FakeClock {
  private current = new Date(START);
  now = (): Date => new Date(this.current);
  set(date: Date): void {
    this.current = new Date(date);
  }
  advanceMinutes(minutes: number): void {
    this.current = new Date(this.current.getTime() + minutes * 60_000);
  }
  advanceDays(days: number): void {
    this.advanceMinutes(days * 24 * 60);
  }
}

export interface World {
  provinceId: string;
  cityA: { id: string; areaId: string; areaId2: string };
  cityB: { id: string; areaId: string; areaId2: string };
  venueA1: string;
  venueA2: string;
  venueB1: string;
}

/** A person with an account, and the principal they sign in as. */
export interface Actor {
  userId: string;
  phone: string;
  principal: Principal;
}

export interface ApiResult {
  status: number;
  headers: Headers;
  text: string;
  json<T = Record<string, unknown>>(): T;
}

export interface CallOptions {
  as?: Actor | Principal | null;
  /** Values for `{name}` placeholders in the endpoint path. */
  params?: Record<string, string>;
  body?: unknown;
  query?: Record<string, string | number | boolean | readonly string[] | undefined>;
  headers?: Record<string, string>;
  raw?: string;
}

export interface Harness {
  pg: PGlite;
  db: Db;
  clock: FakeClock;
  limiter: MemoryRateLimiter;
  app: Hono<AppEnv>;
  world: World;
  logs: string[];
  reset(): Promise<void>;
  close(): Promise<void>;
  call(method: string, path: string, options?: CallOptions): Promise<ApiResult>;
  /** Calls an endpoint by its registry id, so method and path always match the contract. */
  api(id: EndpointId, options?: CallOptions): Promise<ApiResult>;
  get(path: string, options?: CallOptions): Promise<ApiResult>;
  post(path: string, body: unknown, options?: CallOptions): Promise<ApiResult>;
  patch(path: string, body: unknown, options?: CallOptions): Promise<ApiResult>;
  put(path: string, body: unknown, options?: CallOptions): Promise<ApiResult>;
  del(path: string, options?: CallOptions): Promise<ApiResult>;
  /** An account with no roles. */
  person(overrides?: Partial<typeof schema.users.$inferInsert>): Promise<Actor>;
  nationalAdmin(): Promise<Actor>;
  cityCoordinator(cityId: string): Promise<Actor>;
  venueCoordinator(venueId: string): Promise<Actor>;
  /** Signed in with no roles at all, with no account behind it. */
  anonymous: null;
}

let counter = 0;
const unique = (prefix: string) => `${prefix}-${++counter}`;

export interface HarnessOptions {
  config?: Partial<ApiConfig>;
}

/**
 * Every call made through `api(id)` is held to the contract: a success has the contract's status
 * and a body the response schema accepts; a failure is an error body whose code the endpoint may
 * return (`errorsFor`). A handler that drifts fails every test that touches it.
 */
function checkAgainstContract(id: string, def: EndpointDef, result: ApiResult): void {
  if (result.status >= 200 && result.status < 300) {
    if (result.status !== def.success.status) {
      throw new Error(`${id} answered ${result.status}, the contract says ${def.success.status}`);
    }
    if (
      def.success.status !== 204 &&
      def.success.schema &&
      def.success.contentType !== 'text/csv'
    ) {
      const parsed = def.success.schema.safeParse(JSON.parse(result.text));
      if (!parsed.success) throw new Error(`${id} response does not match its schema`);
    }
    return;
  }
  const error = ApiError.safeParse(JSON.parse(result.text));
  if (!error.success) throw new Error(`${id} failed with a body that is not an ApiError`);
  const code = error.data.error.code;
  if (!errorsFor(def).includes(code)) {
    throw new Error(`${id} returned ${code}, which the contract does not list for it`);
  }
  if (result.headers.get('x-request-id') !== error.data.error.requestId) {
    throw new Error(`${id} error requestId differs from the x-request-id header`);
  }
}

const isActor = (value: Actor | Principal): value is Actor => 'principal' in value;

export async function createHarness(options: HarnessOptions = {}): Promise<Harness> {
  vi.setConfig({ testTimeout: 60_000, hookTimeout: 180_000 });
  // Transactions refuse overlapping queries, as node-postgres 9 will (F-02).
  const pg = guardTransactions(new PGlite());
  await migrateUp(pgliteExecutor(pg));
  const db: Db = drizzle(pg, { schema });
  const clock = new FakeClock();
  const limiter = new MemoryRateLimiter();
  const logs: string[] = [];
  const app = createApp({
    db,
    now: clock.now,
    logger: createLogger((line) => logs.push(line), 'debug'),
    rateLimiter: limiter,
    principalMiddleware: testPrincipalMiddleware(),
    ...(options.config ? { config: options.config } : {}),
  });

  const headers = (o: CallOptions): Record<string, string> => {
    const out: Record<string, string> = { ...(o.headers ?? {}) };
    if (o.body !== undefined || o.raw !== undefined) out['content-type'] = 'application/json';
    if (o.as) {
      const principal = isActor(o.as) ? o.as.principal : o.as;
      out[TEST_PRINCIPAL_HEADER] = JSON.stringify(principal);
    }
    return out;
  };

  const url = (path: string, query: CallOptions['query']): string => {
    if (!query) return path;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) continue;
      if (Array.isArray(value)) for (const v of value) params.append(key, String(v));
      else params.append(key, String(value));
    }
    const text = params.toString();
    return text ? `${path}?${text}` : path;
  };

  const harness: Harness = {
    pg,
    db,
    clock,
    limiter,
    app,
    world: undefined as unknown as World,
    logs,
    anonymous: null,
    async reset() {
      const tables = await pg.query<{ tablename: string }>(
        `select tablename from pg_tables where schemaname = 'public' and tablename <> 'schema_migrations'`,
      );
      await pg.exec(
        `TRUNCATE ${tables.rows.map((t) => `"${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`,
      );
      clock.set(START);
      limiter.reset();
      logs.length = 0;
      harness.world = await seedWorld(db);
    },
    close: () => pg.close(),
    async call(method, path, o = {}) {
      const res = await app.request(url(path, o.query), {
        method,
        headers: headers(o),
        ...(o.raw !== undefined
          ? { body: o.raw }
          : o.body !== undefined
            ? { body: JSON.stringify(o.body) }
            : {}),
      });
      const text = await res.text();
      return {
        status: res.status,
        headers: res.headers,
        text,
        json: <T = Record<string, unknown>>() => JSON.parse(text) as T,
      };
    },
    async api(id, o = {}) {
      const def = endpoints[id];
      const path = def.path.replace(/\{(\w+)\}/g, (_m, name: string) => {
        const value = o.params?.[name];
        if (value === undefined) throw new Error(`Missing path parameter ${name} for ${id}`);
        return encodeURIComponent(value);
      });
      const result = await harness.call(def.method, path, o);
      checkAgainstContract(id, def as unknown as EndpointDef, result);
      return result;
    },
    get: (path, o) => harness.call('GET', path, o),
    post: (path, body, o) => harness.call('POST', path, { ...o, body }),
    patch: (path, body, o) => harness.call('PATCH', path, { ...o, body }),
    put: (path, body, o) => harness.call('PUT', path, { ...o, body }),
    del: (path, o) => harness.call('DELETE', path, o),
    async person(overrides = {}) {
      const [row] = await db
        .insert(schema.users)
        .values({
          phoneE164: `+92300${String(2000000 + ++counter).padStart(7, '0')}`,
          phoneVerifiedAt: clock.now(),
          displayName: 'Test Person',
          locale: 'en',
          ...overrides,
        })
        .returning();
      if (!row) throw new Error('user not created');
      return {
        userId: row.id,
        phone: row.phoneE164,
        principal: { userId: row.id, assignments: [] },
      };
    },
    async nationalAdmin() {
      return withRole(harness, { role: 'national_admin' });
    },
    async cityCoordinator(cityId) {
      return withRole(harness, { role: 'city_coordinator', cityId });
    },
    async venueCoordinator(venueId) {
      return withRole(harness, { role: 'venue_coordinator', venueId });
    },
  };
  await harness.reset();
  return harness;
}

async function withRole(h: Harness, scoped: ScopedRole): Promise<Actor> {
  const actor = await h.person();
  await h.db.insert(schema.roleAssignments).values({
    userId: actor.userId,
    role: scoped.role,
    scopeType:
      scoped.role === 'national_admin'
        ? 'national'
        : scoped.role === 'city_coordinator'
          ? 'city'
          : 'venue',
    cityId: scoped.cityId ?? null,
    venueId: scoped.venueId ?? null,
    createdAt: h.clock.now(),
  });
  return { ...actor, principal: { userId: actor.userId, assignments: [scoped] } };
}

async function seedWorld(db: Db): Promise<World> {
  const [province] = await db
    .insert(schema.provinces)
    .values({ code: unique('P'), nameEn: 'Test Province', nameUr: 'ٹیسٹ صوبہ' })
    .returning();
  if (!province) throw new Error('province');
  const city = async (name: string) => {
    const [c] = await db
      .insert(schema.cities)
      .values({
        provinceId: province.id,
        slug: unique('city'),
        nameEn: name,
        nameUr: `${name} ur`,
        timezone: 'Asia/Karachi',
      })
      .returning();
    if (!c) throw new Error('city');
    const area = async (label: string, lat: number, lng: number) => {
      const [a] = await db
        .insert(schema.areas)
        .values({
          cityId: c.id,
          slug: unique('area'),
          nameEn: label,
          nameUr: `${label} ur`,
          lat,
          lng,
        })
        .returning();
      if (!a) throw new Error('area');
      return a.id;
    };
    return {
      id: c.id,
      areaId: await area('Area 1', 31.5, 74.3),
      areaId2: await area('Area 2', 31.6, 74.4),
    };
  };
  const venue = async (c: { id: string; areaId: string }, name: string) => {
    const [v] = await db
      .insert(schema.venues)
      .values({
        cityId: c.id,
        areaId: c.areaId,
        slug: unique('venue'),
        nameEn: name,
        nameUr: `${name} ur`,
        addressEn: '1 Test Road',
        addressUr: '۱ ٹیسٹ روڈ',
        lat: 31.52,
        lng: 74.35,
      })
      .returning();
    if (!v) throw new Error('venue');
    return v.id;
  };
  const cityA = await city('City A');
  const cityB = await city('City B');
  return {
    provinceId: province.id,
    cityA,
    cityB,
    venueA1: await venue(cityA, 'Venue A1'),
    venueA2: await venue(cityA, 'Venue A2'),
    venueB1: await venue(cityB, 'Venue B1'),
  };
}
