import { StyleSheet, View } from 'react-native';
import { Card, Icon, Tag, Text, spacing, useTheme } from '@qc/ui';
import type { Session } from '@qc/contracts';
import { useI18n } from '../i18n/I18nProvider';
import { describeWhenParts } from '../features/nearby/schedule';
import { describePortion } from '../features/session/portion';

export interface NearbyCircleCardProps {
  session: Session;
  /** How far the venue is from the chosen area ("0.8 km"). */
  distance?: string;
  onPress: () => void;
  testID?: string;
}

const styles = StyleSheet.create({
  stack: { gap: spacing.xxs },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  grow: { flexShrink: 1 },
  rule: { height: 1, marginTop: spacing.md, marginBottom: spacing.sm + spacing.xxs },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  seats: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});

/**
 * A circle in Nearby's list (D17): "Section · distance" in green with the portion on an amber
 * tag at the end, the title, the venue, a hairline, then when it meets and the seats left.
 */
export function NearbyCircleCard({ session, distance, onPress, testID }: NearbyCircleCardProps) {
  const { t, l, locale } = useI18n();
  const c = useTheme().colors;
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
    <Card
      onPress={onPress}
      accessibilityLabel={[title.text, venue.text, when, eyebrow, portion, seats]
        .filter(Boolean)
        .join(', ')}
      testID={testID ?? `session-card-${session.id}`}
    >
      <View style={styles.stack}>
        <View style={styles.top}>
          <View style={styles.grow}>
            <Text variant="caption" color="textAccent" strong decorative>
              {eyebrow}
            </Text>
          </View>
          {portion ? <Tag label={portion} kind="gilt" /> : null}
        </View>
        <Text variant="title3" lang={title.lang} decorative>
          {title.text}
        </Text>
        <Text variant="caption" color="textSecondary" lang={venue.lang} decorative>
          {venue.text}
        </Text>
        <View style={[styles.rule, { backgroundColor: c.hairline }]} aria-hidden />
        <View style={styles.bottom}>
          <View style={styles.grow}>
            <Text variant="caption" color="textSecondary" strong decorative>
              {when}
            </Text>
          </View>
          <View style={styles.seats}>
            <Text variant="caption" strong decorative>
              {seats}
            </Text>
            <Icon name="arrow-forward" size={14} color={c.text} />
          </View>
        </View>
      </View>
    </Card>
  );
}
