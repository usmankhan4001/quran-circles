import { distanceKm, inPakistan, type LatLng } from './coords';

export type GeocodeOutcome =
  | { ok: true; point: LatLng; locationType: string }
  | {
      ok: false;
      reason:
        | 'no_key'
        | 'request_failed'
        | 'denied'
        | 'no_result'
        | 'low_confidence'
        | 'far_from_city'
        | 'outside_pakistan';
      /** The best guess, for a person to look at. Never imported. */
      candidate?: LatLng;
    };

export interface GeocodeOptions {
  /** The Google Maps key. Read from the environment by the caller; never logged or written out. */
  key: string | undefined;
  fetchImpl?: typeof fetch;
  /** Largest distance from the city's own position. */
  maxCityKm?: number;
}

/** Only an exact or interpolated street match is trusted. APPROXIMATE and GEOMETRIC_CENTER are not. */
const TRUSTED_TYPES = new Set(['ROOFTOP', 'RANGE_INTERPOLATED']);

interface GoogleResult {
  geometry?: { location?: { lat: number; lng: number }; location_type?: string };
  partial_match?: boolean;
}
interface GoogleResponse {
  status: string;
  results?: GoogleResult[];
}

async function call(
  query: string,
  { key, fetchImpl = fetch }: GeocodeOptions,
): Promise<{ status: string; result?: GoogleResult } | 'failed'> {
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', query);
  url.searchParams.set('components', 'country:PK');
  url.searchParams.set('region', 'pk');
  url.searchParams.set('key', key ?? '');
  try {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return 'failed';
    const body = (await res.json()) as GoogleResponse;
    return { status: body.status, result: body.results?.[0] };
  } catch {
    return 'failed';
  }
}

const pointOf = (r: GoogleResult | undefined): LatLng | null => {
  const l = r?.geometry?.location;
  return l && Number.isFinite(l.lat) && Number.isFinite(l.lng) ? { lat: l.lat, lng: l.lng } : null;
};

/**
 * Geocodes "address, city, Pakistan" and accepts the answer only if it is high confidence:
 * an exact or interpolated street match, not a partial match, inside Pakistan, and close to the
 * city's own position (a second lookup of the city). Anything else comes back with a reason and,
 * where there is one, a candidate for a person to review; a candidate is never imported.
 */
export async function geocodeVenue(
  address: string,
  city: string,
  opts: GeocodeOptions,
): Promise<GeocodeOutcome> {
  if (!opts.key) return { ok: false, reason: 'no_key' };
  const found = await call(`${address}, ${city}, Pakistan`, opts);
  if (found === 'failed') return { ok: false, reason: 'request_failed' };
  if (found.status === 'REQUEST_DENIED' || found.status === 'OVER_QUERY_LIMIT')
    return { ok: false, reason: 'denied' };
  const point = pointOf(found.result);
  if (!point) return { ok: false, reason: 'no_result' };
  if (!inPakistan(point)) return { ok: false, reason: 'outside_pakistan', candidate: point };

  const cityCall = await call(`${city}, Pakistan`, opts);
  const centre = cityCall === 'failed' ? null : pointOf(cityCall.result);
  if (centre && distanceKm(centre, point) > (opts.maxCityKm ?? 40))
    return { ok: false, reason: 'far_from_city', candidate: point };

  const type = found.result?.geometry?.location_type ?? '';
  if (found.result?.partial_match || !TRUSTED_TYPES.has(type) || !centre)
    return { ok: false, reason: 'low_confidence', candidate: point };
  return { ok: true, point, locationType: type };
}
