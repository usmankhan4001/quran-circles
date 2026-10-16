import { describe, expect, it } from 'vitest';
import {
  TIME_BANDS,
  activeFilterCount,
  emptyFilters,
  filtersToQuery,
  hasAnyFilter,
  queryKey,
  timeWindow,
  toggleIn,
  type NearbyFilters,
} from './filters';

const CITY = '00000000-0000-4000-8000-020000000001';
const AREA = '00000000-0000-4000-8000-030000000001';

describe('filtersToQuery', () => {
  it('sends only a page size when nothing is chosen', () => {
    expect(filtersToQuery(emptyFilters)).toEqual({ limit: 20 });
  });

  it('maps every filter to its API field', () => {
    const filters: NearbyFilters = {
      cityId: CITY,
      areaId: AREA,
      days: [5, 1, 3],
      timeBand: 'evening',
      section: 'women',
      language: 'ur',
      program: 'dora',
      q: '  Noor  ',
    };
    expect(filtersToQuery(filters, { limit: 10 })).toEqual({
      limit: 10,
      cityId: CITY,
      areaId: AREA,
      dayOfWeek: [1, 3, 5],
      timeFrom: '17:00',
      timeTo: '20:29',
      section: 'women',
      language: 'ur',
      program: 'dora',
      q: 'Noor',
    });
  });

  it('adds the chosen area as the point to sort by distance from', () => {
    const query = filtersToQuery(emptyFilters, { origin: { lat: 33.6, lng: 73.05 } });
    expect(query).toMatchObject({ lat: 33.6, lng: 73.05 });
  });

  it('leaves out blank search text and empty days', () => {
    const query = filtersToQuery({ ...emptyFilters, q: '   ', days: [] });
    expect(query).not.toHaveProperty('q');
    expect(query).not.toHaveProperty('dayOfWeek');
  });

  it('does not change the order of the days it was given', () => {
    const days = [6, 0];
    filtersToQuery({ ...emptyFilters, days });
    expect(days).toEqual([6, 0]);
  });

  it('keeps search text within the API limit', () => {
    expect(filtersToQuery({ ...emptyFilters, q: 'x'.repeat(300) }).q).toHaveLength(100);
  });

  it('makes the same query for the same filters, so the cache key is stable', () => {
    const a = filtersToQuery({ ...emptyFilters, days: [2, 1], section: 'men' });
    const b = filtersToQuery({ ...emptyFilters, section: 'men', days: [1, 2] });
    expect(queryKey('sessions', a)).toBe(queryKey('sessions', b));
  });
});

describe('time bands', () => {
  it('covers the day without gaps or overlaps', () => {
    const windows = TIME_BANDS.map((band) => timeWindow(band)!);
    for (let i = 1; i < windows.length; i += 1) {
      const [h, m] = windows[i - 1]!.timeTo.split(':').map(Number) as [number, number];
      const next = windows[i]!.timeFrom;
      const end = h * 60 + m + 1;
      expect(
        `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`,
      ).toBe(next);
    }
  });

  it('has no window for no band', () => {
    expect(timeWindow(null)).toBeNull();
  });
});

describe('counting filters', () => {
  it('does not count the city or the search text', () => {
    const filters = { ...emptyFilters, cityId: CITY, q: 'noor' };
    expect(activeFilterCount(filters)).toBe(0);
    expect(hasAnyFilter(filters)).toBe(true);
  });

  it('counts each group once, however many days are chosen', () => {
    const filters = { ...emptyFilters, days: [1, 2, 3], timeBand: 'night' as const, areaId: AREA };
    expect(activeFilterCount(filters)).toBe(3);
  });

  it('toggles a value in a list without changing the list it was given', () => {
    const list = [1, 2];
    expect(toggleIn(list, 3)).toEqual([1, 2, 3]);
    expect(toggleIn(list, 2)).toEqual([1]);
    expect(list).toEqual([1, 2]);
  });
});
