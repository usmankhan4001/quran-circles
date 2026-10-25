import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { IconButton, Text, elevation, radii, spacing, useTheme } from '@qc/ui';
import { useI18n } from '../../i18n/I18nProvider';
import { OSM_COPYRIGHT_URL, readTileProvider } from '../../platform/env';
import { canLocate, locate } from '../../platform/location';
import { useServices } from '../../providers/services';
import { MapPin } from '../../ui/MapPin';
import { ListOnlyMapView } from './ListOnlyMapView';
import {
  MAX_ZOOM,
  MIN_ZOOM,
  TILE_SIZE,
  clampZoom,
  fitView,
  panBy,
  tileUrl,
  tilesFor,
  toView,
  type LatLng,
} from './tiles';
import type { MapViewProps } from './types';

/** Pakistan, for a map with nothing on it yet. */
const COUNTRY = { center: { lat: 30.3753, lng: 69.3451 }, zoom: 5 };
/** The pin's touch area: at least the kit's 48 dp target. */
const PIN_BOX = 48;
/** After this many tiles fail with none drawn, the map is not reachable (offline, blocked). */
const FAILED_TILES = 4;

const styles = StyleSheet.create({
  wrap: { width: '100%', gap: spacing.xs },
  // Geography does not mirror: the drawing is always laid out left to right, also in Urdu.
  surface: { width: '100%', borderRadius: 12, overflow: 'hidden' },
  tile: { position: 'absolute', width: TILE_SIZE, height: TILE_SIZE },
  pin: {
    position: 'absolute',
    width: PIN_BOX,
    height: PIN_BOX + 8,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  dot: { position: 'absolute' },
  // The controls and the credit follow the reader's side.
  controls: { position: 'absolute', top: spacing.sm, end: spacing.sm, gap: spacing.xs },
  control: { borderRadius: radii.lg },
  credit: {
    position: 'absolute',
    bottom: 0,
    end: 0,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderTopStartRadius: 6,
  },
  note: { paddingHorizontal: spacing.xxs },
});

// On the web the page must not scroll or select text while a finger or mouse drags the map.
const web = {
  surface:
    Platform.OS === 'web'
      ? ({ touchAction: 'none', userSelect: 'none', cursor: 'grab', direction: 'ltr' } as object)
      : {},
};

/**
 * A real street map that needs no key: OpenStreetMap tiles drawn as plain images, with our own
 * pins on top, the person's area (or, when they ask, their position) and zoom buttons. It is
 * what the app shows until a Google Maps key is set, and on any phone or browser where Google's
 * map cannot load. Pins are buttons named with the place, so the map works with a screen reader
 * and a keyboard; the tiles themselves are decoration. Drag to move, buttons to zoom. If the
 * tiles cannot be fetched at all (offline), the list of places shows instead.
 */
export function TileMapView(props: MapViewProps) {
  const { markers, selectedId, onSelect, height = 280, accessibilityLabel } = props;
  const theme = useTheme();
  const c = theme.colors;
  const { t } = useI18n();
  const { openUrl } = useServices();
  const provider = useMemo(readTileProvider, []);

  // Until the real width is measured, a guess from the window avoids a blank first frame.
  const [width, setWidth] = useState(() =>
    Math.max(240, Math.round(Dimensions.get('window').width) - 40),
  );
  const [view, setView] = useState<{ center: LatLng; zoom: number } | null>(null);
  const [you, setYou] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [tilesDrawn, setTilesDrawn] = useState(0);
  const [tilesFailed, setTilesFailed] = useState(0);

  const origin = props.center ?? null;
  const fitTo = useCallback(
    (w: number) => {
      const places: LatLng[] = markers.map((m) => ({ lat: m.lat, lng: m.lng }));
      if (origin) places.push(origin);
      return fitView(places, w, height) ?? COUNTRY;
    },
    [markers, origin, height],
  );

  // Open on all the places, and again whenever the set of places changes (a new filter).
  const placesKey = markers.map((m) => `${m.id}:${m.lat},${m.lng}`).join('|');
  useEffect(() => {
    if (width > 0) setView(fitTo(width));
    // fitTo changes with every render of the markers array; the key says when they really did.
  }, [placesKey, width, height, origin?.lat, origin?.lng]);

  const viewRef = useRef(view);
  viewRef.current = view;
  const dragStart = useRef<LatLng | null>(null);
  const responder = useMemo(
    () =>
      PanResponder.create({
        // A tap stays a tap (on a pin); only a real drag moves the map.
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) + Math.abs(g.dy) > 6,
        onMoveShouldSetPanResponderCapture: (_e, g) => Math.abs(g.dx) + Math.abs(g.dy) > 6,
        onPanResponderGrant: () => {
          dragStart.current = viewRef.current?.center ?? null;
        },
        onPanResponderMove: (_e, g) => {
          const start = dragStart.current;
          const current = viewRef.current;
          if (!start || !current) return;
          setView({ zoom: current.zoom, center: panBy(start, current.zoom, g.dx, g.dy) });
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: () => {
          dragStart.current = null;
        },
      }),
    [],
  );

  const zoomBy = (step: number) =>
    setView((v) => (v ? { center: v.center, zoom: clampZoom(v.zoom + step) } : v));

  const findMe = async () => {
    setLocating(true);
    setNote(null);
    const result = await locate();
    setLocating(false);
    if (result.ok) {
      const here = { lat: result.lat, lng: result.lng };
      setYou(here);
      setView((v) => ({ center: here, zoom: Math.max(v?.zoom ?? 0, 14) }));
    } else {
      setNote(t(result.reason === 'denied' ? 'nearby.location.denied' : 'nearby.map.noLocation'));
    }
  };

  if (tilesFailed >= FAILED_TILES && tilesDrawn === 0) return <ListOnlyMapView {...props} />;

  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));
  const tiles = view && width > 0 ? tilesFor(view.center, view.zoom, width, height) : [];
  const inView = (p: { x: number; y: number }) =>
    p.x > -PIN_BOX && p.x < width + PIN_BOX && p.y > -PIN_BOX && p.y < height + PIN_BOX;
  const dot = (place: LatLng | null) =>
    place && view ? toView(place, view.center, view.zoom, width, height) : null;
  const area = dot(origin);
  const here = dot(you);
  const areaSize = 64;
  const hereSize = 18;

  return (
    <View style={styles.wrap} role="group" aria-label={accessibilityLabel} testID="map-tiles">
      <View
        style={[styles.surface, { height, backgroundColor: c.surfaceMuted }, web.surface]}
        onLayout={onLayout}
        testID="map-surface"
        {...responder.panHandlers}
      >
        <View
          aria-hidden
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, theme.mode === 'dark' ? { opacity: 0.82 } : null]}
        >
          {tiles.map((tile) => (
            <Image
              key={tile.key}
              source={{ uri: tileUrl(provider.url, tile) }}
              style={[styles.tile, { left: tile.left, top: tile.top }]}
              accessible={false}
              onLoad={() => setTilesDrawn((n) => n + 1)}
              onError={() => setTilesFailed((n) => n + 1)}
              testID="map-tile"
            />
          ))}
        </View>

        {area && inView(area) ? (
          <View
            aria-hidden
            pointerEvents="none"
            testID="map-origin"
            style={[
              styles.dot,
              {
                left: area.x - areaSize / 2,
                top: area.y - areaSize / 2,
                width: areaSize,
                height: areaSize,
                borderRadius: areaSize,
                backgroundColor: c.accentSubtle,
                borderWidth: 2,
                borderColor: c.hero,
                opacity: 0.7,
              },
            ]}
          />
        ) : null}

        {view
          ? markers.map((marker) => {
              const p = toView(marker, view.center, view.zoom, width, height);
              if (!inView(p)) return null;
              const selected = marker.id === selectedId;
              const name = [marker.title, marker.subtitle, marker.location]
                .filter(Boolean)
                .join(', ');
              return (
                <Pressable
                  key={marker.id}
                  role="button"
                  accessibilityLabel={name}
                  aria-selected={selected}
                  accessibilityState={{ selected }}
                  onPress={() => onSelect(marker.id)}
                  testID={`map-marker-${marker.id}`}
                  style={[
                    styles.pin,
                    { left: p.x - PIN_BOX / 2, top: p.y - PIN_BOX - 8, zIndex: selected ? 2 : 1 },
                  ]}
                >
                  <MapPin
                    count={marker.count ?? 1}
                    selected={selected}
                    testID={`map-pin-${marker.id}`}
                  />
                </Pressable>
              );
            })
          : null}

        {here && inView(here) ? (
          <View
            aria-hidden
            pointerEvents="none"
            testID="map-you"
            style={[
              styles.dot,
              {
                left: here.x - hereSize / 2,
                top: here.y - hereSize / 2,
                width: hereSize,
                height: hereSize,
                borderRadius: hereSize,
                backgroundColor: c.cta,
                borderWidth: 3,
                borderColor: c.surface,
                boxShadow: elevation.medium,
              },
            ]}
          />
        ) : null}

        <View style={[styles.controls, props.controlsInset ? { top: props.controlsInset } : null]}>
          {[
            {
              icon: 'plus' as const,
              label: t('nearby.map.zoomIn'),
              onPress: () => zoomBy(1),
              disabled: !view || view.zoom >= MAX_ZOOM,
              testID: 'map-zoom-in',
            },
            {
              icon: 'minus' as const,
              label: t('nearby.map.zoomOut'),
              onPress: () => zoomBy(-1),
              disabled: !view || view.zoom <= MIN_ZOOM,
              testID: 'map-zoom-out',
            },
            {
              icon: 'map-trifold' as const,
              label: t('nearby.map.showAll'),
              onPress: () => width > 0 && setView(fitTo(width)),
              disabled: !view,
              testID: 'map-show-all',
            },
            ...(canLocate()
              ? [
                  {
                    icon: 'navigation-arrow' as const,
                    label: t('nearby.location.use'),
                    onPress: () => void findMe(),
                    disabled: locating,
                    testID: 'map-locate',
                  },
                ]
              : []),
          ].map((control) => (
            <View
              key={control.testID}
              style={[styles.control, { backgroundColor: c.surface, boxShadow: elevation.medium }]}
            >
              <IconButton
                icon={control.icon}
                accessibilityLabel={control.label}
                onPress={control.onPress}
                disabled={control.disabled}
                loading={control.testID === 'map-locate' && locating}
                testID={control.testID}
              />
            </View>
          ))}
        </View>

        <Pressable
          role="link"
          accessibilityLabel={`${provider.attribution}, ${t('nearby.map.creditLink')}`}
          onPress={() => void openUrl(OSM_COPYRIGHT_URL)}
          style={[styles.credit, { backgroundColor: c.surface }]}
          testID="map-credit"
        >
          <Text variant="caption" color="textSecondary" lang="en" decorative>
            {provider.attribution}
          </Text>
        </Pressable>
      </View>
      {note ? (
        <View style={styles.note} aria-live="polite">
          <Text variant="caption" color="textSecondary" testID="map-note">
            {note}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
