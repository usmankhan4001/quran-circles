import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Icon, Tag, Text, elevation, radii, spacing, useTheme } from '@qc/ui';
import type { Session } from '@qc/contracts';
import { useI18n } from '../i18n/I18nProvider';
import type { TFunction } from '../i18n/translate';
import { describeWhenParts } from '../features/nearby/schedule';
import { splitClock } from '../features/home/clock';
import { describePortion } from '../features/session/portion';

export interface NextCircleCardProps {
  session: Session;
  /** The small line above the title: "Your next session". */
  eyebrow: string;
  /** Opens the session. */
  onPress: () => void;
  /** Opens the venue in the maps app. */
  onDirections: () => void;
  /** How far the venue is from the chosen area ("0.8 km"). Left out without an area. */
  distance?: string;
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
  status: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  statusLine: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dot: { width: 8, height: 8, borderRadius: 4 },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  grow: { flexShrink: 1 },
  rule: { height: 1, marginTop: spacing.sm },
  when: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  whenStart: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    columnGap: spacing.sm,
    flexShrink: 1,
  },
  clock: { flexDirection: 'row', alignItems: 'baseline', columnGap: spacing.xs },
  // A Latin "PM" stays to the right of the figures in Urdu too, as the formatter's isolate keeps
  // it in running text.
  latinClock: { direction: 'ltr' },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  // As drawn: the main action a little wider than Directions (1 : 1.15).
  button: { flexGrow: 1, flexBasis: 120 },
  main: { flexGrow: 1.15, flexBasis: 138 },
});

/**
 * "Your next circle" (H4, D17): a white card that sits half on the green header. A status line
 * with a green dot and how long until it starts, the section on a tag at the end, the title, the
 * venue and how far it is, a hairline, then the start time (figures large, the part of the day
 * small, the day after) with the portion on an amber tag. Directions is a white pill; the main
 * action (the person's registration, or the session) is the charcoal pill with a forward arrow.
 */
export function NextCircleCard({
  session,
  eyebrow,
  onPress,
  onDirections,
  distance,
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
  const sep = t('schedule.separator');
  const status = countdown ? `${eyebrow}${sep}${countdown}` : eyebrow;
  const place = distance ? `${venue.text}${sep}${distance}` : venue.text;
  const dayLine = countdown ? `${when.day}${sep}${countdown}` : when.day;
  // The figures large and the part of the day smaller beside them: "7:30 PM" in one large style
  // is wider than a phone at the largest text size, and "PM" wrapped onto its own line (A-10).
  const clock = splitClock(when.time);
  const period = clock.period ? (
    <Text
      variant="label"
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
          borderColor: theme.mode === 'highContrast' ? c.borderStrong : c.hairline,
          boxShadow: theme.mode === 'light' ? elevation.medium : undefined,
        },
      ]}
    >
      <Pressable
        role="button"
        aria-label={[eyebrow, title.text, place, when.time, dayLine, portion, section]
          .filter(Boolean)
          .join(', ')}
        testID={testID}
        onPress={onPress}
        style={styles.top}
      >
        <View style={styles.status}>
          <View style={styles.statusLine}>
            <View style={[styles.dot, { backgroundColor: c.progress }]} aria-hidden />
            <View style={styles.grow}>
              <Text
                variant="caption"
                color="textAccent"
                strong
                decorative
                testID="home-lead-countdown"
              >
                {status}
              </Text>
            </View>
          </View>
          <View testID="home-lead-section" aria-hidden>
            <Tag label={section} kind="neutral" />
          </View>
        </View>
        <Text variant="title3" lang={title.lang} decorative>
          {title.text}
        </Text>
        <View style={styles.line}>
          <Icon name="pin" size={16} color={c.textSecondary} />
          <View style={styles.grow}>
            <Text variant="caption" color="textSecondary" lang={venue.lang} decorative>
              {place}
            </Text>
          </View>
        </View>
        <View style={[styles.rule, { backgroundColor: c.hairline }]} aria-hidden />
        <View style={styles.when}>
          <View style={styles.whenStart}>
            <View
              style={[styles.clock, clock.latinPeriod ? styles.latinClock : null]}
              testID="home-lead-time"
            >
              {clock.periodFirst ? period : null}
              <Text variant="title1" testID="home-lead-clock" decorative>
                {clock.clock}
              </Text>
              {clock.periodFirst ? null : period}
            </View>
            <Text variant="caption" color="textMuted" testID="home-lead-day" decorative>
              {when.day}
            </Text>
          </View>
          {portion ? (
            <View testID="home-lead-portion" aria-hidden>
              <Tag label={portion} kind="gilt" />
            </View>
          ) : null}
        </View>
      </Pressable>
      <View style={styles.buttons}>
        <View style={styles.button}>
          <Button
            variant="outline"
            icon="route"
            label={t('home.next.directions')}
            onPress={onDirections}
            fullWidth
            testID="home-lead-directions"
          />
        </View>
        <View style={styles.main}>
          {onRegistration ? (
            <Button
              variant="primary"
              trailingIcon="chevron-forward"
              label={t('home.next.myRegistration')}
              onPress={onRegistration}
              fullWidth
              testID="home-lead-registration"
            />
          ) : (
            <Button
              variant="primary"
              trailingIcon="chevron-forward"
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
