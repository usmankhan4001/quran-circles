import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme';
import { elevation, minTouchTarget, radii, spacing } from '../tokens';
import { Text } from './Text';
import { Touchable } from './Touchable';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** The name of the group, for example "Section". */
  accessibilityLabel: string;
  disabled?: boolean;
  testID?: string;
}

const styles = StyleSheet.create({
  // D17: segments sit in a soft pill track; the chosen one is a white pill with charcoal text.
  group: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: radii.pill,
    overflow: 'hidden',
    padding: spacing.xs,
  },
  segment: {
    flex: 1,
    minHeight: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
  },
});

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  disabled,
  testID,
}: SegmentedControlProps<T>) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <View
      testID={testID}
      role="radiogroup"
      aria-label={accessibilityLabel}
      style={[
        styles.group,
        {
          borderColor: theme.mode === 'highContrast' || disabled ? c.borderStrong : c.surfaceMuted,
          backgroundColor: c.surfaceMuted,
        },
      ]}
    >
      {options.map((option) => {
        const selected = option.value === value;
        const off = Boolean(disabled || option.disabled);
        const textColor = off ? 'disabledText' : selected ? 'text' : 'textMuted';
        return (
          <Touchable
            key={option.value}
            testID={testID ? `${testID}-${option.value}` : undefined}
            role="radio"
            checked={selected}
            disabled={off}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.segment,
              {
                backgroundColor: selected
                  ? off
                    ? c.disabledBackground
                    : c.surfaceRaised
                  : pressed
                    ? c.border
                    : 'transparent',
                borderWidth: selected && theme.mode === 'highContrast' ? 2 : 0,
                borderColor: c.borderStrong,
                boxShadow: selected && !off && theme.mode === 'light' ? elevation.low : undefined,
              },
            ]}
          >
            <Text variant="label" color={textColor} align="center" strong={selected}>
              {option.label}
            </Text>
          </Touchable>
        );
      })}
    </View>
  );
}
