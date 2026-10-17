import { Pressable } from 'react-native';
import { minTouchTarget, radii, useTheme } from '@qc/ui';
import { AppIcon, type AppIconName } from './glyphs';

export interface RoundButtonProps {
  icon: AppIconName;
  /** Required: an icon alone has no name. Use the person's name here, never a number. */
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
  /** `large` is 56 dp, for the headcount. */
  size?: 'regular' | 'large';
  testID?: string;
}

/**
 * A round tinted button with a line icon: call and message on a person's row, and the stepper.
 * TODO(kit): replace with @qc/ui IconButton once it takes the kit's phone and chat icons.
 */
export function RoundButton({
  icon,
  accessibilityLabel,
  onPress,
  disabled,
  size = 'regular',
  testID,
}: RoundButtonProps) {
  const { colors } = useTheme();
  const dim = size === 'large' ? minTouchTarget + 8 : minTouchTarget;
  return (
    <Pressable
      testID={testID}
      role="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      disabled={disabled}
      aria-disabled={disabled || undefined}
      style={({ pressed }) => ({
        width: dim,
        height: dim,
        borderRadius: size === 'large' ? radii.lg : radii.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: disabled
          ? colors.surfaceMuted
          : pressed
            ? colors.accent
            : colors.accentSubtle,
      })}
    >
      {({ pressed }) => (
        <AppIcon
          name={icon}
          color={disabled ? colors.disabledText : pressed ? colors.textOnAccent : colors.accent}
          size={22}
        />
      )}
    </Pressable>
  );
}
