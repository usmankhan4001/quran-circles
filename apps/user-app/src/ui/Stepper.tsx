import { Pressable, StyleSheet, View } from 'react-native';
import {
  Icon,
  Text,
  elevation,
  formatNumber,
  minTouchTarget,
  radii,
  spacing,
  useTheme,
} from '@qc/ui';

export interface StepperProps {
  label: string;
  helper?: string;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
  decreaseLabel: string;
  increaseLabel: string;
  locale: 'en' | 'ur';
  testID?: string;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.card,
    borderWidth: 1,
  },
  text: { flex: 1 },
  badge: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  controls: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  button: {
    width: minTouchTarget,
    height: minTouchTarget,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: { minWidth: spacing.xl, alignItems: 'center' },
});

/**
 * The people counter of the registration sheet (D10, R2): the people icon, a minus, the
 * number, a plus, on the leaf tint. TODO(kit): replace with @qc/ui Stepper when the ui lane exports it.
 */
export function Stepper({
  label,
  helper,
  value,
  min,
  max,
  onChange,
  decreaseLabel,
  increaseLabel,
  locale,
  testID,
}: StepperProps) {
  const theme = useTheme();
  const c = theme.colors;
  const atMin = value <= min;
  const atMax = value >= max;
  return (
    <View
      testID={testID}
      role="group"
      aria-label={label}
      style={[
        styles.row,
        {
          backgroundColor: c.accentSubtle,
          borderColor: theme.mode === 'highContrast' ? c.borderStrong : c.border,
        },
      ]}
    >
      <View
        style={[
          styles.badge,
          {
            backgroundColor: c.surface,
            borderColor: c.border,
            boxShadow: theme.mode === 'light' ? elevation.low : undefined,
          },
        ]}
      >
        <Icon name="people" size={22} color={c.accent} />
      </View>
      <View style={styles.text}>
        <Text variant="label" color="textOnAccentSubtle">
          {label}
        </Text>
        {helper ? (
          <Text variant="caption" color="textOnAccentSubtle">
            {helper}
          </Text>
        ) : null}
      </View>
      <View style={styles.controls}>
        <Pressable
          role="button"
          aria-label={decreaseLabel}
          aria-disabled={atMin}
          disabled={atMin}
          onPress={() => onChange(Math.max(min, value - 1))}
          testID={testID ? `${testID}-minus` : undefined}
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: atMin ? c.disabledBackground : c.surface,
              borderWidth: 1,
              borderColor: atMin ? 'transparent' : c.border,
              boxShadow: !atMin && theme.mode === 'light' ? elevation.low : undefined,
              transform: pressed && !atMin && !theme.reduceMotion ? [{ scale: 0.94 }] : undefined,
            },
          ]}
        >
          <MinusBar color={atMin ? c.disabledText : c.accent} />
        </Pressable>
        <View style={styles.value} role="status" aria-live="polite">
          <Text
            variant="title3"
            color="textOnAccentSubtle"
            testID={testID ? `${testID}-value` : undefined}
          >
            {formatNumber(value, locale)}
          </Text>
        </View>
        <Pressable
          role="button"
          aria-label={increaseLabel}
          aria-disabled={atMax}
          disabled={atMax}
          onPress={() => onChange(Math.min(max, value + 1))}
          testID={testID ? `${testID}-plus` : undefined}
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: atMax ? c.disabledBackground : c.accent,
              boxShadow: !atMax && theme.mode === 'light' ? elevation.low : undefined,
              transform: pressed && !atMax && !theme.reduceMotion ? [{ scale: 0.94 }] : undefined,
            },
          ]}
        >
          <Icon name="plus" size={22} color={atMax ? c.disabledText : c.textOnAccent} />
        </Pressable>
      </View>
    </View>
  );
}

function MinusBar({ color }: { color: string }) {
  return (
    <View aria-hidden style={{ width: 16, height: 3, borderRadius: 2, backgroundColor: color }} />
  );
}
