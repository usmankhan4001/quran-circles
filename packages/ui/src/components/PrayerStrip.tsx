import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme';
import { radii, spacing } from '../tokens';
import { Text } from './Text';

export interface PrayerTime {
  key: string;
  name: string;
  /** Already formatted, such as "5:12". */
  time: string;
}

export interface PrayerStripProps {
  prayers: readonly PrayerTime[];
  /** The next prayer. It is marked with a gilt line and named for screen readers. */
  nextKey?: string;
  /** Said before the next prayer, such as "Next". */
  nextLabel: string;
  testID?: string;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', borderRadius: radii.section, padding: spacing.xs },
  cell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
  },
  mark: { height: 3, width: 18, borderRadius: 2, marginTop: spacing.xs },
});

/** Today's five prayers in a row (D2). Secondary on Home; the full list lives under Quran. */
export function PrayerStrip({ prayers, nextKey, nextLabel, testID }: PrayerStripProps) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <View testID={testID} role="list" style={[styles.row, { backgroundColor: c.surface }]}>
      {prayers.map((p) => {
        const next = p.key === nextKey;
        return (
          <View
            key={p.key}
            role="listitem"
            aria-label={next ? `${nextLabel}: ${p.name} ${p.time}` : `${p.name} ${p.time}`}
            style={[styles.cell, next ? { backgroundColor: c.accentSubtle } : undefined]}
          >
            <Text
              variant="caption"
              color={next ? 'textOnAccentSubtle' : 'textSecondary'}
              align="center"
              decorative
            >
              {p.name}
            </Text>
            <Text
              variant="label"
              lang="en"
              direction="ltr"
              color={next ? 'textOnAccentSubtle' : 'text'}
              align="center"
              strong={next}
              decorative
            >
              {p.time}
            </Text>
            <View
              aria-hidden
              style={[styles.mark, { backgroundColor: next ? c.decoration : 'transparent' }]}
            />
          </View>
        );
      })}
    </View>
  );
}
