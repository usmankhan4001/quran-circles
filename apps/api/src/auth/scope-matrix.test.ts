import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import {
  ACTIONS,
  ApiError,
  ROLES,
  SCOPE_ACTIONS,
  type Principal,
  type ResourceScope,
  type Role,
  type ScopeAction,
} from '@qc/contracts';
import { requireAction } from './middleware';
import type { AuthVariables } from './types';

/**
 * The scope matrix, generated from `ACTIONS` in @qc/contracts: every action against every kind of
 * person against in-scope and out-of-scope resources, through the real `requireAction`. A new
 * action is picked up on its own. A new `level` makes `expected` throw, so the suite fails until a
 * rule for it is written here.
 */

const CITY_A = 'aaaaaaaa-0000-4000-8000-00000000000a';
const CITY_B = 'bbbbbbbb-0000-4000-8000-00000000000b';
const VENUE_A1 = 'aaaaaaaa-0000-4000-8000-0000000000a1';
const VENUE_A2 = 'aaaaaaaa-0000-4000-8000-0000000000a2';
const VENUE_B1 = 'bbbbbbbb-0000-4000-8000-0000000000b1';

interface Actor {
  name: string;
  principal: Principal | null;
}

const person = (name: string, assignments: Principal['assignments']): Actor => ({
  name,
  principal: { userId: `user-${name}`, assignments },
});

const ACTORS: Actor[] = [
  { name: 'public', principal: null },
  person('attendee', []),
  person('national_admin', [{ role: 'national_admin' }]),
  person('city_coordinator_A', [{ role: 'city_coordinator', cityId: CITY_A }]),
  person('city_coordinator_B', [{ role: 'city_coordinator', cityId: CITY_B }]),
  person('venue_coordinator_A1', [{ role: 'venue_coordinator', venueId: VENUE_A1 }]),
  person('venue_coordinator_B1', [{ role: 'venue_coordinator', venueId: VENUE_B1 }]),
  person('venue_coordinator_A1_and_A2', [
    { role: 'venue_coordinator', venueId: VENUE_A1 },
    { role: 'venue_coordinator', venueId: VENUE_A2 },
  ]),
  // Assignments with the scope missing must never match anything.
  person('city_coordinator_without_city', [{ role: 'city_coordinator', cityId: null }]),
  person('venue_coordinator_without_venue', [{ role: 'venue_coordinator', venueId: null }]),
];

const RESOURCES: { name: string; resource: ResourceScope }[] = [
  { name: 'no scope', resource: {} },
  { name: 'city A', resource: { cityId: CITY_A } },
  { name: 'city B', resource: { cityId: CITY_B } },
  { name: 'venue A1 in city A', resource: { cityId: CITY_A, venueId: VENUE_A1 } },
  { name: 'venue A2 in city A', resource: { cityId: CITY_A, venueId: VENUE_A2 } },
  { name: 'venue B1 in city B', resource: { cityId: CITY_B, venueId: VENUE_B1 } },
  { name: 'venue A1 with no city', resource: { venueId: VENUE_A1 } },
  { name: 'own data', resource: { ownerUserId: '{self}' } },
  { name: 'someone else data', resource: { ownerUserId: 'user-someone-else' } },
];

/** The rules from `SCOPES.md`, written out again independently of `can`. */
function expected(action: ScopeAction, actor: Actor, resource: ResourceScope): boolean {
  const def = ACTIONS[action];
  const principal = actor.principal;
  const held = principal?.assignments ?? [];
  const mayRole = (role: Role) => (def.roles as readonly Role[]).includes(role);
  switch (def.level) {
    case 'public':
      return true;
    case 'self':
      return (
        !!principal?.userId &&
        (resource.ownerUserId == null || resource.ownerUserId === principal.userId)
      );
    case 'any':
      return held.some((a) => mayRole(a.role));
    case 'national':
      return held.some((a) => a.role === 'national_admin' && mayRole(a.role));
    case 'city':
      return held.some(
        (a) =>
          mayRole(a.role) &&
          (a.role === 'national_admin' ||
            (a.role === 'city_coordinator' && !!a.cityId && a.cityId === resource.cityId)),
      );
    case 'venue':
      return held.some(
        (a) =>
          mayRole(a.role) &&
          (a.role === 'national_admin' ||
            (a.role === 'city_coordinator' && !!a.cityId && a.cityId === resource.cityId) ||
            (a.role === 'venue_coordinator' && !!a.venueId && a.venueId === resource.venueId)),
      );
    default:
      throw new Error(
        `The matrix has a new level "${String(def.level)}" with no rule in this test`,
      );
  }
}

function buildApp() {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use('*', async (c, next) => {
    c.set('requestId', 'matrix');
    const raw = c.req.header('x-principal');
    c.set('principal', raw ? (JSON.parse(raw) as Principal) : null);
    await next();
  });
  for (const action of SCOPE_ACTIONS) {
    app.get(
      `/guard/${action}`,
      requireAction(action, (c) => JSON.parse(c.req.header('x-resource') ?? '{}') as ResourceScope),
      (c) => c.json({ ok: true }),
    );
  }
  return app;
}

const app = buildApp();

async function call(action: ScopeAction, actor: Actor, resource: ResourceScope) {
  const self = actor.principal?.userId ?? undefined;
  const concrete = JSON.parse(
    JSON.stringify(resource).replaceAll('{self}', self ?? 'nobody'),
  ) as ResourceScope;
  return app.request(`/guard/${action}`, {
    headers: {
      'x-resource': JSON.stringify(concrete),
      ...(actor.principal ? { 'x-principal': JSON.stringify(actor.principal) } : {}),
    },
  });
}

describe('scope matrix (generated from ACTIONS)', () => {
  it('covers every action in the contract', () => {
    expect(SCOPE_ACTIONS.length).toBeGreaterThan(40);
    expect(new Set(SCOPE_ACTIONS)).toEqual(new Set(Object.keys(ACTIONS)));
    for (const action of SCOPE_ACTIONS)
      expect(() => expected(action, ACTORS[0]!, {})).not.toThrow();
  });

  it('has an actor for every role, in scope and out of scope', () => {
    for (const role of ROLES) {
      expect(ACTORS.some((a) => a.principal?.assignments.some((x) => x.role === role))).toBe(true);
    }
  });

  describe.each(SCOPE_ACTIONS)('%s', (action) => {
    const def = ACTIONS[action];
    it(`${def.level}: allows exactly who the matrix allows, with the right refusal for the rest`, async () => {
      let allowed = 0;
      let denied = 0;
      for (const actor of ACTORS) {
        for (const { name, resource } of RESOURCES) {
          const response = await call(action, actor, resource);
          const want = expected(action, actor, {
            ...resource,
            ownerUserId:
              resource.ownerUserId === '{self}'
                ? (actor.principal?.userId ?? 'nobody')
                : resource.ownerUserId,
          });
          const label = `${actor.name} on ${name}`;
          if (want) {
            allowed += 1;
            expect(response.status, label).toBe(200);
          } else {
            denied += 1;
            const unauthenticated = actor.principal === null;
            expect(response.status, label).toBe(unauthenticated ? 401 : 403);
            const body = ApiError.parse(await response.json());
            expect(body.error.code, label).toBe(unauthenticated ? 'unauthenticated' : 'forbidden');
            expect(body.error.messageKey, label).toBe(
              unauthenticated ? 'errors.unauthenticated' : 'errors.forbidden',
            );
            expect(body.error.requestId, label).toBe('matrix');
          }
        }
      }
      // Every action is both reachable and out of reach for somebody, except the public ones.
      expect(allowed).toBeGreaterThan(0);
      if (def.level !== 'public') expect(denied).toBeGreaterThan(0);
    });

    if (def.level !== 'public' && def.level !== 'self') {
      it('is refused to a signed-in person with no role, and to the public with 401', async () => {
        const attendee = ACTORS.find((a) => a.name === 'attendee')!;
        const publicActor = ACTORS.find((a) => a.name === 'public')!;
        expect((await call(action, attendee, { cityId: CITY_A, venueId: VENUE_A1 })).status).toBe(
          403,
        );
        expect(
          (await call(action, publicActor, { cityId: CITY_A, venueId: VENUE_A1 })).status,
        ).toBe(401);
      });
    }
  });

  describe.each(ROLES)('role %s', (role) => {
    it('reaches an action only when the matrix lists the role for it', async () => {
      const actor = ACTORS.find((a) => a.principal?.assignments.some((x) => x.role === role))!;
      for (const action of SCOPE_ACTIONS) {
        const def = ACTIONS[action];
        if (def.level === 'public' || def.level === 'self') continue;
        const listed = (def.roles as readonly Role[]).includes(role);
        // Venue A1 in city A is inside the scope of the first actor with each role.
        const own: ResourceScope = { cityId: CITY_A, venueId: VENUE_A1 };
        const response = await call(action, actor, own);
        const reachesOwnScope = response.status === 200;
        if (!listed) expect(reachesOwnScope, `${role} on ${action}`).toBe(false);
        if (listed && def.level === 'any')
          expect(reachesOwnScope, `${role} on ${action}`).toBe(true);
      }
    });
  });
});
