import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { createLogger, redact } from '../middleware/logger';
import { MemoryRateLimiter, DEFAULT_RATE_LIMITS } from '../middleware/rate-limit';
import { requestId } from '../middleware/request-id';
import { requestLog } from '../middleware/request-log';
import { TEST_PRINCIPAL_HEADER, testPrincipalMiddleware } from '../middleware/test-auth';
import type { AppEnv } from '../modules/shared/context';

describe('log redaction', () => {
  it('replaces fields whose names are personal, however deep they sit', () => {
    const out = redact({
      requestId: 'abc',
      phone: '+923000000001',
      user: { displayName: 'A Person', id: 'u1' },
      list: [{ token: 'secret', status: 200 }],
      authorization: 'Bearer abc',
      body: 'message text',
    }) as Record<string, unknown>;
    expect(out).toEqual({
      requestId: 'abc',
      phone: '[redacted]',
      user: { displayName: '[redacted]', id: 'u1' },
      list: [{ token: '[redacted]', status: 200 }],
      authorization: '[redacted]',
      body: '[redacted]',
    });
  });

  it('replaces any text that looks like a phone number, even under an innocent key', () => {
    const out = redact({ detail: 'sent to +92 300 0000001 today', ref: 'abc-123' }) as Record<
      string,
      string
    >;
    expect(out.detail).toBe('[redacted]');
    expect(out.ref).toBe('abc-123');
  });

  it('keeps ids readable even when a run of digits inside them looks like a number', () => {
    const id = '12345678-1234-4123-8123-123456789012';
    expect(redact({ requestId: id, userId: id })).toEqual({ requestId: id, userId: id });
    expect(redact({ ref: '1234 5678 9012' })).toEqual({ ref: '[redacted]' });
  });

  it('stops at a depth limit instead of walking a cycle-shaped structure', () => {
    const deep = { a: { b: { c: { d: { e: { f: { g: 1 } } } } } } };
    expect(JSON.stringify(redact(deep))).toContain('[redacted]');
  });

  it('writes one JSON line per entry above the minimum level, and redacts the fields', () => {
    const lines: string[] = [];
    const log = createLogger((line) => lines.push(line), 'warn');
    log.info('hidden', { a: 1 });
    log.warn('shown', { phone: '+923000000001', code: 'abc' });
    log.error('also shown');
    expect(lines).toHaveLength(2);
    const first = JSON.parse(lines[0]!) as Record<string, unknown>;
    expect(first).toMatchObject({
      level: 'warn',
      msg: 'shown',
      phone: '[redacted]',
      code: '[redacted]',
    });
    expect(lines[0]).not.toContain('+923000000001');
  });
});

describe('the in-memory rate limiter', () => {
  const rule = { limit: 3, windowSeconds: 60 };

  it('allows up to the limit and then says how long to wait', async () => {
    const limiter = new MemoryRateLimiter();
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++)
      expect((await limiter.consume('k', rule, t0 + i)).allowed).toBe(true);
    const blocked = await limiter.consume('k', rule, t0 + 10_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(50);
  });

  it('starts a new window after the old one ends', async () => {
    const limiter = new MemoryRateLimiter();
    const t0 = 5_000_000;
    for (let i = 0; i < 3; i++) await limiter.consume('k', rule, t0);
    expect((await limiter.consume('k', rule, t0 + 59_000)).allowed).toBe(false);
    expect((await limiter.consume('k', rule, t0 + 60_000)).allowed).toBe(true);
  });

  it('counts each key on its own', async () => {
    const limiter = new MemoryRateLimiter();
    for (let i = 0; i < 3; i++) await limiter.consume('a', rule, 1);
    expect((await limiter.consume('a', rule, 2)).allowed).toBe(false);
    expect((await limiter.consume('b', rule, 2)).allowed).toBe(true);
  });

  it('forgets everything on reset, and always asks for at least one second', async () => {
    const limiter = new MemoryRateLimiter();
    for (let i = 0; i < 3; i++) await limiter.consume('k', rule, 0);
    expect((await limiter.consume('k', rule, 59_999)).retryAfterSeconds).toBe(1);
    limiter.reset();
    expect((await limiter.consume('k', rule, 59_999)).allowed).toBe(true);
  });

  it('has a stricter bucket for sign-in codes and registrations than for ordinary calls', () => {
    expect(DEFAULT_RATE_LIMITS.auth_code.limit).toBeLessThan(
      DEFAULT_RATE_LIMITS.registration.limit,
    );
    expect(DEFAULT_RATE_LIMITS.registration.limit).toBeLessThan(DEFAULT_RATE_LIMITS.default.limit);
  });
});

describe('request id and request log', () => {
  function build(lines: string[]) {
    const app = new Hono<AppEnv>();
    app.use('*', requestId());
    app.use('*', requestLog(createLogger((line) => lines.push(line), 'debug')));
    app.get('/search', (c) => c.json({ ok: true }));
    app.get('/boom', () => {
      throw new Error('internal detail with +923000000001');
    });
    app.onError((_e, c) => c.json({ failed: true }, 500));
    return app;
  }

  it('logs method, route, status and request id, and never the query or the url', async () => {
    const lines: string[] = [];
    const app = build(lines);
    const res = await app.request('/search?q=private+words&phone=%2B923000000001', {
      headers: { 'x-request-id': 'trace-12345678' },
    });
    expect(res.headers.get('x-request-id')).toBe('trace-12345678');
    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0]!) as Record<string, unknown>;
    expect(entry).toMatchObject({
      msg: 'request',
      method: 'GET',
      route: '/search',
      status: 200,
      requestId: 'trace-12345678',
    });
    expect(lines[0]).not.toContain('private');
    expect(lines[0]).not.toContain('923000000001');
  });

  it('logs a server error at error level without its message', async () => {
    const lines: string[] = [];
    const app = build(lines);
    const res = await app.request('/boom');
    expect(res.status).toBe(500);
    const entry = JSON.parse(lines[0]!) as Record<string, unknown>;
    expect(entry).toMatchObject({ level: 'error', status: 500 });
    expect(lines[0]).not.toContain('internal detail');
  });

  it('replaces an unsafe request id with a generated one', async () => {
    const app = build([]);
    const res = await app.request('/search', {
      headers: { 'x-request-id': '<script>alert(1)</script>' },
    });
    expect(res.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('the test-only principal', () => {
  it('reads the principal from its header while NODE_ENV is test', async () => {
    const app = new Hono<AppEnv>();
    app.use('*', testPrincipalMiddleware());
    app.get('/who', (c) => c.json({ principal: c.get('principal') }));
    const principal = { userId: 'u1', assignments: [] };
    const res = await app.request('/who', {
      headers: { [TEST_PRINCIPAL_HEADER]: JSON.stringify(principal) },
    });
    expect(await res.json()).toEqual({ principal });
    const none = await app.request('/who', { headers: { [TEST_PRINCIPAL_HEADER]: '{not json' } });
    expect(await none.json()).toEqual({ principal: null });
  });

  it('refuses to be created outside the test environment', () => {
    const before = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      expect(() => testPrincipalMiddleware()).toThrow(/NODE_ENV=test/);
    } finally {
      process.env.NODE_ENV = before;
    }
  });
});
