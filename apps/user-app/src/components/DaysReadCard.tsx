import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Card, Icon, Text, formatNumber, radii, spacing, useTheme } from '@qc/ui';
import { addDays, type ReadingDay, type ReadingDayRecord } from '@qc/contracts';
import { errorMessageKey } from '../core/errors';
import { goalAmountText } from '../features/profile/readingSettings';
import { weekStart } from '../features/reading/days';
import { useReadingDays, useRecordReadingDay } from '../features/reading/hooks';
import { useI18n } from '../i18n/I18nProvider';
import { useNav } from '../nav/NavProvider';
import { useAuthState } from '../providers/hooks';
import { useToast } from '../providers/Toasts';
import { QueryBoundary } from './QueryBoundary';

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  done: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  grow: { flex: 1 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  pillHit: { minHeight: 48, justifyContent: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
  },
  goal: { gap: spacing.sm },
  week: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md + spacing.xxs,
    borderRadius: radii.section,
  },
  day: { alignItems: 'center', gap: spacing.sm, flex: 1 },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const DOT_KEYS = [
  'daysRead.dot.mon',
  'daysRead.dot.tue',
  'daysRead.dot.wed',
  'daysRead.dot.thu',
  'daysRead.dot.fri',
  'daysRead.dot.sat',
  'daysRead.dot.sun',
] as const;

/**
 * Monday to Sunday of this week as seven dots (D17): a read day is a green dot with a tick, any
 * other day the same plain dot, past or still to come. There is no streak and a day not read is
 * never marked as missed. The row is a picture of the "4 of 7" line, which screen readers read.
 */
function WeekDots({
  days,
  today,
  readToday,
}: {
  days: readonly ReadingDay[] | undefined;
  today: string;
  readToday: boolean;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const c = theme.colors;
  const monday = weekStart(today);
  const read = new Set((days ?? []).filter((d) => d.sources.length > 0).map((d) => d.date));
  if (readToday) read.add(today);
  return (
    <View
      aria-hidden
      style={[styles.week, { backgroundColor: c.surfaceMuted }]}
      testID="days-read-dots"
    >
      {DOT_KEYS.map((key, i) => {
        const date = addDays(monday, i);
        const done = read.has(date);
        return (
          <View key={key} style={styles.day} testID={done ? 'days-read-dot-done' : undefined}>
            <View
              style={[
                styles.dot,
                {
                  backgroundColor: done ? c.successSubtle : c.border,
                },
                theme.mode === 'highContrast'
                  ? { borderWidth: 1, borderColor: c.borderStrong }
                  : null,
              ]}
            >
              {done ? <Icon name="check" size={12} color={c.textSuccess} /> : null}
            </View>
            <Text variant="caption" strong decorative>
              {t(key)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function CountedLine({ text, testID }: { text: string; testID: string }) {
  const c = useTheme().colors;
  return (
    <View style={styles.done} testID={testID}>
      <Icon name="check" size={20} color={c.textAccent} />
      <View style={styles.grow}>
        <Text variant="body" color="textAccent">
          {text}
        </Text>
      </View>
    </View>
  );
}

/**
 * Days read (feature 1): "4 of 7 days this week" and the month's count, an "I read today" button
 * and, with a daily goal set, "I met today's goal". No streak, no missed-day words: a day that
 * was not read is simply not counted. Visible only to the person.
 */
function DaysReadCardContent() {
  const { t, locale } = useI18n();
  const nav = useNav();
  const c = useTheme().colors;
  const toast = useToast();
  const { status, me } = useAuthState();
  const reading = useReadingDays();
  const record = useRecordReadingDay();
  const goal = me?.profile.dailyGoal ?? null;

  const send = async (body: ReadingDayRecord) => {
    const outcome = await record.run(body);
    if (!outcome) return; // the error is shown below
    if (outcome.ok) toast.show(t('daysRead.countedToday'), 'success');
    else toast.show(t('daysRead.error.outOfRange'), 'warning');
  };

  const summary = status === 'signedIn' ? reading.summary : undefined;
  const readToday = summary ? summary.todaySources.length > 0 : false;
  const goalToday = summary ? summary.todaySources.includes('goal') : false;
  // The small pill at the end of the title row (D17): "+ I read today", then "Today is counted".
  const pill = !summary ? null : readToday ? (
    <View style={[styles.pill, { backgroundColor: c.accentSubtle }]} testID="days-read-today-done">
      <Icon name="check" size={14} color={c.textOnAccentSubtle} />
      <Text variant="caption" color="textOnAccentSubtle" strong>
        {t('daysRead.countedToday')}
      </Text>
    </View>
  ) : (
    <Pressable
      role="button"
      aria-label={t('daysRead.markToday')}
      aria-busy={record.running}
      disabled={record.running}
      onPress={() => void send({ source: 'manual' })}
      testID="days-read-mark"
      style={styles.pillHit}
    >
      {({ pressed }) => (
        <View style={[styles.pill, { backgroundColor: pressed ? c.border : c.surfaceMuted }]}>
          <Icon name="plus" size={14} color={c.text} />
          <Text variant="caption" strong decorative>
            {t('daysRead.markToday')}
          </Text>
        </View>
      )}
    </Pressable>
  );

  return (
    <View style={styles.stack} testID="home-days-read">
      <View style={styles.head}>
        <Text variant="title3" heading={2}>
          {t('daysRead.title')}
        </Text>
        {pill}
      </View>
      {status !== 'signedIn' ? (
        <Card variant="flat">
          <View style={styles.stack}>
            <Text variant="body">{t('daysRead.signedOut')}</Text>
            <Button
              variant="secondary"
              label={t('daysRead.signIn')}
              onPress={() => nav.go({ name: 'signIn', returnTo: { name: 'home' } })}
              testID="days-read-sign-in"
            />
          </View>
        </Card>
      ) : (
        <QueryBoundary query={reading.query}>
          {() => {
            if (!summary) return null;
            return (
              <View style={styles.stack}>
                <WeekDots days={reading.query.data} today={summary.today} readToday={readToday} />
                <Text variant="caption" color="textSecondary">
                  <Text variant="caption" strong testID="days-read-week">
                    {t('daysRead.week', {
                      read: formatNumber(summary.week, locale),
                      total: formatNumber(7, locale),
                    })}
                  </Text>
                  {t('schedule.separator')}
                  <Text variant="caption" color="textSecondary" testID="days-read-month">
                    {t('daysRead.month', { count: summary.month })}
                  </Text>
                </Text>
                {goal ? (
                  <View style={styles.goal}>
                    <Text variant="caption" testID="days-read-goal">
                      {t('daysRead.goal', { goal: goalAmountText(goal, t) })}
                    </Text>
                    {goalToday ? (
                      <CountedLine text={t('daysRead.goalMetDone')} testID="days-read-goal-done" />
                    ) : (
                      <Button
                        variant="secondary"
                        label={t('daysRead.goalMet')}
                        disabled={record.running}
                        onPress={() =>
                          void send({
                            source: 'goal',
                            ...(goal.unit === 'pages' ? { pages: goal.amount } : {}),
                          })
                        }
                        testID="days-read-goal-met"
                      />
                    )}
                  </View>
                ) : (
                  <Button
                    variant="tertiary"
                    label={t('daysRead.setGoal')}
                    onPress={() => nav.go({ name: 'profile' })}
                    testID="days-read-set-goal"
                  />
                )}
                {record.error ? (
                  <Text variant="caption" color="textDanger" testID="days-read-error">
                    {t(errorMessageKey(record.error.code))}
                  </Text>
                ) : null}
                <Text variant="caption" color="textMuted">
                  {t('daysRead.private')}
                </Text>
              </View>
            );
          }}
        </QueryBoundary>
      )}
    </View>
  );
}

/** It takes no props, so it draws again when its own data changes, not each time Home does. */
export const DaysReadCard = memo(DaysReadCardContent);
