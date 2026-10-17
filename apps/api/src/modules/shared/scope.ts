import type { ScopeFilter } from '@qc/contracts';

/**
 * Whether a list scope (`ctx.scope(action)` for an `any` action) covers one record. Single-record
 * reads use it so they show exactly what the list would show.
 */
export const filterCovers = (
  filter: ScopeFilter,
  record: { cityId: string; venueId: string | null },
): boolean =>
  filter.national ||
  filter.cityIds.includes(record.cityId) ||
  (record.venueId !== null && filter.venueIds.includes(record.venueId));
