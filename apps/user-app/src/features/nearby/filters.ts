import type { Locale, Program, Section, SessionListQuery } from '@qc/contracts';

export const TIME_BANDS = ['morning', 'afternoon', 'evening', 'night'] as const;
export type TimeBand = (typeof TIME_BANDS)[number];

/** Local start-time windows for the time chips. "Night" is after the Isha hour. */
export const TIME_BAND_RANGES: Record<TimeBand, { from: string; to: string }> = {
  morning: { from: '04:00', to: '11:59' },
  afternoon: { from: '12:00', to: '16:59' },
  evening: { from: '17:00', to: '20:29' },
  night: { from: '20:30', to: '23:59' },
};

export interface NearbyFilters {
  cityId: string | null;
  areaId: string | null;
  /** Days of the week, 0 is Sunday. Empty means any day. */
  days: number[];
  /** One part of the day. The API takes a single start-time window, so only one can be chosen. */
  timeBand: TimeBand | null;
  section: Section | null;
  language: Locale | null;
  program: Program | null;
  q: string;
}

export const emptyFilters: NearbyFilters = {
  cityId: null,
  areaId: null,
  days: [],
  timeBand: null,
  section: null,
  language: null,
  program: null,
  q: '',
};

/** The start-time window of a band, in the API's own words. */
export function timeWindow(band: TimeBand | null): { timeFrom: string; timeTo: string } | null {
  if (!band) return null;
  const range = TIME_BAND_RANGES[band];
  return { timeFrom: range.from, timeTo: range.to };
}

export interface QueryExtras {
  /** The chosen area's coordinates: sorts by distance without asking for the phone's location. */
  origin?: { lat: number; lng: number } | null;
  limit?: number;
}

/**
 * Turns the filter chips into the `sessions.list` query. Only filters that are set are sent,
 * so the same filters always make the same query (and the same cache key).
 */
export function filtersToQuery(
  filters: NearbyFilters,
  extras: QueryExtras = {},
): Partial<SessionListQuery> {
  const query: Partial<SessionListQuery> = { limit: extras.limit ?? 20 };
  if (filters.cityId) query.cityId = filters.cityId;
  if (filters.areaId) query.areaId = filters.areaId;
  if (filters.days.length > 0) query.dayOfWeek = [...filters.days].sort((a, b) => a - b);
  const window = timeWindow(filters.timeBand);
  if (window) {
    query.timeFrom = window.timeFrom;
    query.timeTo = window.timeTo;
  }
  if (filters.section) query.section = filters.section;
  if (filters.language) query.language = filters.language;
  if (filters.program) query.program = filters.program;
  const q = filters.q.trim();
  if (q) query.q = q.slice(0, 100);
  if (extras.origin) {
    query.lat = extras.origin.lat;
    query.lng = extras.origin.lng;
  }
  return query;
}

/** How many filter chips are on, for the "Filters (3)" button. City and search do not count. */
export function activeFilterCount(filters: NearbyFilters): number {
  return (
    (filters.areaId ? 1 : 0) +
    (filters.days.length > 0 ? 1 : 0) +
    (filters.timeBand ? 1 : 0) +
    (filters.section ? 1 : 0) +
    (filters.language ? 1 : 0) +
    (filters.program ? 1 : 0)
  );
}

export function hasAnyFilter(filters: NearbyFilters): boolean {
  return activeFilterCount(filters) > 0 || filters.q.trim() !== '';
}

export function toggleIn<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/** A stable cache key for a query. */
export function queryKey(prefix: string, query: object): string {
  const sorted = Object.entries(query)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : 1));
  return `${prefix}:${JSON.stringify(sorted)}`;
}
