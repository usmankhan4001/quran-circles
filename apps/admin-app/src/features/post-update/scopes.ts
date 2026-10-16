import { can, updatePostAction, type Principal, type ResourceScope } from '@qc/contracts';
import type { WorkingScope } from '../../scope/principal';

export type PostLevel = 'national' | 'city' | 'venue';

export interface CityChoice {
  id: string;
  label: string;
}

export interface VenueChoice {
  id: string;
  cityId: string;
  label: string;
}

export interface ScopeOptions {
  levels: PostLevel[];
  cities: CityChoice[];
  venues: VenueChoice[];
}

/** Anyone with a staff role can post to something: an admin to all, a city to its city, a venue to its venue. */
export function canPostAnywhere(principal: Principal): boolean {
  return principal.assignments.length > 0;
}

const resourceFor = (level: PostLevel, cityId: string | null, venueId: string | null): ResourceScope =>
  level === 'national' ? {} : level === 'city' ? { cityId } : { cityId, venueId };

/** Whether the person may post at this level, to this city or venue. The server checks again. */
export function canPostTo(
  principal: Principal,
  level: PostLevel,
  cityId: string | null,
  venueId: string | null,
): boolean {
  if (level === 'city' && !cityId) return false;
  if (level === 'venue' && !venueId) return false;
  return can(principal, updatePostAction(level), resourceFor(level, cityId, venueId));
}

/**
 * The places this person may post to, from the cities and venues the app has loaded. Levels
 * with nothing to choose are left out, so a venue coordinator is only ever offered their venue.
 */
export function buildScopeOptions(
  principal: Principal,
  cities: readonly CityChoice[],
  venues: readonly VenueChoice[],
): ScopeOptions {
  const allowedCities = cities.filter((c) => canPostTo(principal, 'city', c.id, null));
  const allowedVenues = venues.filter((v) => canPostTo(principal, 'venue', v.cityId, v.id));
  const levels: PostLevel[] = [];
  if (canPostTo(principal, 'national', null, null)) levels.push('national');
  if (allowedCities.length > 0) levels.push('city');
  if (allowedVenues.length > 0) levels.push('venue');
  return { levels, cities: allowedCities, venues: allowedVenues };
}

export interface ScopeChoice {
  level: PostLevel;
  cityId: string | null;
  venueId: string | null;
}

/** Opens on the level that matches the role the person is working as. */
export function defaultScopeChoice(active: WorkingScope | null, options: ScopeOptions): ScopeChoice {
  const first = <T extends { id: string }>(list: readonly T[], id?: string | null) =>
    list.find((x) => x.id === id) ?? list[0];
  const fallbackLevel = options.levels[0] ?? 'venue';
  let level: PostLevel = fallbackLevel;
  if (active?.role === 'venue_coordinator' && options.levels.includes('venue')) level = 'venue';
  else if (active?.role === 'city_coordinator' && options.levels.includes('city')) level = 'city';
  else if (active?.role === 'national_admin' && options.levels.includes('national')) level = 'national';
  return {
    level,
    cityId: level === 'city' ? (first(options.cities, active?.cityId)?.id ?? null) : null,
    venueId: level === 'venue' ? (first(options.venues, active?.venueId)?.id ?? null) : null,
  };
}
