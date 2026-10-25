import { useMemo, useRef, useState } from 'react';
import {
  Image,
  PanResponder,
  Platform,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import {
  Banner,
  Button,
  Icon,
  IconButton,
  Text,
  TextField,
  radii,
  spacing,
  useTheme,
} from '@qc/ui';
import { useT } from '../../../appearance/AppearanceProvider';
import {
  MAX_ZOOM,
  MIN_ZOOM,
  TILE_SIZE,
  clampZoom,
  panBy,
  tileUrl,
  tilesFor,
  type LatLng,
} from './tiles';

const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const MAP_HEIGHT = 340;
/** Karachi, for a venue with no pin yet. */
const DEFAULT_CENTER: LatLng = { lat: 24.8607, lng: 67.0011 };

const styles = StyleSheet.create({
  surface: { width: '100%', borderRadius: radii.md, overflow: 'hidden' },
  tile: { position: 'absolute', width: TILE_SIZE, height: TILE_SIZE },
  pin: { position: 'absolute', alignItems: 'center' },
  controls: { position: 'absolute', top: spacing.sm, end: spacing.sm, gap: spacing.xs },
  credit: { position: 'absolute', bottom: 0, end: 0, paddingHorizontal: 6, paddingVertical: 2 },
});

// The page must not scroll or select text while a finger or mouse drags the map.
const web =
  Platform.OS === 'web'
    ? ({ touchAction: 'none', userSelect: 'none', cursor: 'grab', direction: 'ltr' } as object)
    : {};

export interface LocationPickerProps {
  /** Where the pin is now; null for a venue with none. */
  initial: LatLng | null;
  /** The venue's address as typed in the form, shown under the map. */
  address: string;
  onAddressChange: (address: string) => void;
  onUse: (place: LatLng) => void;
  onCancel: () => void;
}

/**
 * Venue location (design: Venue location): drag the map under a pin fixed in the middle, check
 * the address, then "Use this location". Geography does not mirror, so the map always lays out
 * left to right. The pin is the map's centre, rounded to six places (about 10 cm).
 */
export function LocationPicker({
  initial,
  address,
  onAddressChange,
  onUse,
  onCancel,
}: LocationPickerProps) {
  const { t } = useT();
  const { colors } = useTheme();
  const [width, setWidth] = useState(320);
  const [view, setView] = useState<{ center: LatLng; zoom: number }>({
    center: initial ?? DEFAULT_CENTER,
    zoom: initial ? 17 : 12,
  });
  const viewRef = useRef(view);
  viewRef.current = view;
  const dragStart = useRef<LatLng | null>(null);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          dragStart.current = viewRef.current.center;
        },
        onPanResponderMove: (_e, g) => {
          const start = dragStart.current;
          if (!start) return;
          const zoom = viewRef.current.zoom;
          setView({ zoom, center: panBy(start, zoom, g.dx, g.dy) });
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: () => {
          dragStart.current = null;
        },
      }),
    [],
  );

  const template = process.env.EXPO_PUBLIC_MAP_TILE_URL || OSM_TILES;
  const credit = process.env.EXPO_PUBLIC_MAP_TILE_ATTRIBUTION || '© OpenStreetMap';
  const tiles = tilesFor(view.center, view.zoom, width, MAP_HEIGHT);
  const zoomBy = (step: number) =>
    setView((v) => ({ center: v.center, zoom: clampZoom(v.zoom + step) }));
  const round = (n: number) => Number(n.toFixed(6));

  return (
    <View style={{ gap: spacing.lg }} testID="venue-location">
      <Text variant="title3" heading={2}>
        {t('admin.venueEditor.location.title')}
      </Text>
      <View
        style={[styles.surface, { height: MAP_HEIGHT, backgroundColor: colors.surfaceMuted }, web]}
        onLayout={(e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width))}
        role="img"
        aria-label={t('admin.venueEditor.location.mapLabel')}
        testID="venue-location-map"
        {...responder.panHandlers}
      >
        <View aria-hidden pointerEvents="none" style={StyleSheet.absoluteFill}>
          {tiles.map((tile) => (
            <Image
              key={tile.key}
              source={{ uri: tileUrl(template, tile) }}
              style={[styles.tile, { left: tile.left, top: tile.top }]}
              accessible={false}
            />
          ))}
        </View>
        <View
          aria-hidden
          pointerEvents="none"
          style={[styles.pin, { left: width / 2 - 20, top: MAP_HEIGHT / 2 - 40, width: 40 }]}
        >
          <Icon name="map-pin" weight="fill" size={40} color={colors.accent} />
        </View>
        <View style={styles.controls}>
          <View style={{ backgroundColor: colors.surface, borderRadius: radii.lg }}>
            <IconButton
              testID="venue-location-zoom-in"
              icon="plus"
              accessibilityLabel={t('admin.venueEditor.location.zoomIn')}
              disabled={view.zoom >= MAX_ZOOM}
              onPress={() => zoomBy(1)}
            />
          </View>
          <View style={{ backgroundColor: colors.surface, borderRadius: radii.lg }}>
            <IconButton
              testID="venue-location-zoom-out"
              icon="minus"
              accessibilityLabel={t('admin.venueEditor.location.zoomOut')}
              disabled={view.zoom <= MIN_ZOOM}
              onPress={() => zoomBy(-1)}
            />
          </View>
        </View>
        <View style={[styles.credit, { backgroundColor: colors.surface }]}>
          <Text variant="caption" color="textSecondary">
            {credit}
          </Text>
        </View>
      </View>
      <Banner kind="change" title={t('admin.venueEditor.location.hint')} />
      <TextField
        testID="venue-location-address"
        label={t('admin.venueEditor.address.label')}
        value={address}
        onChangeText={onAddressChange}
      />
      <View style={{ gap: spacing.sm }}>
        <Button
          testID="venue-location-use"
          label={t('admin.venueEditor.location.use')}
          icon="check"
          size="large"
          fullWidth
          onPress={() => onUse({ lat: round(view.center.lat), lng: round(view.center.lng) })}
        />
        <Button
          testID="venue-location-cancel"
          label={t('admin.common.cancel')}
          variant="tertiary"
          fullWidth
          onPress={onCancel}
        />
      </View>
    </View>
  );
}
