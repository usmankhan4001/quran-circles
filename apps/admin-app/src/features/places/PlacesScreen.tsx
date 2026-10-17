import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { can, type AdminCircle, type Venue } from '@qc/contracts';
import {
  Button,
  Card,
  EmptyState,
  Icon,
  SearchField,
  SegmentedControl,
  Tag,
  Text,
  spacing,
  useTheme,
  type TagKind,
} from '@qc/ui';
import { useQuery } from '../../api/query';
import { useT } from '../../appearance/AppearanceProvider';
import { useApi } from '../../auth/AuthProvider';
import { QueryBoundary } from '../../components/QueryBoundary';
import { VenueArt } from '../../components/VenueArt';
import { Screen } from '../../components/Screen';
import { ScopeSwitcher } from '../../components/ScopeSwitcher';
import { pickLocalized } from '../../lib/localized';
import { useNavigation } from '../../navigation/NavigationContext';
import { routes } from '../../navigation/routes';
import { useWorkingScope } from '../../scope/WorkingScopeProvider';

type Tab = 'venues' | 'circles';

/** Venues and circles in the working scope, with the way into each editor. */
export function PlacesScreen() {
  const { t } = useT();
  const [tab, setTab] = useState<Tab>('venues');
  return (
    <Screen title={t('admin.places.title')} testID="places">
      <ScopeSwitcher />
      <SegmentedControl
        accessibilityLabel={t('admin.places.title')}
        value={tab}
        onChange={setTab}
        options={[
          { value: 'venues', label: t('admin.places.venues') },
          { value: 'circles', label: t('admin.places.circles') },
        ]}
      />
      {tab === 'venues' ? <VenueList /> : <CircleList />}
    </Screen>
  );
}

function VenueList() {
  const { t, locale } = useT();
  const api = useApi();
  const nav = useNavigation();
  const { filter, principal, active } = useWorkingScope();
  const query = useQuery<VenueRows>(async () => {
    const [page, circleCounts] = await Promise.all([
      api.adminVenues.list({
        query: {
          ...(filter.cityId ? { cityId: filter.cityId } : {}),
          includeArchived: 'true',
          limit: 100,
        },
      }),
      // The count on each card is a nicety: the venues still show when it cannot load.
      api.adminCircles
        .list({ query: { ...filter, limit: 100 } })
        .then((circles) => {
          const counts: Record<string, number> = {};
          for (const c of circles.items) counts[c.venueId] = (counts[c.venueId] ?? 0) + 1;
          return counts;
        })
        .catch(() => null),
    ]);
    // A venue-scoped role works on that one venue even when the person holds others.
    const venues = filter.venueId ? page.items.filter((v) => v.id === filter.venueId) : page.items;
    return { venues, circleCounts };
  }, [filter.cityId, filter.venueId, active?.id]);
  const mayCreate = principal.assignments.some(
    (a) => a.role === 'national_admin' || a.role === 'city_coordinator',
  );
  const [search, setSearch] = useState('');
  return (
    <View style={{ gap: spacing.md }}>
      {mayCreate ? (
        <Button
          testID="places-new-venue"
          label={t('admin.places.newVenue')}
          icon="plus"
          variant="outline"
          fullWidth
          onPress={() => nav.push(routes.newVenue())}
        />
      ) : null}
      <QueryBoundary query={query} testID="places-venues">
        {({ venues, circleCounts }) =>
          venues.length === 0 ? (
            <EmptyState
              title={t('admin.places.noVenuesTitle')}
              description={t('admin.places.noVenuesBody')}
            />
          ) : (
            <View style={{ gap: spacing.md }}>
              <SearchField
                testID="places-venue-search"
                accessibilityLabel={t('admin.places.searchVenues')}
                placeholder={t('admin.places.searchVenues')}
                value={search}
                onChangeText={setSearch}
              />
              {matching(venues, (v) => pickLocalized(v.name, locale), search).map((v) => (
                <VenueCard
                  key={v.id}
                  testID={`venue-${v.id}`}
                  venueId={v.id}
                  title={pickLocalized(v.name, locale)}
                  detail={pickLocalized(v.address, locale)}
                  circles={
                    circleCounts
                      ? t.plural('admin.places.circleCount', circleCounts[v.id] ?? 0)
                      : undefined
                  }
                  tag={
                    v.status === 'archived'
                      ? { label: t('admin.places.archived'), kind: 'neutral' }
                      : undefined
                  }
                  onPress={() => nav.push(routes.venue(v.id))}
                />
              ))}
            </View>
          )
        }
      </QueryBoundary>
    </View>
  );
}

interface VenueRows {
  venues: Venue[];
  /** Circles per venue id, or null when the count could not be read. */
  circleCounts: Record<string, number> | null;
}

interface CircleRows {
  circles: AdminCircle[];
  venueNames: Record<string, string>;
}

function CircleList() {
  const { t, locale, n } = useT();
  const api = useApi();
  const nav = useNavigation();
  const { filter, principal, active } = useWorkingScope();
  const query = useQuery<CircleRows>(async () => {
    const [circles, venues] = await Promise.all([
      api.adminCircles.list({ query: { ...filter, limit: 100 } }),
      api.adminVenues.list({
        query: { ...(filter.cityId ? { cityId: filter.cityId } : {}), limit: 100 },
      }),
    ]);
    const venueNames: Record<string, string> = {};
    for (const v of venues.items) venueNames[v.id] = pickLocalized(v.name, locale);
    // Circles waiting for a decision come first.
    const circlesSorted = [...circles.items].sort(
      (a, b) => Number(b.status === 'pending_approval') - Number(a.status === 'pending_approval'),
    );
    return { circles: circlesSorted, venueNames };
  }, [filter.cityId, filter.venueId, active?.id, locale]);
  const mayCreate = principal.assignments.length > 0;
  const [search, setSearch] = useState('');
  return (
    <View style={{ gap: spacing.md }}>
      {mayCreate ? (
        <Button
          testID="places-new-circle"
          label={t('admin.places.newCircle')}
          icon="plus"
          variant="outline"
          fullWidth
          onPress={() => nav.push(routes.newCircle())}
        />
      ) : null}
      <QueryBoundary query={query} testID="places-circles">
        {({ circles, venueNames }) => {
          if (circles.length === 0) {
            return (
              <EmptyState
                title={t('admin.places.noCirclesTitle')}
                description={t('admin.places.noCirclesBody')}
              />
            );
          }
          const pending = circles.filter(
            (c) =>
              c.status === 'pending_approval' &&
              can(principal, 'circle.approve', { cityId: c.cityId, venueId: c.venueId }),
          ).length;
          return (
            <View style={{ gap: spacing.md }}>
              {pending > 0 ? (
                <Text testID="places-pending-count" variant="label" color="textWarning">
                  {t.plural('admin.places.needsDecision', pending, { count: n(pending) })}
                </Text>
              ) : null}
              <SearchField
                testID="places-circle-search"
                accessibilityLabel={t('admin.places.searchCircles')}
                placeholder={t('admin.places.searchCircles')}
                value={search}
                onChangeText={setSearch}
              />
              {matching(circles, (c) => pickLocalized(c.name, locale), search).map((c) => (
                <PlaceCard
                  key={c.id}
                  testID={`circle-${c.id}`}
                  title={pickLocalized(c.name, locale)}
                  detail={
                    c.status === 'pending_approval'
                      ? (venueNames[c.venueId] ?? '')
                      : `${venueNames[c.venueId] ?? ''} · ${t(`admin.circleEditor.status.${c.status}`)}`
                  }
                  tag={
                    c.status === 'pending_approval'
                      ? { label: t(`admin.circleEditor.status.${c.status}`), kind: 'gilt' }
                      : undefined
                  }
                  onPress={() => nav.push(routes.circle(c.id))}
                />
              ))}
            </View>
          );
        }}
      </QueryBoundary>
    </View>
  );
}

/** Narrows what is already loaded by name; it never asks the server again. */
function matching<T>(items: T[], nameOf: (item: T) => string, search: string): T[] {
  const needle = search.trim().toLocaleLowerCase();
  return needle ? items.filter((i) => nameOf(i).toLocaleLowerCase().includes(needle)) : items;
}

/**
 * A venue as a picture card, as drawn: the venue's art on top with its status tag, the name, the
 * address and how many circles meet there. The contract has no photo field yet, so the picture is
 * drawn venue art (`VenueArt`).
 */
function VenueCard({
  venueId,
  title,
  detail,
  circles,
  tag,
  onPress,
  testID,
}: {
  venueId: string;
  title: string;
  detail: string;
  circles?: string;
  tag?: { label: string; kind: TagKind };
  onPress: () => void;
  testID: string;
}): ReactNode {
  const { colors } = useTheme();
  const label = [title, detail, circles, tag?.label].filter(Boolean).join(', ');
  return (
    <Card testID={testID} onPress={onPress} accessibilityLabel={label} padding="none">
      <View>
        <VenueArt seed={venueId} testID={`${testID}-art`} />
        {tag ? (
          <View style={{ position: 'absolute', top: spacing.sm, start: spacing.sm }}>
            <Tag label={tag.label} kind={tag.kind} />
          </View>
        ) : null}
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          padding: spacing.lg,
        }}
      >
        <View style={{ flex: 1, gap: spacing.xxs }}>
          <Text variant="label">{title}</Text>
          <Text variant="caption" color="textSecondary">
            {detail}
          </Text>
          {circles ? (
            <Text variant="caption" color="textAccent">
              {circles}
            </Text>
          ) : null}
        </View>
        <Icon name="chevron-forward" size={20} color={colors.textSecondary} />
      </View>
    </Card>
  );
}

/** A circle row: name, a detail line, a status tag and an arrow into the editor. */
function PlaceCard({
  title,
  detail,
  tag,
  onPress,
  testID,
}: {
  title: string;
  detail: string;
  tag?: { label: string; kind: TagKind };
  onPress: () => void;
  testID: string;
}): ReactNode {
  const { colors } = useTheme();
  return (
    <Card testID={testID} onPress={onPress} accessibilityLabel={`${title}, ${detail}`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text variant="label">{title}</Text>
          <Text variant="caption" color="textSecondary">
            {detail}
          </Text>
          {tag ? <Tag label={tag.label} kind={tag.kind} /> : null}
        </View>
        <Icon name="chevron-forward" size={20} color={colors.textSecondary} />
      </View>
    </Card>
  );
}
