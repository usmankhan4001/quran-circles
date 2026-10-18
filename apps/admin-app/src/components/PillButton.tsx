import { Pressable } from 'react-native';
import {
  Icon,
  Text,
  minTouchTarget,
  radii,
  spacing,
  useTheme,
  type IconName,
  type IconWeight,
  type TextColor,
} from '@qc/ui';

export interface PillButtonProps {
  label: string;
  onPress: () => void;
  icon?: IconName;
  iconWeight?: IconWeight;
  /** `charcoal` main action, `outline` white with a hairline, `tint` emerald tint (WhatsApp). */
  tone?: 'charcoal' | 'outline' | 'tint';
  /** The name for a screen reader when the label alone is not enough ("Call Sample Guest"). */
  accessibilityLabel?: string;
  testID?: string;
}

/**
 * D17 compact pill, as drawn on cards (Log attendance, Registrants, WhatsApp, Call): smaller type
 * and padding than the kit's Button so two fit side by side, still 48 dp tall to touch.
 * TODO(kit): a compact size for Button.
 */
export function PillButton({
  label,
  onPress,
  icon,
  iconWeight,
  tone = 'outline',
  accessibilityLabel,
  testID,
}: PillButtonProps) {
  const { colors, mode } = useTheme();
  const look = {
    charcoal: { bg: colors.cta, pressed: colors.ctaPressed, border: colors.cta, fg: 'textOnCta' },
    outline: {
      bg: colors.surface,
      pressed: colors.surfaceMuted,
      border: mode === 'highContrast' ? colors.borderStrong : colors.border,
      fg: 'text',
    },
    tint: {
      bg: colors.accentSubtle,
      pressed: colors.border,
      border: mode === 'highContrast' ? colors.accent : colors.accentSubtle,
      fg: 'textOnAccentSubtle',
    },
  }[tone] as { bg: string; pressed: string; border: string; fg: TextColor };
  return (
    <Pressable
      testID={testID}
      role="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: minTouchTarget,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.sm,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: look.border,
        backgroundColor: pressed ? look.pressed : look.bg,
      })}
    >
      {icon ? <Icon name={icon} weight={iconWeight} size={14} color={colors[look.fg]} /> : null}
      <Text variant="caption" strong color={look.fg} decorative numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}
