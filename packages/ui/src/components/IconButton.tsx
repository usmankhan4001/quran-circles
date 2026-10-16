import { ActivityIndicator, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import { useTheme } from '../theme';
import { minTouchTarget, radii } from '../tokens';
import { Icon, type IconName } from './Icon';
import { Touchable } from './Touchable';

export interface IconButtonProps {
  icon: IconName;
  /** Required: an icon alone has no name for a screen reader. */
  accessibilityLabel: string;
  onPress?: (event: GestureResponderEvent) => void;
  variant?: 'plain' | 'tonal' | 'filled';
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
}

const styles = StyleSheet.create({
  base: {
    width: minTouchTarget,
    height: minTouchTarget,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  variant = 'plain',
  disabled,
  loading,
  testID,
}: IconButtonProps) {
  const theme = useTheme();
  const c = theme.colors;
  const fg = disabled ? c.disabledText : variant === 'filled' ? c.textOnAccent : c.text;
  return (
    <Touchable
      testID={testID}
      role="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      disabled={disabled}
      busy={loading}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: disabled
            ? 'transparent'
            : variant === 'filled'
              ? pressed
                ? c.accentPressed
                : c.accent
              : pressed
                ? c.accentSubtle
                : variant === 'tonal'
                  ? c.surfaceMuted
                  : 'transparent',
        },
      ]}
    >
      {loading ? (
        <View aria-hidden>
          <ActivityIndicator color={fg} />
        </View>
      ) : (
        <Icon name={icon} color={fg} />
      )}
    </Touchable>
  );
}
