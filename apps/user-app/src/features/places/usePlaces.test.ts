import { describe, expect, it } from 'vitest';
import { fixtures } from '@qc/contracts/fixtures';
import { cityById, filterAreas } from './usePlaces';

const areas = fixtures.areas.filter((a) => a.cityId === fixtures.cities[1]!.id);

describe('filterAreas', () => {
  it('keeps every area for an empty search', () => {
    expect(filterAreas(areas, '')).toEqual(areas);
    expect(filterAreas(areas, '   ')).toEqual(areas);
  });

  it('ignores case and extra spaces', () => {
    const f7 = filterAreas(areas, '  f-7 ');
    expect(f7.map((a) => a.name.en)).toContain('F-7');
    expect(filterAreas(areas, 'g-9').map((a) => a.name.en)).toEqual(['G-9']);
  });

  it('matches part of a name', () => {
    expect(filterAreas(fixtures.areas, 'town').length).toBeGreaterThan(1);
  });

  it('matches the Urdu name too', () => {
    const withUrdu = fixtures.areas.find((a) => a.name.ur)!;
    const part = withUrdu.name.ur!.slice(0, 3);
    expect(filterAreas(fixtures.areas, part).map((a) => a.id)).toContain(withUrdu.id);
  });

  it('returns nothing when nothing matches', () => {
    expect(filterAreas(areas, 'zzzzzz')).toEqual([]);
  });

  it('does not change the list it was given', () => {
    const copy = [...areas];
    filterAreas(areas, 'f');
    expect(areas).toEqual(copy);
  });
});

describe('cityById', () => {
  it('finds a city, or nothing', () => {
    expect(cityById(fixtures.cities, fixtures.cities[0]!.id)?.name.en).toBe('Rawalpindi');
    expect(cityById(fixtures.cities, null)).toBeUndefined();
    expect(cityById(undefined, 'x')).toBeUndefined();
  });
});
