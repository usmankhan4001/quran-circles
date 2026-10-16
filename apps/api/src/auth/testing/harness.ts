import { PGlite } from '@electric-sql/pglite';
import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/pglite';
import { migrateUp, pgliteExecutor, schema } from '@qc/db';
import { authRoutes } from '../../modules/auth/routes';
import { FakeCodeSender } from '../code-sender';
import { createAuthConfig, type AuthConfig, type AuthConfigInput } from '../config';
import { authMiddleware } from '../middleware';
import { InMemoryRateLimiter } from '../rate-limiter';
import type { AuthDb, AuthDeps, AuthLogger, AuthVariables, LogFields } from '../types';

/** A test-only secret. Long enough to pass the config check; protects nothing. */
export const TEST_SECRET = 'test-secret-test-secret-test-secret-0000';

/** Synthetic numbers only. */
export const PHONE_A = '+923000000001';
export const PHONE_B = '+923000000002';
export const PHONE_C = '+923000000003';

export class FakeClock {
  constructor(private current = new Date('2026-10-16T09:00:00.000Z')) {}
  now = (): Date => new Date(this.current.getTime());
  advance(seconds: number): void {
    this.current = new Date(this.current.getTime() + seconds * 1000);
  }
  set(date: Date): void {
    this.current = date;
  }
}

export interface CapturedLog {
  level: 'info' | 'warn' | 'error';
  event: string;
  fields: LogFields;
}

export class CapturingLogger implements AuthLogger {
  readonly entries: CapturedLog[] = [];
  info = (event: string, fields: LogFields = {}) =>
    this.entries.push({ level: 'info', event, fields });
  warn = (event: string, fields: LogFields = {}) =>
    this.entries.push({ level: 'warn', event, fields });
  error = (event: string, fields: LogFields = {}) =>
    this.entries.push({ level: 'error', event, fields });
  /** Everything logged, as one string, for "never contains X" assertions. */
  text = (): string => JSON.stringify(this.entries);
}

export type TestApp = Hono<{ Variables: AuthVariables }>;

export interface World {
  provinceId: string;
  cityA: { id: string; areaId: string };
  cityB: { id: string; areaId: string };
  venueA1: string;
  venueA2: string;
  venueB1: string;
}

export interface Harness {
  pg: PGlite;
  db: AuthDb;
  clock: FakeClock;
  sender: FakeCodeSender;
  logger: CapturingLogger;
  limiter: InMemoryRateLimiter;
  config: AuthConfig;
  deps: AuthDeps;
  app: TestApp;
  world: World;
  /** Empties every table and seeds the places again. Call in `beforeEach`. */
  reset(): Promise<void>;
  close(): Promise<void>;
  /** POST JSON to the app. `ip` stands in for the caller's address. */
  post(
    path: string,
    body: unknown,
    options?: { token?: string; ip?: string; raw?: string },
  ): Promise<Response>;
  get(path: string, options?: { token?: string; ip?: string }): Promise<Response>;
  requestCode(
    phone: string,
    options?: { ip?: string; channel?: 'whatsapp' | 'sms' },
  ): Promise<Response>;
  /** Asks for a code and verifies it. Returns the parsed sign-in response. */
  signIn(phone: string, options?: { ip?: string; deviceLabel?: string }): Promise<SignedIn>;
  createUser(
    overrides?: Partial<typeof schema.users.$inferInsert>,
  ): Promise<typeof schema.users.$inferSelect>;
  grantRole(
    userId: string,
    role: 'national_admin' | 'city_coordinator' | 'venue_coordinator',
    target?: { cityId?: string; venueId?: string },
  ): Promise<typeof schema.roleAssignments.$inferSelect>;
}

export interface SignedIn {
  status: number;
  body: {
    accessToken: string;
    accessTokenExpiresAt: string;
    refreshToken: string;
    refreshTokenExpiresAt: string;
    isNewAccount: boolean;
    me: {
      id: string;
      phone: string;
      displayName: string | null;
      roles: { id: string; role: string }[];
    };
  };
}

const TRUNCATE =
  'TRUNCATE provinces, users, otp_challenges, auth_sessions, coordinator_invites, audit_log RESTART IDENTITY CASCADE';

export const TEST_IP = '203.0.113.7';

let counter = 0;
const unique = (prefix: string) => `${prefix}-${++counter}`;

export interface HarnessOptions {
  config?: Omit<AuthConfigInput, 'secret'>;
  /** Extra routes for the test app, added after the auth routes. */
  extend?: (app: TestApp, deps: AuthDeps) => void;
}

/** A real Postgres (PGlite) with the real migrations, plus a Hono app with the auth lane mounted. */
export async function createHarness(options: HarnessOptions = {}): Promise<Harness> {
  const pg = new PGlite();
  await migrateUp(pgliteExecutor(pg));
  const db = drizzle(pg, { schema }) as AuthDb;

  const clock = new FakeClock();
  const sender = new FakeCodeSender();
  const logger = new CapturingLogger();
  const limiter = new InMemoryRateLimiter();
  const config = createAuthConfig({ appEnv: 'test', secret: TEST_SECRET, ...options.config });
  const deps: AuthDeps = {
    db,
    config,
    codeSender: sender,
    rateLimiter: limiter,
    logger,
    now: clock.now,
    clientIp: (c) => c.req.header('x-test-ip') ?? TEST_IP,
  };

  const app: TestApp = new Hono<{ Variables: AuthVariables }>();
  app.use('*', async (c, next) => {
    c.set('requestId', 'test-request-id');
    await next();
  });
  app.use('*', authMiddleware(deps));
  app.route('/', authRoutes(deps));
  options.extend?.(app, deps);

  const headers = (o: { token?: string; ip?: string } = {}) => ({
    'content-type': 'application/json',
    ...(o.token ? { authorization: `Bearer ${o.token}` } : {}),
    ...(o.ip ? { 'x-test-ip': o.ip } : {}),
  });

  const harness: Harness = {
    pg,
    db,
    clock,
    sender,
    logger,
    limiter,
    config,
    deps,
    app,
    world: undefined as unknown as World,
    async reset() {
      await pg.exec(TRUNCATE);
      sender.sent.length = 0;
      sender.failWith = null;
      sender.reportChannel = null;
      logger.entries.length = 0;
      clock.set(new Date('2026-10-16T09:00:00.000Z'));
      limiter.clear();
      harness.world = await seedWorld(db);
    },
    close: () => pg.close(),
    post: (path, body, o = {}) =>
      Promise.resolve(
        app.request(path, {
          method: 'POST',
          headers: headers(o),
          body: o.raw ?? JSON.stringify(body),
        }),
      ),
    get: (path, o = {}) =>
      Promise.resolve(app.request(path, { method: 'GET', headers: headers(o) })),
    requestCode: (phone, o = {}) =>
      harness.post('/v1/auth/code', { phone, ...(o.channel ? { channel: o.channel } : {}) }, o),
    async signIn(phone, o = {}) {
      const asked = await harness.requestCode(phone, o);
      if (asked.status !== 202) throw new Error(`request code answered ${asked.status}`);
      const { challengeId } = (await asked.json()) as { challengeId: string };
      const code = harness.sender.last?.code;
      if (!code) throw new Error('no code was sent');
      const verified = await harness.post(
        '/v1/auth/verify',
        { challengeId, code, ...(o.deviceLabel ? { deviceLabel: o.deviceLabel } : {}) },
        o,
      );
      return { status: verified.status, body: (await verified.json()) as SignedIn['body'] };
    },
    async createUser(overrides = {}) {
      const [row] = await db
        .insert(schema.users)
        .values({
          phoneE164: `+92300${String(1000000 + ++counter).padStart(7, '0')}`,
          phoneVerifiedAt: clock.now(),
          displayName: 'Test Person',
          ...overrides,
        })
        .returning();
      if (!row) throw new Error('user not created');
      return row;
    },
    async grantRole(userId, role, target = {}) {
      const [row] = await db
        .insert(schema.roleAssignments)
        .values({
          userId,
          role,
          scopeType:
            role === 'national_admin' ? 'national' : role === 'city_coordinator' ? 'city' : 'venue',
          cityId: target.cityId ?? null,
          venueId: target.venueId ?? null,
        })
        .returning();
      if (!row) throw new Error('role not granted');
      return row;
    },
  };
  await harness.reset();
  return harness;
}

async function seedWorld(db: AuthDb): Promise<World> {
  const [province] = await db
    .insert(schema.provinces)
    .values({ code: unique('P'), nameEn: 'Test Province', nameUr: 'ٹیسٹ صوبہ' })
    .returning();
  if (!province) throw new Error('province');
  const city = async (name: string) => {
    const [c] = await db
      .insert(schema.cities)
      .values({ provinceId: province.id, slug: unique('city'), nameEn: name, nameUr: `${name} ur` })
      .returning();
    if (!c) throw new Error('city');
    const [a] = await db
      .insert(schema.areas)
      .values({ cityId: c.id, slug: unique('area'), nameEn: 'Area', nameUr: 'علاقہ' })
      .returning();
    if (!a) throw new Error('area');
    return { id: c.id, areaId: a.id };
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
