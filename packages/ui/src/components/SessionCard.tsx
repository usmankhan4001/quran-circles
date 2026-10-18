import type { GestureResponderEvent } from 'react-native';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme';
import { radii, spacing } from '../tokens';
import { Card } from './Card';
import { SeatMeter } from './SeatMeter';
import { Tag, type TagKind } from './Tag';
import { Text } from './Text';

export interface SessionCardProps {
  title: string;
  /** Venue and distance, such as "Masjid Al-Noor · 1.2 km". */
  place: string;
  /** Start time, already formatted, such as "7:30 pm". Shown big on the trailing side (D11). */
  time: string;
  /** The day, such as "Friday". */
  day?: string;
  /** A small line in green capitals above the title, such as the programme. */
  eyebrow?: string;
  /** Sections and language, such as "Men, Women · Urdu". */
  details?: string;
  tag?: { label: string; kind?: TagKind };
  seats?: { taken: number; capacity?: number | null };
  onPress?: (event: GestureResponderEvent) => void;
  /** Read in full by screen readers when the card is a button. */
  accessibilityLabel?: string;
  testID?: string;
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  main: { flex: 1, paddingEnd: spacing.md, gap: spacing.xxs },
  when: {
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.md,
  },
  gap: { marginTop: spacing.sm },
  seatsFooter: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
  },
});

/** A session in a list or on Home (D11): what and where on the start side, when on the end. */
export function SessionCard({
  title,
  place,
  time,
  day,
  eyebrow,
  details,
  tag,
  seats,
  onPress,
  accessibilityLabel,
  testID,
}: SessionCardProps) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <Card
      onPress={onPress}
      accessibilityLabel={
        onPress ? (accessibilityLabel ?? `${title}, ${place}, ${day ?? ''} ${time}`) : undefined
      }
      testID={testID}
    >
      <View style={styles.top}>
        <View style={styles.main}>
          {eyebrow ? (
            <Text variant="eyebrow" color="textAccent">
              {eyebrow}
            </Text>
          ) : null}
          <Text variant="title3">{title}</Text>
          <Text variant="caption" color="textSecondary">
            {place}
          </Text>
        </View>
        <View style={[styles.when, { backgroundColor: c.accentSubtle }]}>
          <Text variant="title2" lang="en" direction="ltr" color="textOnAccentSubtle">
            {time}
          </Text>
          {day ? (
            <Text variant="caption" color="textOnAccentSubtle">
              {day}
            </Text>
          ) : null}
        </View>
      </View>
      {details ? (
        <View style={styles.gap}>
          <Text variant="caption" color="textSecondary">
            {details}
          </Text>
        </View>
      ) : null}
      {tag ? (
        <View style={styles.gap}>
          <Tag label={tag.label} kind={tag.kind} />
        </View>
      ) : null}
      {seats ? (
        <View style={[styles.seatsFooter, { borderTopColor: c.border }]}>
          <SeatMeter taken={seats.taken} capacity={seats.capacity} />
        </View>
      ) : null}
    </Card>
  );
}
