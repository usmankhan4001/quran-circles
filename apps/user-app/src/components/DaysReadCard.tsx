import { StyleSheet, View } from 'react-native';
import { Button, Card, Icon, Text, formatNumber, spacing, useTheme } from '@qc/ui';
import type { ReadingDayRecord } from '@qc/contracts';
import { errorMessageKey } from '../core/errors';
import { goalAmountText } from '../features/profile/readingSettings';
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
  rule: { height: 3, width: spacing.xxl, borderRadius: 2 },
});

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
export function DaysReadCard() {
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

  return (
    <Card testID="home-days-read">
      <View style={styles.stack}>
        <View style={[styles.rule, { backgroundColor: c.decoration }]} aria-hidden />
        <Text variant="eyebrow" color="textSecondary">
          {t('daysRead.title')}
        </Text>
        {status !== 'signedIn' ? (
          <>
            <Text variant="body">{t('daysRead.signedOut')}</Text>
            <Button
              variant="secondary"
              label={t('daysRead.signIn')}
              onPress={() => nav.go({ name: 'signIn', returnTo: { name: 'home' } })}
              testID="days-read-sign-in"
            />
          </>
        ) : (
          <QueryBoundary query={reading.query}>
            {() => {
              const summary = reading.summary;
              if (!summary) return null;
              const readToday = summary.todaySources.length > 0;
              const goalToday = summary.todaySources.includes('goal');
              return (
                <View style={styles.stack}>
                  <Text variant="title2" testID="days-read-week">
                    {t('daysRead.week', {
                      read: formatNumber(summary.week, locale),
                      total: formatNumber(7, locale),
                    })}
                  </Text>
                  <Text variant="body" color="textSecondary" testID="days-read-month">
                    {t('daysRead.month', { count: summary.month })}
                  </Text>
                  {readToday ? (
                    <CountedLine text={t('daysRead.countedToday')} testID="days-read-today-done" />
                  ) : (
                    <Button
                      label={t('daysRead.markToday')}
                      icon="check"
                      loading={record.running}
                      onPress={() => void send({ source: 'manual' })}
                      testID="days-read-mark"
                    />
                  )}
                  {goal ? (
                    <>
                      <Text variant="body" testID="days-read-goal">
                        {t('daysRead.goal', { goal: goalAmountText(goal, t) })}
                      </Text>
                      {goalToday ? (
                        <CountedLine
                          text={t('daysRead.goalMetDone')}
                          testID="days-read-goal-done"
                        />
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
                    </>
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
                  <Text variant="caption" color="textSecondary">
                    {t('daysRead.private')}
                  </Text>
                </View>
              );
            }}
          </QueryBoundary>
        )}
      </View>
    </Card>
  );
}
