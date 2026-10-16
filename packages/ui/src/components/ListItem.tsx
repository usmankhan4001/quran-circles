import type { ReactNode } from 'react';
import { StyleSheet, View, type GestureResponderEvent } from 'react-native';
import { useTheme } from '../theme';
import { spacing } from '../tokens';
import { Icon } from './Icon';
import { Text } from './Text';
import { Touchable } from './Touchable';

export interface ListItemProps {
  title: string;
  subtitle?: string;
  /** Shown before the text: an Avatar, an icon or a number. */
  leading?: ReactNode;
  /** Shown after the text: a Badge, a Switch or a value. */
  trailing?: ReactNode;
  onPress?: (event: GestureResponderEvent) => void;
  disabled?: boolean;
  selected?: boolean;
  /** `radio` makes a row of a single-choice list; `checked` is then its state. */
  role?: 'button' | 'radio';
  checked?: boolean;
  /** A forward chevron. Default: on when the row can be pressed. */
  chevron?: boolean;
  /** A hairline under the row. */
  divider?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  text: { flex: 1 },
  leading: { marginEnd: spacing.lg },
  trailing: { marginStart: spacing.md },
});

export function ListItem({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
  disabled,
  selected,
  role = 'button',
  checked,
  chevron,
  divider,
  accessibilityLabel,
  testID,
}: ListItemProps) {
  const theme = useTheme();
  const c = theme.colors;
  const showChevron = chevron ?? Boolean(onPress);
  const body = (
    <>
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.text}>
        <Text variant="body" color={disabled ? 'disabledText' : 'text'}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" color={disabled ? 'disabledText' : 'textSecondary'}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      {showChevron ? (
        <View style={styles.trailing}>
          <Icon
            name="chevron-forward"
            size={20}
            color={disabled ? c.disabledText : c.textSecondary}
          />
        </View>
      ) : null}
    </>
  );
  const border = divider ? { borderBottomWidth: 1, borderBottomColor: c.border } : undefined;
  if (!onPress) {
    return (
      <View
        testID={testID}
        aria-label={accessibilityLabel}
        style={[styles.row, border, selected ? { backgroundColor: c.accentSubtle } : undefined]}
      >
        {body}
      </View>
    );
  }
  return (
    <Touchable
      testID={testID}
      role={role}
      onPress={onPress}
      disabled={disabled}
      selected={role === 'button' ? selected : undefined}
      checked={role === 'radio' ? (checked ?? selected ?? false) : undefined}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.row,
        border,
        { backgroundColor: selected ? c.accentSubtle : pressed ? c.surfaceMuted : 'transparent' },
      ]}
    >
      {body}
    </Touchable>
  );
}
