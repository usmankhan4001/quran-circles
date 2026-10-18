import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, Text, elevation, minTouchTarget, radii, spacing, useTheme } from '@qc/ui';

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  /** A choice that is not offered fades and cannot be picked. */
  disabled?: boolean;
  /** A picture above the label, drawn in the colour the card gives it. Decoration. */
  icon?: (color: string) => ReactNode;
}

export interface ChoiceCardsProps<T extends string> {
  options: readonly ChoiceOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  accessibilityLabel: string;
  testID?: string;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  card: {
    flex: 1,
    minHeight: minTouchTarget + spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.card,
    borderWidth: 1,
  },
  tick: { height: 20, justifyContent: 'center' },
  icon: { height: 32, justifyContent: 'center' },
});

/**
 * Women, Men or Family as three cards (D10, R2), each with its picture. The chosen one fills
 * green with a white tick; one that is not offered fades. Each card is a radio, with the group named.
 * TODO(kit): replace with the @qc/ui choice cards when the ui lane exports them.
 */
export function ChoiceCards<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  testID,
}: ChoiceCardsProps<T>) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <View testID={testID} role="radiogroup" aria-label={accessibilityLabel} style={styles.row}>
      {options.map((option) => {
        const selected = option.value === value;
        const off = Boolean(option.disabled);
        const textColor = off ? 'disabledText' : selected ? 'textOnAccent' : 'text';
        return (
          <Pressable
            key={option.value}
            role="radio"
            aria-checked={selected}
            aria-disabled={off}
            disabled={off}
            testID={testID ? `${testID}-${option.value}` : undefined}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.card,
              {
                backgroundColor: off ? c.disabledBackground : selected ? c.accent : c.surface,
                borderColor: off
                  ? c.disabledBackground
                  : selected
                    ? c.accent
                    : theme.mode === 'highContrast'
                      ? c.borderStrong
                      : c.border,
                boxShadow:
                  !off && theme.mode === 'light'
                    ? selected
                      ? elevation.medium
                      : elevation.low
                    : undefined,
                transform: pressed && !off && !theme.reduceMotion ? [{ scale: 0.98 }] : undefined,
              },
            ]}
          >
            {option.icon ? <View style={styles.icon}>{option.icon(c[textColor])}</View> : null}
            <View style={styles.tick}>
              {selected ? <Icon name="check" size={18} color={c[textColor]} /> : null}
            </View>
            <Text variant="label" color={textColor} align="center" strong={selected}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
