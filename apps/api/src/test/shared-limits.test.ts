import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { endpoints } from '@qc/contracts';
import { createApp } from '../app';
import { FakeCodeSender, InMemoryRateLimiter, authRoutes, createAuthConfig } from '../auth';
import { authLane } from '../middleware/auth-lane';
import { silentLogger } from '../middleware/logger';
import { DEFAULT_RATE_LIMITS, MemoryRateLimiter } from '../middleware/rate-limit';
import {
  SharedLimitClient,
  SharedLimitStore,
  SharedLimitUnavailable,
  processChannel,
  sharedBucketLimiter,
  sharedSignInLimiter,
  type LimitChannel,
} from '../middleware/shared-limits';
import { testPrincipalMiddleware } from '../middleware/test-auth';
import { createHarness, type Harness } from './harness';

/**
 * The shared rate limits for `API_PROCESSES` above 1: the cluster primary keeps the counters and
 * every worker process asks it. Here each "process" is a client with its own channel to one store,
 * with replies delivered asynchronously as over IPC; `cluster.test.ts` runs real processes.
 */

interface Link {
  channel: LimitChannel;
  close(): void;
  sent: unknown[];
}

/** A channel to `store` that delivers in a later turn both ways, like process IPC. */
function link(store: SharedLimitStore, options: { drop?: boolean } = {}): Link {
  const listeners: ((message: unknown) => void)[] = [];
  const closers: (() => void)[] = [];
  const sent: unknown[] = [];
  return {
    sent,
    channel: {
      send: (message) => {
        sent.push(message);
        if (options.drop) return;
        setImmediate(() => {
          void store.handle(message).then((reply) => {
            if (reply) setImmediate(() => listeners.forEach((l) => l(reply)));
          });
        });
      },
      onMessage: (listener) => listeners.push(listener),
      onClose: (listener) => closers.push(listener),
    },
    close: () => closers.forEach((c) => c()),
  };
}

const rule = { limit: 5, windowSeconds: 60 };
const T0 = Date.UTC(2026, 9, 18, 12, 0, 0);

describe('shared limit store and clients', () => {
  it('holds a bucket exactly across two processes asking at the same time', async () => {
    const store = new SharedLimitStore();
    const a = sharedBucketLimiter(new SharedLimitClient(link(store).channel));
    const b = sharedBucketLimiter(new SharedLimitClient(link(store).channel));
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, i) => (i % 2 ? a : b).consume('default:u1', rule, T0)),
    );
    expect(results.filter((r) => r.allowed)).toHaveLength(5);
    expect(results.filter((r) => !r.allowed)).toHaveLength(7);
    // The refusal says when to retry, as one in-process limiter would.
    const local = new MemoryRateLimiter();
    for (let i = 0; i < 5; i++) await local.consume('k', rule, T0);
    const expected = await local.consume('k', rule, T0 + 10_000);
    expect(await a.consume('default:u1', rule, T0 + 10_000)).toEqual(expected);
    // Another key has its own count; the window passing frees the caller.
    expect((await b.consume('default:u2', rule, T0)).allowed).toBe(true);
    expect((await b.consume('default:u1', rule, T0 + 61_000)).allowed).toBe(true);
  });

  it('keeps the sign-in limits sliding and shared: a refused hit is not recorded, reset frees the key', async () => {
    const store = new SharedLimitStore();
    const a = sharedSignInLimiter(new SharedLimitClient(link(store).channel));
    const b = sharedSignInLimiter(new SharedLimitClient(link(store).channel));
    const signInRule = { limit: 3, windowSeconds: 600 };
    const at = (ms: number) => new Date(T0 + ms);
    const first = await Promise.all([
      a.hit('otp-request:ip:h1', signInRule, at(0)),
      b.hit('otp-request:ip:h1', signInRule, at(0)),
      a.hit('otp-request:ip:h1', signInRule, at(100_000)),
      b.hit('otp-request:ip:h1', signInRule, at(100_000)),
    ]);
    expect(first.filter((r) => r.allowed)).toHaveLength(3);
    // Same answer as the auth lane's own limiter for the same hits.
    const local = new InMemoryRateLimiter();
    await local.hit('k', signInRule, at(0));
    await local.hit('k', signInRule, at(0));
    await local.hit('k', signInRule, at(100_000));
    expect(await b.hit('otp-request:ip:h1', signInRule, at(200_000))).toEqual(
      await local.hit('k', signInRule, at(200_000)),
    );
    // Sliding: the two hits at 0 leave the window at 600 s, so two slots free up.
    expect((await a.hit('otp-request:ip:h1', signInRule, at(600_001))).allowed).toBe(true);
    expect((await b.hit('otp-request:ip:h1', signInRule, at(600_001))).allowed).toBe(true);
    expect((await a.hit('otp-request:ip:h1', signInRule, at(600_001))).allowed).toBe(false);
    // A reset from one process frees the key for the other.
    await b.reset('otp-request:ip:h1');
    expect((await a.hit('otp-request:ip:h1', signInRule, at(600_002))).allowed).toBe(true);
    // The store's limiters are the in-process classes themselves.
    expect(store.buckets).toBeInstanceOf(MemoryRateLimiter);
    expect(store.signIn).toBeInstanceOf(InMemoryRateLimiter);
  });

  it('ignores messages that are not limit requests and refuses malformed ones', async () => {
    const store = new SharedLimitStore();
    expect(await store.handle({ type: 'other', id: 1 })).toBeNull();
    expect(await store.handle('text')).toBeNull();
    expect(await store.handle(null)).toBeNull();
    expect(await store.handle({ type: 'qc:limit', op: 'consume' })).toBeNull();
    expect(
      await store.handle({ type: 'qc:limit', id: 7, op: 'consume', key: 'k', rule: { limit: 0 } }),
    ).toEqual({ type: 'qc:limit-reply', id: 7, ok: false });
    expect(await store.handle({ type: 'qc:limit', id: 8, op: 'delete', key: 'k' })).toEqual({
      type: 'qc:limit-reply',
      id: 8,
      ok: false,
    });
  });

  it('fails the call, never skips the limit, when the primary refuses, is silent or is gone', async () => {
    vi.useFakeTimers();
    try {
      // Refused: the worker sent something the primary would not take.
      const store = new SharedLimitStore();
      const refused = new SharedLimitClient(link(store).channel);
      const bad = refused
        .request({ op: 'consume', key: '', rule, nowMs: T0 })
        .catch((e: unknown) => e);
      await vi.runAllTimersAsync();
      expect(await bad).toBeInstanceOf(SharedLimitUnavailable);

      // Silent: no answer within the timeout.
      const silent = link(store, { drop: true });
      const client = new SharedLimitClient(silent.channel, 2_000);
      const waiting = sharedBucketLimiter(client).consume('k', rule, T0);
      const caught = waiting.catch((e: unknown) => e);
      expect(client.inFlight).toBe(1);
      await vi.advanceTimersByTimeAsync(1_999);
      expect(client.inFlight).toBe(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(await caught).toBeInstanceOf(SharedLimitUnavailable);
      expect(client.inFlight).toBe(0);

      // Gone: the channel closes with calls waiting, and later calls fail at once.
      const pending = sharedSignInLimiter(client).hit('k', rule, new Date(T0));
      const pendingCaught = pending.catch((e: unknown) => e);
      silent.close();
      expect(await pendingCaught).toBeInstanceOf(SharedLimitUnavailable);
      await expect(sharedSignInLimiter(client).reset('k')).rejects.toBeInstanceOf(
        SharedLimitUnavailable,
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('fails the call when the message cannot be sent', async () => {
    const throwing: LimitChannel = {
      send: () => {
        throw new Error('EPIPE');
      },
      onMessage: () => undefined,
      onClose: () => undefined,
    };
    const client = new SharedLimitClient(throwing);
    await expect(client.request({ op: 'reset', key: 'k' })).rejects.toBeInstanceOf(
      SharedLimitUnavailable,
    );
    expect(client.inFlight).toBe(0);
  });

  it('refuses to send from a process that has no primary', () => {
    const fake = { send: undefined, connected: false, on: () => fake } as unknown as NodeJS.Process;
    expect(() =>
      processChannel(fake).send({ type: 'qc:limit', id: 1, op: 'reset', key: 'k' }),
    ).toThrow('no channel to the primary');
  });
});

describe('two API processes on one database', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(() => h.close());
  beforeEach(() => h.reset());
  afterEach(() => vi.useRealTimers());

  const smallBuckets = {
    ...DEFAULT_RATE_LIMITS,
    default: { limit: 4, windowSeconds: 60 },
  };

  it('share the contract buckets: an address gets its limit once, not once per process', async () => {
    const store = new SharedLimitStore();
    const apps = [0, 1].map(() =>
      createApp({
        db: h.db,
        now: h.clock.now,
        logger: silentLogger,
        principalMiddleware: testPrincipalMiddleware(),
        rateLimiter: sharedBucketLimiter(new SharedLimitClient(link(store).channel)),
        config: { trustProxy: true, rateLimits: smallBuckets },
      }),
    );
    const from = (i: number, address: string) =>
      apps[i % 2]!.request('/v1/places/provinces', { headers: { 'x-forwarded-for': address } });
    const statuses = await Promise.all(
      Array.from({ length: 10 }, (_, i) => from(i, '198.51.100.7')),
    ).then((rs) => rs.map((r) => r.status));
    expect(statuses.filter((s) => s === 200)).toHaveLength(4);
    expect(statuses.filter((s) => s === 429)).toHaveLength(6);
    // Another address is counted on its own, by either process.
    expect((await from(1, '198.51.100.8')).status).toBe(200);
    // Separate in-process limiters (the bug this prevents) would let each process allow 4.
    const unshared = [0, 1].map(() =>
      createApp({
        db: h.db,
        now: h.clock.now,
        logger: silentLogger,
        principalMiddleware: testPrincipalMiddleware(),
        rateLimiter: new MemoryRateLimiter(),
        config: { trustProxy: true, rateLimits: smallBuckets },
      }),
    );
    const loose = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        unshared[i % 2]!.request('/v1/places/provinces', {
          headers: { 'x-forwarded-for': '198.51.100.9' },
        }),
      ),
    );
    expect(loose.filter((r) => r.status === 200)).toHaveLength(8);
  });

  function signInApp(store: SharedLimitStore, sender: FakeCodeSender) {
    const authDeps = {
      db: h.db,
      config: createAuthConfig({
        secret: 'test-secret-test-secret-test-secret-0000',
        appEnv: 'test',
        otp: { fixedCode: '123456' },
        trustProxy: true,
        rateLimits: {
          requestPerIp: { limit: 3, windowSeconds: 3600 },
          refreshPerIp: { limit: 2, windowSeconds: 600 },
        },
      }),
      codeSender: sender,
      now: h.clock.now,
      rateLimiter: sharedSignInLimiter(new SharedLimitClient(link(store).channel)),
    };
    const { principalMiddleware, authFailure } = authLane(authDeps);
    return createApp({
      db: h.db,
      now: h.clock.now,
      logger: silentLogger,
      principalMiddleware,
      authFailure,
      config: { trustProxy: true },
      mount: [authRoutes(authDeps)],
    });
  }

  const post = (app: ReturnType<typeof createApp>, path: string, body: unknown, ip: string) =>
    app.request(path, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    });

  it('share the sign-in limits: code requests per address hold across both processes', async () => {
    const store = new SharedLimitStore();
    const sender = new FakeCodeSender();
    const apps = [signInApp(store, sender), signInApp(store, sender)];
    const path = endpoints['auth.requestCode'].path;
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        post(
          apps[i % 2]!,
          path,
          { email: `reader${1000 + i}@example.org`, locale: 'en', channel: 'email' },
          '203.0.113.5',
        ),
      ),
    );
    const statuses = results.map((r) => r.status);
    expect(statuses.filter((s) => s === 202)).toHaveLength(3);
    expect(statuses.filter((s) => s === 429)).toHaveLength(5);
    expect(sender.sent).toHaveLength(3);
    const refused = results.find((r) => r.status === 429)!;
    expect(Number(refused.headers.get('retry-after'))).toBeGreaterThan(0);
    // Another address still gets its own allowance.
    const other = await post(
      apps[1]!,
      path,
      { email: 'reader9999@example.org', locale: 'en', channel: 'email' },
      '203.0.113.6',
    );
    expect(other.status).toBe(202);
  });

  it('share the refresh limit per address across both processes', async () => {
    const store = new SharedLimitStore();
    const sender = new FakeCodeSender();
    const apps = [signInApp(store, sender), signInApp(store, sender)];
    const path = endpoints['auth.refresh'].path;
    const statuses = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        post(apps[i % 2]!, path, { refreshToken: `junk-token-${i}` }, '203.0.113.9'),
      ),
    ).then((rs) => rs.map((r) => r.status));
    // Two junk tokens are looked at (and refused); the other four never reach the database.
    expect(statuses.filter((s) => s === 401)).toHaveLength(2);
    expect(statuses.filter((s) => s === 429)).toHaveLength(4);
  });

  it('answers 500, not an unlimited request, when the primary does not answer', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const silent = new SharedLimitClient(link(new SharedLimitStore(), { drop: true }).channel, 50);
    const app = createApp({
      db: h.db,
      now: h.clock.now,
      logger: silentLogger,
      principalMiddleware: testPrincipalMiddleware(),
      rateLimiter: sharedBucketLimiter(silent),
    });
    const pending = app.request('/v1/places/provinces');
    await vi.advanceTimersByTimeAsync(50);
    const res = await pending;
    expect(res.status).toBe(500);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('internal_error');
  });
});
