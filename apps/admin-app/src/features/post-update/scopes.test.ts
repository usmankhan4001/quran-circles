import { describe, expect, it } from 'vitest';
import { ids, meFor } from '../../test/backend';
import { principalOf, workingScopesOf } from '../../scope/principal';
import { buildScopeOptions, canPostAnywhere, canPostTo, defaultScopeChoice } from './scopes';

const cities = [
  { id: ids.cityRawalpindi, label: 'Rawalpindi' },
  { id: ids.cityLahore, label: 'Lahore' },
];
const venues = [
  { id: ids.venueAlNoor, cityId: ids.cityRawalpindi, label: 'Al-Noor' },
  { id: ids.venueLahore, cityId: ids.cityLahore, label: 'Bilal' },
];

describe('canPostTo', () => {
  it('lets a venue coordinator post to their venue only', () => {
    const p = principalOf(meFor('venue'));
    expect(canPostTo(p, 'venue', ids.cityRawalpindi, ids.venueAlNoor)).toBe(true);
    expect(canPostTo(p, 'venue', ids.cityLahore, ids.venueLahore)).toBe(false);
    expect(canPostTo(p, 'city', ids.cityRawalpindi, null)).toBe(false);
    expect(canPostTo(p, 'national', null, null)).toBe(false);
  });

  it('lets a city coordinator post to their city and its venues', () => {
    const p = principalOf(meFor('city'));
    expect(canPostTo(p, 'city', ids.cityRawalpindi, null)).toBe(true);
    expect(canPostTo(p, 'city', ids.cityLahore, null)).toBe(false);
    expect(canPostTo(p, 'venue', ids.cityRawalpindi, ids.venueAlNoor)).toBe(true);
    expect(canPostTo(p, 'venue', ids.cityLahore, ids.venueLahore)).toBe(false);
    expect(canPostTo(p, 'national', null, null)).toBe(false);
  });

  it('lets a national admin post anywhere', () => {
    const p = principalOf(meFor('admin'));
    expect(canPostTo(p, 'national', null, null)).toBe(true);
    expect(canPostTo(p, 'city', ids.cityLahore, null)).toBe(true);
    expect(canPostTo(p, 'venue', ids.cityLahore, ids.venueLahore)).toBe(true);
  });

  it('refuses a level with nothing chosen', () => {
    const p = principalOf(meFor('admin'));
    expect(canPostTo(p, 'city', null, null)).toBe(false);
    expect(canPostTo(p, 'venue', ids.cityLahore, null)).toBe(false);
  });
});

describe('buildScopeOptions', () => {
  it('offers a venue coordinator only their venue', () => {
    const o = buildScopeOptions(principalOf(meFor('venue')), cities, venues);
    expect(o.levels).toEqual(['venue']);
    expect(o.venues.map((v) => v.id)).toEqual([ids.venueAlNoor]);
    expect(o.cities).toEqual([]);
  });

  it('offers a city coordinator their city and its venues', () => {
    const o = buildScopeOptions(principalOf(meFor('city')), cities, venues);
    expect(o.levels).toEqual(['city', 'venue']);
    expect(o.cities.map((c) => c.id)).toEqual([ids.cityRawalpindi]);
    expect(o.venues.map((v) => v.id)).toEqual([ids.venueAlNoor]);
  });

  it('offers a national admin everything', () => {
    const o = buildScopeOptions(principalOf(meFor('admin')), cities, venues);
    expect(o.levels).toEqual(['national', 'city', 'venue']);
    expect(o.cities).toHaveLength(2);
    expect(o.venues).toHaveLength(2);
  });

  it('offers a person with several venues each of them', () => {
    const o = buildScopeOptions(principalOf(meFor('multi')), cities, venues);
    expect(o.levels).toEqual(['venue']);
    expect(o.venues).toHaveLength(2);
  });

  it('offers nothing to a person with no role', () => {
    const o = buildScopeOptions(principalOf({ ...meFor('venue'), roles: [] }), cities, venues);
    expect(o.levels).toEqual([]);
    expect(canPostAnywhere(principalOf({ ...meFor('venue'), roles: [] }))).toBe(false);
  });
});

describe('defaultScopeChoice', () => {
  it('opens on the level of the working role', () => {
    const adminOptions = buildScopeOptions(principalOf(meFor('admin')), cities, venues);
    expect(defaultScopeChoice(workingScopesOf(meFor('admin'))[0]!, adminOptions).level).toBe(
      'national',
    );

    const cityOptions = buildScopeOptions(principalOf(meFor('city')), cities, venues);
    expect(defaultScopeChoice(workingScopesOf(meFor('city'))[0]!, cityOptions)).toEqual({
      level: 'city',
      cityId: ids.cityRawalpindi,
      venueId: null,
    });

    const venueOptions = buildScopeOptions(principalOf(meFor('venue')), cities, venues);
    expect(defaultScopeChoice(workingScopesOf(meFor('venue'))[0]!, venueOptions)).toEqual({
      level: 'venue',
      cityId: null,
      venueId: ids.venueAlNoor,
    });
  });

  it('opens on the venue of the role chosen among several', () => {
    const options = buildScopeOptions(principalOf(meFor('multi')), cities, venues);
    const scopes = workingScopesOf(meFor('multi'));
    expect(defaultScopeChoice(scopes[1]!, options).venueId).toBe(ids.venueLahore);
  });

  it('falls back to the first level on offer', () => {
    const options = buildScopeOptions(principalOf(meFor('city')), cities, venues);
    expect(defaultScopeChoice(null, options).level).toBe('city');
  });
});
