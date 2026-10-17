import { useState } from 'react';
import { View } from 'react-native';
import { can, type AdminCircle, type Venue } from '@qc/contracts';
import { Button, EmptyState, SegmentedControl, Text, spacing } from '@qc/ui';
import { useQuery } from '../../api/query';
import { useT } from '../../appearance/AppearanceProvider';
import { useApi } from '../../auth/AuthProvider';
import { QueryBoundary } from '../../components/QueryBoundary';
import { Screen } from '../../components/Screen';
import { SessionCard } from '../../components/SessionCard';
import { Tag } from '../../components/Tag';
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
  const query = useQuery<Venue[]>(async () => {
    const page = await api.adminVenues.list({
      query: {
        ...(filter.cityId ? { cityId: filter.cityId } : {}),
        includeArchived: 'true',
        limit: 100,
      },
    });
    // A venue-scoped role works on that one venue even when the person holds others.
    return filter.venueId ? page.items.filter((v) => v.id === filter.venueId) : page.items;
  }, [filter.cityId, filter.venueId, active?.id]);
  const mayCreate = principal.assignments.some(
    (a) => a.role === 'national_admin' || a.role === 'city_coordinator',
  );
  return (
    <View style={{ gap: spacing.md }}>
      {mayCreate ? (
        <Button
          testID="places-new-venue"
          label={t('admin.places.newVenue')}
          fullWidth
          onPress={() => nav.push(routes.newVenue())}
        />
      ) : null}
      <QueryBoundary query={query} testID="places-venues">
        {(venues) =>
          venues.length === 0 ? (
            <EmptyState
              title={t('admin.places.noVenuesTitle')}
              description={t('admin.places.noVenuesBody')}
            />
          ) : (
            <View style={{ gap: spacing.md }}>
              {venues.map((v) => (
                <SessionCard
                  key={v.id}
                  testID={`venue-${v.id}`}
                  title={pickLocalized(v.name, locale)}
                  detail={pickLocalized(v.address, locale)}
                  tag={
                    v.status === 'archived' ? (
                      <Tag label={t('admin.places.archived')} tone="neutral" />
                    ) : undefined
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
  return (
    <View style={{ gap: spacing.md }}>
      {mayCreate ? (
        <Button
          testID="places-new-circle"
          label={t('admin.places.newCircle')}
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
              {circles.map((c) => (
                <SessionCard
                  key={c.id}
                  testID={`circle-${c.id}`}
                  title={pickLocalized(c.name, locale)}
                  detail={
                    c.status === 'pending_approval'
                      ? (venueNames[c.venueId] ?? '')
                      : `${venueNames[c.venueId] ?? ''} · ${t(`admin.circleEditor.status.${c.status}`)}`
                  }
                  tag={
                    c.status === 'pending_approval' ? (
                      <Tag label={t(`admin.circleEditor.status.${c.status}`)} tone="warning" />
                    ) : undefined
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
