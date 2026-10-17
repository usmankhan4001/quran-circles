import { View } from 'react-native';
import type { Session } from '@qc/contracts';
import { EmptyState, IconButton, SessionCard, Text, isolate, spacing } from '@qc/ui';
import { useQuery } from '../../api/query';
import { useT } from '../../appearance/AppearanceProvider';
import { useApi, useAuth } from '../../auth/AuthProvider';
import { QueryBoundary } from '../../components/QueryBoundary';
import { Screen } from '../../components/Screen';
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
import { NextSessionCard } from './NextSessionCard';
import { whenSummary } from './sessionText';

export interface TodayScreenProps {
  /** The moment "today" is taken from. Tests pass a fixed one. */
  now?: Date;
}

/**
 * The first tab (layout A): the next session as a big card with four quick actions, then the
 * other sessions in the working scope, today's first.
 */
export function TodayScreen({ now = new Date() }: TodayScreenProps) {
  const { t, locale } = useT();
  const api = useApi();
  const nav = useNavigation();
  const { me } = useAuth();
  const { active, filter, principal } = useWorkingScope();

  const query = useQuery(async () => {
    const page = await api.adminSessions.list({ query: { ...filter, limit: 50 } });
    return page.items;
  }, [filter.cityId, filter.venueId, active?.id]);

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
      actions={
        canPostAnywhere(principal) ? (
          <IconButton
            testID="today-post-update"
            icon="bell"
            variant="onHero"
            accessibilityLabel={t('admin.home.postUpdate')}
            onPress={() => nav.push(routes.postUpdate())}
          />
        ) : undefined
      }
      testID="today"
    >
      <ScopeSwitcher />
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
          const next = nextOf(sessions);
          const rest = sessions.filter((s) => s !== next);
          const todays = rest.filter(
            (s) => s.nextOccurrence && isToday(s.nextOccurrence.startsAt, now),
          );
          const others = rest.filter((s) => !todays.includes(s));
          const nextIsToday = !!next?.nextOccurrence && isToday(next.nextOccurrence.startsAt, now);
          return (
            <View style={{ gap: spacing.lg }}>
              {next ? (
                <View style={{ gap: spacing.md }}>
                  <Text variant="title3" heading={2}>
                    {nextIsToday ? t('admin.home.todaySection') : t('admin.home.nextSection')}
                  </Text>
                  <NextSessionCard session={next} now={now} />
                  {nextIsToday ? todays.map((s) => row(s, false)) : null}
                </View>
              ) : null}
              {!nextIsToday && todays.length > 0 ? (
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
                    {todays.length > 0 || next
                      ? t('admin.home.otherSection')
                      : t('admin.home.allSection')}
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

/** The session whose next date comes first. Sessions with no coming date are never "next". */
export function nextOf(sessions: readonly Session[]): Session | null {
  let best: Session | null = null;
  for (const s of sessions) {
    if (!s.nextOccurrence || s.nextOccurrence.status === 'cancelled') continue;
    if (!best || s.nextOccurrence.startsAt < best.nextOccurrence!.startsAt) best = s;
  }
  return best;
}
