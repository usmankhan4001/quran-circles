import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Icon, IconButton, QuranPortion, Text, radii, spacing, useTheme } from '@qc/ui';
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
  /** Opens the join pledge. Leave it out when the person has already joined. */
  onJoin?: () => void;
  /** Opens the person's registration. Leave it out when they are not registered. */
  onRegistration?: () => void;
  /** Opens the portion directly in the Quran reader. */
  onReadPortion?: () => void;
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
  // Design system session card: flat, a hairline, 16 radius, 20 inside.
  card: { borderRadius: radii.card, padding: 20, borderWidth: 1, gap: spacing.lg },
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  heading: { flex: 1, gap: 2 },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  when: { alignItems: 'flex-end', gap: 4 },
  clock: { flexDirection: 'row', alignItems: 'baseline', columnGap: spacing.xs, direction: 'ltr' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  buttons: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  main: { flex: 1 },
});

/**
 * "Your next session" on Home (design system): a flat white card with a green label (the day and
 * how long until it starts), the venue, the area and distance, the start time as the biggest
 * thing on it, the Quran portion between hairlines, who it is for, and one main button. Joining
 * is a pledge ("Confirm I will join"); there is no seat.
 */
export function NextCircleCard({
  session,
  eyebrow,
  onPress,
  onDirections,
  distance,
  onJoin,
  onRegistration,
  onReadPortion,
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
  const dayLine = countdown ? `${when.day}${sep}${countdown}` : when.day;
  const place = distance ? `${venue.text}${sep}${distance}` : venue.text;
  const clock = splitClock(when.time);
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: c.surface,
          borderColor: theme.mode === 'highContrast' ? c.borderStrong : c.hairline,
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
        style={{ gap: spacing.lg }}
      >
        <View style={styles.top}>
          <View style={styles.heading}>
            <Text color="textAccent" decorative testID="home-lead-countdown" variant="eyebrow">
              {dayLine}
            </Text>
            <Text lang={title.lang} decorative variant="title3">
              {title.text}
            </Text>
            <View style={styles.line}>
              <Icon name="pin" size={14} color={c.textMuted} />
              <Text color="textMuted" lang={venue.lang} decorative variant="caption">
                {place}
              </Text>
            </View>
          </View>
          <View style={styles.when} testID="home-lead-time">
            <View style={styles.clock}>
              <Text testID="home-lead-clock" decorative variant="time" lang="en">
                {clock.clock}
              </Text>
            </View>
            {clock.period ? (
              <Text
                color="textMuted"
                testID="home-lead-period"
                decorative
                variant="caption"
                {...(clock.latinPeriod ? { lang: 'en' as const } : {})}
              >
                {clock.period}
              </Text>
            ) : null}
          </View>
        </View>
        {portion ? (
          <View testID="home-lead-portion">
            <QuranPortion label={portion} />
          </View>
        ) : null}
        <View style={styles.meta} testID="home-lead-section">
          <Icon name="people" size={16} color={c.textMuted} />
          <Text color="textMuted" decorative variant="caption">
            {section}
          </Text>
        </View>
      </Pressable>
      <View style={styles.buttons}>
        <View style={styles.main}>
          {onRegistration ? (
            <Button
              label={t('home.next.myRegistration')}
              trailingIcon="arrow-forward"
              fullWidth
              onPress={onRegistration}
              testID="home-lead-registration"
            />
          ) : onReadPortion ? (
            <Button
              label={t('readAlong.open')}
              icon="book"
              fullWidth
              onPress={onReadPortion}
              testID="home-lead-read-portion"
            />
          ) : onJoin ? (
            <Button
              label={t('registration.pledge')}
              fullWidth
              onPress={onJoin}
              testID="home-lead-join"
            />
          ) : (
            <Button
              label={t('home.nextSession.action')}
              trailingIcon="arrow-forward"
              fullWidth
              onPress={onPress}
              testID="home-lead-details"
            />
          )}
        </View>
        <IconButton
          icon="pin"
          variant="tonal"
          accessibilityLabel={t('home.next.directions')}
          onPress={onDirections}
          testID="home-lead-directions"
        />
      </View>
    </View>
  );
}
