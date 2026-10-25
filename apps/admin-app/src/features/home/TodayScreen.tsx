import { View } from 'react-native';
import type { Session } from '@qc/contracts';
import { EmptyState, Icon, IconButton, ListItem, SessionCard, Text, spacing } from '@qc/ui';
import { useQuery } from '../../api/query';
import { useT } from '../../appearance/AppearanceProvider';
import { useApi, useAuth } from '../../auth/AuthProvider';
import { QueryBoundary } from '../../components/QueryBoundary';
import { Screen } from '../../components/Screen';
import { ScopePill } from '../../components/ScopePill';
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
import { useWorkingScope } from '../../scope/WorkingScopeProvider';
import { TODAY_LIMIT, takeEarlyToday } from './earlyToday';
import { AttendanceTrend } from './AttendanceTrend';
import { NextSessionCard, QuickActions } from './NextSessionCard';
import { whenSummary } from './sessionText';

export interface TodayScreenProps {
  /** The moment "today" is taken from. Tests pass a fixed one. */
  now?: Date;
}

/**
 * The first tab (D17): the scope pill and the bell on the green header, the next session as a
 * white card half on it, quick actions two by two, then the other sessions in the working scope,
 * today's first.
 */
export function TodayScreen({ now = new Date() }: TodayScreenProps) {
  const { t, locale } = useT();
  const api = useApi();
  const nav = useNavigation();
  const { me } = useAuth();
  const { active, filter } = useWorkingScope();

  const query = useQuery(async () => {
    // Asked while the app was starting, for this person and this scope (earlyToday.ts)?
    const early = me ? takeEarlyToday(me.id, filter) : null;
    if (early) {
      try {
        return await early;
      } catch {
        // It failed: ask again here, which can refresh the sign-in.
      }
    }
    const page = await api.adminSessions.list({ query: { ...filter, limit: TODAY_LIMIT } });
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
        onPress={() => nav.push(routes.session(s.id))}
      />
    );
  };

  const sessions = query.data;
  const next = sessions ? nextOf(sessions) : null;

  return (
    <Screen
      eyebrow={formatLocalDate(pkDateOf(now), locale)}
      title={
        me?.displayName
          ? t('admin.home.greeting', { name: me.displayName })
          : t('admin.home.greetingPlain')
      }
      leading={<ScopePill />}
      actions={
        <IconButton
          testID="today-account"
          icon="user"
          variant="tonal"
          accessibilityLabel={t('admin.tabs.account')}
          onPress={() => nav.push(routes.account())}
        />
      }
      hero={next ? <NextSessionCard session={next} now={now} /> : null}
      testID="today"
    >
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
          return (
            <View style={{ gap: spacing.lg }}>
              {next ? <QuickActions session={next} /> : null}
              {next ? <AttendanceTrend session={next} now={now} /> : null}
              {next ? (
                <View style={{ gap: spacing.xs }}>
                  <Text variant="body" strong heading={2}>
                    {t('admin.home.tools')}
                  </Text>
                  <ListItem
                    testID="today-tool-daily-ayah"
                    title={t('admin.dailyAyah.title')}
                    subtitle={t('admin.dailyAyah.entry.action')}
                    leading={<Icon name="book" size={22} />}
                    onPress={() => nav.push(routes.dailyAyah({ venueId: next.venue.id }))}
                  />
                </View>
              ) : null}
              {todays.length > 0 ? (
                <View style={{ gap: spacing.md }}>
                  <Text variant="body" strong heading={2}>
                    {t('admin.home.todaySection')}
                  </Text>
                  {todays.map((s) => row(s, false))}
                </View>
              ) : null}
              {others.length > 0 ? (
                <View style={{ gap: spacing.md }}>
                  <Text variant="body" strong heading={2}>
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
