import { Pressable, View } from 'react-native';
import { Text, minTouchTarget, radii, spacing, useTheme } from '@qc/ui';

export interface FilterPill<T extends string> {
  value: T;
  label: string;
  /** Shown after the label in brackets, as drawn: "All (18)". Left out when unknown. */
  count?: string;
}

export interface FilterPillsProps<T extends string> {
  options: readonly FilterPill<T>[];
  value: T;
  onChange: (value: T) => void;
  /** The name of the group for a screen reader. */
  accessibilityLabel: string;
  testID?: string;
}

/**
 * D17 filter pills: a row of white pills with a hairline; the chosen one is charcoal with white
 * text. One choice at a time, so they are radios for a screen reader.
 * TODO(kit): replace with a kit filter-pill group when one exists.
 */
export function FilterPills<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  testID,
}: FilterPillsProps<T>) {
  const { colors, mode } = useTheme();
  return (
    <View
      testID={testID}
      role="radiogroup"
      aria-label={accessibilityLabel}
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}
    >
      {options.map((o) => {
        const on = o.value === value;
        const label = o.count !== undefined ? `${o.label} (${o.count})` : o.label;
        return (
          <Pressable
            key={o.value}
            testID={testID ? `${testID}-${o.value}` : undefined}
            role="radio"
            aria-checked={on}
            accessibilityLabel={label}
            onPress={() => onChange(o.value)}
            hitSlop={spacing.xs}
            style={({ pressed }) => ({
              minHeight: minTouchTarget - spacing.sm,
              justifyContent: 'center',
              paddingHorizontal: spacing.md,
              borderRadius: radii.pill,
              borderWidth: 1,
              borderColor: on
                ? colors.cta
                : mode === 'highContrast'
                  ? colors.borderStrong
                  : colors.border,
              backgroundColor: on ? colors.cta : pressed ? colors.surfaceMuted : colors.surface,
            })}
          >
            <Text variant="caption" strong color={on ? 'textOnCta' : 'text'} decorative>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
