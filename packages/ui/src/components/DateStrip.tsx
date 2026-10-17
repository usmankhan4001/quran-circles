import { ScrollView, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme';
import { radii, spacing } from '../tokens';
import { Text } from './Text';
import { Touchable } from './Touchable';

export interface DateStripDay {
  key: string;
  /** Short weekday, such as "Fri". */
  weekday: string;
  /** Day of the month, such as "30". */
  day: string;
  /** The full date for screen readers, such as "Friday 30 October". */
  accessibilityLabel: string;
  /** A day with no sessions; it stays visible but cannot be chosen. */
  disabled?: boolean;
}

export interface DateStripProps {
  days: readonly DateStripDay[];
  value: string;
  onChange: (key: string) => void;
  /** The name of the group, such as "Day". */
  accessibilityLabel: string;
  testID?: string;
}

const styles = StyleSheet.create({
  row: { paddingVertical: spacing.xs, gap: spacing.sm, flexDirection: 'row' },
  day: {
    minWidth: 56,
    minHeight: 64,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
});

/** A swipeable row of days (D2). The chosen day fills green, like every other choice (D10). */
export function DateStrip({ days, value, onChange, accessibilityLabel, testID }: DateStripProps) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <View testID={testID} role="radiogroup" aria-label={accessibilityLabel}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {days.map((d) => {
          const on = d.key === value;
          const off = Boolean(d.disabled);
          return (
            <Touchable
              key={d.key}
              testID={testID ? `${testID}-${d.key}` : undefined}
              role="radio"
              checked={on}
              disabled={off}
              accessibilityLabel={d.accessibilityLabel}
              onPress={() => onChange(d.key)}
              style={({ pressed }) => [
                styles.day,
                {
                  backgroundColor: on
                    ? c.accent
                    : off
                      ? c.disabledBackground
                      : pressed
                        ? c.accentSubtle
                        : c.surface,
                  borderWidth: on ? 0 : 1,
                  borderColor: theme.mode === 'light' ? c.border : c.borderStrong,
                },
              ]}
            >
              <Text
                variant="caption"
                color={on ? 'textOnAccent' : off ? 'disabledText' : 'textSecondary'}
                align="center"
                decorative
              >
                {d.weekday}
              </Text>
              <Text
                variant="title3"
                lang="en"
                direction="ltr"
                color={on ? 'textOnAccent' : off ? 'disabledText' : 'text'}
                align="center"
                decorative
              >
                {d.day}
              </Text>
            </Touchable>
          );
        })}
      </ScrollView>
    </View>
  );
}
