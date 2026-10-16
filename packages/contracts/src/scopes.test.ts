import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  ACTIONS,
  SCOPE_ACTIONS,
  can,
  roleAssignAction,
  scopeFilter,
  scopeMatrixMarkdown,
  updatePostAction,
  type Principal,
  type ResourceScope,
  type ScopeAction,
} from './scopes';

const CITY_A = '00000000-0000-4000-8000-000000000a01';
const CITY_B = '00000000-0000-4000-8000-000000000b01';
const VENUE_A1 = '00000000-0000-4000-8000-0000000a0001'; // in city A
const VENUE_A2 = '00000000-0000-4000-8000-0000000a0002'; // in city A
const VENUE_B1 = '00000000-0000-4000-8000-0000000b0001'; // in city B
const ME = '00000000-0000-4000-8000-00000000fff1';
const OTHER = '00000000-0000-4000-8000-00000000fff2';

const people = {
  anonymous: null,
  attendee: { userId: ME, assignments: [] } satisfies Principal,
  venueCoordinatorA1: {
    userId: ME,
    assignments: [{ role: 'venue_coordinator', venueId: VENUE_A1 }],
  } satisfies Principal,
  cityCoordinatorA: {
    userId: ME,
    assignments: [{ role: 'city_coordinator', cityId: CITY_A }],
  } satisfies Principal,
  nationalAdmin: { userId: ME, assignments: [{ role: 'national_admin' }] } satisfies Principal,
  // A coordinator row with its scope missing must never match anything.
  brokenCityCoordinator: {
    userId: ME,
    assignments: [{ role: 'city_coordinator' }],
  } satisfies Principal,
  brokenVenueCoordinator: {
    userId: ME,
    assignments: [{ role: 'venue_coordinator' }],
  } satisfies Principal,
};
type Who = keyof typeof people;

const at = {
  venueA1: { cityId: CITY_A, venueId: VENUE_A1 },
  venueA2: { cityId: CITY_A, venueId: VENUE_A2 },
  venueB1: { cityId: CITY_B, venueId: VENUE_B1 },
  cityA: { cityId: CITY_A },
  cityB: { cityId: CITY_B },
  national: {},
} satisfies Record<string, ResourceScope>;
type Where = keyof typeof at;

/** Expected answers written out by hand: who may do an action of a level, at which place. */
const expectLevel: Record<'venue' | 'city' | 'national', Record<Who, Where[]>> = {
  venue: {
    anonymous: [],
    attendee: [],
    venueCoordinatorA1: ['venueA1'],
    cityCoordinatorA: ['venueA1', 'venueA2'],
    nationalAdmin: ['venueA1', 'venueA2', 'venueB1'],
    brokenCityCoordinator: [],
    brokenVenueCoordinator: [],
  },
  city: {
    anonymous: [],
    attendee: [],
    venueCoordinatorA1: [],
    cityCoordinatorA: ['cityA'],
    nationalAdmin: ['cityA', 'cityB'],
    brokenCityCoordinator: [],
    brokenVenueCoordinator: [],
  },
  national: {
    anonymous: [],
    attendee: [],
    venueCoordinatorA1: [],
    cityCoordinatorA: [],
    nationalAdmin: ['national'],
    brokenCityCoordinator: [],
    brokenVenueCoordinator: [],
  },
};

const placesFor = (level: 'venue' | 'city' | 'national'): Where[] =>
  level === 'venue'
    ? ['venueA1', 'venueA2', 'venueB1']
    : level === 'city'
      ? ['cityA', 'cityB']
      : ['national'];

describe('scope matrix, staff actions with a resource level', () => {
  for (const action of SCOPE_ACTIONS) {
    const def = ACTIONS[action];
    if (def.level !== 'venue' && def.level !== 'city' && def.level !== 'national') continue;
    const level = def.level;

    describe(action, () => {
      for (const who of Object.keys(people) as Who[]) {
        for (const where of placesFor(level)) {
          // Which roles the action allows is part of the definition; the oracle below mirrors the
          // handwritten level table, then drops roles the action does not list.
          const principal = people[who];
          const roleOk =
            principal === null || principal.assignments.length === 0
              ? false
              : principal.assignments.some((a) =>
                  (def.roles as readonly string[]).includes(a.role),
                );
          const expected = roleOk && expectLevel[level][who].includes(where);
          it(`${who} at ${where}: ${expected ? 'allowed' : 'denied'}`, () => {
            expect(can(principal, action, at[where])).toBe(expected);
          });
        }
      }
    });
  }
});

describe('scope matrix, named rules from the V2 plan', () => {
  const rule = (who: Who, action: ScopeAction, where: Where, allowed: boolean) =>
    it(`${who} ${allowed ? 'can' : 'cannot'} ${action} at ${where}`, () => {
      expect(can(people[who], action, at[where])).toBe(allowed);
    });

  // Venue coordinators run their own venue only.
  rule('venueCoordinatorA1', 'session.change_schedule', 'venueA1', true);
  rule('venueCoordinatorA1', 'session.change_schedule', 'venueA2', false);
  rule('venueCoordinatorA1', 'attendance.mark', 'venueB1', false);
  rule('venueCoordinatorA1', 'venue.create', 'cityA', false);
  rule('venueCoordinatorA1', 'circle.create', 'venueA1', true);
  rule('venueCoordinatorA1', 'circle.approve', 'cityA', false);
  rule('venueCoordinatorA1', 'update.post_venue', 'venueA1', true);
  rule('venueCoordinatorA1', 'update.post_city', 'cityA', false);
  rule('venueCoordinatorA1', 'role.assign_venue_coordinator', 'venueA1', false);
  rule('venueCoordinatorA1', 'audit.read', 'cityA', false);

  // City coordinators run everything under their city, and approve circles there.
  rule('cityCoordinatorA', 'circle.approve', 'cityA', true);
  rule('cityCoordinatorA', 'circle.approve', 'cityB', false);
  rule('cityCoordinatorA', 'venue.create', 'cityA', true);
  rule('cityCoordinatorA', 'venue.create', 'cityB', false);
  rule('cityCoordinatorA', 'registration.list', 'venueA2', true);
  rule('cityCoordinatorA', 'registration.list', 'venueB1', false);
  rule('cityCoordinatorA', 'role.assign_venue_coordinator', 'venueA2', true);
  rule('cityCoordinatorA', 'role.assign_venue_coordinator', 'venueB1', false);
  rule('cityCoordinatorA', 'role.assign_city_coordinator', 'cityA', false);
  rule('cityCoordinatorA', 'role.assign_national_admin', 'national', false);
  rule('cityCoordinatorA', 'update.post_national', 'national', false);
  rule('cityCoordinatorA', 'settings.update', 'national', false);

  // National admins act everywhere, and only they change platform settings and national roles.
  rule('nationalAdmin', 'settings.update', 'national', true);
  rule('nationalAdmin', 'update.post_national', 'national', true);
  rule('nationalAdmin', 'role.assign_national_admin', 'national', true);
  rule('nationalAdmin', 'role.assign_city_coordinator', 'cityB', true);
  rule('nationalAdmin', 'registration.export', 'venueB1', true);

  // Nobody else, including signed-out visitors and plain attendees, gets staff actions.
  rule('attendee', 'registration.list', 'venueA1', false);
  rule('anonymous', 'registration.list', 'venueA1', false);
  rule('attendee', 'venue.list_admin', 'national', false);
});

describe('public and self actions', () => {
  const publicActions = SCOPE_ACTIONS.filter((a) => ACTIONS[a].level === 'public');
  const selfActions = SCOPE_ACTIONS.filter((a) => ACTIONS[a].level === 'self');

  it('has public and self actions', () => {
    expect(publicActions.length).toBeGreaterThan(5);
    expect(selfActions.length).toBeGreaterThan(5);
  });

  for (const a of publicActions) {
    it(`${a} is open to everyone`, () => {
      for (const who of Object.keys(people) as Who[]) expect(can(people[who], a)).toBe(true);
    });
  }

  for (const a of selfActions) {
    it(`${a} needs a signed-in person acting on their own data`, () => {
      expect(can(null, a)).toBe(false);
      expect(can({ assignments: [] }, a)).toBe(false);
      expect(can(people.attendee, a, { ownerUserId: ME })).toBe(true);
      expect(can(people.attendee, a, { ownerUserId: OTHER })).toBe(false);
      // Staff do not reach into other people's personal data through a staff role.
      expect(can(people.nationalAdmin, a, { ownerUserId: OTHER })).toBe(false);
      expect(can(people.nationalAdmin, a, { ownerUserId: ME })).toBe(true);
    });
  }
});

describe('"any" actions and scope filters', () => {
  const anyActions = SCOPE_ACTIONS.filter((a) => ACTIONS[a].level === 'any');

  it('has list actions', () => expect(anyActions.length).toBeGreaterThan(4));

  for (const a of anyActions) {
    it(`${a} needs a qualifying role and filters to its scope`, () => {
      const roles = ACTIONS[a].roles as readonly string[];
      expect(can(null, a)).toBe(false);
      expect(can(people.attendee, a)).toBe(false);
      expect(can(people.venueCoordinatorA1, a)).toBe(roles.includes('venue_coordinator'));
      expect(can(people.cityCoordinatorA, a)).toBe(roles.includes('city_coordinator'));
      expect(can(people.nationalAdmin, a)).toBe(roles.includes('national_admin'));

      expect(scopeFilter(people.nationalAdmin, a).national).toBe(roles.includes('national_admin'));
      expect(scopeFilter(people.cityCoordinatorA, a).cityIds).toEqual(
        roles.includes('city_coordinator') ? [CITY_A] : [],
      );
      expect(scopeFilter(people.venueCoordinatorA1, a).venueIds).toEqual(
        roles.includes('venue_coordinator') ? [VENUE_A1] : [],
      );
    });
  }

  it('merges several assignments', () => {
    const both: Principal = {
      userId: ME,
      assignments: [
        { role: 'venue_coordinator', venueId: VENUE_A1 },
        { role: 'venue_coordinator', venueId: VENUE_B1 },
        { role: 'city_coordinator', cityId: CITY_A },
      ],
    };
    expect(scopeFilter(both, 'venue.list_admin')).toEqual({
      national: false,
      cityIds: [CITY_A],
      venueIds: [VENUE_A1, VENUE_B1],
    });
    expect(can(both, 'attendance.mark', at.venueB1)).toBe(true);
    expect(can(both, 'attendance.mark', at.venueA2)).toBe(true);
  });

  it('gives nothing to a signed-out person', () => {
    expect(scopeFilter(null, 'venue.list_admin')).toEqual({
      national: false,
      cityIds: [],
      venueIds: [],
    });
  });
});

describe('guards', () => {
  it('denies an action the matrix does not know', () => {
    expect(can(people.nationalAdmin, 'not.a.real.action' as ScopeAction, at.national)).toBe(false);
  });

  it('maps role and scope to the guarding action', () => {
    expect(roleAssignAction('national_admin')).toBe('role.assign_national_admin');
    expect(roleAssignAction('city_coordinator')).toBe('role.assign_city_coordinator');
    expect(roleAssignAction('venue_coordinator')).toBe('role.assign_venue_coordinator');
    expect(updatePostAction('national')).toBe('update.post_national');
    expect(updatePostAction('city')).toBe('update.post_city');
    expect(updatePostAction('venue')).toBe('update.post_venue');
  });

  it('keeps SCOPES.md in step with the matrix', () => {
    const file = readFileSync(resolve(import.meta.dirname, '../SCOPES.md'), 'utf8');
    expect(file).toBe(scopeMatrixMarkdown());
  });
});
