import type { ReactNode } from 'react';
import { StyleSheet, View, type GestureResponderEvent } from 'react-native';
import { useTheme } from '../theme';
import { elevation, radii, spacing, type SpacingToken } from '../tokens';
import { Touchable } from './Touchable';

export type CardVariant = 'raised' | 'outlined' | 'flat';

export interface CardProps {
  children: ReactNode;
  variant?: CardVariant;
  padding?: SpacingToken;
  /** Makes the whole card a button. */
  onPress?: (event: GestureResponderEvent) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
}

const styles = StyleSheet.create({
  base: { borderRadius: radii.card, borderWidth: 1, overflow: 'hidden' },
});

export function Card({
  children,
  variant = 'raised',
  padding = 'lg',
  onPress,
  disabled,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: CardProps) {
  const theme = useTheme();
  const c = theme.colors;
  const isHighContrast = theme.mode === 'highContrast';
  const base = {
    padding: spacing[padding],
    backgroundColor: variant === 'flat' ? c.surfaceMuted : c.surface,
    // Whisper-thin hairline border pairs with soft shadow in light mode; strong border for outlined/HC.
    borderColor:
      variant === 'outlined' || isHighContrast
        ? c.borderStrong
        : c.border,
    boxShadow: variant === 'raised' && theme.mode === 'light' ? elevation.low : undefined,
  };
  if (!onPress) {
    return (
      <View testID={testID} aria-label={accessibilityLabel} style={[styles.base, base]}>
        {children}
      </View>
    );
  }
  return (
    <Touchable
      testID={testID}
      role="button"
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        styles.base,
        base,
        pressed ? { backgroundColor: c.surfaceMuted } : undefined,
        pressed && !disabled && !theme.reduceMotion ? { transform: [{ scale: 0.992 }] } : undefined,
        disabled ? { opacity: 0.6 } : undefined,
      ]}
    >
      {children}
    </Touchable>
  );
}
