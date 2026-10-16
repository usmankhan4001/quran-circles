import type { PrayerPlace } from './calc';

/**
 * City centres for choosing a place by name, when the phone gives no location. Prayer times
 * differ by a few minutes across a city, which is within the margin of the calculation.
 */
export const PAKISTAN_CITIES: readonly (PrayerPlace & { id: string })[] = [
  { id: 'karachi', name: 'Karachi', latitude: 24.8607, longitude: 67.0011 },
  { id: 'lahore', name: 'Lahore', latitude: 31.5204, longitude: 74.3587 },
  { id: 'islamabad', name: 'Islamabad', latitude: 33.6844, longitude: 73.0479 },
  { id: 'rawalpindi', name: 'Rawalpindi', latitude: 33.5651, longitude: 73.0169 },
  { id: 'faisalabad', name: 'Faisalabad', latitude: 31.4504, longitude: 73.135 },
  { id: 'multan', name: 'Multan', latitude: 30.1575, longitude: 71.5249 },
  { id: 'peshawar', name: 'Peshawar', latitude: 34.0151, longitude: 71.5249 },
  { id: 'quetta', name: 'Quetta', latitude: 30.1798, longitude: 66.975 },
  { id: 'hyderabad', name: 'Hyderabad', latitude: 25.396, longitude: 68.3578 },
  { id: 'gujranwala', name: 'Gujranwala', latitude: 32.1877, longitude: 74.1945 },
  { id: 'sialkot', name: 'Sialkot', latitude: 32.4945, longitude: 74.5229 },
  { id: 'bahawalpur', name: 'Bahawalpur', latitude: 29.3956, longitude: 71.6836 },
  { id: 'abbottabad', name: 'Abbottabad', latitude: 34.1688, longitude: 73.2215 },
  { id: 'gilgit', name: 'Gilgit', latitude: 35.9208, longitude: 74.3144 },
];

/** Karachi, the default when nothing else is known. */
export const DEFAULT_PLACE: PrayerPlace = PAKISTAN_CITIES[0] as PrayerPlace;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** The listed city closest to a coordinate, by great-circle distance. */
export function nearestCity(latitude: number, longitude: number): PrayerPlace & { id: string } {
  let best = PAKISTAN_CITIES[0] as PrayerPlace & { id: string };
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const city of PAKISTAN_CITIES) {
    const dLat = toRad(city.latitude - latitude);
    const dLon = toRad(city.longitude - longitude);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(latitude)) * Math.cos(toRad(city.latitude)) * Math.sin(dLon / 2) ** 2;
    const distance = 2 * Math.asin(Math.sqrt(a));
    if (distance < bestDistance) {
      best = city;
      bestDistance = distance;
    }
  }
  return best;
}
