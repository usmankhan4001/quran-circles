import { View } from 'react-native';
import type { AdminOccurrence } from '@qc/contracts';
import { Button, Card, SeatMeter, Tag, Text, formatNumber, spacing } from '@qc/ui';
import { useQuery } from '../../api/query';
import { useT } from '../../appearance/AppearanceProvider';
import { useApi } from '../../auth/AuthProvider';
import { QueryBoundary } from '../../components/QueryBoundary';
import { QuickAction } from '../../components/QuickAction';
import { Screen } from '../../components/Screen';
import { pickLocalized } from '../../lib/localized';
import { formatInstantDate, formatInstantTime, isToday, pkDayRange } from '../../lib/time';
import { useNavigation } from '../../navigation/NavigationContext';
import { routes } from '../../navigation/routes';
import { sessionAbilities } from '../../scope/principal';
import { useWorkingScope } from '../../scope/WorkingScopeProvider';
import { useSession } from './sessionDirectory';
import { whenSummary } from './sessionText';

export interface SessionScreenProps {
  sessionId: string;
  now?: Date;
  /** Changes when the screen comes back into view, so it loads again. */
  reloadKey?: number;
}

/** One session: what it is, what the person may do with it, and its coming dates. */
export function SessionScreen({ sessionId, now = new Date(), reloadKey = 0 }: SessionScreenProps) {
  const { t, locale } = useT();
  const api = useApi();
  const nav = useNavigation();
  const { principal } = useWorkingScope();
  const session = useSession(sessionId, reloadKey);
  const occurrences = useQuery(async () => {
    const res = await api.adminSessions.occurrences({
      params: { sessionId },
      query: { from: pkDayRange(now).from, limit: 14 },
    });
    return res.items;
  }, [sessionId, reloadKey]);

  return (
    <Screen
      title={session.data ? pickLocalized(session.data.title, locale) : t('admin.home.session')}
      subtitle={session.data ? pickLocalized(session.data.venue.name, locale) : undefined}
      onBack={nav.back}
      testID="session"
    >
      <QueryBoundary query={session} testID="session-data">
        {(s) => {
          const can = sessionAbilities(principal, s);
          const todayOccurrence = occurrences.data?.find((o) => isToday(o.startsAt, now));
          return (
            <View style={{ gap: spacing.lg }}>
              <Card>
                <View style={{ gap: spacing.sm }}>
                  <Text variant="label">{whenSummary(s, t, locale)}</Text>
                  <Text variant="caption" color="textSecondary">
                    {t(`admin.home.section.${s.section}`)} ·{' '}
                    {s.language === 'ur' ? 'اردو' : 'English'}
                  </Text>
                  {s.status === 'draft' ? <Tag label={t('admin.home.draft')} kind="gilt" /> : null}
                  {s.registration.capacity !== null ? (
                    <>
                      <SeatMeter
                        taken={s.registration.seatsTaken ?? 0}
                        capacity={s.registration.capacity}
                      />
                      <Text variant="caption" color="textSecondary">
                        {t('admin.home.seats', {
                          taken: formatNumber(s.registration.seatsTaken ?? 0, locale),
                          capacity: formatNumber(s.registration.capacity, locale),
                        })}
                      </Text>
                    </>
                  ) : null}
                </View>
              </Card>

              {can.seeRegistrants ? (
                <Button
                  testID="session-registrants"
                  label={
                    todayOccurrence ? t('admin.home.registrantsToday') : t('admin.home.registrants')
                  }
                  size="large"
                  fullWidth
                  onPress={() => nav.push(routes.registrants(s.id, todayOccurrence?.id))}
                />
              ) : null}
              <View style={{ gap: spacing.sm }}>
                {can.postUpdate ? (
                  <QuickAction
                    testID="session-post-update"
                    glyph="bell"
                    label={t('admin.home.postAbout')}
                    onPress={() => nav.push(routes.postUpdate(s.id))}
                  />
                ) : null}
                {can.changeSchedule ? (
                  <QuickAction
                    testID="session-change-time"
                    glyph="clock"
                    label={t('admin.home.changeTime')}
                    onPress={() => nav.push(routes.schedule(s.id))}
                  />
                ) : null}
              </View>

              <Text variant="title3" heading={2}>
                {t('admin.home.dates')}
              </Text>
              <QueryBoundary query={occurrences} testID="session-dates">
                {(items) =>
                  items.length === 0 ? (
                    <Text color="textSecondary">{t('admin.home.noDates')}</Text>
                  ) : (
                    <View style={{ gap: spacing.md }}>
                      {items.map((o) => (
                        <OccurrenceCard
                          key={o.id}
                          occurrence={o}
                          sessionId={s.id}
                          canMark={can.markAttendance}
                          canEdit={can.editOccurrence}
                        />
                      ))}
                    </View>
                  )
                }
              </QueryBoundary>
            </View>
          );
        }}
      </QueryBoundary>
    </Screen>
  );
}

function OccurrenceCard({
  occurrence: o,
  sessionId,
  canMark,
  canEdit,
}: {
  occurrence: AdminOccurrence;
  sessionId: string;
  canMark: boolean;
  canEdit: boolean;
}) {
  const { t, locale, n } = useT();
  const nav = useNavigation();
  const notes: string[] = [];
  if (o.status === 'cancelled') notes.push(t('admin.home.cancelled'));
  if (o.headcount !== null) notes.push(t('admin.home.headcount', { count: n(o.headcount) }));
  if (o.portionLabel) notes.push(o.portionLabel);
  return (
    <Card testID={`occurrence-${o.id}`}>
      <View style={{ gap: spacing.sm }}>
        <Text variant="label">
          {formatInstantDate(o.startsAt, locale)} · {formatInstantTime(o.startsAt, locale)}
        </Text>
        {o.status === 'cancelled' ? <Tag label={t('admin.home.cancelled')} kind="alert" /> : null}
        {notes.length > 0 ? (
          <Text variant="caption" color={o.status === 'cancelled' ? 'textDanger' : 'textSecondary'}>
            {notes.join(' · ')}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {canMark ? (
            <Button
              testID={`occurrence-${o.id}-attendance`}
              label={t('admin.home.attendance')}
              variant="secondary"
              onPress={() => nav.push(routes.attendance(sessionId, o.id))}
            />
          ) : null}
          {canEdit ? (
            <Button
              testID={`occurrence-${o.id}-edit`}
              label={t('admin.home.editOccurrence')}
              variant="tertiary"
              onPress={() => nav.push(routes.occurrence(sessionId, o.id))}
            />
          ) : null}
        </View>
      </View>
    </Card>
  );
}
