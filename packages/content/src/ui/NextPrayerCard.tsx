import { View } from 'react-native';
import { Card, Text, spacing } from '@qc/ui';
import { todayAt, type PrayerPlace } from '../prayer/calc';
import { hijriDate } from '../prayer/hijri';
import { useContent } from './context';
import { clockText, countdownLine, hijriText, prayerName } from './format';
import { useNextPrayer } from './hooks';
import { useContentI18n } from './i18n';

export interface NextPrayerCardProps {
  /** The chosen city. Null before the person has chosen one. */
  place: PrayerPlace | null;
  /** Opens the prayer times (or, with no city, the city chooser). */
  onPress?: () => void;
  testID?: string;
}

/**
 * Home card: the next prayer, the time left, and the Hijri date. It is calculated on the phone,
 * so it keeps counting down with no connection.
 */
export function NextPrayerCard({ place, onPress, testID }: NextPrayerCardProps) {
  const i18n = useContentI18n();
  if (!place) {
    return (
      <Card onPress={onPress} testID={testID} accessibilityLabel={i18n.t('prayer.noCity.title')}>
        <Text variant="caption" color="textSecondary">
          {i18n.t('prayer.next')}
        </Text>
        <View style={{ height: spacing.xs }} />
        <Text variant="title3" heading={2}>
          {i18n.t('prayer.noCity.title')}
        </Text>
        <Text color="textSecondary">{i18n.t('prayer.noCity.body')}</Text>
      </Card>
    );
  }
  return <WithPlace place={place} onPress={onPress} testID={testID} />;
}

function WithPlace({
  place,
  onPress,
  testID,
}: {
  place: PrayerPlace;
  onPress: (() => void) | undefined;
  testID: string | undefined;
}) {
  const i18n = useContentI18n();
  const { hijriOffsetDays } = useContent();
  const { next, countdown, now } = useNextPrayer(place);
  // The Hijri date follows the calendar day at the place, like the prayer times screen.
  const hijri = hijriDate(todayAt(place, now), hijriOffsetDays);
  const line = countdownLine(i18n, next.prayer, countdown);
  const at = clockText(i18n, next.at, place);
  return (
    <Card
      onPress={onPress}
      testID={testID}
      accessibilityLabel={`${i18n.t('prayer.next')}. ${line}. ${at}`}
    >
      <Text variant="caption" color="textSecondary" decorative>
        {i18n.t('prayer.next')}
      </Text>
      <View style={{ height: spacing.xs }} />
      <Text variant="title3" heading={2} testID="next-prayer-countdown" decorative>
        {line}
      </Text>
      <Text color="textSecondary" decorative testID="next-prayer-time">
        {`${prayerName(i18n, next.prayer)}, ${at}`}
      </Text>
      {hijri ? (
        <>
          <View style={{ height: spacing.sm }} />
          <Text variant="caption" color="textSecondary" decorative testID="next-prayer-hijri">
            {`${i18n.t('prayer.hijri')}: ${hijriText(i18n, hijri)}`}
          </Text>
        </>
      ) : null}
    </Card>
  );
}
