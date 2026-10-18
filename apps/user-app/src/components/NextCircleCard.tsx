import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, Text, elevation, radii, spacing, useTheme } from '@qc/ui';
import type { Session } from '@qc/contracts';
import { useI18n } from '../i18n/I18nProvider';
import type { TFunction } from '../i18n/translate';
import { describeWhenParts } from '../features/nearby/schedule';
import { splitClock } from '../features/home/clock';
import { describePortion } from '../features/session/portion';
import { ArtPill } from '../ui/ArtPill';
import { useTextWeight } from '../ui/textWeight';

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
  // As drawn: 18 inside, corners 20, a hairline and a soft shadow (Home artboard 01).
  card: { borderRadius: radii.card, padding: 18, borderWidth: 1 },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  statusLine: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 },
  section: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: radii.pill, borderWidth: 1 },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 3 },
  grow: { flexShrink: 1 },
  when: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: 14,
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  whenStart: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    columnGap: spacing.xs,
    flexShrink: 1,
  },
  clock: { flexDirection: 'row', alignItems: 'baseline', columnGap: spacing.xs },
  // A Latin "PM" stays to the right of the figures in Urdu too, as the formatter's isolate keeps
  // it in running text.
  latinClock: { direction: 'ltr' },
  portion: { paddingHorizontal: 10, paddingVertical: spacing.xs, borderRadius: radii.pill },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: 14 },
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
  const w = useTextWeight();
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
      color="textSecondary"
      testID="home-lead-period"
      decorative
      {...(clock.latinPeriod ? { lang: 'en' as const } : {})}
      variant="label"
      style={w('700', clock.latinPeriod ? { lang: 'en' } : undefined)}
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
      >
        <View style={styles.status}>
          <View style={styles.statusLine}>
            <Icon name="check-circle" size={14} color={c.textSuccess} />
            <View style={styles.grow}>
              <Text
                color="textSuccess"
                decorative
                testID="home-lead-countdown"
                variant="caption"
                style={w('700')}
              >
                {status}
              </Text>
            </View>
          </View>
          <View
            testID="home-lead-section"
            aria-hidden
            style={[
              styles.section,
              {
                backgroundColor: c.surfaceMuted,
                borderColor: theme.mode === 'highContrast' ? c.borderStrong : c.border,
              },
            ]}
          >
            <Text color="textSecondary" decorative variant="caption" style={w('600')}>
              {section}
            </Text>
          </View>
        </View>
        <Text
          lang={title.lang}
          decorative
          variant="title3"
          style={w('800', { letterSpacing: -0.25 })}
        >
          {title.text}
        </Text>
        <View style={styles.line}>
          <Icon name="pin" size={13} color={c.textSecondary} />
          <View style={styles.grow}>
            <Text color="textSecondary" lang={venue.lang} decorative variant="caption">
              {place}
            </Text>
          </View>
        </View>
        <View style={[styles.when, { borderTopColor: c.hairline }]}>
          <View style={styles.whenStart}>
            <View
              style={[styles.clock, clock.latinPeriod ? styles.latinClock : null]}
              testID="home-lead-time"
            >
              {clock.periodFirst ? period : null}
              <Text testID="home-lead-clock" decorative variant="display">
                {clock.clock}
              </Text>
              {clock.periodFirst ? null : period}
            </View>
            <Text color="textMuted" testID="home-lead-day" decorative variant="caption">
              {`· ${when.day}`}
            </Text>
          </View>
          {portion ? (
            <View
              testID="home-lead-portion"
              aria-hidden
              style={[styles.portion, { backgroundColor: c.warningSubtle }]}
            >
              <Text color="textWarning" decorative variant="caption" style={w('700')}>
                {portion}
              </Text>
            </View>
          ) : null}
        </View>
      </Pressable>
      <View style={styles.buttons}>
        <View style={styles.button}>
          <ArtPill
            icon="route"
            label={t('home.next.directions')}
            onPress={onDirections}
            testID="home-lead-directions"
          />
        </View>
        <View style={styles.main}>
          {onRegistration ? (
            <ArtPill
              variant="primary"
              trailingIcon="arrow-forward"
              label={t('home.next.myRegistration')}
              onPress={onRegistration}
              testID="home-lead-registration"
            />
          ) : (
            <ArtPill
              variant="primary"
              trailingIcon="arrow-forward"
              label={t('home.nextSession.action')}
              onPress={onPress}
              testID="home-lead-details"
            />
          )}
        </View>
      </View>
    </View>
  );
}
