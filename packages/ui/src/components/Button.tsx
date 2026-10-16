import { ActivityIndicator, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import { useTheme } from '../theme';
import { radii, spacing } from '../tokens';
import { Icon, type IconName } from './Icon';
import { Text, type TextColor } from './Text';
import { Touchable } from './Touchable';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger';
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
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  base: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  full: { alignSelf: 'stretch' },
  gap: { marginEnd: spacing.sm },
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
  accessibilityLabel,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const theme = useTheme();
  const c = theme.colors;
  const off = Boolean(disabled);
  const palette: Record<ButtonVariant, { bg: string; pressed: string; fg: TextColor; border: string }> = {
    primary: { bg: c.accent, pressed: c.accentPressed, fg: 'textOnAccent', border: c.accent },
    secondary: { bg: c.surface, pressed: c.accentSubtle, fg: 'textAccent', border: c.accent },
    tertiary: { bg: 'transparent', pressed: c.accentSubtle, fg: 'textAccent', border: 'transparent' },
    danger: { bg: c.danger, pressed: c.dangerPressed, fg: 'textOnDanger', border: c.danger },
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
          borderWidth: 2,
          borderColor: off ? (variant === 'secondary' ? c.disabledText : 'transparent') : p.border,
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
      <Text variant={size === 'large' ? 'bodyLarge' : 'label'} color={fgKey} align="center">
        {label}
      </Text>
    </Touchable>
  );
}
