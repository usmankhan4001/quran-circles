import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, Text, formatNumber, minTouchTarget, radii, spacing, useTheme } from '@qc/ui';

export interface StepperProps {
  label: string;
  helper?: string;
  /** The count in words inside the pill, such as "2 people". */
  valueText?: string;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
  decreaseLabel: string;
  increaseLabel: string;
  locale: 'en' | 'ur';
  testID?: string;
}

/** The drawn circle inside each 48 dp button. */
const DOT = 32;

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs + spacing.xxs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingStart: spacing.lg,
    paddingEnd: spacing.xs,
    minHeight: minTouchTarget + spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  text: { flex: 1 },
  controls: { flexDirection: 'row', alignItems: 'center' },
  button: {
    width: minTouchTarget,
    height: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: { minWidth: spacing.lg, alignItems: 'center' },
});

/**
 * The people counter of the registration form (D17): the label above, then a grey pill with
 * the count in words, a minus in a white ringed circle, the number and a plus in an emerald
 * circle. Each button is 48 dp to touch around its smaller drawn circle.
 * TODO(kit): replace with @qc/ui Stepper when the ui lane exports it.
 */
export function Stepper({
  label,
  helper,
  valueText,
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
  const hc = theme.mode === 'highContrast';
  const atMin = value <= min;
  const atMax = value >= max;
  return (
    <View testID={testID} role="group" aria-label={label} style={styles.wrap}>
      <Text variant="label">{label}</Text>
      <View
        style={[
          styles.row,
          { backgroundColor: c.surfaceMuted, borderColor: hc ? c.borderStrong : c.border },
        ]}
      >
        <Icon name="people" size={20} color={c.textSecondary} />
        <View style={styles.text}>
          <Text variant="body" strong testID={testID ? `${testID}-words` : undefined}>
            {valueText ?? formatNumber(value, locale)}
          </Text>
        </View>
        <View style={styles.controls}>
          <Pressable
            role="button"
            aria-label={decreaseLabel}
            aria-disabled={atMin}
            disabled={atMin}
            onPress={() => onChange(Math.max(min, value - 1))}
            testID={testID ? `${testID}-minus` : undefined}
            style={styles.button}
          >
            {({ pressed }) => (
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: atMin ? c.disabledBackground : c.surface,
                    borderWidth: 1,
                    borderColor: atMin ? 'transparent' : hc ? c.borderStrong : c.border,
                    transform:
                      pressed && !atMin && !theme.reduceMotion ? [{ scale: 0.92 }] : undefined,
                  },
                ]}
              >
                <MinusBar color={atMin ? c.disabledText : c.text} />
              </View>
            )}
          </Pressable>
          <View style={styles.value} role="status" aria-live="polite">
            <Text variant="title3" testID={testID ? `${testID}-value` : undefined}>
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
            style={styles.button}
          >
            {({ pressed }) => (
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: atMax ? c.disabledBackground : c.accent,
                    transform:
                      pressed && !atMax && !theme.reduceMotion ? [{ scale: 0.92 }] : undefined,
                  },
                ]}
              >
                <Icon name="plus" size={18} color={atMax ? c.disabledText : c.textOnAccent} />
              </View>
            )}
          </Pressable>
        </View>
      </View>
      {helper ? (
        <Text variant="caption" color="textSecondary">
          {helper}
        </Text>
      ) : null}
    </View>
  );
}

function MinusBar({ color }: { color: string }) {
  return (
    <View aria-hidden style={{ width: 12, height: 2, borderRadius: 1, backgroundColor: color }} />
  );
}
