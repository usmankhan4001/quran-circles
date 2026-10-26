export interface LatLng {
  lat: number;
  lng: number;
}

/** Pakistan, with a margin. A pin outside it is wrong whatever the city. */
export const PAKISTAN_BOX = { south: 23.4, north: 37.3, west: 60.7, east: 77.9 } as const;

const valid = (lat: number, lng: number): boolean =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

const NUM = '(-?\\d{1,3}\\.\\d+)';
/** Most exact first: the pinned place, then a query or the map centre. */
const PATTERNS: readonly RegExp[] = [
  new RegExp(`!3d${NUM}!4d${NUM}`),
  new RegExp(`[?&](?:q|ll|sll|query|destination|daddr)=${NUM}(?:,|%2C|\\+)\\s*${NUM}`),
  new RegExp(`@${NUM},${NUM}`),
  new RegExp(`[?&]center=${NUM}(?:,|%2C)${NUM}`),
];

/** Latitude and longitude written in a Google Maps address (or a snippet of its page). */
export function parseCoords(text: string): LatLng | null {
  let decoded = text;
  try {
    decoded = decodeURIComponent(text);
  } catch {
    // keep the raw text
  }
  for (const p of PATTERNS) {
    const m = p.exec(text) ?? p.exec(decoded);
    if (m) {
      const lat = Number(m[1]);
      const lng = Number(m[2]);
      if (valid(lat, lng)) return { lat, lng };
    }
  }
  return null;
}

/**
 * A bare "lat, lng" pair typed into a note. Only for notes: in a link a bare pair could be
 * anything, and a note is where people type coordinates by hand.
 */
export function parseBarePair(text: string): LatLng | null {
  const m = new RegExp(`(?<![\\d.])${NUM}\\s*[,;/\\s]\\s*${NUM}(?![\\d.])`).exec(text);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  return valid(lat, lng) ? { lat, lng } : null;
}

export const inPakistan = (p: LatLng): boolean =>
  p.lat >= PAKISTAN_BOX.south &&
  p.lat <= PAKISTAN_BOX.north &&
  p.lng >= PAKISTAN_BOX.west &&
  p.lng <= PAKISTAN_BOX.east;

export function distanceKm(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function median(points: readonly LatLng[]): LatLng {
  const mid = (xs: number[]) => {
    const s = [...xs].sort((x, y) => x - y);
    const n = s.length;
    return n % 2 ? s[(n - 1) / 2]! : (s[n / 2 - 1]! + s[n / 2]!) / 2;
  };
  return { lat: mid(points.map((p) => p.lat)), lng: mid(points.map((p) => p.lng)) };
}
