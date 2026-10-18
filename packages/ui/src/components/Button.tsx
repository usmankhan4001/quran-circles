import { ActivityIndicator, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import { useTheme } from '../theme';
import { elevation, radii, spacing } from '../tokens';
import { Icon, type IconName } from './Icon';
import { Text, type TextColor } from './Text';
import { Touchable } from './Touchable';

/**
 * D17 pills: `primary` charcoal (the one main action of a screen), `emerald` solid green,
 * `secondary` emerald tint, `outline` white with a hairline border and charcoal text,
 * `tertiary` text only, `danger` soft red with a red outline for careful actions.
 */
export type ButtonVariant = 'primary' | 'emerald' | 'secondary' | 'outline' | 'tertiary' | 'danger';
export type ButtonSize = 'regular' | 'large';

export interface ButtonProps {
  label: string;
  onPress?: (event: GestureResponderEvent) => void;
  variant?: ButtonVariant;
  /** `large` (56 dp) is for the key action of a screen, such as Register. */
  size?: ButtonSize;
  disabled?: boolean;
  /** Shows a spinner and ignores presses. The label stays visible. */
  loading?: boolean;
  fullWidth?: boolean;
  icon?: IconName;
  /** An icon after the label, such as the forward arrow on "My registration". Mirrors in Urdu. */
  trailingIcon?: IconName;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  base: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm + spacing.xxs,
  },
  full: { alignSelf: 'stretch' },
  gap: { marginEnd: spacing.sm },
  trail: { marginStart: spacing.sm },
});

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'regular',
  disabled,
  loading,
  fullWidth,
  icon,
  trailingIcon,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const theme = useTheme();
  const c = theme.colors;
  const off = Boolean(disabled);
  const palette: Record<
    ButtonVariant,
    { bg: string; pressed: string; fg: TextColor; border: string }
  > = {
    primary: { bg: c.cta, pressed: c.ctaPressed, fg: 'textOnCta', border: c.cta },
    emerald: { bg: c.accent, pressed: c.accentPressed, fg: 'textOnAccent', border: c.accent },
    secondary: {
      bg: c.accentSubtle,
      pressed: c.border,
      fg: 'textOnAccentSubtle',
      border: c.accentSubtle,
    },
    outline: {
      bg: c.surface,
      pressed: c.surfaceMuted,
      fg: 'text',
      border: theme.mode === 'highContrast' ? c.borderStrong : c.border,
    },
    tertiary: {
      bg: 'transparent',
      pressed: c.accentSubtle,
      fg: 'textAccent',
      border: 'transparent',
    },
    danger: {
      bg: c.dangerSubtle,
      pressed: c.surfaceMuted,
      fg: 'textOnDangerSubtle',
      border: c.textDanger,
    },
  };
  const p = palette[variant];
  const fgKey: TextColor = off ? 'disabledText' : p.fg;
  const fg = c[fgKey];
  return (
    <Touchable
      testID={testID}
      role="button"
      onPress={onPress}
      disabled={off}
      busy={loading}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        styles.row,
        styles.base,
        { minHeight: size === 'large' ? 56 : 48 },
        fullWidth ? styles.full : undefined,
        {
          backgroundColor: off
            ? variant === 'tertiary'
              ? 'transparent'
              : c.disabledBackground
            : pressed
              ? p.pressed
              : p.bg,
          borderWidth: variant === 'outline' || variant === 'danger' ? 1 : 0,
          borderColor: off ? (variant === 'outline' ? c.disabledText : 'transparent') : p.border,
          boxShadow:
            variant === 'primary' && !off && theme.mode === 'light' ? elevation.medium : undefined,
          transform: pressed && !off && !theme.reduceMotion ? [{ scale: 0.98 }] : undefined,
        },
      ]}
    >
      {loading ? (
        <View style={styles.gap} aria-hidden>
          <ActivityIndicator color={fg} />
        </View>
      ) : icon ? (
        <View style={styles.gap}>
          <Icon name={icon} color={fg} size={20} />
        </View>
      ) : null}
      <Text variant="label" color={fgKey} align="center">
        {label}
      </Text>
      {trailingIcon && !loading ? (
        <View style={styles.trail}>
          <Icon name={trailingIcon} color={fg} size={18} />
        </View>
      ) : null}
    </Touchable>
  );
}
