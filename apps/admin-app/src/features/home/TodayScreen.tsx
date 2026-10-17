import { useEffect } from 'react';
import { View } from 'react-native';
import type { Session } from '@qc/contracts';
import { EmptyState, SessionCard, Text, isolate, spacing } from '@qc/ui';
import { useQuery } from '../../api/query';
import { useT } from '../../appearance/AppearanceProvider';
import { useApi, useAuth } from '../../auth/AuthProvider';
import { QueryBoundary } from '../../components/QueryBoundary';
import { Screen } from '../../components/Screen';
import { QuickAction } from '../../components/QuickAction';
import { ScopeSwitcher } from '../../components/ScopeSwitcher';
import { pickLocalized } from '../../lib/localized';
import {
  formatInstantDate,
  formatInstantTime,
  formatLocalDate,
  formatLocalTime,
  isToday,
  pkDateOf,
} from '../../lib/time';
import { useNavigation } from '../../navigation/NavigationContext';
import { routes } from '../../navigation/routes';
import { canPostAnywhere } from '../post-update/scopes';
import { useWorkingScope } from '../../scope/WorkingScopeProvider';
import { useSessionDirectory } from './sessionDirectory';
import { whenSummary } from './sessionText';

export interface TodayScreenProps {
  /** The moment "today" is taken from. Tests pass a fixed one. */
  now?: Date;
}

/** The first tab: sessions in the working scope, with today's first. */
export function TodayScreen({ now = new Date() }: TodayScreenProps) {
  const { t, locale } = useT();
  const api = useApi();
  const nav = useNavigation();
  const dir = useSessionDirectory();
  const { me } = useAuth();
  const { active, filter, principal } = useWorkingScope();

  const query = useQuery(async () => {
    const page = await api.adminSessions.list({ query: { ...filter, limit: 50 } });
    return page.items;
  }, [filter.cityId, filter.venueId, active?.id]);

  useEffect(() => {
    if (query.data) dir.remember(query.data);
  }, [query.data, dir]);

  const row = (s: Session, withDate: boolean) => {
    const next = s.nextOccurrence;
    return (
      <SessionCard
        key={s.id}
        testID={`session-${s.id}`}
        title={pickLocalized(s.title, locale)}
        place={pickLocalized(s.venue.name, locale)}
        time={
          next
            ? formatInstantTime(next.startsAt, locale)
            : formatLocalTime(s.localStartTime, locale)
        }
        day={withDate && next ? formatInstantDate(next.startsAt, locale) : undefined}
        details={whenSummary(s, t, locale)}
        tag={s.status === 'draft' ? { label: t('admin.home.draft'), kind: 'gilt' } : undefined}
        seats={
          s.registration.capacity !== null
            ? { taken: s.registration.seatsTaken ?? 0, capacity: s.registration.capacity }
            : undefined
        }
        onPress={() => nav.push(routes.session(s.id))}
      />
    );
  };

  return (
    <Screen
      eyebrow={
        me?.displayName
          ? t('admin.home.greeting', { name: isolate(me.displayName) })
          : t('admin.home.greetingPlain')
      }
      title={t('admin.home.title')}
      subtitle={formatLocalDate(pkDateOf(now), locale)}
      testID="today"
    >
      <ScopeSwitcher />
      {canPostAnywhere(principal) ? (
        <QuickAction
          testID="today-post-update"
          glyph="bell"
          label={t('admin.home.postUpdate')}
          onPress={() => nav.push(routes.postUpdate())}
        />
      ) : null}
      <QueryBoundary query={query} testID="today-data">
        {(sessions) => {
          if (sessions.length === 0) {
            return (
              <EmptyState
                title={t('admin.home.emptyTitle')}
                description={t('admin.home.emptyBody')}
              />
            );
          }
          const todays = sessions.filter(
            (s) => s.nextOccurrence && isToday(s.nextOccurrence.startsAt, now),
          );
          const others = sessions.filter((s) => !todays.includes(s));
          return (
            <View style={{ gap: spacing.lg }}>
              {todays.length > 0 ? (
                <View style={{ gap: spacing.md }}>
                  <Text variant="title3" heading={2}>
                    {t('admin.home.todaySection')}
                  </Text>
                  {todays.map((s) => row(s, false))}
                </View>
              ) : null}
              {others.length > 0 ? (
                <View style={{ gap: spacing.md }}>
                  <Text variant="title3" heading={2}>
                    {todays.length > 0 ? t('admin.home.otherSection') : t('admin.home.allSection')}
                  </Text>
                  {others.map((s) => row(s, true))}
                </View>
              ) : null}
            </View>
          );
        }}
      </QueryBoundary>
    </Screen>
  );
}
