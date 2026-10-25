/**
 * Web Mercator arithmetic for the keyless tile map (`TileMapView`): where a place falls on the
 * world at a zoom level, which square tiles cover a view, and the zoom that fits a set of places.
 * Pure, so it is tested on its own.
 */

/** Tiles are 256 px squares; the whole world is one tile at zoom 0. */
export const TILE_SIZE = 256;
export const MIN_ZOOM = 3;
export const MAX_ZOOM = 18;
/** Mercator stops short of the poles. */
const MAX_LAT = 85.05112878;

export interface LatLng {
  lat: number;
  lng: number;
}
export interface Point {
  x: number;
  y: number;
}

const worldSize = (zoom: number) => TILE_SIZE * 2 ** zoom;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The pixel on the whole world map at this zoom (0,0 is the north-west corner). */
export function project({ lat, lng }: LatLng, zoom: number): Point {
  const size = worldSize(zoom);
  const sin = Math.sin((clamp(lat, -MAX_LAT, MAX_LAT) * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * size,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size,
  };
}

/** The place under a world pixel at this zoom. */
export function unproject({ x, y }: Point, zoom: number): LatLng {
  const size = worldSize(zoom);
  const n = Math.PI - (2 * Math.PI * clamp(y, 0, size)) / size;
  return {
    lat: (180 / Math.PI) * Math.atan(Math.sinh(n)),
    lng: (x / size) * 360 - 180,
  };
}

export interface Tile {
  /** Unique within one view; the same tile keeps its key while the map moves. */
  key: string;
  z: number;
  /** Wrapped into the world, for the tile address. */
  x: number;
  y: number;
  /** Where its top-left corner sits in the view. */
  left: number;
  top: number;
}

/** The tiles that cover a view of `width` × `height` centred on `center`. */
export function tilesFor(center: LatLng, zoom: number, width: number, height: number): Tile[] {
  if (width <= 0 || height <= 0) return [];
  const z = Math.round(zoom);
  const count = 2 ** z;
  const c = project(center, z);
  const originX = c.x - width / 2;
  const originY = c.y - height / 2;
  const x0 = Math.floor(originX / TILE_SIZE);
  const x1 = Math.floor((originX + width) / TILE_SIZE);
  const y0 = Math.max(0, Math.floor(originY / TILE_SIZE));
  const y1 = Math.min(count - 1, Math.floor((originY + height) / TILE_SIZE));
  const tiles: Tile[] = [];
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      tiles.push({
        key: `${z}/${tx}/${ty}`,
        z,
        x: ((tx % count) + count) % count,
        y: ty,
        left: tx * TILE_SIZE - originX,
        top: ty * TILE_SIZE - originY,
      });
    }
  }
  return tiles;
}

/** Where a place falls in a view centred on `center` (may be outside the view). */
export function toView(
  place: LatLng,
  center: LatLng,
  zoom: number,
  width: number,
  height: number,
): Point {
  const p = project(place, zoom);
  const c = project(center, zoom);
  return { x: p.x - c.x + width / 2, y: p.y - c.y + height / 2 };
}

/** The centre after dragging the map by `dx`, `dy` view pixels from `start`. */
export function panBy(start: LatLng, zoom: number, dx: number, dy: number): LatLng {
  const p = project(start, zoom);
  const next = unproject({ x: p.x - dx, y: p.y - dy }, zoom);
  return { lat: next.lat, lng: ((((next.lng + 180) % 360) + 360) % 360) - 180 };
}

/**
 * The centre and the largest whole zoom at which every place fits in the view, with `padding`
 * pixels kept clear at each side. One place (or none fitting) opens at `single`.
 */
export function fitView(
  places: readonly LatLng[],
  width: number,
  height: number,
  options: { padding?: number; single?: number; max?: number } = {},
): { center: LatLng; zoom: number } | null {
  if (places.length === 0) return null;
  const padding = options.padding ?? 48;
  const single = options.single ?? 14;
  const max = options.max ?? 16;
  const lats = places.map((p) => p.lat);
  const lngs = places.map((p) => p.lng);
  const north = Math.max(...lats);
  const south = Math.min(...lats);
  const east = Math.max(...lngs);
  const west = Math.min(...lngs);
  const nw = project({ lat: north, lng: west }, 0);
  const se = project({ lat: south, lng: east }, 0);
  const mid = unproject({ x: (nw.x + se.x) / 2, y: (nw.y + se.y) / 2 }, 0);
  const spanX = se.x - nw.x;
  const spanY = se.y - nw.y;
  if (spanX === 0 && spanY === 0) return { center: mid, zoom: single };
  const room = { x: Math.max(1, width - 2 * padding), y: Math.max(1, height - 2 * padding) };
  const zx = spanX > 0 ? Math.log2(room.x / spanX) : Infinity;
  const zy = spanY > 0 ? Math.log2(room.y / spanY) : Infinity;
  const zoom = clamp(Math.floor(Math.min(zx, zy)), MIN_ZOOM, max);
  return { center: mid, zoom };
}

/** Fills a tile address template: `{z}`, `{x}`, `{y}` and an optional `{s}` subdomain. */
export function tileUrl(template: string, tile: Pick<Tile, 'x' | 'y' | 'z'>): string {
  return template
    .replace('{s}', 'abc'[(tile.x + tile.y) % 3]!)
    .replace('{z}', String(tile.z))
    .replace('{x}', String(tile.x))
    .replace('{y}', String(tile.y));
}

export function clampZoom(zoom: number): number {
  return clamp(Math.round(zoom), MIN_ZOOM, MAX_ZOOM);
}
