import { describe, expect, it } from 'vitest';
import { ids, meFor } from '../test/backend';
import {
  allowed,
  isStaff,
  listFilterOf,
  pickWorkingScope,
  principalOf,
  sessionAbilities,
  workingScopesOf,
} from './principal';

const inVenue = { venueId: ids.venueAlNoor, cityId: ids.cityRawalpindi };
const otherVenueSameCity = {
  venueId: '00000000-0000-4000-8000-040000000002',
  cityId: ids.cityRawalpindi,
};
const otherCity = { venueId: ids.venueLahore, cityId: ids.cityLahore };

describe('principalOf and scopes', () => {
  it('turns the roles of the signed-in person into assignments', () => {
    const principal = principalOf(meFor('multi'));
    expect(principal.assignments).toHaveLength(2);
    expect(principal.assignments[0]).toMatchObject({
      role: 'venue_coordinator',
      venueId: ids.venueAlNoor,
    });
  });

  it('treats only people with a role as staff', () => {
    expect(isStaff(meFor('venue'))).toBe(true);
    expect(isStaff({ ...meFor('venue'), roles: [] })).toBe(false);
  });

  it('lists a working scope for each role', () => {
    const scopes = workingScopesOf(meFor('multi'));
    expect(scopes.map((s) => s.venueId)).toEqual([ids.venueAlNoor, ids.venueLahore]);
  });

  it('opens on the saved scope while it is still held', () => {
    const scopes = workingScopesOf(meFor('multi'));
    expect(pickWorkingScope(scopes, scopes[1]!.id)?.id).toBe(scopes[1]!.id);
    expect(pickWorkingScope(scopes, 'gone')?.id).toBe(scopes[0]!.id);
    expect(pickWorkingScope(scopes)?.id).toBe(scopes[0]!.id);
    expect(pickWorkingScope([])).toBeNull();
  });

  it('prefers the narrowest role when nothing is saved', () => {
    const venue = workingScopesOf(meFor('venue'))[0]!;
    const city = workingScopesOf(meFor('city'))[0]!;
    const admin = workingScopesOf(meFor('admin'))[0]!;
    expect(pickWorkingScope([admin, city, venue])?.role).toBe('venue_coordinator');
    expect(pickWorkingScope([admin, city])?.role).toBe('city_coordinator');
    expect(pickWorkingScope([admin])?.role).toBe('national_admin');
  });

  it('narrows lists to the venue, the city, or nothing for an admin', () => {
    expect(listFilterOf(workingScopesOf(meFor('venue'))[0]!)).toEqual({ venueId: ids.venueAlNoor });
    expect(listFilterOf(workingScopesOf(meFor('city'))[0]!)).toEqual({
      cityId: ids.cityRawalpindi,
    });
    expect(listFilterOf(workingScopesOf(meFor('admin'))[0]!)).toEqual({});
    expect(listFilterOf(null)).toEqual({});
  });
});

describe('session abilities by role', () => {
  it('lets a venue coordinator act on their venue only', () => {
    const p = principalOf(meFor('venue'));
    expect(sessionAbilities(p, inVenue)).toEqual({
      seeRegistrants: true,
      markAttendance: true,
      changeSchedule: true,
      editOccurrence: true,
      postUpdate: true,
    });
    for (const other of [otherVenueSameCity, otherCity]) {
      expect(Object.values(sessionAbilities(p, other)).every((v) => v === false)).toBe(true);
    }
  });

  it('lets a city coordinator act on every venue of their city but not another city', () => {
    const p = principalOf(meFor('city'));
    expect(Object.values(sessionAbilities(p, inVenue)).every(Boolean)).toBe(true);
    expect(Object.values(sessionAbilities(p, otherVenueSameCity)).every(Boolean)).toBe(true);
    expect(Object.values(sessionAbilities(p, otherCity)).every((v) => v === false)).toBe(true);
  });

  it('lets a national admin act everywhere', () => {
    const p = principalOf(meFor('admin'));
    for (const where of [inVenue, otherVenueSameCity, otherCity]) {
      expect(Object.values(sessionAbilities(p, where)).every(Boolean)).toBe(true);
    }
  });

  it('gives a person with several roles the union of them', () => {
    const p = principalOf(meFor('multi'));
    expect(sessionAbilities(p, inVenue).changeSchedule).toBe(true);
    expect(sessionAbilities(p, otherCity).changeSchedule).toBe(true);
    expect(sessionAbilities(p, otherVenueSameCity).changeSchedule).toBe(false);
  });

  it('gives a person with no role nothing', () => {
    const p = principalOf({ ...meFor('venue'), roles: [] });
    expect(Object.values(sessionAbilities(p, inVenue)).every((v) => v === false)).toBe(true);
  });
});

describe('role matrix for places and circles', () => {
  const venueRes = inVenue;
  it.each([
    ['venue', 'venue.update', venueRes, true],
    ['venue', 'venue.update', otherVenueSameCity, false],
    ['venue', 'venue.create', { cityId: ids.cityRawalpindi }, false],
    ['venue', 'circle.create', venueRes, true],
    ['venue', 'circle.approve', venueRes, false],
    ['city', 'venue.create', { cityId: ids.cityRawalpindi }, true],
    ['city', 'venue.create', { cityId: ids.cityLahore }, false],
    ['city', 'circle.approve', venueRes, true],
    ['city', 'circle.approve', otherCity, false],
    ['admin', 'venue.create', { cityId: ids.cityLahore }, true],
    ['admin', 'circle.approve', otherCity, true],
  ] as const)('%s coordinator: %s on %j is %s', (kind, action, resource, expected) => {
    expect(allowed(principalOf(meFor(kind)), action, resource)).toBe(expected);
  });
});
