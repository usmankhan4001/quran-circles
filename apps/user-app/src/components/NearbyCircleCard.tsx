import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, Text, elevation, radii, spacing, useTheme } from '@qc/ui';
import type { Session } from '@qc/contracts';
import { useI18n } from '../i18n/I18nProvider';
import { describeWhenParts } from '../features/nearby/schedule';
import { describePortion } from '../features/session/portion';
import { useTextWeight } from '../ui/textWeight';

export interface NearbyCircleCardProps {
  session: Session;
  /** How far the venue is from the chosen area ("0.8 km"). */
  distance?: string;
  onPress: () => void;
  testID?: string;
}

const styles = StyleSheet.create({
  // As drawn (Nearby artboard 01): 16 inside, corners 20, a hairline edge.
  card: { padding: spacing.lg, borderRadius: radii.card, borderWidth: 1 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: 6,
  },
  grow: { flexShrink: 1 },
  portion: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radii.pill },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  seats: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});

/**
 * A circle in Nearby's list (D17): "Section · distance" in green with the portion on an amber
 * tag at the end, the title, the venue, a hairline, then when it meets and the seats left.
 */
export function NearbyCircleCard({ session, distance, onPress, testID }: NearbyCircleCardProps) {
  const { t, l, locale } = useI18n();
  const theme = useTheme();
  const w = useTextWeight();
  const c = theme.colors;
  const title = l(session.title);
  const venue = l(session.venue.name);
  const sep = t('schedule.separator');
  const { time, day } = describeWhenParts(session, t, locale, true);
  const portion = session.nextOccurrence
    ? describePortion(session.nextOccurrence, t, locale)
    : null;
  const section = t(`sections.${session.section}`);
  const eyebrow = distance ? `${section}${sep}${distance}` : section;
  const registration = session.registration;
  const seats =
    session.status === 'cancelled'
      ? t('session.cancelled')
      : registration.enabled && registration.full
        ? t('session.full')
        : registration.enabled && registration.capacity !== null
          ? t('session.seatsLeft', {
              count: Math.max(0, registration.capacity - (registration.seatsTaken ?? 0)),
            })
          : t('nearby.card.details');
  const when = `${day}${sep}${time}`;
  return (
    <Pressable
      role="button"
      onPress={onPress}
      aria-label={[title.text, venue.text, when, eyebrow, portion, seats]
        .filter(Boolean)
        .join(', ')}
      testID={testID ?? `session-card-${session.id}`}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: pressed ? c.surfaceMuted : c.surface,
          borderColor: theme.mode === 'highContrast' ? c.borderStrong : c.hairline,
          boxShadow: theme.mode === 'light' ? elevation.low : undefined,
          transform: pressed && !theme.reduceMotion ? [{ scale: 0.992 }] : undefined,
        },
      ]}
    >
      <View style={styles.top}>
        <View style={styles.grow}>
          <Text variant="caption" color="textAccent" decorative style={w('700')}>
            {eyebrow}
          </Text>
        </View>
        {portion ? (
          <View style={[styles.portion, { backgroundColor: c.warningSubtle }]}>
            <Text
              variant="eyebrow"
              color="textWarning"
              decorative
              style={w('700', { letterSpacing: 0 })}
            >
              {portion}
            </Text>
          </View>
        ) : null}
      </View>
      <Text variant="title3" lang={title.lang} decorative>
        {title.text}
      </Text>
      <Text
        variant="caption"
        color="textSecondary"
        lang={venue.lang}
        decorative
        style={[w('400'), { marginTop: 2 }]}
      >
        {venue.text}
      </Text>
      <View style={[styles.bottom, { borderTopColor: c.hairline }]}>
        <View style={styles.grow}>
          <Text variant="caption" color="textSecondary" decorative style={w('600')}>
            {when}
          </Text>
        </View>
        <View style={styles.seats}>
          <Text variant="caption" decorative style={w('700')}>
            {seats}
          </Text>
          <Icon name="arrow-forward" size={12} color={c.text} />
        </View>
      </View>
    </Pressable>
  );
}
