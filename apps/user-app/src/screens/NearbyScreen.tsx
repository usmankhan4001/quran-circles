import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Section } from '@qc/contracts';
import {
  Banner,
  Button,
  Card,
  Chip,
  EmptyState,
  Icon,
  ScreenHeader,
  SearchField,
  SegmentedControl,
  Skeleton,
  Text,
  TimeRow,
  spacing,
  useTheme,
} from '@qc/ui';
import { AreaPickerSheet } from '../components/AreaPickerSheet';
import { MapSelectionCards } from '../components/MapSelectionCard';
import { errorMessageKey } from '../core/errors';
import { useAppConfig } from '../features/config/useAppConfig';
import { splitClock } from '../features/home/clock';
import { FiltersSheet } from '../features/nearby/ui/FiltersSheet';
import {
  activeFilterCount,
  emptyFilters,
  hasAnyFilter,
  type NearbyFilters,
} from '../features/nearby/filters';
import { describeLocation, markersFromSessions } from '../features/nearby/markers';
import { useOrigin } from '../features/nearby/useOrigin';
import { distanceParts, haversineMetres } from '../core/distance';
import { useSessionList } from '../features/nearby/useSessions';
import { useAreas, useCities } from '../features/places/usePlaces';
import { useI18n } from '../i18n/I18nProvider';
import { useNav } from '../nav/NavProvider';
import { useOffline, usePreferences } from '../providers/hooks';
import { useServices } from '../providers/services';
import { ComingSoon } from '../ui/ComingSoon';
import { TabFrame } from '../ui/TabFrame';
import { describeWhenParts } from '../features/nearby/schedule';

const GUTTER = 20;
const SECTION_CHIPS: readonly Section[] = ['women', 'men', 'family'];

const styles = StyleSheet.create({
  gutter: { paddingHorizontal: GUTTER },
  head: { gap: spacing.md },
  body: { paddingHorizontal: GUTTER, paddingTop: spacing.lg, gap: spacing.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  list: { gap: spacing.md },
  area: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 32,
    alignSelf: 'flex-start',
  },
  selected: { gap: spacing.md },
  selectedTop: { gap: 2 },
  selectedRow: { flexDirection: 'row', gap: spacing.sm },
  grow: { flex: 1 },
  soonCentre: { alignSelf: 'center', justifyContent: 'center' },
});

type ViewMode = 'list' | 'map';

export function NearbyScreen() {
  const { t, l, locale } = useI18n();
  const nav = useNav();
  const { MapView } = useServices();
  const prefs = usePreferences();
  const config = useAppConfig();
  const cities = useCities();
  const areas = useAreas(prefs.cityId);
  const origin = useOrigin();
  const offline = useOffline();
  const c = useTheme().colors;

  const [local, setLocal] = useState<NearbyFilters>(emptyFilters);
  const filters: NearbyFilters = { ...local, cityId: prefs.cityId };
  const [mode, setMode] = useState<ViewMode>('list');
  const [showFilters, setShowFilters] = useState(false);
  const [showAreas, setShowAreas] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState<string | null>(null);

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

  const city = cities.data?.find((x) => x.id === prefs.cityId);
  const area = areas.data?.find((a) => a.id === prefs.areaId);
  const areaLabel = city
    ? area
      ? `${l(city.name).text} · ${l(area.name).text}`
      : l(city.name).text
    : t('home.area.choose');
  const count = activeFilterCount(filters);
  const selectedSessions = list.items.filter((s) => s.venueId === selectedVenue);
  const clearFilters = () => setLocal({ ...emptyFilters });
  const sep = t('schedule.separator');

  const header = (
    <View testID="screen-header" style={[styles.gutter, styles.head]}>
      <ScreenHeader
        title={t('nearby.title')}
        meta={areaLabel}
        metaAction={{
          label: t('home.area.change', { place: areaLabel }),
          onPress: () => setShowAreas(true),
          testID: 'nearby-area-button',
        }}
      />
      <SearchField
        accessibilityLabel={t('nearby.search.label')}
        placeholder={t('nearby.search.placeholder')}
        value={local.q}
        onChangeText={(q) => setLocal((f) => ({ ...f, q }))}
        testID="nearby-search"
      />
      <SegmentedControl<ViewMode>
        accessibilityLabel={t('nearby.view.label')}
        value={mode}
        onChange={setMode}
        options={[
          { value: 'map', label: t('nearby.view.map') },
          { value: 'list', label: t('nearby.view.list') },
        ]}
        testID="nearby-view"
      />
      <View style={styles.chips} role="group" aria-label={t('nearby.filters.section')}>
        {SECTION_CHIPS.map((s) => (
          <Chip
            key={s}
            label={t(`sections.${s}`)}
            selected={local.section === s}
            onPress={() => setLocal((f) => ({ ...f, section: f.section === s ? null : s }))}
            testID={`nearby-section-${s}`}
          />
        ))}
        <Chip
          label={t('nearby.tonight')}
          selected={local.timeBand === 'night'}
          onPress={() =>
            setLocal((f) => ({ ...f, timeBand: f.timeBand === 'night' ? null : 'night' }))
          }
          testID="nearby-tonight"
        />
        <Chip
          label={count > 0 ? t('nearby.filters.buttonCount', { count }) : t('nearby.filters.open')}
          onPress={() => setShowFilters(true)}
          testID="nearby-filters-button"
        />
      </View>
    </View>
  );

  const selection =
    selectedVenue && selectedSessions.length > 0 ? (
      <MapSelectionCards
        sessions={selectedSessions}
        distanceText={distanceText}
        venueId={selectedVenue}
      />
    ) : (
      <Text variant="caption" color="textMuted">
        {t('nearby.map.hint')}
      </Text>
    );

  return (
    <TabFrame header={header} testID="nearby-screen">
      <View style={styles.body}>
        {list.offline ? (
          <Banner kind="offline" title={t('app.savedCopy')} testID="saved-copy-note" />
        ) : null}

        {list.status === 'loading' ? (
          <View testID="loading">
            <Skeleton shape="block" height={120} announce />
          </View>
        ) : list.status === 'error' ? (
          <EmptyState
            icon="error"
            title={t(list.error?.code === 'network_error' ? 'ui.offlineTitle' : 'ui.errorTitle')}
            description={t(errorMessageKey(list.error?.code ?? 'unknown'))}
            action={{ label: t('ui.retry'), onPress: () => void list.refetch() }}
            testID="nearby-error"
          />
        ) : list.items.length === 0 ? (
          <View testID="nearby-empty">
            <EmptyState
              title={t('nearby.empty.title')}
              description={
                hasAnyFilter(filters) ? t('nearby.empty.withFilters') : t('nearby.empty.body')
              }
              {...(hasAnyFilter(filters)
                ? { action: { label: t('nearby.filters.clear'), onPress: clearFilters } }
                : {})}
            />
            {/* Requesting a circle is a later wave: drawn, but not built (owner, 25 Oct 2026). */}
            {config.featureFlags.circle_requests ? (
              <ComingSoon
                label={t('nearby.request.action')}
                style={styles.soonCentre}
                testID="nearby-request"
              />
            ) : null}
          </View>
        ) : mode === 'map' && !offline ? (
          <View style={styles.list}>
            {!origin ? (
              <Card variant="flat" testID="nearby-location-off">
                <View style={styles.list}>
                  <View style={styles.selectedRow}>
                    <Icon name="pin" size={20} color={c.textMuted} />
                    <View style={styles.grow}>
                      <Text variant="label">{t('nearby.location.offTitle')}</Text>
                      <Text variant="caption" color="textMuted">
                        {t('nearby.location.offBody')}
                      </Text>
                    </View>
                  </View>
                  <Button
                    variant="secondary"
                    label={t('nearby.location.chooseArea')}
                    onPress={() => setShowAreas(true)}
                    testID="nearby-choose-area"
                  />
                </View>
              </Card>
            ) : null}
            <MapView
              markers={markers}
              selectedId={selectedVenue}
              onSelect={setSelectedVenue}
              {...(origin ? { center: origin } : {})}
              accessibilityLabel={t('nearby.map.label')}
              unavailableLabel={t('nearby.map.unavailable')}
            />
            <Button
              variant="outline"
              icon="map-trifold"
              label={t('nearby.map.openFull')}
              fullWidth
              onPress={() => nav.go({ name: 'map' })}
              testID="nearby-open-full-map"
            />
            {selection}
          </View>
        ) : (
          <View testID="nearby-list">
            {mode === 'map' && offline ? (
              <Banner kind="offline" title={t('nearby.map.offline')} testID="map-offline" />
            ) : null}
            {list.items.map((session, i) => {
              const distance = distanceText(session.venue);
              const when = describeWhenParts(session, t, locale, true);
              const title = l(session.title);
              const venue = l(session.venue.name).text;
              return (
                <TimeRow
                  key={session.id}
                  title={venue}
                  subtitle={[when.day, t(`sections.${session.section}`), distance]
                    .filter(Boolean)
                    .join(sep)}
                  time={splitClock(when.time).clock}
                  divider={i < list.items.length - 1}
                  accessibilityLabel={[title.text, venue, when.day, when.time, distance]
                    .filter(Boolean)
                    .join(', ')}
                  onPress={() => nav.go({ name: 'session', sessionId: session.id })}
                  testID={`nearby-row-${session.id}`}
                />
              );
            })}
            {list.hasMore ? (
              <Button
                variant="secondary"
                fullWidth
                label={t('nearby.loadMore')}
                loading={list.loadingMore}
                onPress={() => void list.loadMore()}
                testID="nearby-load-more"
              />
            ) : null}
            {config.featureFlags.circle_requests ? (
              <Card testID="nearby-ask">
                <View style={styles.list}>
                  <Text variant="title3" heading={2}>
                    {t('nearby.ask.title')}
                  </Text>
                  <Text variant="body" color="textMuted">
                    {t('nearby.ask.body')}
                  </Text>
                  <ComingSoon label={t('nearby.ask.action')} testID="nearby-ask-action" />
                </View>
              </Card>
            ) : null}
          </View>
        )}
      </View>

      <AreaPickerSheet
        visible={showAreas}
        onClose={() => setShowAreas(false)}
        cityId={prefs.cityId}
        value={prefs.areaId}
        onCityChange={(cityId) => {
          void prefs.update({ cityId, areaId: null });
          setLocal((f) => ({ ...f, areaId: null }));
        }}
        onChange={(areaId) => void prefs.update({ areaId })}
      />
      <FiltersSheet
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        filters={filters}
        onChange={(next) => setLocal(next)}
        matching={list.status === 'success' && !list.hasMore ? list.items.length : null}
      />
    </TabFrame>
  );
}
