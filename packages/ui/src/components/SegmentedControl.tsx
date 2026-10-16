import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme';
import { minTouchTarget, radii, spacing } from '../tokens';
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
  group: { flexDirection: 'row', borderWidth: 2, borderRadius: radii.pill, overflow: 'hidden' },
  segment: {
    flex: 1,
    minHeight: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
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
      style={[styles.group, { borderColor: disabled ? c.disabledText : c.accent, backgroundColor: c.surface }]}
    >
      {options.map((option) => {
        const selected = option.value === value;
        const off = Boolean(disabled || option.disabled);
        const textColor = off ? 'disabledText' : selected ? 'textOnAccent' : 'textAccent';
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
                    : c.accent
                  : pressed
                    ? c.accentSubtle
                    : 'transparent',
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
