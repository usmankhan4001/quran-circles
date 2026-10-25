import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useI18n } from '../i18n';
import {
  MAX_ZOOM,
  MIN_ZOOM,
  TILE_SIZE,
  clampZoom,
  panBy,
  tileUrl,
  tilesFor,
  type LatLng,
} from '../lib/map/tiles';
import { Icon } from './icons';
import { Button } from './ui';

const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const MAP_HEIGHT = 340;
/** Karachi, for a venue with no pin yet. */
const DEFAULT_CENTER: LatLng = { lat: 24.8607, lng: 67.0011 };
/** How far an arrow key moves the map, in view pixels. */
const KEY_STEP = 48;

const round = (n: number) => Number(n.toFixed(6));

export interface LocationPickerProps {
  /** Where the pin is now; null for a venue with none. */
  initial: LatLng | null;
  busy?: boolean;
  onUse(place: LatLng): void;
  onCancel(): void;
}

/**
 * Venue location: drag the map under a pin fixed in the middle, then "Use this location". The pin
 * is the map's centre rounded to six places (about 10 cm). No address search. Geography does not
 * mirror, so the map always lays out left to right. Arrow keys move the map and + and - zoom it,
 * so it works without a mouse.
 */
export function LocationPicker({ initial, busy = false, onUse, onCancel }: LocationPickerProps) {
  const { t } = useI18n();
  const [view, setView] = useState<{ center: LatLng; zoom: number }>({
    center: initial ?? DEFAULT_CENTER,
    zoom: initial ? 17 : 12,
  });
  const [width, setWidth] = useState(560);
  const surface = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ x: number; y: number; center: LatLng } | null>(null);

  const setSurface = (el: HTMLDivElement | null) => {
    surface.current = el;
    if (el && el.clientWidth > 0 && el.clientWidth !== width) setWidth(el.clientWidth);
  };
  const zoomBy = (step: number) =>
    setView((v) => ({ center: v.center, zoom: clampZoom(v.zoom + step) }));
  const moveBy = (dx: number, dy: number) =>
    setView((v) => ({ zoom: v.zoom, center: panBy(v.center, v.zoom, dx, dy) }));

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, center: view.center };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start) return;
    setView((v) => ({
      zoom: v.zoom,
      center: panBy(start.center, v.zoom, e.clientX - start.x, e.clientY - start.y),
    }));
  };
  const endDrag = () => {
    drag.current = null;
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [KEY_STEP, 0],
      ArrowRight: [-KEY_STEP, 0],
      ArrowUp: [0, KEY_STEP],
      ArrowDown: [0, -KEY_STEP],
    };
    const move = moves[e.key];
    if (move) {
      e.preventDefault();
      moveBy(move[0], move[1]);
    } else if (e.key === '+' || e.key === '=') zoomBy(1);
    else if (e.key === '-') zoomBy(-1);
  };

  const tiles = tilesFor(view.center, view.zoom, width, MAP_HEIGHT);
  return (
    <div className="location-picker">
      <div
        ref={setSurface}
        className="map-surface"
        style={{ blockSize: `${MAP_HEIGHT / 16}rem` }}
        role="application"
        tabIndex={0}
        aria-label={t('console.venues.location.mapLabel')}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        data-testid="venue-location-map"
      >
        <div className="map-tiles" aria-hidden="true">
          {tiles.map((tile) => (
            <img
              key={tile.key}
              className="map-tile"
              src={tileUrl(OSM_TILES, tile)}
              alt=""
              draggable={false}
              width={TILE_SIZE}
              height={TILE_SIZE}
              style={{ left: tile.left, top: tile.top }}
            />
          ))}
        </div>
        <span className="map-pin" aria-hidden="true">
          <Icon name="map-pin" size={40} weight="fill" />
        </span>
        <div className="map-zoom">
          <button
            type="button"
            className="map-zoom-btn"
            aria-label={t('console.venues.location.zoomIn')}
            disabled={view.zoom >= MAX_ZOOM}
            onClick={() => zoomBy(1)}
          >
            <Icon name="plus" size="sm" />
          </button>
          <button
            type="button"
            className="map-zoom-btn"
            aria-label={t('console.venues.location.zoomOut')}
            disabled={view.zoom <= MIN_ZOOM}
            onClick={() => zoomBy(-1)}
          >
            <span aria-hidden="true">−</span>
          </button>
        </div>
        <span className="map-credit">© OpenStreetMap</span>
      </div>
      <p className="field-hint">{t('console.venues.location.hint')}</p>
      <div className="form-actions">
        <Button
          variant="primary"
          busy={busy}
          onClick={() => onUse({ lat: round(view.center.lat), lng: round(view.center.lng) })}
        >
          <Icon name="check" size="sm" />
          {t('console.venues.location.use')}
        </Button>
        <Button onClick={onCancel} disabled={busy}>
          {t('console.shell.cancel')}
        </Button>
      </div>
    </div>
  );
}
