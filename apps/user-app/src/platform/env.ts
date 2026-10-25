/**
 * Public configuration only. Anything here ships inside the app and the web page, so it must
 * be safe for anyone to read: addresses and restricted public keys, never secrets.
 */
export interface AppEnv {
  apiUrl: string;
  /** Restricted by app id and web origin in the Google console. Empty means the list-only map. */
  googleMapsKey: string;
  /** The public half of the web push key pair. Empty disables web push. */
  vapidPublicKey: string;
}

/** OpenStreetMap's own tiles: free and keyless, credited on the map as their licence asks. */
export const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const OSM_ATTRIBUTION = '© OpenStreetMap contributors';
export const OSM_COPYRIGHT_URL = 'https://www.openstreetmap.org/copyright';

/**
 * The street tiles drawn by the keyless map, used while there is no Google Maps key. Another
 * tile service can be set with `EXPO_PUBLIC_MAP_TILE_URL` (`{z}`, `{x}`, `{y}`, optional
 * `{s}`) and its credit line with `EXPO_PUBLIC_MAP_TILE_ATTRIBUTION`.
 */
export function readTileProvider(): { url: string; attribution: string } {
  const url = process.env.EXPO_PUBLIC_MAP_TILE_URL;
  if (!url) return { url: OSM_TILES, attribution: OSM_ATTRIBUTION };
  return { url, attribution: process.env.EXPO_PUBLIC_MAP_TILE_ATTRIBUTION ?? OSM_ATTRIBUTION };
}

export function readEnv(): AppEnv {
  return {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4010',
    googleMapsKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
    vapidPublicKey: process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY ?? '',
  };
}
