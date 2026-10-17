import { StyleSheet, View, type GestureResponderEvent } from 'react-native';
import { useTheme } from '../theme';
import { minTouchTarget, radii, spacing } from '../tokens';
import { Icon } from './Icon';
import { Text } from './Text';
import { Touchable } from './Touchable';

export interface ChipProps {
  label: string;
  /** When set the chip is a toggle (a filter). Leave undefined for a plain action chip. */
  selected?: boolean;
  onPress?: (event: GestureResponderEvent) => void;
  /** Shows a remove button after the label. */
  onRemove?: (event: GestureResponderEvent) => void;
  disabled?: boolean;
  testID?: string;
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    minHeight: minTouchTarget,
    borderRadius: radii.md,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  main: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    paddingStart: spacing.lg,
  },
  iconGap: { marginEnd: spacing.sm },
});

export function Chip({ label, selected, onPress, onRemove, disabled, testID }: ChipProps) {
  const theme = useTheme();
  const c = theme.colors;
  const isToggle = selected !== undefined;
  const on = selected === true;
  // D10: a chosen chip fills solid green with white text and a tick.
  const textColor = disabled ? 'disabledText' : on ? 'textOnAccent' : 'text';
  const fg = c[textColor];
  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: disabled ? c.disabledBackground : on ? c.accent : c.surface,
          borderColor: disabled ? c.disabledBackground : on ? c.accent : c.borderStrong,
        },
      ]}
    >
      <Touchable
        testID={testID}
        role={isToggle ? 'checkbox' : 'button'}
        checked={isToggle ? on : undefined}
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [
          styles.main,
          { paddingEnd: onRemove ? spacing.sm : spacing.lg },
          pressed ? { backgroundColor: on ? c.accentPressed : c.surfaceMuted } : undefined,
        ]}
      >
        {on ? (
          <View style={styles.iconGap}>
            <Icon name="check" size={16} color={fg} />
          </View>
        ) : null}
        <Text variant="label" color={textColor}>
          {label}
        </Text>
      </Touchable>
      {onRemove ? (
        <Touchable
          role="button"
          accessibilityLabel={theme.t('ui.remove', { name: label })}
          onPress={onRemove}
          disabled={disabled}
          style={{ alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="close" size={16} color={disabled ? c.disabledText : fg} />
        </Touchable>
      ) : null}
    </View>
  );
}
