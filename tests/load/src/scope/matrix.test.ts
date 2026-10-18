import { describe, expect, it } from 'vitest';
import { ACTIONS, ENDPOINT_IDS, type Principal } from '@qc/contracts';
import { endpointDef } from '../http';
import { expectationFor, judge } from './expect';
import { SCENARIOS, runOrder, scenarioName } from './scenarios';
import type { Fixture, Prepared, Scenario, World } from './types';

/**
 * The fast self-check of the scope runner: no network. It proves the scenario table covers the
 * contract, every request it would send passes the contract's own Zod schemas, and the oracle
 * agrees with the frozen matrix for each kind of caller.
 */
const uuid = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const world: World = {
  cityA: { id: uuid(1), areaId: uuid(2) },
  cityB: { id: uuid(3), areaId: uuid(4) },
  venueA1: uuid(5),
  venueA2: uuid(6),
  venueB1: uuid(7),
};

const fx: Fixture = {
  world,
  runTag: 'selfcheck',
  fixedCode: '000000',
  today: '2026-10-18',
  pickDate: '2026-11-27',
  sessionId: uuid(10),
  session2Id: uuid(11),
  occurrenceId: uuid(12),
  circleId: uuid(13),
  inviteId: uuid(14),
  assignmentId: uuid(15),
  handoverTargetUserId: uuid(16),
  venueDailyAyahId: uuid(17),
  nationalDailyAyahId: uuid(18),
  posterId: uuid(19),
  hijriOffsetDays: 0,
  owner: {
    userId: uuid(20),
    registrationId: uuid(21),
    followId: uuid(22),
    deviceId: uuid(23),
    bookmarkId: uuid(24),
    circleRequestId: uuid(25),
  },
};

const prepared: Prepared = {
  phone: '+923130000001',
  challengeId: uuid(30),
  refreshToken: 'synthetic-refresh-token-0000',
  followId: uuid(31),
  deviceId: uuid(32),
  bookmarkId: uuid(33),
  circleRequestId: uuid(34),
  registrationId: uuid(35),
};

const P = {
  attendee: { userId: uuid(40), assignments: [] },
  vcVenue: {
    userId: uuid(41),
    assignments: [{ role: 'venue_coordinator', venueId: world.venueA1 }],
  },
  vcSameCity: {
    userId: uuid(42),
    assignments: [{ role: 'venue_coordinator', venueId: world.venueA2 }],
  },
  vcOtherCity: {
    userId: uuid(43),
    assignments: [{ role: 'venue_coordinator', venueId: world.venueB1 }],
  },
  ccCity: { userId: uuid(44), assignments: [{ role: 'city_coordinator', cityId: world.cityA.id }] },
  ccOther: {
    userId: uuid(45),
    assignments: [{ role: 'city_coordinator', cityId: world.cityB.id }],
  },
  national: { userId: uuid(46), assignments: [{ role: 'national_admin' }] },
} satisfies Record<string, Principal>;

const expectFor = (s: Scenario, p: Principal | null) =>
  expectationFor(s, p, world, fx.owner.userId);

describe('the scenario table covers the contract', () => {
  it('has a scenario for every endpoint and none for an unknown one', () => {
    const covered = new Set(SCENARIOS.map((s) => s.id));
    expect([...covered].sort()).toEqual([...ENDPOINT_IDS].sort());
  });

  it('gives every staff endpoint a staff spec with an action the contract lists', () => {
    for (const s of SCENARIOS) {
      const def = endpointDef(s.id);
      if (def.auth !== 'staff') {
        expect(s.staff, scenarioName(s)).toBeUndefined();
        continue;
      }
      expect(s.staff, scenarioName(s)).toBeDefined();
      expect(def.actions, scenarioName(s)).toContain(s.staff?.action);
      for (const q of s.staff?.qualifying ?? []) expect(Object.keys(ACTIONS)).toContain(q);
    }
  });

  it('tries another person’s record only on user endpoints that take a record id', () => {
    for (const s of SCENARIOS.filter((x) => x.owner === 'other')) {
      expect(endpointDef(s.id).auth, scenarioName(s)).toBe('user');
      expect(endpointDef(s.id).params, scenarioName(s)).toBeDefined();
    }
  });

  it('sends only requests the contract accepts', () => {
    for (const s of SCENARIOS) {
      const def = endpointDef(s.id);
      const req = s.request(fx, prepared);
      const label = scenarioName(s);
      if (def.params) expect(def.params.safeParse(req.params).success, label).toBe(true);
      else expect(req.params, label).toBeUndefined();
      if (def.query) expect(def.query.safeParse(req.query ?? {}).success, label).toBe(true);
      else expect(req.query, label).toBeUndefined();
      if (def.body) expect(def.body.safeParse(req.body).success, label).toBe(true);
      else expect(req.body, label).toBeUndefined();
    }
  });

  it('runs disposable scenarios after ordinary ones and the venue archive last', () => {
    const order = runOrder();
    const last = order[order.length - 1];
    expect(last?.id).toBe('adminVenues.archive');
    const firstDisposable = order.findIndex((s) => s.disposable);
    expect(order.slice(firstDisposable).every((s) => s.disposable || s.last)).toBe(true);
  });
});

describe('the oracle agrees with the frozen matrix', () => {
  it('lets everyone call public endpoints', () => {
    for (const s of SCENARIOS.filter((x) => endpointDef(x.id).auth === 'public')) {
      for (const p of [null, ...Object.values(P)]) expect(expectFor(s, p)).toBe('allow');
    }
  });

  it('answers 401 to an anonymous caller on every other endpoint', () => {
    for (const s of SCENARIOS.filter((x) => endpointDef(x.id).auth !== 'public')) {
      expect(expectFor(s, null), scenarioName(s)).toBe('unauthenticated');
    }
  });

  it('lets every signed-in person use their own data and refuses another person’s', () => {
    for (const s of SCENARIOS.filter((x) => endpointDef(x.id).auth === 'user')) {
      for (const p of Object.values(P)) {
        expect(expectFor(s, p), scenarioName(s)).toBe(s.owner === 'other' ? 'refused' : 'allow');
      }
    }
  });

  it('refuses an attendee (and a revoked coordinator) every staff endpoint with 403', () => {
    for (const s of SCENARIOS.filter((x) => endpointDef(x.id).auth === 'staff')) {
      expect(expectFor(s, P.attendee), scenarioName(s)).toBe('deny');
    }
  });

  it('lets a national admin call every staff endpoint', () => {
    for (const s of SCENARIOS.filter((x) => endpointDef(x.id).auth === 'staff')) {
      expect(expectFor(s, P.national), scenarioName(s)).toBe('allow');
    }
  });

  it('follows the role columns for coordinators in and out of scope', () => {
    for (const s of SCENARIOS.filter((x) => x.staff)) {
      const spec = s.staff!;
      const roles: readonly string[] = ACTIONS[spec.action].roles;
      const name = scenarioName(s);
      const inScope = (role: string): boolean => roles.includes(role);
      if (spec.target === 'national') {
        for (const p of [P.vcVenue, P.ccCity]) expect(expectFor(s, p), name).not.toBe('allow');
      }
      if (spec.target === 'venue' && !spec.oracle) {
        expect(expectFor(s, P.vcVenue) === 'allow', name).toBe(inScope('venue_coordinator'));
        expect(expectFor(s, P.ccCity) === 'allow', name).toBe(inScope('city_coordinator'));
        expect(expectFor(s, P.vcSameCity), name).not.toBe('allow');
      }
      if (spec.target === 'city') {
        expect(expectFor(s, P.vcVenue), name).not.toBe('allow');
        expect(expectFor(s, P.ccCity) === 'allow', name).toBe(inScope('city_coordinator'));
      }
      if (spec.target !== 'any' && !spec.oracle) {
        for (const p of [P.vcOtherCity, P.ccOther]) expect(expectFor(s, p), name).not.toBe('allow');
      }
    }
  });

  it('expects 404, not 403, for a single record outside a coordinator’s scope', () => {
    const get = SCENARIOS.find((s) => s.id === 'adminSessions.get')!;
    expect(expectFor(get, P.vcOtherCity)).toBe('not_found');
    expect(expectFor(get, P.attendee)).toBe('deny');
  });
});

describe('judging an answer', () => {
  it('accepts a conflict as allowed but never a refusal or a crash', () => {
    expect(judge('allow', 409, null).ok).toBe(true);
    expect(judge('allow', 403, null).ok).toBe(false);
    expect(judge('allow', 500, null).ok).toBe(false);
  });

  it('marks a 2xx where a refusal was expected as a leak', () => {
    expect(judge('deny', 200, null)).toEqual({ ok: false, reason: 'expected 403, got 200 (LEAK)' });
    expect(judge('refused', 204, null).reason).toContain('LEAK');
    expect(judge('not_found', 403, null).ok).toBe(false);
  });

  it('treats a rate-limited answer as inconclusive, not as a pass', () => {
    expect(judge('deny', 429, null)).toEqual({ ok: false, reason: 'rate limited (inconclusive)' });
  });

  it('checks that a forbidden import row was refused and nothing applied', () => {
    const refused = {
      applied: false,
      rows: [{ index: 0, status: 'invalid', issues: [{ path: 'cityId', code: 'forbidden' }] }],
    };
    expect(judge('row_forbidden', 200, refused).ok).toBe(true);
    expect(
      judge('row_forbidden', 200, { applied: false, rows: [{ status: 'created', issues: [] }] }).ok,
    ).toBe(false);
    expect(judge('row_forbidden', 403, null).ok).toBe(false);
  });
});
