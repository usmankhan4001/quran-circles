import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { Section } from '@qc/contracts';
import { Chip, IconButton, SearchField, spacing, useTheme } from '@qc/ui';
import { AreaPickerSheet } from '../components/AreaPickerSheet';
import { MapSelectionCards } from '../components/MapSelectionCard';
import { distanceParts, haversineMetres } from '../core/distance';
import { emptyFilters, type NearbyFilters } from '../features/nearby/filters';
import { describeLocation, markersFromSessions } from '../features/nearby/markers';
import { useOrigin } from '../features/nearby/useOrigin';
import { useSessionList } from '../features/nearby/useSessions';
import { useAreas, useCities } from '../features/places/usePlaces';
import { useI18n } from '../i18n/I18nProvider';
import { useNav } from '../nav/NavProvider';
import { usePreferences } from '../providers/hooks';
import { useInsets } from '../providers/insets';
import { useServices } from '../providers/services';

const SECTION_CHIPS: readonly Section[] = ['women', 'men', 'family'];

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: {
    position: 'absolute',
    start: 12,
    end: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  grow: { flex: 1 },
  chips: { position: 'absolute', start: 0, end: 0 },
  chipRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: 12 },
  locate: { position: 'absolute', end: 12 },
  card: { position: 'absolute', start: 12, end: 12, bottom: 12, maxHeight: '55%' },
});

/**
 * The whole screen is the map. A close button, a search field and filter chips float over the
 * top, a locate button sits at the end, and tapping a pin opens a card at the bottom with Join and
 * Details. "Locate" opens the area picker: the map is centred on the area, so no phone location
 * is read.
 */
export function FullMapScreen({ venueId }: { venueId?: string }) {
  const { t, l, locale } = useI18n();
  const nav = useNav();
  const { MapView } = useServices();
  const prefs = usePreferences();
  const cities = useCities();
  const areas = useAreas(prefs.cityId);
  const origin = useOrigin();
  const c = useTheme().colors;
  const insets = useInsets();
  const { height } = useWindowDimensions();
  const [local, setLocal] = useState<NearbyFilters>(emptyFilters);
  const filters: NearbyFilters = { ...local, cityId: prefs.cityId };
  const [selected, setSelected] = useState<string | null>(venueId ?? null);
  const [showAreas, setShowAreas] = useState(false);
  const list = useSessionList(filters, { origin });

  const distanceText = useCallback(
    (to: { lat: number; lng: number }) => {
      if (!origin) return undefined;
      const parts = distanceParts(haversineMetres(origin, to), locale);
      return parts.unit === 'km'
        ? t('home.distance.km', { distance: parts.value })
        : t('home.distance.metres', { distance: parts.value });
    },
    [origin, locale, t],
  );
  const markers = useMemo(
    () =>
      markersFromSessions(
        list.items,
        locale,
        (count, first) => (count > 1 ? t('nearby.map.moreSessions', { count }) : first),
        (venue) => {
          const area = areas.data?.find((a) => a.id === venue.areaId);
          const city = cities.data?.find((x) => x.id === venue.cityId);
          return describeLocation({
            area: area ? l(area.name).text : undefined,
            city: city ? l(city.name).text : undefined,
            distance: distanceText(venue),
            comma: t('schedule.separator'),
            separator: ' · ',
          });
        },
      ),
    [list.items, locale, t, l, areas.data, cities.data, distanceText],
  );
  const sessions = list.items.filter((s) => s.venueId === selected);
  const top = insets.top + 12;

  return (
    <View
      testID="full-map-screen"
      role="main"
      style={[styles.root, { backgroundColor: c.surfaceMuted }]}
    >
      <MapView
        markers={markers}
        selectedId={selected}
        onSelect={setSelected}
        {...(origin ? { center: origin } : {})}
        accessibilityLabel={t('map.full.label')}
        unavailableLabel={t('nearby.map.unavailable')}
        height={height}
        controlsInset={top + 116}
      />
      <View style={[styles.top, { top }]}>
        <IconButton
          icon="close"
          variant="tonal"
          accessibilityLabel={t('map.close')}
          onPress={() => nav.back()}
          testID="full-map-close"
        />
        <View style={styles.grow}>
          <SearchField
            accessibilityLabel={t('map.search')}
            placeholder={t('map.search')}
            value={local.q}
            onChangeText={(q) => setLocal((f) => ({ ...f, q }))}
            testID="full-map-search"
          />
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.chips, { top: top + 60 }]}
        contentContainerStyle={styles.chipRow}
        testID="full-map-chips"
      >
        <Chip
          label={t('nearby.tonight')}
          selected={local.timeBand === 'night'}
          onPress={() =>
            setLocal((f) => ({ ...f, timeBand: f.timeBand === 'night' ? null : 'night' }))
          }
          testID="full-map-tonight"
        />
        {SECTION_CHIPS.map((s) => (
          <Chip
            key={s}
            label={t(`sections.${s}`)}
            selected={local.section === s}
            onPress={() => setLocal((f) => ({ ...f, section: f.section === s ? null : s }))}
            testID={`full-map-section-${s}`}
          />
        ))}
      </ScrollView>
      <View style={[styles.locate, { bottom: selected ? '60%' : 24 }]}>
        <IconButton
          icon="pin"
          variant="tonal"
          accessibilityLabel={t('map.locate')}
          onPress={() => setShowAreas(true)}
          testID="full-map-locate"
        />
      </View>
      {selected && sessions.length > 0 ? (
        <View style={[styles.card, { bottom: 12 + insets.bottom }]}>
          <ScrollView>
            <MapSelectionCards sessions={sessions} distanceText={distanceText} venueId={selected} />
          </ScrollView>
        </View>
      ) : null}
      <AreaPickerSheet
        visible={showAreas}
        onClose={() => setShowAreas(false)}
        cityId={prefs.cityId}
        value={prefs.areaId}
        onCityChange={(cityId) => void prefs.update({ cityId, areaId: null })}
        onChange={(areaId) => void prefs.update({ areaId })}
      />
    </View>
  );
}
