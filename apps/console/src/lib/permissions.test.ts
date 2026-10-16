import { describe, expect, it } from 'vitest';
import type { Me } from '@qc/contracts';
import { fixtureMe } from '@qc/contracts/fixtures';
import {
  cityCoordinator,
  nationalAdmin,
  rawalpindi,
  islamabad,
  venueA,
  venueB,
  venueCoordinator,
} from '../test/people';
import {
  canAssignRole,
  canSomewhere,
  isNavAllowed,
  principalFromMe,
  visibleNav,
} from './permissions';

const ids = (p: Parameters<typeof visibleNav>[0]) => visibleNav(p).map((i) => i.id);

describe('role based navigation', () => {
  it('shows nothing to a signed-out or role-less person', () => {
    expect(ids(null)).toEqual([]);
    expect(ids({ userId: 'u', assignments: [] })).toEqual([]);
  });

  it('venue coordinator sees sessions, venues and exports only', () => {
    expect(ids(venueCoordinator)).toEqual(['sessions', 'venues', 'exports']);
  });

  it('city coordinator also sees coordinators, import and the audit log', () => {
    expect(ids(cityCoordinator)).toEqual([
      'sessions',
      'venues',
      'exports',
      'coordinators',
      'import',
      'audit',
    ]);
  });

  it('national admin sees everything including settings', () => {
    expect(ids(nationalAdmin)).toEqual([
      'sessions',
      'venues',
      'exports',
      'coordinators',
      'import',
      'audit',
      'settings',
    ]);
  });

  it('guards each page the same way as the menu', () => {
    expect(isNavAllowed(venueCoordinator, 'import')).toBe(false);
    expect(isNavAllowed(cityCoordinator, 'settings')).toBe(false);
    expect(isNavAllowed(cityCoordinator, 'audit')).toBe(true);
    expect(isNavAllowed(nationalAdmin, 'settings')).toBe(true);
  });

  it('a person with two roles gets the union of both', () => {
    const both = {
      userId: 'u',
      assignments: [...venueCoordinator.assignments, ...nationalAdmin.assignments],
    };
    expect(ids(both)).toEqual(ids(nationalAdmin));
  });
});

describe('principalFromMe', () => {
  it('builds assignments from the roles on /me', () => {
    const me: Me = {
      ...fixtureMe,
      roles: [
        {
          id: '00000000-0000-4000-8000-0b0000000001',
          role: 'venue_coordinator',
          scopeType: 'venue',
          cityId: rawalpindi!.id,
          venueId: venueA!.id,
          scopeName: null,
          createdAt: '2027-02-01T00:00:00Z',
        },
      ],
    };
    expect(principalFromMe(me)).toEqual({
      userId: me.id,
      assignments: [{ role: 'venue_coordinator', cityId: rawalpindi!.id, venueId: venueA!.id }],
    });
    expect(canSomewhere(principalFromMe(me), 'registration.export')).toBe(true);
    expect(canSomewhere(principalFromMe(me), 'settings.update')).toBe(false);
  });
});

describe('who may assign which role', () => {
  it('only a national admin may make national admins', () => {
    expect(canAssignRole(nationalAdmin, 'national_admin')).toBe(true);
    expect(canAssignRole(cityCoordinator, 'national_admin')).toBe(false);
    expect(canAssignRole(venueCoordinator, 'national_admin')).toBe(false);
  });

  it('a city coordinator may assign inside their own city only', () => {
    expect(
      canAssignRole(cityCoordinator, 'venue_coordinator', {
        cityId: rawalpindi!.id,
        venueId: venueA!.id,
      }),
    ).toBe(true);
    expect(
      canAssignRole(cityCoordinator, 'venue_coordinator', {
        cityId: islamabad!.id,
        venueId: venueB!.id,
      }),
    ).toBe(false);
    expect(canAssignRole(cityCoordinator, 'city_coordinator', { cityId: rawalpindi!.id })).toBe(
      false,
    );
  });

  it('a venue coordinator may assign nobody', () => {
    expect(canAssignRole(venueCoordinator, 'venue_coordinator', { venueId: venueA!.id })).toBe(
      false,
    );
  });
});
