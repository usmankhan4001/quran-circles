import { useEffect } from 'react';
import { View } from 'react-native';
import type { Session } from '@qc/contracts';
import { Button, EmptyState, ListItem, Text, spacing } from '@qc/ui';
import { useQuery } from '../../api/query';
import { useT } from '../../appearance/AppearanceProvider';
import { useApi } from '../../auth/AuthProvider';
import { QueryBoundary } from '../../components/QueryBoundary';
import { Screen } from '../../components/Screen';
import { ScopeSwitcher } from '../../components/ScopeSwitcher';
import { pickLocalized } from '../../lib/localized';
import { formatLocalDate, isToday, pkDateOf } from '../../lib/time';
import { useNavigation } from '../../navigation/NavigationContext';
import { routes } from '../../navigation/routes';
import { canPostAnywhere } from '../post-update/scopes';
import { useWorkingScope } from '../../scope/WorkingScopeProvider';
import { useSessionDirectory } from './sessionDirectory';
import { nextOccurrenceText, whenSummary } from './sessionText';

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
  const { active, filter, principal } = useWorkingScope();

  const query = useQuery(
    async () => {
      const page = await api.adminSessions.list({ query: { ...filter, limit: 50 } });
      return page.items;
    },
    [filter.cityId, filter.venueId, active?.id],
  );

  useEffect(() => {
    if (query.data) dir.remember(query.data);
  }, [query.data, dir]);

  const row = (s: Session, withDate: boolean) => (
    <ListItem
      key={s.id}
      testID={`session-${s.id}`}
      title={pickLocalized(s.title, locale)}
      subtitle={`${pickLocalized(s.venue.name, locale)} · ${
        withDate ? (nextOccurrenceText(s, locale) ?? whenSummary(s, t, locale)) : whenSummary(s, t, locale)
      }`}
      trailing={
        s.status === 'draft' ? (
          <Text variant="caption" color="textSecondary">
            {t('admin.home.draft')}
          </Text>
        ) : undefined
      }
      divider
      onPress={() => nav.push(routes.session(s.id))}
    />
  );

  return (
    <Screen
      variant="large"
      title={t('admin.home.title')}
      subtitle={formatLocalDate(pkDateOf(now), locale)}
      testID="today"
    >
      <ScopeSwitcher />
      {canPostAnywhere(principal) ? (
        <Button
          testID="today-post-update"
          label={t('admin.home.postUpdate')}
          variant="secondary"
          fullWidth
          onPress={() => nav.push(routes.postUpdate())}
        />
      ) : null}
      <QueryBoundary query={query} testID="today">
        {(sessions) => {
          if (sessions.length === 0) {
            return <EmptyState title={t('admin.home.emptyTitle')} description={t('admin.home.emptyBody')} />;
          }
          const todays = sessions.filter(
            (s) => s.nextOccurrence && isToday(s.nextOccurrence.startsAt, now),
          );
          const others = sessions.filter((s) => !todays.includes(s));
          return (
            <View style={{ gap: spacing.lg }}>
              {todays.length > 0 ? (
                <View>
                  <Text variant="title3" heading={2}>
                    {t('admin.home.todaySection')}
                  </Text>
                  {todays.map((s) => row(s, false))}
                </View>
              ) : null}
              {others.length > 0 ? (
                <View>
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
