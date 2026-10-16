import { useState, type ReactNode } from 'react';
import {
  Pressable,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import type { Role } from 'react-native';
import { useTheme } from '../theme';
import { minTouchTarget } from '../tokens';

export interface TouchableState {
  pressed: boolean;
  focused: boolean;
}

export interface TouchableProps {
  onPress?: (event: GestureResponderEvent) => void;
  disabled?: boolean;
  busy?: boolean;
  role: Role;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  selected?: boolean;
  checked?: boolean;
  expanded?: boolean;
  /** The control opens a dialog. Used by the web target only. */
  opensDialog?: boolean;
  /** Style, or a function of the pressed and focused state. */
  style?: StyleProp<ViewStyle> | ((state: TouchableState) => StyleProp<ViewStyle>);
  children: ReactNode | ((state: TouchableState) => ReactNode);
  testID?: string;
  /** Extra hit area in dp, for controls smaller than the touch target. */
  hitSlop?: number;
  /** Do not apply the minimum height (for parts of a bigger row). */
  noMinSize?: boolean;
}

/**
 * The one pressable all interactive parts are built on. It guarantees the 48 dp touch target,
 * a visible focus ring, and correct accessibility state, and it ignores presses while the
 * control is disabled or busy.
 */
export function Touchable({
  onPress,
  disabled,
  busy,
  role,
  accessibilityLabel,
  accessibilityHint,
  selected,
  checked,
  expanded,
  opensDialog,
  style,
  children,
  testID,
  hitSlop,
  noMinSize,
}: TouchableProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const inactive = Boolean(disabled || busy);
  const web = opensDialog ? { 'aria-haspopup': 'dialog' } : undefined;
  return (
    <Pressable
      {...web}
      testID={testID}
      role={role}
      aria-label={accessibilityLabel}
      aria-disabled={disabled ? true : undefined}
      aria-busy={busy ? true : undefined}
      aria-selected={selected}
      aria-checked={checked}
      aria-expanded={expanded}
      accessibilityHint={accessibilityHint}
      disabled={inactive}
      hitSlop={hitSlop}
      onPress={inactive ? undefined : onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => {
        const state: TouchableState = { pressed, focused };
        const resolved = typeof style === 'function' ? style(state) : style;
        return [
          noMinSize ? undefined : { minHeight: minTouchTarget, minWidth: minTouchTarget },
          resolved,
          focused
            ? {
                outlineColor: theme.colors.focus,
                outlineWidth: 3,
                outlineOffset: 2,
                outlineStyle: 'solid' as const,
              }
            : undefined,
        ];
      }}
    >
      {({ pressed }) =>
        typeof children === 'function' ? children({ pressed, focused }) : children
      }
    </Pressable>
  );
}
