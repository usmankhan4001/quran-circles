import { useState } from 'react';
import { View } from 'react-native';
import type { AdminOccurrence } from '@qc/contracts';
import { Button, Card, Icon, Tag, Text, radii, spacing, useTheme } from '@qc/ui';
import { useQuery } from '../../api/query';
import { useT } from '../../appearance/AppearanceProvider';
import { useApi } from '../../auth/AuthProvider';
import { PillButton } from '../../components/PillButton';
import { QueryBoundary } from '../../components/QueryBoundary';
import { QuickAction } from '../../components/QuickAction';
import { Screen } from '../../components/Screen';
import { pickLocalized } from '../../lib/localized';
import { formatInstantDate, formatInstantTime, isToday, pkDayRange } from '../../lib/time';
import { useNavigation } from '../../navigation/NavigationContext';
import { routes } from '../../navigation/routes';
import { sessionAbilities } from '../../scope/principal';
import { useWorkingScope } from '../../scope/WorkingScopeProvider';
import { posterAbilities } from '../posters/posters';
import { useSession } from './useSession';
import { whenSummary } from './sessionText';

export interface SessionScreenProps {
  sessionId: string;
  now?: Date;
  /** Changes when the screen comes back into view, so it loads again. */
  reloadKey?: number;
}

/** How many coming dates show before "Show all": a daily session would otherwise fill the screen. */
const FIRST_DATES = 5;

/**
 * One session: a card with the date that matters now (today's, or the next one), how many are
 * coming and the two everyday actions; then the other actions; then the coming dates as one
 * compact list, each with its portion (or that it is not set), the headcount and its shortcuts.
 */
export function SessionScreen({ sessionId, now = new Date(), reloadKey = 0 }: SessionScreenProps) {
  const { t, locale, n } = useT();
  const { colors } = useTheme();
  const api = useApi();
  const nav = useNavigation();
  const { principal } = useWorkingScope();
  const session = useSession(sessionId, reloadKey);
  const [allDates, setAllDates] = useState(false);
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
      <QueryBoundary query={session} testID="session-data" notFoundIsNotAvailable>
        {(s) => {
          const can = sessionAbilities(principal, s);
          const posters = posterAbilities(principal, s);
          const todayOccurrence = occurrences.data?.find((o) => isToday(o.startsAt, now));
          // The date the card is about: today's, else the next one that is not cancelled.
          const focus =
            todayOccurrence ?? occurrences.data?.find((o) => o.status !== 'cancelled') ?? null;
          const coming = s.registration.seatsTaken;
          return (
            <View style={{ gap: spacing.lg }}>
              <Card>
                <View style={{ gap: spacing.sm }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: spacing.xs,
                    }}
                  >
                    {s.status === 'cancelled' ? (
                      <Tag
                        label={t('admin.home.cancelled')}
                        kind="alert"
                        testID="session-cancelled"
                      />
                    ) : todayOccurrence ? (
                      <Tag label={t('admin.home.todaySection')} kind="ok" />
                    ) : focus ? (
                      <Tag label={t('admin.home.nextSection')} kind="neutral" />
                    ) : null}
                    {s.status === 'draft' ? (
                      <Tag label={t('admin.home.draft')} kind="gilt" />
                    ) : null}
                    {focus && s.status !== 'cancelled' ? (
                      <Tag
                        testID="session-focus-portion"
                        label={focus.portionLabel ?? t('admin.home.portionMissing')}
                        kind={focus.portionLabel ? 'gilt' : 'neutral'}
                      />
                    ) : null}
                  </View>
                  {focus ? (
                    <Text variant="title2" testID="session-focus-when">
                      {formatInstantDate(focus.startsAt, locale)} ·{' '}
                      {formatInstantTime(focus.startsAt, locale)}
                    </Text>
                  ) : null}
                  <Text
                    variant={focus ? 'caption' : 'label'}
                    color={focus ? 'textSecondary' : 'text'}
                  >
                    {whenSummary(s, t, locale)}
                  </Text>
                  <Text variant="caption" color="textSecondary">
                    {t(`admin.home.section.${s.section}`)} ·{' '}
                    {s.language === 'ur' ? 'اردو' : 'English'}
                  </Text>

                  {/* Only when the server gives a count, as on the home card. */}
                  {coming !== null ? (
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: spacing.xs,
                        paddingVertical: spacing.sm,
                        paddingHorizontal: spacing.md,
                        borderRadius: radii.md,
                        borderWidth: 1,
                        borderColor: colors.hairline,
                        backgroundColor: colors.surfaceMuted,
                      }}
                    >
                      <Icon
                        name="users-three"
                        weight="duotone"
                        size={15}
                        color={colors.textAccent}
                      />
                      <Text
                        testID="session-coming"
                        variant="caption"
                        color="textAccent"
                        strong
                        lang="en"
                      >
                        {n(coming)}
                      </Text>
                      <Text variant="caption" color="textAccent" strong>
                        {t('admin.home.coming')}
                      </Text>
                    </View>
                  ) : null}

                  {(can.markAttendance && focus) || can.seeRegistrants ? (
                    <View
                      style={{
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        gap: spacing.sm,
                        paddingTop: spacing.xxs,
                      }}
                    >
                      {can.markAttendance && focus ? (
                        <View style={{ flexGrow: 1.15, flexBasis: 120 }}>
                          <PillButton
                            testID="session-log-attendance"
                            icon="clipboard-text"
                            iconWeight="fill"
                            label={t('admin.home.logAttendance')}
                            tone="charcoal"
                            onPress={() => nav.push(routes.attendance(s.id, focus.id))}
                          />
                        </View>
                      ) : null}
                      {can.seeRegistrants ? (
                        <View style={{ flexGrow: 1, flexBasis: 110 }}>
                          <PillButton
                            testID="session-registrants"
                            icon="users-three"
                            label={
                              coming !== null
                                ? t('admin.home.registrantsCount', { count: n(coming) })
                                : todayOccurrence
                                  ? t('admin.home.registrantsToday')
                                  : t('admin.home.registrants')
                            }
                            onPress={() => nav.push(routes.registrants(s.id, todayOccurrence?.id))}
                          />
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              </Card>

              <View style={{ gap: spacing.sm }}>
                {can.postUpdate ? (
                  <QuickAction
                    testID="session-post-update"
                    icon="bell"
                    label={t('admin.home.postAbout')}
                    onPress={() => nav.push(routes.postUpdate(s.id))}
                  />
                ) : null}
                {can.changeSchedule ? (
                  <QuickAction
                    testID="session-change-time"
                    icon="clock"
                    label={t('admin.home.changeTime')}
                    onPress={() => nav.push(routes.schedule(s.id))}
                  />
                ) : null}
                {posters.read ? (
                  <QuickAction
                    testID="session-posters"
                    icon="share"
                    label={t('admin.posters.open')}
                    onPress={() => nav.push(routes.posters(s.id))}
                  />
                ) : null}
              </View>

              <Text variant="title3" heading={2}>
                {t('admin.home.dates')}
              </Text>
              <QueryBoundary query={occurrences} testID="session-dates">
                {(items) => {
                  if (items.length === 0)
                    return <Text color="textSecondary">{t('admin.home.noDates')}</Text>;
                  const shown = allDates ? items : items.slice(0, FIRST_DATES);
                  return (
                    <View style={{ gap: spacing.sm }}>
                      <Card padding="none">
                        {shown.map((o, i) => (
                          <OccurrenceRow
                            key={o.id}
                            occurrence={o}
                            sessionId={s.id}
                            canMark={can.markAttendance}
                            canEdit={can.editOccurrence}
                            now={now}
                            last={i === shown.length - 1}
                          />
                        ))}
                      </Card>
                      {!allDates && items.length > FIRST_DATES ? (
                        <Button
                          testID="session-all-dates"
                          variant="tertiary"
                          label={t('admin.home.allDates', { count: n(items.length) })}
                          onPress={() => setAllDates(true)}
                        />
                      ) : null}
                    </View>
                  );
                }}
              </QueryBoundary>
            </View>
          );
        }}
      </QueryBoundary>
    </Screen>
  );
}

/** One coming date: when, its state in words (today, cancelled, portion, headcount), shortcuts. */
function OccurrenceRow({
  occurrence: o,
  sessionId,
  canMark,
  canEdit,
  now,
  last,
}: {
  occurrence: AdminOccurrence;
  sessionId: string;
  canMark: boolean;
  canEdit: boolean;
  now: Date;
  last: boolean;
}) {
  const { t, locale, n } = useT();
  const { colors } = useTheme();
  const nav = useNavigation();
  const cancelled = o.status === 'cancelled';
  return (
    <View
      testID={`occurrence-${o.id}`}
      style={{
        gap: spacing.xs,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.hairline,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: spacing.xs,
        }}
      >
        <Text variant="label" style={{ flexGrow: 1 }}>
          {formatInstantDate(o.startsAt, locale)} · {formatInstantTime(o.startsAt, locale)}
        </Text>
        {cancelled ? (
          <Tag label={t('admin.home.cancelled')} kind="alert" />
        ) : (
          <>
            {isToday(o.startsAt, now) ? (
              <Tag
                label={t('admin.home.todaySection')}
                kind="ok"
                testID={`occurrence-${o.id}-today`}
              />
            ) : null}
            <Tag
              label={o.portionLabel ?? t('admin.home.portionMissing')}
              kind={o.portionLabel ? 'gilt' : 'neutral'}
            />
          </>
        )}
      </View>
      {o.headcount !== null ? (
        <Text variant="caption" color="textSecondary">
          {t('admin.home.headcount', { count: n(o.headcount) })}
        </Text>
      ) : null}
      {canMark || canEdit ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
          {canMark ? (
            <Button
              testID={`occurrence-${o.id}-attendance`}
              label={t('admin.home.attendance')}
              icon="clipboard-text"
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
      ) : null}
    </View>
  );
}
