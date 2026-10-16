import type { Principal } from '@qc/contracts';
import { areas, cities, venues } from '@qc/contracts/fixtures';

/** Synthetic people for tests. Ids come from the contract fixtures; no real data. */
export const [rawalpindi, islamabad] = cities;
export const [venueA, venueB] = venues;

export const nationalAdmin: Principal = {
  userId: '00000000-0000-4000-8000-0a0000000001',
  assignments: [{ role: 'national_admin', cityId: null, venueId: null }],
};

export const cityCoordinator: Principal = {
  userId: '00000000-0000-4000-8000-0a0000000002',
  assignments: [{ role: 'city_coordinator', cityId: rawalpindi!.id, venueId: null }],
};

export const venueCoordinator: Principal = {
  userId: '00000000-0000-4000-8000-0a0000000003',
  assignments: [{ role: 'venue_coordinator', cityId: null, venueId: venueA!.id }],
};

export const areasOf = (cityId: string) => areas.filter((a) => a.cityId === cityId);
export const areasByCity = Object.fromEntries(cities.map((c) => [c.id, areasOf(c.id)]));
