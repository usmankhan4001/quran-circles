import type { Locale } from '@qc/contracts';
import { formatNumber } from '@qc/ui';

export interface LatLng {
  lat: number;
  lng: number;
}

/** The mean radius of the Earth in metres, as the haversine formula usually takes it. */
export const EARTH_RADIUS_METRES = 6_371_000;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/**
 * The great-circle distance between two points in metres (haversine). Worked out on the phone:
 * nothing about where the person is leaves it.
 */
export function haversineMetres(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METRES * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The distance from `origin` to the closest of `points`, or null when there are none. */
export function nearestMetres(origin: LatLng, points: readonly LatLng[]): number | null {
  let best: number | null = null;
  for (const point of points) {
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) continue;
    const d = haversineMetres(origin, point);
    if (best === null || d < best) best = d;
  }
  return best;
}

export interface DistanceParts {
  unit: 'metres' | 'km';
  /** The number, with the language's digits, ready to go into a translation. */
  value: string;
}

/**
 * How a distance is written: metres under 1 km (to the nearest 10 m), km with one decimal under
 * 10 km, whole km from 10 km. Digits follow the kit's numeral rule for the language.
 */
export function distanceParts(metres: number, locale: Locale): DistanceParts {
  const safe = Number.isFinite(metres) ? Math.max(0, metres) : 0;
  const tens = Math.max(10, Math.round(safe / 10) * 10);
  if (tens < 1000) return { unit: 'metres', value: formatNumber(tens, locale) };
  const km = safe / 1000;
  const tenths = Math.round(km * 10) / 10;
  if (tenths < 10) return { unit: 'km', value: formatNumber(tenths.toFixed(1), locale) };
  return { unit: 'km', value: formatNumber(Math.round(km), locale) };
}
