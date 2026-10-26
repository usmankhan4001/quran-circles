import { distanceKm, inPakistan, median, type LatLng } from './coords';
import type { Resolution } from './resolve';

/** One venue (all circles that share a `venue_key`), as the location step sees it. */
export interface VenueInput {
  venueKey: string;
  city: string;
  /** Coordinates the file already carries (`map_lat`, `map_lng`), when both are there. */
  given: LatLng | null;
  /** Map links of the rows at this venue; the first that resolves wins. */
  links: readonly string[];
}

export type LocationStatus =
  | 'resolved' // a pin from the file or a map link, inside the city's usual spread
  | 'needs_geocoding' // no usable pin; a geocoder could try (owner picks the service)
  | 'needs_pin' // not imported until a coordinator pins it in the console
  | 'outlier'; // a pin far from the other venues of its city; not imported until checked

export interface VenueLocation {
  venueKey: string;
  city: string;
  status: LocationStatus;
  point: LatLng | null;
  source: 'file' | 'link' | 'page' | 'none';
  /** Why a venue is not `resolved`. Codes only, never cell text. */
  reason: string | null;
  /** Kilometres from the median pin of its city, when the check ran. */
  offsetKm: number | null;
}

export interface LocateOptions {
  /** A pin further than this from its city's median pin is an outlier. */
  maxOffsetKm?: number;
  /** Cities with fewer pins than this cannot be cross-checked against each other. */
  minPinsToCheck?: number;
  /** This many venues (distinct addresses) at one spot means a default or shared pin; none is trusted. */
  maxVenuesPerPin?: number;
}

export const DEFAULT_MAX_OFFSET_KM = 60;

/**
 * Picks one position per venue and checks it against the city. Coordinates are never invented:
 * a venue with no pin from the file or its links stays unlocated. A pin that is outside
 * Pakistan, or far from the median of its city's other pins (a Karachi address filed under
 * Sargodha, say), is flagged `outlier` and not treated as resolved.
 */
export function locateVenues(
  venues: readonly VenueInput[],
  resolutions: ReadonlyMap<string, Resolution>,
  {
    maxOffsetKm = DEFAULT_MAX_OFFSET_KM,
    minPinsToCheck = 3,
    maxVenuesPerPin = 2,
  }: LocateOptions = {},
): VenueLocation[] {
  const picked = venues.map((v): VenueLocation => {
    const base = { venueKey: v.venueKey, city: v.city, offsetKm: null };
    if (v.given) {
      return inPakistan(v.given)
        ? { ...base, status: 'resolved', point: v.given, source: 'file', reason: null }
        : {
            ...base,
            status: 'outlier',
            point: v.given,
            source: 'file',
            reason: 'outside_pakistan',
          };
    }
    let reason: string | null = v.links.length === 0 ? 'no_link' : null;
    for (const link of v.links) {
      const r = resolutions.get(link.trim());
      if (r?.ok)
        return {
          ...base,
          status: 'resolved',
          point: r.point,
          source: r.via === 'page' ? 'page' : 'link',
          reason: null,
        };
      reason = r ? r.reason : 'not_resolved';
    }
    // A link that is not a Google link, or a Google link with no position in it, cannot be
    // pinned by a tool; an address might be geocoded. No link at all: same.
    return { ...base, status: 'needs_geocoding', point: null, source: 'none', reason };
  });

  // Venues with different addresses do not share one pin. Two or more at the same spot (to about
  // a metre) means the source gave a default or the wrong link, not each venue's own position.
  const spots = new Map<string, VenueLocation[]>();
  for (const loc of picked) {
    if (loc.status !== 'resolved' || !loc.point) continue;
    const key = `${loc.point.lat.toFixed(5)},${loc.point.lng.toFixed(5)}`;
    spots.set(key, [...(spots.get(key) ?? []), loc]);
  }
  for (const group of spots.values()) {
    if (group.length < maxVenuesPerPin) continue;
    for (const loc of group) {
      loc.status = 'needs_geocoding';
      loc.point = null;
      loc.source = 'none';
      loc.reason = 'shared_pin';
    }
  }

  const byCity = new Map<string, VenueLocation[]>();
  for (const loc of picked) {
    if (loc.status === 'resolved') byCity.set(loc.city, [...(byCity.get(loc.city) ?? []), loc]);
  }
  for (const group of byCity.values()) {
    if (group.length < minPinsToCheck) continue;
    const centre = median(group.map((g) => g.point!));
    for (const loc of group) {
      const km = distanceKm(centre, loc.point!);
      loc.offsetKm = Math.round(km * 10) / 10;
      if (km > maxOffsetKm) {
        loc.status = 'outlier';
        loc.reason = 'far_from_city';
      }
    }
  }
  return picked;
}

export interface LocationCounts {
  venues: number;
  resolvedFromFile: number;
  resolvedFromLinks: number;
  needsGeocoding: number;
  needsPin: number;
  outliers: number;
  /** Cities whose pins were too few to cross-check. */
  citiesUnchecked: number;
}

export function countLocations(locs: readonly VenueLocation[], minPinsToCheck = 3): LocationCounts {
  const pins = new Map<string, number>();
  for (const l of locs)
    if (l.status === 'resolved' || l.reason === 'far_from_city')
      pins.set(l.city, (pins.get(l.city) ?? 0) + 1);
  return {
    venues: locs.length,
    resolvedFromFile: locs.filter((l) => l.status === 'resolved' && l.source === 'file').length,
    resolvedFromLinks: locs.filter((l) => l.status === 'resolved' && l.source !== 'file').length,
    needsGeocoding: locs.filter((l) => l.status === 'needs_geocoding').length,
    needsPin: locs.filter((l) => l.status === 'needs_pin').length,
    outliers: locs.filter((l) => l.status === 'outlier').length,
    citiesUnchecked: [...pins.values()].filter((n) => n < minPinsToCheck).length,
  };
}
