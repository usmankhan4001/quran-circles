import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Icon, Text, elevation, radii, spacing, useTheme } from '@qc/ui';
import type { Session } from '@qc/contracts';
import { useI18n } from '../i18n/I18nProvider';
import type { TFunction } from '../i18n/translate';
import { describeWhenParts } from '../features/nearby/schedule';
import { splitClock } from '../features/home/clock';
import { describePortion } from '../features/session/portion';
import { SectionIcon } from '../ui/SectionIcon';

export interface NextCircleCardProps {
  session: Session;
  /** The small line above the title: "Your next session". */
  eyebrow: string;
  /** Opens the session. */
  onPress: () => void;
  /** Opens the venue in the maps app. */
  onDirections: () => void;
  /** Opens the person's registration. Leave it out when they are not registered. */
  onRegistration?: () => void;
  /** Now, for the countdown. */
  now: Date;
  testID?: string;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "Starting now", "in 25 minutes", "in 3 hours", "in 2 days". Null with nothing dated. */
export function countdownText(
  startsAt: string | undefined,
  now: Date,
  t: TFunction,
): string | null {
  if (!startsAt) return null;
  const ms = new Date(startsAt).getTime() - now.getTime();
  if (Number.isNaN(ms)) return null;
  if (ms < MINUTE) return t('home.countdown.now');
  if (ms < HOUR) return t('home.countdown.minutes', { count: Math.floor(ms / MINUTE) });
  if (ms < DAY) return t('home.countdown.hours', { count: Math.floor(ms / HOUR) });
  return t('home.countdown.days', { count: Math.floor(ms / DAY) });
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.card, padding: spacing.lg, gap: spacing.md },
  top: { gap: spacing.xs },
  when: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: spacing.sm },
  clock: { flexDirection: 'row', alignItems: 'baseline', columnGap: spacing.xs },
  // A Latin "PM" stays to the right of the figures in Urdu too, as the formatter's isolate keeps
  // it in running text.
  latinClock: { direction: 'ltr' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
  },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  grow: { flexShrink: 1 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  button: { flexGrow: 1, flexBasis: 140 },
});

/**
 * "Your next circle" (H4): a white raised card that sits half on the green header. The start
 * time is large with the day and how long until it, then the portion being read and the
 * section, and two buttons: directions to the venue and the person's registration.
 */
export function NextCircleCard({
  session,
  eyebrow,
  onPress,
  onDirections,
  onRegistration,
  now,
  testID,
}: NextCircleCardProps) {
  const { t, l, locale } = useI18n();
  const theme = useTheme();
  const c = theme.colors;
  const title = l(session.title);
  const venue = l(session.venue.name);
  const when = describeWhenParts(session, t, locale, true);
  const countdown = countdownText(session.nextOccurrence?.startsAt, now, t);
  const portion = session.nextOccurrence
    ? describePortion(session.nextOccurrence, t, locale)
    : null;
  const section = t(`sections.${session.section}`);
  const dayLine = countdown ? `${when.day}${t('schedule.separator')}${countdown}` : when.day;
  // The figures large and the part of the day smaller beside them: "7:30 PM" in one large style
  // is wider than a phone at the largest text size, and "PM" wrapped onto its own line (A-10).
  const clock = splitClock(when.time);
  const period = clock.period ? (
    <Text
      variant="title2"
      color="textSecondary"
      testID="home-lead-period"
      decorative
      {...(clock.latinPeriod ? { lang: 'en' as const } : {})}
    >
      {clock.period}
    </Text>
  ) : null;
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: theme.mode === 'highContrast' ? c.borderStrong : c.border,
          boxShadow: theme.mode === 'light' ? elevation.medium : undefined,
        },
      ]}
    >
      <Pressable
        role="button"
        aria-label={[eyebrow, title.text, venue.text, when.time, dayLine, portion, section]
          .filter(Boolean)
          .join(', ')}
        testID={testID}
        onPress={onPress}
        style={styles.top}
      >
        <Text variant="eyebrow" color="textAccent" decorative>
          {eyebrow}
        </Text>
        <Text variant="title2" lang={title.lang} decorative>
          {title.text}
        </Text>
        <View style={styles.line}>
          <Icon name="pin" size={16} color={c.textSecondary} />
          <View style={styles.grow}>
            <Text variant="caption" color="textSecondary" lang={venue.lang} decorative>
              {venue.text}
            </Text>
          </View>
        </View>
        <View style={styles.when}>
          <View
            style={[styles.clock, clock.latinPeriod ? styles.latinClock : null]}
            testID="home-lead-time"
          >
            {clock.periodFirst ? period : null}
            <Text variant="countdown" testID="home-lead-clock" decorative>
              {clock.clock}
            </Text>
            {clock.periodFirst ? null : period}
          </View>
          <Text variant="label" color="textSecondary" testID="home-lead-countdown" decorative>
            {dayLine}
          </Text>
        </View>
      </Pressable>
      <View style={styles.chips}>
        {portion ? (
          <View
            style={[
              styles.chip,
              {
                backgroundColor: c.warningSubtle,
                borderWidth: 1,
                borderColor: theme.mode === 'highContrast' ? c.borderStrong : c.decoration,
              },
            ]}
            testID="home-lead-portion"
          >
            <Icon name="book" size={16} color={c.textOnWarningSubtle} />
            <Text variant="caption" color="textOnWarningSubtle" strong>
              {portion}
            </Text>
          </View>
        ) : null}
        <View
          style={[
            styles.chip,
            {
              backgroundColor: c.accentSubtle,
              borderWidth: 1,
              borderColor: theme.mode === 'highContrast' ? c.borderStrong : c.border,
            },
          ]}
          testID="home-lead-section"
        >
          <SectionIcon section={session.section} size={16} color={c.textOnAccentSubtle} />
          <Text variant="caption" color="textOnAccentSubtle" strong>
            {section}
          </Text>
        </View>
      </View>
      <View style={styles.buttons}>
        <View style={styles.button}>
          <Button
            variant="secondary"
            icon="route"
            label={t('venue.directions')}
            onPress={onDirections}
            fullWidth
            testID="home-lead-directions"
          />
        </View>
        <View style={styles.button}>
          {onRegistration ? (
            <Button
              variant="primary"
              icon="calendar"
              label={t('home.next.myRegistration')}
              onPress={onRegistration}
              fullWidth
              testID="home-lead-registration"
            />
          ) : (
            <Button
              variant="primary"
              label={t('home.nextSession.action')}
              onPress={onPress}
              fullWidth
              testID="home-lead-details"
            />
          )}
        </View>
      </View>
    </View>
  );
}
