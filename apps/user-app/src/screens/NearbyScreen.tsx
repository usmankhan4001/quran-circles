import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  SegmentedControl,
  Select,
  Skeleton,
  Text,
  TextField,
  spacing,
} from '@qc/ui';
import { AreaPickerSheet } from '../components/AreaPickerSheet';
import { ProfileButton } from '../components/ProfileButton';
import { ScreenFrame } from '../components/ScreenFrame';
import { SessionCard } from '../components/SessionCard';
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
import { useSessionList } from '../features/nearby/useSessions';
import { useAreas, useCities } from '../features/places/usePlaces';
import { useI18n } from '../i18n/I18nProvider';
import { useNav } from '../nav/NavProvider';
import { usePreferences } from '../providers/hooks';
import { useServices } from '../providers/services';
import { useToast } from '../providers/Toasts';

const styles = StyleSheet.create({
  stack: { gap: spacing.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  grow: { flex: 1 },
  list: { gap: spacing.md },
});

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
  const [selectedVenue, setSelectedVenue] = useState<string | null>(null);

  const list = useSessionList(filters, { origin });
  const markers = useMemo(
    () =>
      markersFromSessions(list.items, locale, (count, first) =>
        count > 1 ? t('nearby.map.moreSessions', { count }) : first,
      ),
    [list.items, locale, t],
  );

  const cityOptions = [
    { value: '', label: t('nearby.city.all') },
    ...(cities.data ?? []).map((c) => ({ value: c.id, label: l(c.name).text })),
  ];
  const selectedArea = areas.data?.find((a) => a.id === filters.areaId);
  const count = activeFilterCount(filters);
  const selectedSessions = list.items.filter((s) => s.venueId === selectedVenue);

  const clearFilters = () => setLocal({ ...emptyFilters });

  return (
    <ScreenFrame
      title={t('tabs.nearby')}
      variant="large"
      actions={<ProfileButton />}
      testID="nearby-screen"
    >
      <View style={styles.stack}>
        <TextField
          label={t('nearby.search.label')}
          placeholder={t('nearby.search.placeholder')}
          value={local.q}
          onChangeText={(q) => setLocal((f) => ({ ...f, q }))}
          testID="nearby-search"
        />
        <Select
          label={t('nearby.city.label')}
          options={cityOptions}
          value={prefs.cityId ?? ''}
          onChange={(value) => {
            void prefs.update({ cityId: value === '' ? null : value, areaId: null });
            setLocal((f) => ({ ...f, areaId: null }));
          }}
          testID="nearby-city"
        />
        <View style={styles.row}>
          <View style={styles.grow}>
            <Button
              variant="secondary"
              fullWidth
              label={selectedArea ? l(selectedArea.name).text : t('nearby.area.button')}
              onPress={() => setShowAreas(true)}
              testID="nearby-area-button"
            />
          </View>
          <View style={styles.grow}>
            <Button
              variant="secondary"
              fullWidth
              label={
                count > 0 ? t('nearby.filters.buttonCount', { count }) : t('nearby.filters.open')
              }
              onPress={() => setShowFilters(true)}
              testID="nearby-filters-button"
            />
          </View>
        </View>

        {count > 0 ? (
          <View style={styles.chips} testID="active-filters">
            {selectedArea ? (
              <Chip
                label={l(selectedArea.name).text}
                onRemove={() => setLocal((f) => ({ ...f, areaId: null }))}
              />
            ) : null}
            {local.days.map((day) => (
              <Chip
                key={`day-${day}`}
                label={t(DAY_KEYS[day] ?? 'days.sun')}
                onRemove={() => setLocal((f) => ({ ...f, days: f.days.filter((d) => d !== day) }))}
              />
            ))}
            {local.timeBand ? (
              <Chip
                label={t(`nearby.time.${local.timeBand}`)}
                onRemove={() => setLocal((f) => ({ ...f, timeBand: null }))}
              />
            ) : null}
            {local.section ? (
              <Chip
                label={t(`sections.${local.section}`)}
                onRemove={() => setLocal((f) => ({ ...f, section: null }))}
              />
            ) : null}
            {local.language ? (
              <Chip
                label={t(`profile.language.${local.language}`)}
                onRemove={() => setLocal((f) => ({ ...f, language: null }))}
              />
            ) : null}
            {local.program ? (
              <Chip
                label={t(`programs.${local.program}`)}
                onRemove={() => setLocal((f) => ({ ...f, program: null }))}
              />
            ) : null}
          </View>
        ) : null}

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
                {selectedSessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    onPress={() => nav.go({ name: 'session', sessionId: session.id })}
                  />
                ))}
                <Button
                  variant="secondary"
                  fullWidth
                  label={t('nearby.map.viewVenue')}
                  onPress={() => nav.go({ name: 'venue', venueId: selectedVenue })}
                />
              </View>
            ) : (
              <Card variant="flat">
                <Text variant="body" color="textSecondary">
                  {t('nearby.map.hint')}
                </Text>
              </Card>
            )}
          </View>
        ) : (
          <View style={styles.list} testID="nearby-list">
            {list.items.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                emphasis="next"
                onPress={() => nav.go({ name: 'session', sessionId: session.id })}
              />
            ))}
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
          </View>
        )}
      </View>

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
      />
    </ScreenFrame>
  );
}
