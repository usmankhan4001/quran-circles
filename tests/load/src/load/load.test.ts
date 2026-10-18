import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { endpoints, type EndpointDef } from '@qc/contracts';
import { LOAD_DIR, checkTarget } from '../args';
import { buildUrl } from '../http';
import { API_LIMITS, SIGN_IN_BUDGET, assertSignInBudget } from '../limits';
import { Synthetic, pakistanDate, type Person } from '../people';
import { percentile, summarize } from '../stats';
import { checkThresholds, classify, runStep } from './runner';
import { OPS, SCENARIO } from './scenario';

/** The fast self-check of the load runner: no network (a fake fetch answers), no database. */

const uuid = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const person = (n: number): Person => ({
  label: `p${n}`,
  userId: uuid(100 + n),
  token: `token-${n}`,
  refreshToken: `refresh-${n}`,
  ip: `10.0.0.${n + 1}`,
  me: {
    id: uuid(100 + n),
    phone: '+923130000000',
    displayName: null,
    locale: 'en',
    createdAt: '2026-10-18T00:00:00Z',
    profile: {} as Person['me']['profile'],
    roles: [],
  },
});

/** Answers like the API would, and remembers which contract routes were called. */
function fakeApi() {
  const seen: { method: string; path: string; body: unknown }[] = [];
  const routes = (Object.values(endpoints) as EndpointDef[]).map((d) => ({
    def: d,
    re: new RegExp(`^${d.path.replace(/\{\w+\}/g, '[^/]+')}$`),
  }));
  const fetchFake: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    const route = routes.find((r) => r.def.method === method && r.re.test(url.pathname));
    if (!route) throw new Error(`not a contract route: ${method} ${url.pathname}`);
    const body = init?.body ? (JSON.parse(String(init.body)) as unknown) : undefined;
    seen.push({ method, path: route.def.path, body });
    const json = (status: number, data: unknown) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { 'content-type': 'application/json' },
      });
    switch (route.def.id) {
      case 'sessions.list':
        return json(200, { items: [{ id: uuid(1) }], nextCursor: null });
      case 'sessions.get':
        return json(200, { id: uuid(1), section: 'women' });
      case 'registrations.create':
        return json(409, { error: { code: 'already_registered', message: 'x', requestId: 'r' } });
      default:
        return json(200, { items: [], nextCursor: null });
    }
  };
  return { seen, fetchFake };
}

describe('the scenario file', () => {
  it('parses and sets latency thresholds for every operation', () => {
    expect(Object.keys(SCENARIO.thresholds.ops).sort()).toEqual([...OPS].sort());
    const vus = SCENARIO.steps.map((s) => s.vus);
    expect(vus).toEqual([...vus].sort((a, b) => a - b));
  });

  it('is the file the k6 script reads, and the k6 script tags every operation', () => {
    const k6 = readFileSync(join(LOAD_DIR, 'k6', 'ramadan-evening.js'), 'utf8');
    expect(k6).toContain("open('../scenario.json')");
    for (const op of OPS) expect(k6, op).toContain(`'${op}'`);
  });
});

describe('the journey', () => {
  it('calls only contract routes, registers in the session’s own section, and counts a repeat registration as expected', async () => {
    const { seen, fetchFake } = fakeApi();
    const result = await runStep(
      {
        baseUrl: 'http://127.0.0.1:1',
        scenario: { ...SCENARIO, journey: { ...SCENARIO.journey, registerProbability: 1 } },
        cityId: uuid(3),
        areaIds: [uuid(4)],
        center: SCENARIO.seed.center,
        sessionIds: [uuid(1)],
        users: [person(1), person(2)],
        fetch: fetchFake,
        sleep: async () => undefined,
      },
      { vus: 2, durationS: 0.05 },
      0,
    );
    expect(result.iterations).toBeGreaterThan(0);
    expect(result.failedRate).toBe(0);
    expect(result.ops.register?.outcomes).toEqual({ expected_4xx: result.ops.register?.count });
    const registration = seen.find((s) => s.path === '/v1/registrations');
    expect(registration?.body).toMatchObject({ section: 'women', sessionId: uuid(1) });
    const paths = new Set(seen.map((s) => s.path));
    expect(paths).toContain('/v1/sessions');
    expect(paths).toContain('/v1/updates/unread-count');
  });

  it('refreshes an expired access token once and retries, as the app does', async () => {
    const { fetchFake } = fakeApi();
    let expired = true;
    const fetchExpiring: typeof fetch = async (input, init) => {
      const url = new URL(String(input));
      const auth = new Headers(init?.headers).get('authorization');
      if (url.pathname === '/v1/auth/refresh') {
        expired = false;
        return new Response(
          JSON.stringify({ accessToken: 'fresh', refreshToken: 'fresh-refresh' }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        );
      }
      if (url.pathname === '/v1/updates/unread-count' && (expired || auth !== 'Bearer fresh')) {
        return new Response(JSON.stringify({ error: { code: 'token_expired' } }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        });
      }
      return fetchFake(input, init);
    };
    const user = person(3);
    const result = await runStep(
      {
        baseUrl: 'http://127.0.0.1:1',
        scenario: { ...SCENARIO, journey: { ...SCENARIO.journey, registerProbability: 0 } },
        cityId: uuid(3),
        areaIds: [uuid(4)],
        center: SCENARIO.seed.center,
        sessionIds: [uuid(1)],
        users: [user],
        fetch: fetchExpiring,
        sleep: async () => undefined,
      },
      { vus: 1, durationS: 0.02 },
      0,
    );
    expect(user.token).toBe('fresh');
    expect(result.ops.token_refresh?.count).toBe(1);
    expect(result.failedRate).toBe(0);
  });

  it('classifies answers', () => {
    expect(classify({ status: 200, body: null })).toBe('ok');
    expect(classify({ status: 0, body: null })).toBe('network_error');
    expect(classify({ status: 503, body: null })).toBe('server_error');
    expect(classify({ status: 429, body: null })).toBe('rate_limited');
    expect(classify({ status: 409, body: { error: { code: 'session_full' } } })).toBe(
      'expected_4xx',
    );
    expect(classify({ status: 400, body: { error: { code: 'validation_failed' } } })).toBe(
      'unexpected_4xx',
    );
  });
});

describe('figures and thresholds', () => {
  it('uses nearest-rank percentiles', () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(values, 95)).toBe(95);
    expect(percentile(values, 99)).toBe(99);
    expect(summarize([5, 1, 3])).toMatchObject({ count: 3, min: 1, p50: 3, max: 5 });
    expect(summarize([])).toMatchObject({ count: 0, p95: 0 });
  });

  it('fails a step over the error rate or a latency limit, and a slow push drain', () => {
    const step = {
      vus: 1,
      durationS: 1,
      iterations: 1,
      requests: 100,
      rps: 100,
      outcomes: {},
      failedRate: 0.02,
      rateLimitedRate: 0,
      overall: summarize([1]),
      ops: { nearby: { ...summarize([10_000]), outcomes: {} } },
    };
    const checks = checkThresholds(SCENARIO, step, {
      postMs: 10,
      drainPerSecond: 1,
      timedOut: false,
    });
    const failed = checks.filter((c) => !c.pass).map((c) => c.name);
    expect(failed).toEqual(['failed rate', 'nearby p95', 'nearby p99', 'push drain per second']);
  });
});

describe('safety', () => {
  it('refuses anything but localhost unless staging is named on purpose', () => {
    expect(() => checkTarget('http://127.0.0.1:3000')).not.toThrow();
    expect(() => checkTarget('https://api.example.org')).toThrow(/refusing/);
  });

  it('makes synthetic numbers in the reserved range and builds contract URLs', () => {
    const s = new Synthetic('+92313', 1);
    const phones = new Set(Array.from({ length: 1000 }, () => s.phone()));
    expect(phones.size).toBe(1000);
    for (const p of phones) expect(p).toMatch(/^\+923[0-9]{9}$/);
    expect(buildUrl('http://h/', 'sessions.get', { params: { sessionId: 'x' } })).toBe(
      'http://h/v1/sessions/x',
    );
    expect(buildUrl('http://h', 'ayahOfTheDay.get', { query: { venueId: ['a', 'b'] } })).toBe(
      'http://h/v1/ayah-of-the-day?venueId=a&venueId=b',
    );
    expect(pakistanDate(0, new Date('2026-10-18T20:00:00Z'))).toBe('2026-10-19');
  });
});

describe('API limits', () => {
  it('plans the default seed inside the global sign-in code ceiling, with room for the admins', () => {
    expect(SIGN_IN_BUDGET).toBeLessThan(API_LIMITS.codesPerHourGlobal);
    expect(() => assertSignInBudget(SCENARIO.seed.users + 1 + SCENARIO.steps.length)).not.toThrow();
  });

  it('refuses a plan that would pass the ceiling partway through seeding', () => {
    expect(() => assertSignInBudget(SIGN_IN_BUDGET + 1)).toThrow(/1000 codes an hour|1,000/);
    expect(() => assertSignInBudget(-1)).toThrow(/whole number/);
    expect(() => assertSignInBudget(1.5)).toThrow(/whole number/);
  });

  it('gives the k6 script the same budget', () => {
    const script = readFileSync(join(LOAD_DIR, 'k6', 'ramadan-evening.js'), 'utf8');
    expect(script).toContain(`const SIGN_IN_BUDGET = ${SIGN_IN_BUDGET};`);
  });
});
