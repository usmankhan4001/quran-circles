import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Icon,
  ListItem,
  SegmentedControl,
  SearchField,
  Sheet,
  Skeleton,
  Tag,
  Text,
  minTouchTarget,
  radii,
  screenGutter,
  spacing,
  useTheme,
} from '@qc/ui';
import { AreaPickerSheet } from '../components/AreaPickerSheet';
import { NearbyCircleCard } from '../components/NearbyCircleCard';
import { errorMessageKey } from '../core/errors';
import { DAY_KEYS } from '../core/format';
import { useAppConfig } from '../features/config/useAppConfig';
import { FiltersSheet } from '../features/nearby/ui/FiltersSheet';
import {
  activeFilterCount,
  emptyFilters,
  hasAnyFilter,
  type NearbyFilters,
} from '../features/nearby/filters';
import { markersFromSessions } from '../features/nearby/markers';
import { useOrigin } from '../features/nearby/useOrigin';
import { distanceParts, haversineMetres } from '../core/distance';
import { useSessionList } from '../features/nearby/useSessions';
import { useAreas, useCities } from '../features/places/usePlaces';
import { useI18n } from '../i18n/I18nProvider';
import { useNav } from '../nav/NavProvider';
import { usePreferences } from '../providers/hooks';
import { useServices } from '../providers/services';
import { useToast } from '../providers/Toasts';
import { PictureCard } from '../ui/PictureCard';
import { TabFrame } from '../ui/TabFrame';
import { describeWhenParts } from '../features/nearby/schedule';
import { describePortion } from '../features/session/portion';

const styles = StyleSheet.create({
  stack: { gap: spacing.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  list: { gap: spacing.md },
  carousel: { gap: spacing.md, paddingBottom: spacing.sm, paddingHorizontal: spacing.xxs },
  chipRow: { gap: spacing.sm, paddingVertical: spacing.xxs, alignItems: 'center' },
  active: { flexDirection: 'row', gap: spacing.sm },
  header: {
    paddingHorizontal: screenGutter,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  title: { flexShrink: 1 },
  switch: { width: 160 },
  place: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: minTouchTarget,
    paddingHorizontal: spacing.md + spacing.xxs,
    borderRadius: radii.pill,
  },
  selectedTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  grow: { flexShrink: 1 },
  selected: { gap: spacing.xs },
});

const NEAREST_WIDTH = 176;

/** The charcoal place chip that starts the chip row (D17): a pin and the city's name. */
function PlaceChip({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <Pressable
      role="button"
      testID="nearby-city"
      onPress={onPress}
      style={({ pressed }) => [
        styles.place,
        {
          backgroundColor: pressed ? c.ctaPressed : c.cta,
          ...(theme.mode === 'highContrast' ? { borderWidth: 1, borderColor: c.borderStrong } : {}),
        },
      ]}
    >
      <Icon name="pin" size={14} color={c.progress} />
      <Text variant="caption" color="textOnCta" strong>
        {label}
      </Text>
    </Pressable>
  );
}

type ViewMode = 'list' | 'map';

export function NearbyScreen() {
  const { t, l, locale } = useI18n();
  const nav = useNav();
  const toast = useToast();
  const { MapView } = useServices();
  const prefs = usePreferences();
  const config = useAppConfig();
  const cities = useCities();
  const areas = useAreas(prefs.cityId);
  const origin = useOrigin();

  const [local, setLocal] = useState<NearbyFilters>(emptyFilters);
  const filters: NearbyFilters = { ...local, cityId: prefs.cityId };
  const [mode, setMode] = useState<ViewMode>('list');
  const [showFilters, setShowFilters] = useState(false);
  const [showAreas, setShowAreas] = useState(false);
  const [showCities, setShowCities] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState<string | null>(null);

  const list = useSessionList(filters, { origin });
  const markers = useMemo(
    () =>
      markersFromSessions(list.items, locale, (count, first) =>
        count > 1 ? t('nearby.map.moreSessions', { count }) : first,
      ),
    [list.items, locale, t],
  );

  const selectedCity = cities.data?.find((c) => c.id === prefs.cityId);
  const distanceText = (to: { lat: number; lng: number }) => {
    if (!origin) return undefined;
    const parts = distanceParts(haversineMetres(origin, to), locale);
    return parts.unit === 'km'
      ? t('home.distance.km', { distance: parts.value })
      : t('home.distance.metres', { distance: parts.value });
  };
  const dayLabel =
    local.days.length > 0
      ? local.days.map((day) => t(DAY_KEYS[day] ?? 'days.sun')).join(t('schedule.separator'))
      : t('nearby.filters.day');
  const chooseCity = (cityId: string | null) => {
    void prefs.update({ cityId, areaId: null });
    setLocal((f) => ({ ...f, areaId: null }));
    setShowCities(false);
  };
  const selectedArea = areas.data?.find((a) => a.id === filters.areaId);
  const count = activeFilterCount(filters);
  const selectedSessions = list.items.filter((s) => s.venueId === selectedVenue);

  const clearFilters = () => setLocal({ ...emptyFilters });

  const sep = t('schedule.separator');
  const header = (
    <View testID="screen-header" style={styles.header}>
      <View style={styles.titleRow}>
        <View style={styles.title}>
          <Text variant="title2" heading={1}>
            {t('nearby.heading')}
          </Text>
        </View>
        <View style={styles.switch}>
          <SegmentedControl<ViewMode>
            accessibilityLabel={t('nearby.view.label')}
            value={mode}
            onChange={setMode}
            options={[
              { value: 'list', label: t('nearby.view.list') },
              { value: 'map', label: t('nearby.view.map') },
            ]}
            testID="nearby-view"
          />
        </View>
      </View>
      <SearchField
        accessibilityLabel={t('nearby.search.label')}
        placeholder={t('nearby.search.placeholder')}
        value={local.q}
        onChangeText={(q) => setLocal((f) => ({ ...f, q }))}
        testID="nearby-search"
      />
      {/* One row of chips under the search (N2, D17): the place in charcoal, then each filter;
          a filter that is on is an emerald pill with a cross to take it off. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
        testID="nearby-chips"
      >
        <PlaceChip
          label={selectedCity ? l(selectedCity.name).text : t('nearby.city.all')}
          onPress={() => setShowCities(true)}
        />
        <Chip
          label={selectedArea ? l(selectedArea.name).text : t('nearby.area.button')}
          selected={Boolean(selectedArea)}
          onPress={() => setShowAreas(true)}
          testID="nearby-area-button"
        />
        {local.timeBand || local.language || local.program ? (
          <View style={styles.active} testID="active-filters">
            {local.timeBand ? (
              <Chip
                label={t(`nearby.time.${local.timeBand}`)}
                selected
                onRemove={() => setLocal((f) => ({ ...f, timeBand: null }))}
              />
            ) : null}
            {local.language ? (
              <Chip
                label={t(`profile.language.${local.language}`)}
                selected
                onRemove={() => setLocal((f) => ({ ...f, language: null }))}
              />
            ) : null}
            {local.program ? (
              <Chip
                label={t(`programs.${local.program}`)}
                selected
                onRemove={() => setLocal((f) => ({ ...f, program: null }))}
              />
            ) : null}
          </View>
        ) : null}
        <Chip
          label={
            local.section
              ? t(`sections.${local.section}`)
              : `${t('nearby.filters.section')}: ${t('nearby.filters.any')}`
          }
          selected={Boolean(local.section)}
          onPress={() => setShowFilters(true)}
          {...(local.section ? { onRemove: () => setLocal((f) => ({ ...f, section: null })) } : {})}
          testID="nearby-section"
        />
        <Chip
          label={dayLabel}
          selected={local.days.length > 0}
          onPress={() => setShowFilters(true)}
          testID="nearby-day"
        />
        <Chip
          label={count > 0 ? t('nearby.filters.buttonCount', { count }) : t('nearby.filters.open')}
          onPress={() => setShowFilters(true)}
          testID="nearby-filters-button"
        />
      </ScrollView>
    </View>
  );

  return (
    <TabFrame header={header} testID="nearby-screen">
      <View style={styles.stack}>
        {list.offline ? (
          <Text variant="caption" color="textSecondary" testID="saved-copy-note">
            {t('app.savedCopy')}
          </Text>
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
          <EmptyState
            title={t('nearby.empty.title')}
            description={
              hasAnyFilter(filters) ? t('nearby.empty.withFilters') : t('nearby.empty.body')
            }
            {...(hasAnyFilter(filters)
              ? { action: { label: t('nearby.filters.clear'), onPress: clearFilters } }
              : {})}
            {...(config.featureFlags.circle_requests
              ? {
                  secondaryAction: {
                    label: t('nearby.request.action'),
                    onPress: () => toast.show(t('nearby.request.soon'), 'info'),
                  },
                }
              : {})}
            testID="nearby-empty"
          />
        ) : mode === 'map' ? (
          <View style={styles.stack}>
            <MapView
              markers={markers}
              selectedId={selectedVenue}
              onSelect={setSelectedVenue}
              {...(origin ? { center: origin } : {})}
              accessibilityLabel={t('nearby.map.label')}
              unavailableLabel={t('nearby.map.unavailable')}
            />
            {selectedVenue ? (
              <View style={styles.list} testID="map-selection">
                {selectedSessions.map((session) => {
                  const title = l(session.title);
                  const distance = distanceText(session.venue);
                  const place = l(session.venue.name).text;
                  const portion = session.nextOccurrence
                    ? describePortion(session.nextOccurrence, t, locale)
                    : null;
                  const when = describeWhenParts(session, t, locale, true);
                  return (
                    <Card key={session.id} testID={`map-selected-${session.id}`}>
                      <View style={styles.selected}>
                        <View style={styles.selectedTop}>
                          <View style={styles.grow}>
                            <Text variant="caption" color="textSuccess" strong>
                              {distance ? `${place}${sep}${distance}` : place}
                            </Text>
                          </View>
                          {portion ? <Tag label={portion} kind="gilt" /> : null}
                        </View>
                        <Text variant="title3" lang={title.lang}>
                          {title.text}
                        </Text>
                        <Text variant="caption" color="textSecondary">
                          {[when.day, when.time, t(`sections.${session.section}`)].join(sep)}
                        </Text>
                        <Button
                          variant="outline"
                          fullWidth
                          trailingIcon="arrow-forward"
                          label={t('nearby.map.openDetails')}
                          onPress={() => nav.go({ name: 'session', sessionId: session.id })}
                          testID={`map-open-${session.id}`}
                        />
                      </View>
                    </Card>
                  );
                })}
                <Button
                  variant="tertiary"
                  fullWidth
                  label={t('nearby.map.viewVenue')}
                  onPress={() => nav.go({ name: 'venue', venueId: selectedVenue })}
                />
              </View>
            ) : (
              <View style={styles.list}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.carousel}
                  testID="map-nearest"
                >
                  {markers.slice(0, 6).map((marker) => {
                    const distance = distanceText(marker);
                    return (
                      <PictureCard
                        key={marker.id}
                        seed={marker.id}
                        width={NEAREST_WIDTH}
                        title={marker.title}
                        {...(marker.subtitle ? { caption: marker.subtitle } : {})}
                        {...(distance ? { distance } : {})}
                        onPress={() => setSelectedVenue(marker.id)}
                        testID={`map-nearest-${marker.id}`}
                      />
                    );
                  })}
                </ScrollView>
                <Card variant="flat">
                  <Text variant="body" color="textSecondary">
                    {t('nearby.map.hint')}
                  </Text>
                </Card>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.list} testID="nearby-list">
            {list.items.map((session) => {
              const distance = distanceText(session.venue);
              return (
                <NearbyCircleCard
                  key={session.id}
                  session={session}
                  {...(distance ? { distance } : {})}
                  onPress={() => nav.go({ name: 'session', sessionId: session.id })}
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
            {/* Asking for a circle waits for the circle requests flag of the city browsed. */}
            {config.featureFlags.circle_requests ? (
              <Card testID="nearby-ask">
                <View style={styles.list}>
                  <Text variant="title3" heading={2}>
                    {t('nearby.ask.title')}
                  </Text>
                  <Text variant="body" color="textSecondary">
                    {t('nearby.ask.body')}
                  </Text>
                  <Button
                    variant="secondary"
                    label={t('nearby.ask.action')}
                    onPress={() => toast.show(t('nearby.request.soon'), 'info')}
                    testID="nearby-ask-action"
                  />
                </View>
              </Card>
            ) : null}
          </View>
        )}
      </View>

      <Sheet
        visible={showCities}
        onClose={() => setShowCities(false)}
        title={t('nearby.city.label')}
        testID="city-sheet"
      >
        <View role="radiogroup" aria-label={t('nearby.city.label')}>
          <ListItem
            title={t('nearby.city.all')}
            role="radio"
            checked={!prefs.cityId}
            chevron={false}
            onPress={() => chooseCity(null)}
            testID="city-option-all"
          />
          {(cities.data ?? []).map((city) => (
            <ListItem
              key={city.id}
              title={l(city.name).text}
              role="radio"
              checked={prefs.cityId === city.id}
              selected={prefs.cityId === city.id}
              chevron={false}
              onPress={() => chooseCity(city.id)}
              testID={`city-option-${city.id}`}
            />
          ))}
        </View>
      </Sheet>
      <AreaPickerSheet
        visible={showAreas}
        onClose={() => setShowAreas(false)}
        cityId={prefs.cityId}
        value={filters.areaId}
        allowAll
        onChange={(areaId) => setLocal((f) => ({ ...f, areaId }))}
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
