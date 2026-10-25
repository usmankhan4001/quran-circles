import type { LatLng } from './coords';

const ALPHABET = '23456789CFGHJMPQRVWX';
const PAIR_RESOLUTIONS = [20, 1, 0.05, 0.0025, 0.000125] as const;

/** Matches a full ("7JMW8VPR+2F") or short ("XWM6+G8R") Open Location Code inside free text. */
export const PLUS_CODE = /\b([23456789CFGHJMPQRVWX]{2,8})\+([23456789CFGHJMPQRVWX]{2,3})\b/i;

const indexOf = (ch: string): number => ALPHABET.indexOf(ch.toUpperCase());

/** Centre of a full code (the part before the plus sign has 8 characters). */
export function decodeFull(code: string): LatLng | null {
  const [head, tail] = code.split('+');
  if (!head || tail === undefined || head.length !== 8) return null;
  const digits = (head + tail).toUpperCase();
  let lat = -90;
  let lng = -180;
  let latRes = 0;
  let lngRes = 0;
  const pairs = Math.min(5, Math.floor(digits.length / 2));
  for (let p = 0; p < pairs; p++) {
    const a = indexOf(digits[p * 2]!);
    const b = indexOf(digits[p * 2 + 1]!);
    if (a < 0 || b < 0) return null;
    latRes = PAIR_RESOLUTIONS[p]!;
    lngRes = PAIR_RESOLUTIONS[p]!;
    lat += a * latRes;
    lng += b * lngRes;
  }
  if (digits.length > 10) {
    const g = indexOf(digits[10]!);
    if (g < 0) return null;
    latRes /= 5;
    lngRes /= 4;
    lat += Math.floor(g / 4) * latRes;
    lng += (g % 4) * lngRes;
  }
  return { lat: lat + latRes / 2, lng: lng + lngRes / 2 };
}

/** The first `n` characters (n even) of the code that covers a point. */
function prefixFor(point: LatLng, n: number): string {
  let lat = point.lat + 90;
  let lng = point.lng + 180;
  let out = '';
  for (let p = 0; p < n / 2; p++) {
    const res = PAIR_RESOLUTIONS[p]!;
    const a = Math.min(19, Math.floor(lat / res));
    const b = Math.min(19, Math.floor(lng / res));
    out += ALPHABET[a]! + ALPHABET[b]!;
    lat -= a * res;
    lng -= b * res;
  }
  return out;
}

/**
 * A short code names a spot inside a cell; the missing leading characters come from a reference
 * point (here, the median of the city's other pins). The nearest full code to the reference wins,
 * the standard way to recover one. The caller still checks the result against the city.
 */
export function recoverShort(code: string, reference: LatLng): LatLng | null {
  const [head, tail] = code.split('+');
  if (head === undefined || tail === undefined || head.length >= 8 || head.length % 2 !== 0)
    return null;
  const missing = 8 - head.length;
  const full = prefixFor(reference, missing) + head + '+' + tail;
  const centre = decodeFull(full);
  if (!centre) return null;
  const cell = PAIR_RESOLUTIONS[missing / 2 - 1]!;
  const half = cell / 2;
  const out = { ...centre };
  if (out.lat > reference.lat + half) out.lat -= cell;
  else if (out.lat < reference.lat - half) out.lat += cell;
  if (out.lng > reference.lng + half) out.lng -= cell;
  else if (out.lng < reference.lng - half) out.lng += cell;
  return out;
}

/** A position from the plus code in `text`, using `reference` for a short code. */
export function plusCodeToPoint(text: string, reference: LatLng | null): LatLng | null {
  const m = PLUS_CODE.exec(text);
  if (!m) return null;
  const code = `${m[1]!.toUpperCase()}+${m[2]!.toUpperCase()}`;
  if (m[1]!.length === 8) return decodeFull(code);
  return reference ? recoverShort(code, reference) : null;
}
